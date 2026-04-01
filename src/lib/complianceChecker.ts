import type { Edge } from "@xyflow/react";
import type { InfraNode, InfraNodeType } from "@/store/useCanvasStore";

export type Severity = "critical" | "high" | "medium" | "low";

export interface ComplianceViolation {
  id: string;
  severity: Severity;
  title: string;
  description: string;
  affectedNodes: InfraNode[];
  recommendation: string;
  framework: string; // e.g., "SOC2", "HIPAA", "AWS Well-Architected"
}

export interface ComplianceReport {
  violations: ComplianceViolation[];
  passed: ComplianceCheck[];
  score: number; // 0-100
  summary: { critical: number; high: number; medium: number; low: number };
}

interface ComplianceCheck {
  title: string;
  framework: string;
}

type CheckFn = (nodes: InfraNode[], edges: Edge[]) => ComplianceViolation[];

// ── Individual checks ──

const checkNoFirewall: CheckFn = (nodes) => {
  const hasFirewall = nodes.some((n) => n.data.type === "firewall");
  if (hasFirewall) return [];
  const publicFacing = nodes.filter((n) =>
    ["load-balancer", "cdn", "api-gateway"].includes(n.data.type)
  );
  if (publicFacing.length === 0 && nodes.length > 0) {
    return [{
      id: "no-firewall-no-edge",
      severity: "high",
      title: "No network security layer",
      description: "Architecture has no firewall, WAF, or security group. All services may be directly exposed.",
      affectedNodes: nodes.slice(0, 3),
      recommendation: "Add a Firewall / WAF / Security Group node to protect your services.",
      framework: "AWS Well-Architected",
    }];
  }
  if (publicFacing.length > 0) {
    return [{
      id: "no-firewall",
      severity: "critical",
      title: "Public-facing services without WAF/Firewall",
      description: `${publicFacing.length} public-facing service(s) have no firewall or WAF protection.`,
      affectedNodes: publicFacing,
      recommendation: "Add a Firewall or WAF node in front of public-facing load balancers and API gateways.",
      framework: "OWASP / SOC2",
    }];
  }
  return [];
};

const checkDatabaseExposed: CheckFn = (nodes, edges) => {
  const dbs = nodes.filter((n) => n.data.type === "database");
  const violations: ComplianceViolation[] = [];

  for (const db of dbs) {
    // Check if DB is directly connected to a public-facing node
    const incomingSources = edges
      .filter((e) => e.target === db.id)
      .map((e) => nodes.find((n) => n.id === e.source))
      .filter(Boolean);

    const directlyExposed = incomingSources.some((n) =>
      n && ["load-balancer", "cdn", "api-gateway"].includes(n.data.type)
    );

    if (directlyExposed) {
      violations.push({
        id: `db-exposed-${db.id}`,
        severity: "critical",
        title: "Database directly connected to public entry point",
        description: `"${db.data.label}" is directly connected to a public-facing service with no application layer in between.`,
        affectedNodes: [db, ...incomingSources.filter((n): n is InfraNode => n !== undefined)],
        recommendation: "Route traffic through an application/API layer. Never expose databases directly to public endpoints.",
        framework: "HIPAA / PCI-DSS",
      });
    }
  }
  return violations;
};

const checkNoMonitoring: CheckFn = (nodes) => {
  const hasMon = nodes.some((n) => n.data.type === "monitoring");
  if (hasMon || nodes.length < 3) return [];
  return [{
    id: "no-monitoring",
    severity: "high",
    title: "No monitoring or observability",
    description: "Architecture has no monitoring, logging, or observability stack. Failures will go undetected.",
    affectedNodes: [],
    recommendation: "Add a Monitoring node (Prometheus, Grafana, CloudWatch, Datadog) connected to critical services.",
    framework: "AWS Well-Architected / SRE",
  }];
};

const checkSingleDatabase: CheckFn = (nodes) => {
  const dbs = nodes.filter((n) => n.data.type === "database");
  if (dbs.length !== 1) return [];
  return [{
    id: "single-db",
    severity: "high",
    title: "Single database with no replica",
    description: `"${dbs[0].data.label}" is the only database. If it fails, all data access is lost.`,
    affectedNodes: dbs,
    recommendation: "Add a read replica or standby database for failover. Consider multi-AZ deployment.",
    framework: "AWS Well-Architected / SOC2",
  }];
};

const checkNoCache: CheckFn = (nodes) => {
  const hasCache = nodes.some((n) => n.data.type === "cache");
  const hasDbs = nodes.some((n) => n.data.type === "database");
  const hasMultipleServices = nodes.filter((n) => ["docker", "kubernetes", "server"].includes(n.data.type)).length >= 2;
  if (hasCache || !hasDbs || !hasMultipleServices) return [];
  return [{
    id: "no-cache",
    severity: "medium",
    title: "No caching layer",
    description: "Multiple services hitting database directly with no caching layer. This causes unnecessary load and latency.",
    affectedNodes: nodes.filter((n) => n.data.type === "database"),
    recommendation: "Add a Redis or Memcached cache between application services and the database.",
    framework: "AWS Well-Architected",
  }];
};

