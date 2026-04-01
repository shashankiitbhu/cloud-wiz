import type { InfraNode, InfraNodeType } from "@/store/useCanvasStore";

function sanitizeName(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40);
}

function deploymentYaml(name: string, image: string, port: number): string {
  return `apiVersion: apps/v1
kind: Deployment
metadata:
  name: ${name}
  labels:
    app: ${name}
spec:
  replicas: 2
  selector:
    matchLabels:
      app: ${name}
  template:
    metadata:
      labels:
        app: ${name}
    spec:
      containers:
        - name: ${name}
          image: ${image}
          ports:
            - containerPort: ${port}
          resources:
            requests:
              memory: "128Mi"
              cpu: "250m"
            limits:
              memory: "256Mi"
              cpu: "500m"
---
apiVersion: v1
kind: Service
metadata:
  name: ${name}-svc
spec:
  selector:
    app: ${name}
  ports:
    - port: ${port}
      targetPort: ${port}
  type: ClusterIP`;
}

function statefulSetYaml(name: string, image: string, port: number, storage: string): string {
  return `apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: ${name}
  labels:
    app: ${name}
spec:
  serviceName: ${name}
  replicas: 1
  selector:
    matchLabels:
      app: ${name}
  template:
    metadata:
      labels:
        app: ${name}
    spec:
      containers:
        - name: ${name}
          image: ${image}
          ports:
            - containerPort: ${port}
          volumeMounts:
            - name: ${name}-data
              mountPath: /data
  volumeClaimTemplates:
    - metadata:
        name: ${name}-data
      spec:
        accessModes: ["ReadWriteOnce"]
        resources:
          requests:
            storage: ${storage}
---
apiVersion: v1
kind: Service
metadata:
  name: ${name}-svc
spec:
  selector:
    app: ${name}
  ports:
    - port: ${port}
      targetPort: ${port}
  type: ClusterIP`;
}

function ingressYaml(name: string): string {
  return `apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: ${name}
  annotations:
    nginx.ingress.kubernetes.io/rewrite-target: /
spec:
  rules:
    - host: app.example.com
      http:
        paths:
          - path: /
            pathType: Prefix
            backend:
              service:
                name: ${name}-svc
                port:
                  number: 80`;
}

const TYPE_MAP: Record<InfraNodeType, (name: string) => string> = {
  docker: (n) => deploymentYaml(n, `${n}:latest`, 8080),
  kubernetes: (n) => deploymentYaml(n, `${n}:latest`, 8080),
  server: (n) => deploymentYaml(n, `${n}:latest`, 8080),
  "api-gateway": (n) => ingressYaml(n),
  "load-balancer": (n) =>
    `apiVersion: v1
kind: Service
metadata:
  name: ${n}-lb
spec:
  type: LoadBalancer
  selector:
    app: ${n}
  ports:
    - port: 80
      targetPort: 8080`,
  database: (n) => statefulSetYaml(n, "postgres:16-alpine", 5432, "10Gi"),
  cache: (n) => statefulSetYaml(n, "redis:7-alpine", 6379, "1Gi"),
  queue: (n) => statefulSetYaml(n, "rabbitmq:3-management-alpine", 5672, "5Gi"),
  storage: (n) =>
    `# S3-compatible storage — use external service or MinIO
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ${n}
spec:
  replicas: 1
  selector:
    matchLabels:
      app: ${n}
  template:
    metadata:
      labels:
        app: ${n}
    spec:
      containers:
        - name: minio
          image: minio/minio:latest
          args: ["server", "/data"]
          ports:
            - containerPort: 9000
          volumeMounts:
            - name: data
              mountPath: /data
      volumes:
        - name: data
          emptyDir: {}`,
  cdn: (n) =>
    `# CDN is typically external (CloudFront, Cloudflare)
# Placeholder config map for CDN origin
apiVersion: v1
kind: ConfigMap
metadata:
  name: ${n}-config
data:
  CDN_ORIGIN: "https://origin.example.com"`,
  firewall: (n) =>
    `apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: ${n}
spec:
  podSelector: {}
  policyTypes:
    - Ingress
    - Egress
  ingress:
    - from:
        - namespaceSelector:
            matchLabels:
              role: trusted`,
  monitoring: (n) => deploymentYaml(n, "prom/prometheus:latest", 9090),
};

export function generateK8sYaml(nodes: InfraNode[]): string {
  if (nodes.length === 0) return "# No nodes to generate YAML for";

  const sections = nodes.map((node) => {
    const name = sanitizeName(node.data.label);
    const generator = TYPE_MAP[node.data.type] || TYPE_MAP.server;
    return `# ── ${node.data.label} (${node.data.type}) ──\n${generator(name)}`;
  });

  return sections.join("\n---\n");
}
