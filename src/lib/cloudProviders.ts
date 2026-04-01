import type { CloudProvider, InfraNodeType } from "@/store/useCanvasStore";

// ── Provider display names ─────────────────────────────

export const CLOUD_LABELS: Record<CloudProvider, string> = {
  aws: "AWS",
  digitalocean: "DigitalOcean",
  "local-k8s": "Local K8s",
};

export const CLOUD_TAGS: Record<CloudProvider, string> = {
  aws: "Enterprise",
  digitalocean: "Startup",
  "local-k8s": "Testing",
};

// ── Node label mapping per provider ────────────────────

// Provider-specific service prefixes per node type.
// The original node label is appended to give context-aware names
// e.g. "MongoDB" + aws/database → "Amazon RDS — MongoDB"
const NODE_PREFIXES: Record<CloudProvider, Partial<Record<InfraNodeType, string>>> = {
  aws: {
    "load-balancer": "AWS ALB",
    "api-gateway": "API Gateway (AWS)",
    docker: "ECS Fargate",
    kubernetes: "EKS Node Group",
    server: "EC2 Instance",
    database: "Amazon RDS",
    cache: "ElastiCache",
    queue: "Amazon SQS",
    storage: "S3 Bucket",
    cdn: "CloudFront",
    firewall: "Security Group",
    monitoring: "CloudWatch",
  },
  digitalocean: {
    "load-balancer": "DO Load Balancer",
    "api-gateway": "DO App Platform",
    docker: "DO App Platform",
    kubernetes: "DOKS Node Pool",
    server: "DO Droplet",
    database: "DO Managed DB",
    cache: "DO Managed Cache",
    queue: "RabbitMQ Droplet",
    storage: "DO Spaces",
    cdn: "DO CDN",
    firewall: "DO Cloud Firewall",
    monitoring: "DO Monitoring",
  },
  "local-k8s": {
    "load-balancer": "Ingress Controller",
    "api-gateway": "K8s Ingress",
    docker: "Deployment Pod",
    kubernetes: "K8s Deployment",
    server: "Deployment Pod",
    database: "StatefulSet",
    cache: "StatefulSet",
    queue: "StatefulSet",
    storage: "PersistentVolumeClaim",
    cdn: "Nginx Proxy Cache",
    firewall: "NetworkPolicy",
    monitoring: "Prometheus",
  },
};

export function getProviderLabel(
  cloud: CloudProvider,
  nodeType: InfraNodeType,
  fallbackLabel: string
): string {
  const prefix = NODE_PREFIXES[cloud]?.[nodeType];
  if (!prefix) return fallbackLabel;
  return `${prefix} — ${fallbackLabel}`;
}

// ── Terraform generators per provider ──────────────────

function sanitize(label: string, sep: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, sep)
    .replace(new RegExp(`^\\${sep}|\\${sep}$`, "g"), "")
    .slice(0, 40);
}

type TfGen = (name: string, label: string) => string;

// ── AWS Terraform ──────────────────────────────────────