const checkNoLoadBalancer: CheckFn = (nodes) => {
  const hasLB = nodes.some((n) => n.data.type === "load-balancer");
  const services = nodes.filter((n) => ["docker", "kubernetes", "server"].includes(n.data.type));
  if (hasLB || services.length < 2) return [];
  return [{
    id: "no-lb",
    severity: "medium",
    title: "Multiple services without load balancing",
    description: `${services.length} services deployed with no load balancer. Traffic distribution and failover not possible.`,
    affectedNodes: services,
    recommendation: "Add a Load Balancer node to distribute traffic across service instances.",
    framework: "AWS Well-Architected",
  }];
};

const checkNoEncryptionAtRest: CheckFn = (nodes) => {
  const storageNodes = nodes.filter((n) => ["database", "storage", "cache"].includes(n.data.type));
  if (storageNodes.length === 0) return [];
  // We can't actually check encryption from the visual graph — flag as advisory
  return [{
    id: "encryption-advisory",
    severity: "medium",
    title: "Ensure encryption at rest is enabled",
    description: `${storageNodes.length} data storage node(s) found. Verify that encryption at rest is configured for all.`,
    affectedNodes: storageNodes,
    recommendation: "Enable encryption at rest for all databases (RDS encryption), caches (ElastiCache at-rest encryption), and storage (S3 SSE-KMS).",
    framework: "HIPAA / PCI-DSS / SOC2",
  }];
};

const checkNoMultiAZ: CheckFn = (nodes) => {
  // Check for single instances of critical services
  const typeCount = new Map<InfraNodeType, InfraNode[]>();
  for (const n of nodes) {
    if (!typeCount.has(n.data.type)) typeCount.set(n.data.type, []);
    typeCount.get(n.data.type)!.push(n);
  }

  const criticalSingletons: InfraNode[] = [];
  const criticalTypes: InfraNodeType[] = ["load-balancer", "api-gateway", "cache"];
  for (const t of criticalTypes) {
    const group = typeCount.get(t);
    if (group && group.length === 1) {
      criticalSingletons.push(group[0]);
    }
  }

  if (criticalSingletons.length === 0) return [];
  return [{
    id: "no-multi-az",
    severity: "medium",
    title: "Critical services not redundant",
    description: `${criticalSingletons.length} critical service(s) have only a single instance. No high-availability guarantee.`,
    affectedNodes: criticalSingletons,
    recommendation: "Deploy critical services across multiple availability zones with auto-failover.",
    framework: "AWS Well-Architected",
  }];
};

const checkOrphanedNodes: CheckFn = (nodes, edges) => {
  const connected = new Set<string>();
  for (const e of edges) {
    connected.add(e.source);
    connected.add(e.target);
  }
  const orphans = nodes.filter((n) => !connected.has(n.id));
  if (orphans.length === 0) return [];
  return [{
    id: "orphaned-nodes",
    severity: "low",
    title: "Orphaned nodes detected",
    description: `${orphans.length} node(s) have no connections. They may be misconfigured or unnecessary.`,
    affectedNodes: orphans,
    recommendation: "Connect orphaned nodes to the architecture or remove them if unnecessary.",
    framework: "General",
  }];
};

// ── Checks that pass ──

function getPassedChecks(nodes: InfraNode[], edges: Edge[]): ComplianceCheck[] {
  const passed: ComplianceCheck[] = [];
  if (nodes.some((n) => n.data.type === "firewall")) passed.push({ title: "Firewall / WAF present", framework: "SOC2" });
  if (nodes.some((n) => n.data.type === "monitoring")) passed.push({ title: "Monitoring enabled", framework: "SRE" });
  if (nodes.some((n) => n.data.type === "load-balancer")) passed.push({ title: "Load balancing configured", framework: "Well-Architected" });
  if (nodes.some((n) => n.data.type === "cache")) passed.push({ title: "Caching layer present", framework: "Well-Architected" });
  if (nodes.filter((n) => n.data.type === "database").length >= 2) passed.push({ title: "Database redundancy", framework: "SOC2" });

  const connected = new Set<string>();
  for (const e of edges) { connected.add(e.source); connected.add(e.target); }
  if (nodes.length > 0 && nodes.every((n) => connected.has(n.id))) {
    passed.push({ title: "All nodes connected", framework: "General" });
  }

  return passed;
}

// ── Main runner ──

const ALL_CHECKS: CheckFn[] = [
  checkNoFirewall,
  checkDatabaseExposed,
  checkNoMonitoring,
  checkSingleDatabase,
  checkNoCache,
  checkNoLoadBalancer,
  checkNoEncryptionAtRest,
  checkNoMultiAZ,
  checkOrphanedNodes,
];

export function runComplianceChecks(
  nodes: InfraNode[],
  edges: Edge[]
): ComplianceReport {
  if (nodes.length === 0) {
    return { violations: [], passed: [], score: 100, summary: { critical: 0, high: 0, medium: 0, low: 0 } };
  }

  const violations = ALL_CHECKS.flatMap((check) => check(nodes, edges));
  const passed = getPassedChecks(nodes, edges);

  const summary = {
    critical: violations.filter((v) => v.severity === "critical").length,
    high: violations.filter((v) => v.severity === "high").length,
    medium: violations.filter((v) => v.severity === "medium").length,
    low: violations.filter((v) => v.severity === "low").length,
  };

  // Score: start at 100, deduct per severity
  let score = 100;
  score -= summary.critical * 20;
  score -= summary.high * 12;
  score -= summary.medium * 5;
  score -= summary.low * 2;
  score += passed.length * 5;
  score = Math.max(0, Math.min(100, score));

  return { violations, passed, score, summary };
}
