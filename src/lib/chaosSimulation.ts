import type { Edge } from "@xyflow/react";
import type { InfraNode, InfraNodeType } from "@/store/useCanvasStore";

// Critical node types — these are picked as chaos origins
const CRITICAL_TYPES: Set<InfraNodeType> = new Set([
  "database",
  "cache",
  "queue",
  "load-balancer",
  "api-gateway",
]);

/**
 * Simulate a cascading failure starting from a random critical node.
 * Returns an array of "waves" — each wave is a set of node IDs that fail
 * at that step, plus affected edge IDs.
 */
export interface ChaosWave {
  nodeIds: string[];
  edgeIds: string[];
}

export function computeChaosWaves(
  nodes: InfraNode[],
  edges: Edge[]
): ChaosWave[] {
  // Pick a random critical node as origin
  const criticalNodes = nodes.filter((n) =>
    CRITICAL_TYPES.has(n.data.type)
  );
  const origin =
    criticalNodes.length > 0
      ? criticalNodes[Math.floor(Math.random() * criticalNodes.length)]
      : nodes[Math.floor(Math.random() * nodes.length)];

  if (!origin) return [];

  // Build adjacency (undirected for cascading)
  const adj = new Map<string, Set<string>>();
  const edgeMap = new Map<string, Edge[]>(); // nodeId -> edges touching it

  for (const e of edges) {
    if (!adj.has(e.source)) adj.set(e.source, new Set());
    if (!adj.has(e.target)) adj.set(e.target, new Set());
    adj.get(e.source)!.add(e.target);
    adj.get(e.target)!.add(e.source);

    if (!edgeMap.has(e.source)) edgeMap.set(e.source, []);
    if (!edgeMap.has(e.target)) edgeMap.set(e.target, []);
    edgeMap.get(e.source)!.push(e);
    edgeMap.get(e.target)!.push(e);
  }

  // BFS from origin to create waves
  const visited = new Set<string>();
  const waves: ChaosWave[] = [];
  let frontier = [origin.id];
  visited.add(origin.id);

  while (frontier.length > 0) {
    const affectedEdgeIds = new Set<string>();
    for (const nodeId of frontier) {
      for (const e of edgeMap.get(nodeId) || []) {
        affectedEdgeIds.add(e.id);
      }
    }

    waves.push({
      nodeIds: [...frontier],
      edgeIds: [...affectedEdgeIds],
    });

    const nextFrontier: string[] = [];
    for (const nodeId of frontier) {
      for (const neighbor of adj.get(nodeId) || []) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          nextFrontier.push(neighbor);
        }
      }
    }
    frontier = nextFrontier;
  }

  return waves;
}