const AWS_TF: Record<InfraNodeType, TfGen> = {
  "load-balancer": (n, l) => `# ${l}
resource "aws_lb" "${n}" {
  name               = "${n}"
  internal           = false
  load_balancer_type = "application"
  security_groups    = [aws_security_group.${n}_sg.id]
  subnets            = var.public_subnets
  tags = { Name = "${l}" }
}`,
  "api-gateway": (n, l) => `# ${l}
resource "aws_apigatewayv2_api" "${n}" {
  name          = "${n}"
  protocol_type = "HTTP"
  description   = "${l}"
}`,
  docker: (n, l) => `# ${l}
resource "aws_ecs_task_definition" "${n}" {
  family                   = "${n}"
  requires_compatibilities = ["FARGATE"]
  network_mode             = "awsvpc"
  cpu                      = "256"
  memory                   = "512"
  container_definitions = jsonencode([{
    name  = "${n}"
    image = "${n}:latest"
    portMappings = [{ containerPort = 8080 }]
  }])
}
resource "aws_ecs_service" "${n}_svc" {
  name            = "${n}"
  cluster         = aws_ecs_cluster.main.id
  task_definition = aws_ecs_task_definition.${n}.arn
  desired_count   = 2
  launch_type     = "FARGATE"
}`,
  kubernetes: (n, l) => `# ${l}
resource "aws_eks_node_group" "${n}" {
  cluster_name    = aws_eks_cluster.main.name
  node_group_name = "${n}"
  node_role_arn   = aws_iam_role.eks_nodes.arn
  subnet_ids      = var.private_subnets
  scaling_config { desired_size = 2; max_size = 5; min_size = 1 }
  instance_types = ["t3.medium"]
  tags = { Name = "${l}" }
}`,
  server: (n, l) => `# ${l}
resource "aws_instance" "${n}" {
  ami           = var.ami_id
  instance_type = "t3.medium"
  subnet_id     = var.private_subnets[0]
  tags = { Name = "${l}" }
}`,
  database: (n, l) => `# ${l}
resource "aws_db_instance" "${n}" {
  identifier        = "${n}"
  engine            = "postgres"
  engine_version    = "16.1"
  instance_class    = "db.t3.medium"
  allocated_storage = 20
  db_name           = "${n.replace(/_/g, "")}"
  username          = "admin"
  password          = var.db_password
  skip_final_snapshot = true
  tags = { Name = "${l}" }
}`,
  cache: (n, l) => `# ${l}
resource "aws_elasticache_cluster" "${n}" {
  cluster_id      = "${n}"
  engine          = "redis"
  node_type       = "cache.t3.micro"
  num_cache_nodes = 1
  port            = 6379
  tags = { Name = "${l}" }
}`,
  queue: (n, l) => `# ${l}
resource "aws_sqs_queue" "${n}" {
  name                      = "${n}"
  message_retention_seconds = 345600
  receive_wait_time_seconds = 10
  tags = { Name = "${l}" }
}`,
  storage: (n, l) => `# ${l}
resource "aws_s3_bucket" "${n}" {
  bucket = "${n}-\${var.environment}"
  tags   = { Name = "${l}" }
}`,
  cdn: (n, l) => `# ${l}
resource "aws_cloudfront_distribution" "${n}" {
  enabled = true
  comment = "${l}"
  origin {
    domain_name = aws_s3_bucket.origin.bucket_regional_domain_name
    origin_id   = "${n}-origin"
  }
  default_cache_behavior {
    allowed_methods        = ["GET", "HEAD"]
    cached_methods         = ["GET", "HEAD"]
    target_origin_id       = "${n}-origin"
    viewer_protocol_policy = "redirect-to-https"
    forwarded_values { query_string = false; cookies { forward = "none" } }
  }
  restrictions { geo_restriction { restriction_type = "none" } }
  viewer_certificate { cloudfront_default_certificate = true }
  tags = { Name = "${l}" }
}`,
  firewall: (n, l) => `# ${l}
resource "aws_security_group" "${n}" {
  name   = "${n}"
  vpc_id = var.vpc_id
  ingress { from_port = 443; to_port = 443; protocol = "tcp"; cidr_blocks = ["0.0.0.0/0"] }
  egress  { from_port = 0; to_port = 0; protocol = "-1"; cidr_blocks = ["0.0.0.0/0"] }
  tags = { Name = "${l}" }
}`,
  monitoring: (n, l) => `# ${l}
resource "aws_cloudwatch_dashboard" "${n}" {
  dashboard_name = "${n}"
  dashboard_body = jsonencode({ widgets = [] })
}`,
};

// ── DigitalOcean Terraform ─────────────────────────────

