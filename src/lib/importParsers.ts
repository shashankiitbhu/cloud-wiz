import type { Edge } from "@xyflow/react";
import type { InfraNode, InfraNodeType } from "@/store/useCanvasStore";

interface ParseResult {
  nodes: InfraNode[];
  edges: Edge[];
  warnings: string[];
}

// ── Helpers ──

let nodeCounter = 0;
function nextId(prefix: string): string {
  return `${prefix}-${++nodeCounter}-${Math.random().toString(36).slice(2, 6)}`;
}

function makeNode(
  id: string,
  label: string,
  type: InfraNodeType,
  x: number,
  y: number
): InfraNode {
  return {
    id,
    type: "terminal",
    position: { x, y },
    data: { label, type },
  };
}

function makeEdge(source: string, target: string): Edge {
  return {
    id: `e-${source}-${target}`,
    source,
    target,
    style: { stroke: "#39FF14", strokeWidth: 1.5 },
  };
}

function autoLayout(nodes: InfraNode[]): InfraNode[] {
  const cols = Math.ceil(Math.sqrt(nodes.length));
  return nodes.map((n, i) => ({
    ...n,
    position: {
      x: 60 + (i % cols) * 280,
      y: 40 + Math.floor(i / cols) * 180,
    },
  }));
}

// ── Docker Compose Parser ──

function inferTypeFromImage(image: string): InfraNodeType {
  const img = image.toLowerCase();
  if (img.includes("postgres") || img.includes("mysql") || img.includes("mariadb") || img.includes("mongo")) return "database";
  if (img.includes("redis") || img.includes("memcached")) return "cache";
  if (img.includes("rabbitmq") || img.includes("kafka") || img.includes("nats")) return "queue";
  if (img.includes("nginx") || img.includes("haproxy") || img.includes("traefik") || img.includes("envoy")) return "load-balancer";
  if (img.includes("prometheus") || img.includes("grafana") || img.includes("jaeger") || img.includes("datadog")) return "monitoring";
  if (img.includes("minio") || img.includes("s3")) return "storage";
  if (img.includes("cloudflare") || img.includes("cdn")) return "cdn";
  return "docker";
}

export function parseDockerCompose(content: string): ParseResult {
  nodeCounter = 0;
  const warnings: string[] = [];
  const nodes: InfraNode[] = [];
  const edges: Edge[] = [];
  const nodeIdMap = new Map<string, string>();

  // Simple YAML-ish parser for docker-compose — handles the common patterns
  const lines = content.split("\n");
  let inServices = false;
  let currentService: string | null = null;
  let currentImage = "";
  let currentDepends: string[] = [];
  let currentIndent = 0;

  const flushService = () => {
    if (!currentService) return;
    const id = nextId("dc");
    const type = currentImage ? inferTypeFromImage(currentImage) : "docker";
    const label = currentService.replace(/_/g, " ").replace(/-/g, " ");
    nodes.push(makeNode(id, label, type, 0, 0));
    nodeIdMap.set(currentService, id);

    for (const dep of currentDepends) {
      const depId = nodeIdMap.get(dep);
      if (depId) edges.push(makeEdge(depId, id));
    }

    currentService = null;
    currentImage = "";
    currentDepends = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    const indent = line.length - line.trimStart().length;

    if (trimmed === "services:" || trimmed.startsWith("services:")) {
      inServices = true;
      currentIndent = indent;
      continue;
    }

    if (inServices && indent <= currentIndent && trimmed.includes(":") && !trimmed.startsWith("-")) {
      // We've left the services block
      if (!trimmed.endsWith(":") || indent <= currentIndent) {
        flushService();
        inServices = false;
        continue;
      }
    }

    if (inServices) {
      // Service name (indent level 2 usually)
      if (indent === currentIndent + 2 && trimmed.endsWith(":") && !trimmed.startsWith("-")) {
        flushService();
        currentService = trimmed.replace(":", "").trim();
        continue;
      }

      // Image
      const imageMatch = trimmed.match(/^image:\s*['"]?([^'"]+)['"]?/);
      if (imageMatch && currentService) {
        currentImage = imageMatch[1];
        continue;
      }

      // depends_on
      if (trimmed.startsWith("- ") && currentService) {
        const dep = trimmed.replace(/^-\s*/, "").replace(/:.*/, "").trim();
        if (dep && !dep.includes(":")) {
          currentDepends.push(dep);
        }
      }
    }
  }
  flushService();

  // Resolve remaining dependency edges
  for (const [serviceName, nodeId] of nodeIdMap) {
    // Second pass for depends_on we might have missed
    const serviceNode = nodes.find((n) => n.id === nodeId);
    if (serviceNode) {
      // try to find depends_on references in the raw text
    }
  }

  if (nodes.length === 0) {
    warnings.push("No services found. Check your docker-compose format.");
  }

  return { nodes: autoLayout(nodes), edges, warnings };
}

