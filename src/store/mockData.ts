import type { Edge } from "@xyflow/react";
import type { InfraNode } from "./useCanvasStore";

export const MOCK_NODES: InfraNode[] = [
  {
    id: "lb-1",
    type: "terminal",
    position: { x: 400, y: 20 },
    data: { label: "Public Load Balancer", type: "load-balancer" },
  },
  {
    id: "gw-1",
    type: "terminal",
    position: { x: 380, y: 160 },
    data: { label: "API Gateway", type: "api-gateway" },
  },
  {
    id: "web-1",
    type: "terminal",
    position: { x: 120, y: 310 },
    data: { label: "Web Pod (x3)", type: "kubernetes" },
  },
  {
    id: "api-1",
    type: "terminal",
    position: { x: 400, y: 310 },
    data: { label: "API Service", type: "docker" },
  },
  {
    id: "worker-1",
    type: "terminal",
    position: { x: 680, y: 310 },
    data: { label: "Worker Service", type: "docker" },
  },
  {
    id: "cache-1",
    type: "terminal",
    position: { x: 120, y: 480 },
    data: { label: "Redis Cache", type: "cache" },
  },
  {
    id: "db-1",
    type: "terminal",
    position: { x: 400, y: 480 },
    data: { label: "Postgres Primary", type: "database" },
  },
  {
    id: "queue-1",
    type: "terminal",
    position: { x: 680, y: 480 },
    data: { label: "Message Queue", type: "queue" },
  },
  {
    id: "s3-1",
    type: "terminal",
    position: { x: 250, y: 630 },
    data: { label: "Object Storage (S3)", type: "storage" },
  },
  {
    id: "mon-1",
    type: "terminal",
    position: { x: 550, y: 630 },
    data: { label: "Monitoring Stack", type: "monitoring" },
  },
];

const edgeStyle = { stroke: "#39FF14", strokeWidth: 1.5 };

export const MOCK_EDGES: Edge[] = [
  {
    id: "e-lb-gw",
    source: "lb-1",
    target: "gw-1",
    animated: true,
    style: edgeStyle,
  },
  {
    id: "e-gw-web",
    source: "gw-1",
    target: "web-1",
    style: edgeStyle,
  },
  {
    id: "e-gw-api",
    source: "gw-1",
    target: "api-1",
    animated: true,
    style: edgeStyle,
  },
  {
    id: "e-gw-worker",
    source: "gw-1",
    target: "worker-1",
    style: edgeStyle,
  },
  {
    id: "e-web-cache",
    source: "web-1",
    target: "cache-1",
    style: edgeStyle,
  },
  {
    id: "e-api-db",
    source: "api-1",
    target: "db-1",
    animated: true,
    style: edgeStyle,
  },
  {
    id: "e-worker-queue",
    source: "worker-1",
    target: "queue-1",
    style: edgeStyle,
  },
  {
    id: "e-api-cache",
    source: "api-1",
    target: "cache-1",
    style: edgeStyle,
  },
  {
    id: "e-db-s3",
    source: "db-1",
    target: "s3-1",
    style: edgeStyle,
  },
  {
    id: "e-db-mon",
    source: "db-1",
    target: "mon-1",
    style: edgeStyle,
  },
  {
    id: "e-queue-mon",
    source: "queue-1",
    target: "mon-1",
    style: edgeStyle,
  },
];