const DO_TF: Record<InfraNodeType, TfGen> = {
  "load-balancer": (n, l) => `# ${l}
resource "digitalocean_loadbalancer" "${n}" {
  name   = "${n}"
  region = var.region
  forwarding_rule {
    entry_port     = 80
    entry_protocol = "http"
    target_port     = 8080
    target_protocol = "http"
  }
  droplet_tag = "${n}"
}`,
  "api-gateway": (n, l) => `# ${l} — use App Platform with routing
resource "digitalocean_app" "${n}" {
  spec {
    name   = "${n}"
    region = var.region
    ingress { rule { match { path { prefix = "/api" } } } }
  }
}`,
  docker: (n, l) => `# ${l}
resource "digitalocean_app" "${n}" {
  spec {
    name   = "${n}"
    region = var.region
    service {
      name               = "${n}"
      instance_count     = 2
      instance_size_slug = "basic-xxs"
      image { registry_type = "DOCKER_HUB"; registry = "${n}"; repository = "${n}"; tag = "latest" }
    }
  }
}`,
  kubernetes: (n, l) => `# ${l}
resource "digitalocean_kubernetes_node_pool" "${n}" {
  cluster_id = digitalocean_kubernetes_cluster.main.id
  name       = "${n}"
  size       = "s-2vcpu-4gb"
  node_count = 2
  tags       = ["${l}"]
}`,
  server: (n, l) => `# ${l}
resource "digitalocean_droplet" "${n}" {
  name   = "${n}"
  image  = "ubuntu-22-04-x64"
  size   = "s-2vcpu-4gb"
  region = var.region
  tags   = ["${l}"]
}`,
  database: (n, l) => `# ${l}
resource "digitalocean_database_cluster" "${n}" {
  name       = "${n}"
  engine     = "pg"
  version    = "16"
  size       = "db-s-1vcpu-2gb"
  region     = var.region
  node_count = 1
  tags       = ["${l}"]
}`,
  cache: (n, l) => `# ${l}
resource "digitalocean_database_cluster" "${n}" {
  name       = "${n}"
  engine     = "redis"
  version    = "7"
  size       = "db-s-1vcpu-1gb"
  region     = var.region
  node_count = 1
}`,
  queue: (n, l) => `# ${l} — RabbitMQ on Droplet
resource "digitalocean_droplet" "${n}" {
  name   = "${n}"
  image  = "ubuntu-22-04-x64"
  size   = "s-1vcpu-2gb"
  region = var.region
  user_data = "#!/bin/bash\\napt-get update && apt-get install -y rabbitmq-server"
}`,
  storage: (n, l) => `# ${l}
resource "digitalocean_spaces_bucket" "${n}" {
  name   = "${n}"
  region = var.region
  acl    = "private"
}`,
  cdn: (n, l) => `# ${l}
resource "digitalocean_cdn" "${n}" {
  origin = digitalocean_spaces_bucket.${n}.bucket_domain_name
}`,
  firewall: (n, l) => `# ${l}
resource "digitalocean_firewall" "${n}" {
  name = "${n}"
  inbound_rule {
    protocol         = "tcp"
    port_range       = "443"
    source_addresses = ["0.0.0.0/0"]
  }
  outbound_rule {
    protocol              = "tcp"
    port_range            = "all"
    destination_addresses = ["0.0.0.0/0"]
  }
  tags = ["${l}"]
}`,
  monitoring: (n, l) => `# ${l}
resource "digitalocean_monitor_alert" "${n}" {
  alerts { email = ["ops@example.com"] }
  window      = "5m"
  type        = "v1/insights/droplet/cpu"
  compare     = "GreaterThan"
  value       = 80
  enabled     = true
  description = "${l}"
}`,
};

// ── Local K8s (plain Kubernetes manifests as HCL comments) ─

const K8S_TF: Record<InfraNodeType, TfGen> = {
  "load-balancer": (n, l) => `# ${l}
resource "kubernetes_service" "${n}" {
  metadata { name = "${n}" }
  spec {
    type = "LoadBalancer"
    selector = { app = "${n}" }
    port { port = 80; target_port = 8080 }
  }
}`,
  "api-gateway": (n, l) => `# ${l}
resource "kubernetes_ingress_v1" "${n}" {
  metadata {
    name = "${n}"
    annotations = { "nginx.ingress.kubernetes.io/rewrite-target" = "/" }
  }
  spec {
    rule {
      host = "app.local"
      http { path { path = "/"; path_type = "Prefix"; backend { service { name = "${n}-svc"; port { number = 80 } } } } }
    }
  }
}`,
  docker: (n, l) => `# ${l}
resource "kubernetes_deployment" "${n}" {
  metadata { name = "${n}"; labels = { app = "${n}" } }
  spec {
    replicas = 2
    selector { match_labels = { app = "${n}" } }
    template {
      metadata { labels = { app = "${n}" } }
      spec { container { name = "${n}"; image = "${n}:latest"; port { container_port = 8080 }
        resources { requests = { cpu = "250m"; memory = "128Mi" }; limits = { cpu = "500m"; memory = "256Mi" } }
      } }
    }
  }
}`,
  kubernetes: (n, l) => `# ${l}
resource "kubernetes_deployment" "${n}" {
  metadata { name = "${n}"; labels = { app = "${n}" } }
  spec {
    replicas = 2
    selector { match_labels = { app = "${n}" } }
    template {
      metadata { labels = { app = "${n}" } }
      spec { container { name = "${n}"; image = "${n}:latest"; port { container_port = 8080 } } }
    }
  }
}`,
  server: (n, l) => `# ${l}
resource "kubernetes_deployment" "${n}" {
  metadata { name = "${n}" }
  spec {
    replicas = 1
    selector { match_labels = { app = "${n}" } }
    template {
      metadata { labels = { app = "${n}" } }
      spec { container { name = "${n}"; image = "${n}:latest"; port { container_port = 8080 } } }
    }
  }
}`,
  database: (n, l) => `# ${l}
resource "kubernetes_stateful_set" "${n}" {
  metadata { name = "${n}" }
  spec {
    service_name = "${n}"
    replicas     = 1
    selector { match_labels = { app = "${n}" } }
    template {
      metadata { labels = { app = "${n}" } }
      spec { container { name = "${n}"; image = "postgres:16-alpine"; port { container_port = 5432 }
        volume_mount { name = "${n}-data"; mount_path = "/var/lib/postgresql/data" }
      } }
    }
    volume_claim_template {
      metadata { name = "${n}-data" }
      spec { access_modes = ["ReadWriteOnce"]; resources { requests = { storage = "10Gi" } } }
    }
  }
}`,
  cache: (n, l) => `# ${l}
resource "kubernetes_stateful_set" "${n}" {
  metadata { name = "${n}" }
  spec {
    service_name = "${n}"
    replicas     = 1
    selector { match_labels = { app = "${n}" } }
    template {
      metadata { labels = { app = "${n}" } }
      spec { container { name = "${n}"; image = "redis:7-alpine"; port { container_port = 6379 } } }
    }
  }
}`,
  queue: (n, l) => `# ${l}
resource "kubernetes_stateful_set" "${n}" {
  metadata { name = "${n}" }
  spec {
    service_name = "${n}"
    replicas     = 1
    selector { match_labels = { app = "${n}" } }
    template {
      metadata { labels = { app = "${n}" } }
      spec { container { name = "${n}"; image = "rabbitmq:3-management-alpine"; port { container_port = 5672 } } }
    }
  }
}`,
  storage: (n, l) => `# ${l}
resource "kubernetes_persistent_volume_claim" "${n}" {
  metadata { name = "${n}" }
  spec {
    access_modes = ["ReadWriteOnce"]
    resources { requests = { storage = "20Gi" } }
  }
}`,
  cdn: (n, l) => `# ${l} — Nginx caching proxy
resource "kubernetes_deployment" "${n}" {
  metadata { name = "${n}" }
  spec {
    replicas = 1
    selector { match_labels = { app = "${n}" } }
    template {
      metadata { labels = { app = "${n}" } }
      spec { container { name = "nginx"; image = "nginx:alpine"; port { container_port = 80 } } }
    }
  }
}`,
  firewall: (n, l) => `# ${l}
resource "kubernetes_network_policy" "${n}" {
  metadata { name = "${n}" }
  spec {
    pod_selector {}
    policy_types = ["Ingress", "Egress"]
    ingress { from { namespace_selector { match_labels = { role = "trusted" } } } }
  }
}`,
  monitoring: (n, l) => `# ${l}
resource "kubernetes_deployment" "${n}" {
  metadata { name = "${n}" }
  spec {
    replicas = 1
    selector { match_labels = { app = "${n}" } }
    template {
      metadata { labels = { app = "${n}" } }
      spec { container { name = "prometheus"; image = "prom/prometheus:latest"; port { container_port = 9090 } } }
    }
  }
}`,
};