// ── Kubernetes YAML Parser ──

function inferTypeFromK8sKind(kind: string, name: string): InfraNodeType {
  const n = name.toLowerCase();
  if (kind === "Ingress") return "api-gateway";
  if (kind === "NetworkPolicy") return "firewall";
  if (kind === "Service" && n.includes("lb")) return "load-balancer";
  if (kind === "Service" && (n.includes("loadbalancer") || n.includes("load-balancer"))) return "load-balancer";
  if (n.includes("postgres") || n.includes("mysql") || n.includes("mongo") || n.includes("db")) return "database";
  if (n.includes("redis") || n.includes("cache") || n.includes("memcached")) return "cache";
  if (n.includes("rabbit") || n.includes("kafka") || n.includes("queue") || n.includes("nats")) return "queue";
  if (n.includes("prometheus") || n.includes("grafana") || n.includes("monitor") || n.includes("jaeger")) return "monitoring";
  if (n.includes("minio") || n.includes("s3") || n.includes("storage")) return "storage";
  if (n.includes("nginx") || n.includes("haproxy") || n.includes("traefik")) return "load-balancer";
  if (kind === "StatefulSet") return "database";
  if (kind === "DaemonSet") return "monitoring";
  return "kubernetes";
}

export function parseKubernetesYaml(content: string): ParseResult {
  nodeCounter = 0;
  const warnings: string[] = [];
  const nodes: InfraNode[] = [];
  const edges: Edge[] = [];
  const selectorMap = new Map<string, string>(); // app label → nodeId

  // Split on --- for multi-document YAML
  const documents = content.split(/^---$/m).filter((d) => d.trim());

  for (const doc of documents) {
    const lines = doc.split("\n");
    let kind = "";
    let name = "";
    let appLabel = "";
    let selectorApp = "";

    for (const line of lines) {
      const trimmed = line.trim();
      const kindMatch = trimmed.match(/^kind:\s*(.+)/);
      if (kindMatch) kind = kindMatch[1].trim();

      const nameMatch = trimmed.match(/^name:\s*['"]?([^'"]+)['"]?/);
      if (nameMatch && !name) name = nameMatch[1].trim();

      const appMatch = trimmed.match(/app:\s*['"]?([^'"]+)['"]?/);
      if (appMatch) {
        if (!appLabel) appLabel = appMatch[1].trim();
        selectorApp = appMatch[1].trim();
      }
    }

    if (!kind || !name) continue;

    // Skip ConfigMaps, Secrets, ServiceAccounts unless they're interesting
    if (["ConfigMap", "Secret", "ServiceAccount", "ClusterRole", "ClusterRoleBinding", "Role", "RoleBinding"].includes(kind)) continue;

    const id = nextId("k8s");
    const type = inferTypeFromK8sKind(kind, name);
    const label = `${name} (${kind})`;
    nodes.push(makeNode(id, label, type, 0, 0));

    if (appLabel) selectorMap.set(appLabel, id);

    // If this is a Service, link it to the matching Deployment
    if (kind === "Service" && selectorApp) {
      const targetId = selectorMap.get(selectorApp);
      if (targetId && targetId !== id) {
        edges.push(makeEdge(id, targetId));
      }
    }
  }

  if (nodes.length === 0) {
    warnings.push("No Kubernetes resources found. Check your YAML format.");
  }

  return { nodes: autoLayout(nodes), edges, warnings };
}

// ── Terraform Parser ──

