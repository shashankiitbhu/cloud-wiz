import type { InfraNode, InfraNodeType } from "@/store/useCanvasStore";

export type CloudProvider = "aws" | "gcp" | "azure";

interface PricingTier {
  service: string;
  monthlyCost: number;
  unit: string;
  notes: string;
}

// Approximate monthly costs for typical production configurations
// Based on us-east-1 / us-central1 pricing as of 2024-2025
const AWS_PRICING: Record<InfraNodeType, PricingTier> = {
  "load-balancer": { service: "ALB", monthlyCost: 22.5, unit: "per LB + LCU", notes: "Application Load Balancer, ~1M requests/mo" },
  "api-gateway": { service: "API Gateway", monthlyCost: 35, unit: "per 1M calls", notes: "HTTP API, ~10M requests/mo" },
  docker: { service: "ECS Fargate", monthlyCost: 73, unit: "per task", notes: "0.5 vCPU, 1GB RAM, 2 tasks" },
  kubernetes: { service: "EKS + EC2", monthlyCost: 145, unit: "per node", notes: "t3.medium, 2 nodes + $74 EKS fee" },
  server: { service: "EC2", monthlyCost: 30, unit: "per instance", notes: "t3.medium On-Demand" },
  database: { service: "RDS PostgreSQL", monthlyCost: 65, unit: "per instance", notes: "db.t3.medium, 20GB, single-AZ" },
  cache: { service: "ElastiCache Redis", monthlyCost: 25, unit: "per node", notes: "cache.t3.micro, single node" },
  queue: { service: "SQS", monthlyCost: 4, unit: "per queue", notes: "~5M messages/mo" },
  storage: { service: "S3", monthlyCost: 2.3, unit: "per 100GB", notes: "Standard, 100GB + requests" },
  cdn: { service: "CloudFront", monthlyCost: 8.5, unit: "per distribution", notes: "~100GB transfer/mo" },
  firewall: { service: "WAF + SG", monthlyCost: 6, unit: "per web ACL", notes: "1 web ACL + 5 rules" },
  monitoring: { service: "CloudWatch", monthlyCost: 15, unit: "per dashboard", notes: "10 metrics, 3 dashboards, basic alarms" },
};

const GCP_PRICING: Record<InfraNodeType, PricingTier> = {
  "load-balancer": { service: "Cloud Load Balancing", monthlyCost: 18, unit: "per rule", notes: "HTTP(S) LB, 5 forwarding rules" },
  "api-gateway": { service: "API Gateway", monthlyCost: 30, unit: "per 1M calls", notes: "~10M requests/mo" },
  docker: { service: "Cloud Run", monthlyCost: 45, unit: "per service", notes: "2 vCPU, 1GB, always-on" },
  kubernetes: { service: "GKE", monthlyCost: 120, unit: "per node", notes: "e2-medium, 2 nodes + $74 mgmt fee" },
  server: { service: "Compute Engine", monthlyCost: 25, unit: "per instance", notes: "e2-medium" },
  database: { service: "Cloud SQL", monthlyCost: 52, unit: "per instance", notes: "db-standard-1, 10GB SSD" },
  cache: { service: "Memorystore Redis", monthlyCost: 35, unit: "per instance", notes: "M1, 1GB basic tier" },
  queue: { service: "Pub/Sub", monthlyCost: 5, unit: "per topic", notes: "~5M messages/mo" },
  storage: { service: "Cloud Storage", monthlyCost: 2, unit: "per 100GB", notes: "Standard, 100GB" },
  cdn: { service: "Cloud CDN", monthlyCost: 7.5, unit: "per origin", notes: "~100GB transfer/mo" },
  firewall: { service: "Cloud Armor", monthlyCost: 8, unit: "per policy", notes: "1 security policy + 5 rules" },
  monitoring: { service: "Cloud Monitoring", monthlyCost: 8, unit: "per workspace", notes: "First 150MB logs free, basic metrics" },
};

const AZURE_PRICING: Record<InfraNodeType, PricingTier> = {
  "load-balancer": { service: "App Gateway", monthlyCost: 24, unit: "per gateway", notes: "Standard_v2, small" },
  "api-gateway": { service: "API Management", monthlyCost: 50, unit: "per instance", notes: "Consumption tier" },
  docker: { service: "Container Instances", monthlyCost: 55, unit: "per group", notes: "1 vCPU, 1.5GB" },
  kubernetes: { service: "AKS", monthlyCost: 130, unit: "per node", notes: "Standard_DS2_v2, 2 nodes (free control plane)" },
  server: { service: "Virtual Machine", monthlyCost: 28, unit: "per VM", notes: "B2s" },
  database: { service: "Azure SQL", monthlyCost: 60, unit: "per DTU", notes: "S1, 20 DTU" },
  cache: { service: "Azure Cache Redis", monthlyCost: 20, unit: "per instance", notes: "C0, 250MB" },
  queue: { service: "Service Bus", monthlyCost: 10, unit: "per namespace", notes: "Basic tier" },
  storage: { service: "Blob Storage", monthlyCost: 1.8, unit: "per 100GB", notes: "Hot tier, 100GB" },
  cdn: { service: "Azure CDN", monthlyCost: 7, unit: "per endpoint", notes: "~100GB transfer/mo" },
  firewall: { service: "Azure Firewall", monthlyCost: 12, unit: "per policy", notes: "Basic SKU" },
  monitoring: { service: "Azure Monitor", monthlyCost: 12, unit: "per workspace", notes: "Basic metrics + 5GB logs" },
};

const PROVIDER_MAP: Record<CloudProvider, Record<InfraNodeType, PricingTier>> = {
  aws: AWS_PRICING,
  gcp: GCP_PRICING,
  azure: AZURE_PRICING,
};

export interface CostBreakdownItem {
  node: InfraNode;
  service: string;
  monthlyCost: number;
  unit: string;
  notes: string;
}

export interface CostEstimate {
  provider: CloudProvider;
  items: CostBreakdownItem[];
  totalMonthly: number;
  totalAnnual: number;
}

export function estimateCosts(
  nodes: InfraNode[],
  provider: CloudProvider = "aws"
): CostEstimate {
  const pricing = PROVIDER_MAP[provider];
  const items: CostBreakdownItem[] = nodes.map((node) => {
    const tier = pricing[node.data.type];
    return {
      node,
      service: tier.service,
      monthlyCost: tier.monthlyCost,
      unit: tier.unit,
      notes: tier.notes,
    };
  });

  const totalMonthly = items.reduce((sum, i) => sum + i.monthlyCost, 0);

  return {
    provider,
    items: items.sort((a, b) => b.monthlyCost - a.monthlyCost),
    totalMonthly: Math.round(totalMonthly * 100) / 100,
    totalAnnual: Math.round(totalMonthly * 12 * 100) / 100,
  };
}

export function compareProviders(nodes: InfraNode[]): Record<CloudProvider, CostEstimate> {
  return {
    aws: estimateCosts(nodes, "aws"),
    gcp: estimateCosts(nodes, "gcp"),
    azure: estimateCosts(nodes, "azure"),
  };
}