// ── Provider map ───────────────────────────────────────

const PROVIDER_TF: Record<CloudProvider, Record<InfraNodeType, TfGen>> = {
  aws: AWS_TF,
  digitalocean: DO_TF,
  "local-k8s": K8S_TF,
};

const PROVIDER_HEADERS: Record<CloudProvider, string> = {
  aws: `terraform {
  required_version = ">= 1.5"
  required_providers {
    aws = { source = "hashicorp/aws"; version = "~> 5.0" }
  }
}
provider "aws" { region = var.region }
variable "region"          { default = "us-east-1" }
variable "environment"     { default = "production" }
variable "vpc_id"          { type = string }
variable "public_subnets"  { type = list(string) }
variable "private_subnets" { type = list(string) }
variable "ami_id"          { type = string; default = "ami-0c55b159cbfafe1f0" }
variable "db_password"     { type = string; sensitive = true }`,

  digitalocean: `terraform {
  required_version = ">= 1.5"
  required_providers {
    digitalocean = { source = "digitalocean/digitalocean"; version = "~> 2.0" }
  }
}
provider "digitalocean" { token = var.do_token }
variable "do_token" { type = string; sensitive = true }
variable "region"   { default = "nyc3" }`,

  "local-k8s": `terraform {
  required_version = ">= 1.5"
  required_providers {
    kubernetes = { source = "hashicorp/kubernetes"; version = "~> 2.0" }
  }
}
provider "kubernetes" {
  config_path = "~/.kube/config"
}`,
};

// ── Public API ─────────────────────────────────────────

export function generateProviderTerraform(
  cloud: CloudProvider,
  nodes: { label: string; type: InfraNodeType }[]
): string {
  if (nodes.length === 0) return "# No nodes to generate Terraform for";

  const tfMap = PROVIDER_TF[cloud];
  const header = `# ══════════════════════════════════════════
# Generated by Cloud Wiz — ${CLOUD_LABELS[cloud]} (${CLOUD_TAGS[cloud]})
# ══════════════════════════════════════════

${PROVIDER_HEADERS[cloud]}
`;

  const resources = nodes.map((node) => {
    const name = sanitize(node.label, "_");
    const gen = tfMap[node.type] || tfMap.server;
    return gen(name, node.label);
  });

  return header + "\n" + resources.join("\n\n");
}