function inferTypeFromTfResource(resourceType: string, name: string): InfraNodeType {
  const rt = resourceType.toLowerCase();
  const n = name.toLowerCase();
  if (rt.includes("lb") || rt.includes("load_balancer") || rt.includes("alb") || rt.includes("elb")) return "load-balancer";
  if (rt.includes("db_instance") || rt.includes("rds") || rt.includes("dynamodb") || rt.includes("sql_database")) return "database";
  if (rt.includes("elasticache") || rt.includes("memorystore")) return "cache";
  if (rt.includes("sqs") || rt.includes("sns") || rt.includes("pubsub") || rt.includes("queue")) return "queue";
  if (rt.includes("s3") || rt.includes("storage_bucket") || rt.includes("blob")) return "storage";
  if (rt.includes("cloudfront") || rt.includes("cdn")) return "cdn";
  if (rt.includes("security_group") || rt.includes("firewall") || rt.includes("waf")) return "firewall";
  if (rt.includes("apigateway") || rt.includes("api_gateway")) return "api-gateway";
  if (rt.includes("ecs") || rt.includes("container") || rt.includes("cloud_run")) return "docker";
  if (rt.includes("eks") || rt.includes("gke") || rt.includes("aks") || rt.includes("kubernetes")) return "kubernetes";
  if (rt.includes("cloudwatch") || rt.includes("monitoring") || rt.includes("log_group")) return "monitoring";
  if (rt.includes("instance") || rt.includes("compute")) return "server";
  if (n.includes("monitor") || n.includes("alert")) return "monitoring";
  return "server";
}

export function parseTerraform(content: string): ParseResult {
  nodeCounter = 0;
  const warnings: string[] = [];
  const nodes: InfraNode[] = [];
  const edges: Edge[] = [];
  const refMap = new Map<string, string>(); // terraform ref (type.name) → nodeId

  // Match resource blocks: resource "type" "name" {
  const resourceRegex = /resource\s+"([^"]+)"\s+"([^"]+)"\s*\{/g;
  let match;
  const resources: { type: string; name: string; fullRef: string; startIdx: number }[] = [];

  while ((match = resourceRegex.exec(content)) !== null) {
    resources.push({
      type: match[1],
      name: match[2],
      fullRef: `${match[1]}.${match[2]}`,
      startIdx: match.index,
    });
  }

  for (const res of resources) {
    const id = nextId("tf");
    const infraType = inferTypeFromTfResource(res.type, res.name);
    const label = res.name.replace(/_/g, " ");
    nodes.push(makeNode(id, label, infraType, 0, 0));
    refMap.set(res.fullRef, id);
    refMap.set(res.name, id);
  }

  // Find references between resources
  for (let i = 0; i < resources.length; i++) {
    const res = resources[i];
    const end = i + 1 < resources.length ? resources[i + 1].startIdx : content.length;
    const block = content.slice(res.startIdx, end);
    const sourceId = refMap.get(res.fullRef);
    if (!sourceId) continue;

    // Find references like aws_lb.main.arn or var refs pointing to other resources
    for (const [ref, targetId] of refMap) {
      if (ref === res.fullRef || ref === res.name) continue;
      if (block.includes(ref) && targetId !== sourceId) {
        // Avoid duplicate edges
        const edgeId = `e-${sourceId}-${targetId}`;
        if (!edges.find((e) => e.id === edgeId)) {
          edges.push(makeEdge(sourceId, targetId));
        }
      }
    }
  }

  if (nodes.length === 0) {
    warnings.push("No Terraform resources found. Check your .tf format.");
  }

  return { nodes: autoLayout(nodes), edges, warnings };
}

// ── Auto-detect and parse ──

export function detectAndParse(content: string, filename?: string): ParseResult {
  const lower = content.toLowerCase();
  const ext = filename?.split(".").pop()?.toLowerCase();

  // By extension
  if (ext === "tf" || ext === "tfvars") return parseTerraform(content);
  if (ext === "yaml" || ext === "yml") {
    if (lower.includes("services:") && (lower.includes("image:") || lower.includes("build:"))) {
      return parseDockerCompose(content);
    }
    return parseKubernetesYaml(content);
  }

  // By content
  if (lower.includes("resource \"") && lower.includes("provider \"")) return parseTerraform(content);
  if (lower.includes("resource \"")) return parseTerraform(content);
  if (lower.includes("services:") && (lower.includes("image:") || lower.includes("build:"))) return parseDockerCompose(content);
  if (lower.includes("apiversion:") && lower.includes("kind:")) return parseKubernetesYaml(content);

  return { nodes: [], edges: [], warnings: ["Could not detect file format. Supported: docker-compose.yml, Kubernetes YAML, Terraform (.tf)"] };
}
