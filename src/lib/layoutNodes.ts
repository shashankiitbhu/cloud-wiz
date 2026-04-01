import type { InfraNode, InfraNodeType } from "@/store/useCanvasStore";
import type { Edge } from "@xyflow/react";

interface RawNode {
  id: string;
  label: string;
  type: string;
  sourceRepo?: string;
}

interface RawEdge {
  id: string;
  source: string;
  target: string;
}

// Tier priority: lower number = higher on canvas
const TIER: Record<InfraNodeType, number> = {
  cdn: 0,
  "load-balancer": 0,
  firewall: 1,
  "api-gateway": 1,
  server: 2,
  docker: 2,
  kubernetes: 2,
  cache: 3,
  queue: 3,
  database: 4,
  storage: 4,
  monitoring: 5,
};

export function layoutFromResponse(
  rawNodes: RawNode[],
  rawEdges: RawEdge[]
): { nodes: InfraNode[]; edges: Edge[] } {
  // Group nodes by tier
  const tiers = new Map<number, RawNode[]>();
  for (const n of rawNodes) {
    const tier = TIER[n.type as InfraNodeType] ?? 2;
    if (!tiers.has(tier)) tiers.set(tier, []);
    tiers.get(tier)!.push(n);
  }

  const sortedTiers = [...tiers.entries()].sort((a, b) => a[0] - b[0]);

  const NODE_W = 220;
  const NODE_GAP_X = 60;
  const TIER_GAP_Y = 160;

  const nodes: InfraNode[] = [];
  let tierY = 40;

  for (const [, tierNodes] of sortedTiers) {
    const totalWidth = tierNodes.length * NODE_W + (tierNodes.length - 1) * NODE_GAP_X;
    let startX = Math.max(40, (900 - totalWidth) / 2);

    for (const n of tierNodes) {
      nodes.push({
        id: n.id,
        type: "terminal",
        position: { x: startX, y: tierY },
        data: {
          label: n.label,
          type: (n.type as InfraNodeType) || "server",
          ...(n.sourceRepo ? { sourceRepo: n.sourceRepo } : {}),
        },
      });
      startX += NODE_W + NODE_GAP_X;
    }
    tierY += TIER_GAP_Y;
  }

  const edgeStyle = { stroke: "#39FF14", strokeWidth: 1.5 };
  const edges: Edge[] = rawEdges.map((e, i) => ({
    id: e.id || `e-${e.source}-${e.target}-${i}`,
    source: e.source,
    target: e.target,
    style: edgeStyle,
    animated: i % 3 === 0, // animate every 3rd edge for visual interest
  }));

  return { nodes, edges };
}
