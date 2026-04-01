import type { Edge } from "@xyflow/react";
import type { InfraNode } from "@/store/useCanvasStore";

export interface ArchTemplate {
  id: string;
  name: string;
  description: string;
  tags: string[];
  nodes: InfraNode[];
  edges: Edge[];
}

const E = (src: string, tgt: string): Edge => ({
  id: `e-${src}-${tgt}`,
  source: src,
  target: tgt,
  style: { stroke: "#39FF14", strokeWidth: 1.5 },
});

const N = (
  id: string,
  label: string,
  type: string,
  x: number,
  y: number
): InfraNode => ({
  id,
  type: "terminal",
  position: { x, y },
  data: { label, type: type as InfraNode["data"]["type"] },
});

export const TEMPLATES: ArchTemplate[] = [
  {
    id: "three-tier",
    name: "3-Tier Web App",
    description: "Classic load balancer → app servers → database pattern with caching and monitoring.",
    tags: ["web", "classic", "beginner"],
    nodes: [
      N("cdn", "CloudFront CDN", "cdn", 400, 0),
      N("lb", "Application LB", "load-balancer", 400, 150),
      N("web1", "Web Server 1", "docker", 150, 310),
      N("web2", "Web Server 2", "docker", 400, 310),
      N("web3", "Web Server 3", "docker", 650, 310),
      N("cache", "Redis Cache", "cache", 150, 480),
      N("db-primary", "Postgres Primary", "database", 400, 480),
      N("db-replica", "Postgres Replica", "database", 650, 480),
      N("s3", "Static Assets (S3)", "storage", 150, 630),
      N("mon", "Monitoring", "monitoring", 650, 630),
    ],
    edges: [
      E("cdn", "lb"), E("lb", "web1"), E("lb", "web2"), E("lb", "web3"),
      E("web1", "cache"), E("web2", "cache"), E("web2", "db-primary"),
      E("web3", "db-primary"), E("db-primary", "db-replica"),
      E("web1", "s3"), E("db-primary", "mon"), E("cache", "mon"),
    ],
  },
  {
    id: "microservices",
    name: "Event-Driven Microservices",
    description: "API Gateway → microservices communicating via message queue with independent databases.",
    tags: ["microservices", "event-driven", "scalable"],
    nodes: [
      N("gw", "API Gateway", "api-gateway", 400, 0),
      N("auth", "Auth Service", "docker", 100, 160),
      N("user", "User Service", "docker", 350, 160),
      N("order", "Order Service", "docker", 600, 160),
      N("notify", "Notification Service", "docker", 850, 160),
      N("queue", "RabbitMQ", "queue", 475, 330),
      N("auth-db", "Auth DB", "database", 100, 490),
      N("user-db", "User DB", "database", 350, 490),
      N("order-db", "Order DB", "database", 600, 490),
      N("cache", "Redis Cache", "cache", 850, 330),
      N("mon", "Prometheus + Grafana", "monitoring", 100, 630),
      N("s3", "Document Store (S3)", "storage", 600, 630),
    ],
    edges: [
      E("gw", "auth"), E("gw", "user"), E("gw", "order"),
      E("order", "queue"), E("queue", "notify"), E("queue", "order"),
      E("auth", "auth-db"), E("user", "user-db"), E("order", "order-db"),
      E("user", "cache"), E("auth", "cache"),
      E("order", "s3"), E("auth", "mon"), E("user", "mon"), E("order", "mon"),
    ],
  },
  {
    id: "data-pipeline",
    name: "Data Pipeline",
    description: "Ingest → process → store → serve pattern for real-time and batch analytics.",
    tags: ["data", "analytics", "etl"],
    nodes: [
      N("ingest", "API Ingestion", "api-gateway", 100, 0),
      N("stream", "Kafka Stream", "queue", 400, 0),
      N("iot", "IoT Gateway", "server", 700, 0),
      N("processor", "Stream Processor", "docker", 250, 170),
      N("batch", "Batch Processor", "kubernetes", 550, 170),
      N("lake", "Data Lake (S3)", "storage", 100, 340),
      N("warehouse", "Data Warehouse", "database", 400, 340),
      N("cache", "Query Cache", "cache", 700, 340),
      N("api", "Analytics API", "docker", 400, 500),
      N("dashboard", "Dashboard", "monitoring", 400, 650),
      N("ml", "ML Pipeline", "kubernetes", 700, 500),
    ],
    edges: [
      E("ingest", "stream"), E("iot", "stream"),
      E("stream", "processor"), E("stream", "batch"),
      E("processor", "warehouse"), E("batch", "lake"),
      E("lake", "warehouse"), E("warehouse", "cache"),
      E("warehouse", "api"), E("cache", "api"),
      E("api", "dashboard"), E("lake", "ml"), E("ml", "warehouse"),
    ],
  },
  {
    id: "ml-serving",
    name: "ML Model Serving",
    description: "Model training pipeline with A/B serving, feature store, and monitoring.",
    tags: ["ml", "ai", "model-serving"],
    nodes: [
      N("lb", "Load Balancer", "load-balancer", 400, 0),
      N("gw", "API Gateway", "api-gateway", 400, 150),
      N("model-a", "Model A (Production)", "docker", 200, 310),
      N("model-b", "Model B (Canary)", "docker", 600, 310),
      N("features", "Feature Store", "cache", 100, 480),
      N("training-db", "Training Data (S3)", "storage", 400, 480),
      N("model-reg", "Model Registry", "storage", 700, 480),
      N("trainer", "Training Pipeline", "kubernetes", 400, 640),
      N("mon", "ML Metrics / Drift", "monitoring", 700, 640),
      N("queue", "Prediction Queue", "queue", 100, 310),
    ],
    edges: [
      E("lb", "gw"), E("gw", "model-a"), E("gw", "model-b"),
      E("gw", "queue"), E("queue", "model-a"),
      E("model-a", "features"), E("model-b", "features"),
      E("training-db", "trainer"), E("trainer", "model-reg"),
      E("model-reg", "model-a"), E("model-reg", "model-b"),
      E("model-a", "mon"), E("model-b", "mon"),
    ],
  },
  {
    id: "serverless",
    name: "Serverless Architecture",
    description: "CDN → API Gateway → Lambda functions with DynamoDB, S3, and SQS.",
    tags: ["serverless", "aws", "lambda"],
    nodes: [
      N("cdn", "CloudFront", "cdn", 400, 0),
      N("gw", "API Gateway", "api-gateway", 400, 150),
      N("auth-fn", "Auth Lambda", "server", 150, 310),
      N("api-fn", "API Lambda", "server", 400, 310),
      N("worker-fn", "Worker Lambda", "server", 650, 310),
      N("dynamo", "DynamoDB", "database", 250, 480),
      N("s3", "S3 Bucket", "storage", 550, 480),
      N("queue", "SQS Queue", "queue", 650, 480),
      N("mon", "CloudWatch", "monitoring", 400, 630),
    ],
    edges: [
      E("cdn", "gw"), E("gw", "auth-fn"), E("gw", "api-fn"),
      E("api-fn", "dynamo"), E("api-fn", "s3"),
      E("api-fn", "queue"), E("queue", "worker-fn"),
      E("worker-fn", "s3"), E("worker-fn", "dynamo"),
      E("auth-fn", "dynamo"), E("api-fn", "mon"), E("worker-fn", "mon"),
    ],
  },
  {
    id: "k8s-production",
    name: "Production Kubernetes",
    description: "Full K8s cluster with ingress, service mesh, observability stack, and GitOps.",
    tags: ["kubernetes", "production", "devops"],
    nodes: [
      N("ingress", "Ingress Controller", "load-balancer", 400, 0),
      N("mesh", "Service Mesh (Istio)", "firewall", 400, 150),
      N("frontend", "Frontend Pods", "kubernetes", 150, 310),
      N("backend", "Backend Pods", "kubernetes", 400, 310),
      N("worker", "Worker Pods", "kubernetes", 650, 310),
      N("db", "PostgreSQL StatefulSet", "database", 250, 480),
      N("redis", "Redis Cluster", "cache", 550, 480),
      N("queue", "NATS Streaming", "queue", 750, 480),
      N("prom", "Prometheus", "monitoring", 100, 640),
      N("grafana", "Grafana", "monitoring", 300, 640),
      N("loki", "Loki Logs", "monitoring", 500, 640),
      N("s3", "Persistent Volumes", "storage", 700, 640),
    ],
    edges: [
      E("ingress", "mesh"), E("mesh", "frontend"), E("mesh", "backend"), E("mesh", "worker"),
      E("frontend", "backend"), E("backend", "db"), E("backend", "redis"),
      E("worker", "queue"), E("worker", "redis"),
      E("db", "s3"), E("backend", "prom"), E("worker", "prom"),
      E("prom", "grafana"), E("prom", "loki"),
    ],
  },
];
