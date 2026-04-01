import type { Edge } from "@xyflow/react";
import type { InfraNode, InfraNodeType } from "@/store/useCanvasStore";

// ── Types ──

export interface FailureImpact {
  originNode: InfraNode;
  waves: CascadeWave[];
  totalAffected: number;
  totalNodes: number;
  blastRadiusPercent: number;
  hardFailures: InfraNode[]; // nodes with NO alternative path
  softFailures: InfraNode[]; // nodes reachable via other routes
  survived: InfraNode[]; // completely unaffected
  criticalPath: string[]; // node IDs in the longest cascade chain
}

export interface CascadeWave {
  depth: number;
  nodes: InfraNode[];
  edges: Edge[];
}

export interface ResilienceReport {
  score: number; // 0-100
  grade: "A" | "B" | "C" | "D" | "F";
  singlePointsOfFailure: InfraNode[];
  redundancyGaps: RedundancyGap[];
  metrics: {
    spofCount: number;
    maxCascadeDepth: number;
    avgConnectivity: number;
    redundantPaths: number;
    criticalWithoutBackup: number;
  };
}

export interface RedundancyGap {
  node: InfraNode;
  reason: string;
}

// ── Adjacency helpers ──

interface AdjGraph {
  outgoing: Map<string, Set<string>>; // directed: source → targets
  incoming: Map<string, Set<string>>; // directed: target → sources
  undirected: Map<string, Set<string>>; // both directions
  edgesBetween: Map<string, Edge[]>; // nodeId → edges touching it
}

function buildGraph(nodes: InfraNode[], edges: Edge[]): AdjGraph {
  const outgoing = new Map<string, Set<string>>();
  const incoming = new Map<string, Set<string>>();
  const undirected = new Map<string, Set<string>>();
  const edgesBetween = new Map<string, Edge[]>();

  for (const n of nodes) {
    outgoing.set(n.id, new Set());
    incoming.set(n.id, new Set());
    undirected.set(n.id, new Set());
    edgesBetween.set(n.id, []);
  }

  for (const e of edges) {
    outgoing.get(e.source)?.add(e.target);
    incoming.get(e.target)?.add(e.source);
    undirected.get(e.source)?.add(e.target);
    undirected.get(e.target)?.add(e.source);
    edgesBetween.get(e.source)?.push(e);
    edgesBetween.get(e.target)?.push(e);
  }

  return { outgoing, incoming, undirected, edgesBetween };
}

// ── 1. Failure Impact Analysis ──

const CRITICAL_TYPES: Set<InfraNodeType> = new Set([
  "database", "cache", "queue", "load-balancer", "api-gateway",
]);

function pickChaosOrigin(nodes: InfraNode[]): InfraNode {
  const critical = nodes.filter((n) => CRITICAL_TYPES.has(n.data.type));
  const pool = critical.length > 0 ? critical : nodes;
  return pool[Math.floor(Math.random() * pool.length)];
}

export function analyzeFailure(
  nodes: InfraNode[],
  edges: Edge[],
  originId?: string
): FailureImpact {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const graph = buildGraph(nodes, edges);

  const origin = originId
    ? nodeMap.get(originId) || pickChaosOrigin(nodes)
    : pickChaosOrigin(nodes);

  // BFS cascade — a node fails if ANY of its dependencies (incoming sources) has failed
  // We simulate: origin goes down → anything that depends on it cascades
  const failed = new Set<string>([origin.id]);
  const waves: CascadeWave[] = [];
  let frontier = [origin.id];
  const visited = new Set<string>([origin.id]);

  // Wave 0: the origin
  waves.push({
    depth: 0,
    nodes: [origin],
    edges: graph.edgesBetween.get(origin.id)?.filter(
      (e) => e.source === origin.id || e.target === origin.id
    ) || [],
  });

  // Subsequent waves: nodes that depend on failed nodes
  while (frontier.length > 0) {
    const nextFrontier: string[] = [];
    const waveNodes: InfraNode[] = [];
    const waveEdges: Edge[] = [];

    for (const failedId of frontier) {
      // Find nodes that DEPEND on this failed node (outgoing targets)
      for (const dependentId of graph.outgoing.get(failedId) || []) {
        if (visited.has(dependentId)) continue;

        // Check if this node has ALL its incoming dependencies failed
        // or if the failed node was its only/primary source
        const incomingSources = graph.incoming.get(dependentId) || new Set();
        const healthySources = [...incomingSources].filter((s) => !failed.has(s));

        // Node fails if it has no healthy sources left
        if (healthySources.length === 0) {
          visited.add(dependentId);
          failed.add(dependentId);
          nextFrontier.push(dependentId);
          const node = nodeMap.get(dependentId);
          if (node) waveNodes.push(node);
        }
      }

      // Also check undirected neighbors for tightly coupled services
      for (const neighborId of graph.undirected.get(failedId) || []) {
        if (visited.has(neighborId)) continue;
        const neighborIncoming = graph.incoming.get(neighborId) || new Set();
        // If this neighbor's ONLY connection is the failed node, it's isolated
        const allNeighborConnections = graph.undirected.get(neighborId) || new Set();
        const healthyConnections = [...allNeighborConnections].filter((c) => !failed.has(c));
        if (healthyConnections.length === 0) {
          visited.add(neighborId);
          failed.add(neighborId);
          nextFrontier.push(neighborId);
          const node = nodeMap.get(neighborId);
          if (node) waveNodes.push(node);
        }
      }
    }

    if (waveNodes.length > 0) {
      // Collect affected edges for this wave
      for (const n of waveNodes) {
        for (const e of graph.edgesBetween.get(n.id) || []) {
          if (!waveEdges.find((we) => we.id === e.id)) {
            waveEdges.push(e);
          }
        }
      }
      waves.push({ depth: waves.length, nodes: waveNodes, edges: waveEdges });
    }

    frontier = nextFrontier;
  }

  // Classify nodes
  const hardFailures: InfraNode[] = [];
  const softFailures: InfraNode[] = [];
  const survived: InfraNode[] = [];

  for (const node of nodes) {
    if (node.id === origin.id) continue;
    if (failed.has(node.id)) {
      // Hard failure = no alternative path exists from any entry point
      const hasAlternative = hasAlternativePath(node.id, origin.id, nodes, edges);
      if (hasAlternative) {
        softFailures.push(node);
      } else {
        hardFailures.push(node);
      }
    } else {
      survived.push(node);
    }
  }

  // Find critical path (longest chain from origin)
  const criticalPath = findLongestCascadePath(origin.id, failed, graph);

  return {
    originNode: origin,
    waves,
    totalAffected: failed.size,
    totalNodes: nodes.length,
    blastRadiusPercent: Math.round((failed.size / nodes.length) * 100),
    hardFailures,
    softFailures,
    survived,
    criticalPath,
  };
}

function hasAlternativePath(
  targetId: string,
  excludeId: string,
  nodes: InfraNode[],
  edges: Edge[]
): boolean {
  // Check if target is reachable from any "entry" node (0 incoming edges)
  // without going through the excluded node
  const filteredEdges = edges.filter(
    (e) => e.source !== excludeId && e.target !== excludeId
  );
  const adj = new Map<string, Set<string>>();
  for (const n of nodes) adj.set(n.id, new Set());
  for (const e of filteredEdges) {
    adj.get(e.source)?.add(e.target);
    adj.get(e.target)?.add(e.source);
  }

  // Find entry nodes (nodes with no incoming edges in filtered graph)
  const hasIncoming = new Set(filteredEdges.map((e) => e.target));
  const entryNodes = nodes.filter(
    (n) => n.id !== excludeId && n.id !== targetId && !hasIncoming.has(n.id)
  );

  // BFS from any entry node to target
  for (const entry of entryNodes) {
    const visited = new Set<string>([entry.id]);
    const queue = [entry.id];
    while (queue.length > 0) {
      const current = queue.shift()!;
      if (current === targetId) return true;
      for (const neighbor of adj.get(current) || []) {
        if (!visited.has(neighbor)) {
          visited.add(neighbor);
          queue.push(neighbor);
        }
      }
    }
  }
  return false;
}

function findLongestCascadePath(
  originId: string,
  failed: Set<string>,
  graph: AdjGraph
): string[] {
  let longest: string[] = [];

  function dfs(nodeId: string, path: string[]) {
    if (path.length > longest.length) longest = [...path];
    for (const next of graph.outgoing.get(nodeId) || []) {
      if (failed.has(next) && !path.includes(next)) {
        dfs(next, [...path, next]);
      }
    }
  }

  dfs(originId, [originId]);
  return longest;
}

// ── 2. Resilience Scoring ──

export function analyzeResilience(
  nodes: InfraNode[],
  edges: Edge[]
): ResilienceReport {
  if (nodes.length === 0) {
    return {
      score: 0,
      grade: "F",
      singlePointsOfFailure: [],
      redundancyGaps: [],
      metrics: {
        spofCount: 0,
        maxCascadeDepth: 0,
        avgConnectivity: 0,
        redundantPaths: 0,
        criticalWithoutBackup: 0,
      },
    };
  }

  const graph = buildGraph(nodes, edges);

  // Find Single Points of Failure (bridges/articulation points)
  const spofs = findArticulationPoints(nodes, graph);

  // Find redundancy gaps
  const redundancyGaps = findRedundancyGaps(nodes, graph);

  // Calculate max cascade depth across all possible origins
  let maxCascadeDepth = 0;
  for (const node of nodes) {
    const impact = analyzeFailure(nodes, edges, node.id);
    maxCascadeDepth = Math.max(maxCascadeDepth, impact.waves.length);
  }

  // Average connectivity
  let totalConnections = 0;
  for (const n of nodes) {
    totalConnections += (graph.undirected.get(n.id)?.size || 0);
  }
  const avgConnectivity = totalConnections / nodes.length;

  // Count redundant paths (nodes with 2+ incoming connections)
  let redundantPaths = 0;
  for (const n of nodes) {
    if ((graph.incoming.get(n.id)?.size || 0) >= 2) redundantPaths++;
  }

  // Critical nodes without backup
  const criticalTypes: Set<InfraNodeType> = new Set([
    "database", "cache", "load-balancer", "api-gateway",
  ]);
  const criticalNodes = nodes.filter((n) => criticalTypes.has(n.data.type));
  const criticalWithoutBackup = criticalNodes.filter((n) => {
    // Check if there's another node of the same type
    return !nodes.some(
      (other) => other.id !== n.id && other.data.type === n.data.type
    );
  }).length;

  // ── Score calculation ──
  let score = 100;

  // Penalize SPOFs heavily: -15 per SPOF
  score -= spofs.length * 15;

  // Penalize low redundancy: -10 per critical node without backup
  score -= criticalWithoutBackup * 10;

  // Penalize deep cascade chains: -5 per depth level beyond 2
  score -= Math.max(0, maxCascadeDepth - 2) * 5;

  // Reward redundant paths: +3 per node with 2+ sources
  score += redundantPaths * 3;

  // Reward higher connectivity (up to +10)
  score += Math.min(10, Math.floor(avgConnectivity * 3));

  // Penalize redundancy gaps
  score -= redundancyGaps.length * 5;

  score = Math.max(0, Math.min(100, Math.round(score)));

  const grade: ResilienceReport["grade"] =
    score >= 90 ? "A" : score >= 75 ? "B" : score >= 60 ? "C" : score >= 40 ? "D" : "F";

  return {
    score,
    grade,
    singlePointsOfFailure: spofs,
    redundancyGaps,
    metrics: {
      spofCount: spofs.length,
      maxCascadeDepth,
      avgConnectivity: Math.round(avgConnectivity * 10) / 10,
      redundantPaths,
      criticalWithoutBackup,
    },
  };
}

// Tarjan's algorithm for articulation points
function findArticulationPoints(
  nodes: InfraNode[],
  graph: AdjGraph
): InfraNode[] {
  const nodeMap = new Map(nodes.map((n) => [n.id, n]));
  const visited = new Set<string>();
  const disc = new Map<string, number>();
  const low = new Map<string, number>();
  const parent = new Map<string, string | null>();
  const ap = new Set<string>();
  let timer = 0;

  function dfs(u: string) {
    visited.add(u);
    disc.set(u, timer);
    low.set(u, timer);
    timer++;
    let children = 0;

    for (const v of graph.undirected.get(u) || []) {
      if (!visited.has(v)) {
        children++;
        parent.set(v, u);
        dfs(v);
        low.set(u, Math.min(low.get(u)!, low.get(v)!));

        // u is an articulation point if:
        if (parent.get(u) === null && children > 1) ap.add(u);
        if (parent.get(u) !== null && low.get(v)! >= disc.get(u)!) ap.add(u);
      } else if (v !== parent.get(u)) {
        low.set(u, Math.min(low.get(u)!, disc.get(v)!));
      }
    }
  }

  for (const n of nodes) {
    if (!visited.has(n.id)) {
      parent.set(n.id, null);
      dfs(n.id);
    }
  }

  return [...ap].map((id) => nodeMap.get(id)!).filter(Boolean);
}

function findRedundancyGaps(
  nodes: InfraNode[],
  graph: AdjGraph
): RedundancyGap[] {
  const gaps: RedundancyGap[] = [];

  for (const node of nodes) {
    const incoming = graph.incoming.get(node.id)?.size || 0;
    const outgoing = graph.outgoing.get(node.id)?.size || 0;

    // Database with single connection
    if (node.data.type === "database" && incoming <= 1 && outgoing === 0) {
      gaps.push({
        node,
        reason: "Database has no read replica or failover — single point of data loss",
      });
    }

    // Load balancer with only one target
    if (node.data.type === "load-balancer" && outgoing <= 1) {
      gaps.push({
        node,
        reason: "Load balancer routes to only 1 target — no load distribution benefit",
      });
    }

    // Service with no incoming connections (orphaned)
    if (
      incoming === 0 &&
      outgoing > 0 &&
      node.data.type !== "load-balancer" &&
      node.data.type !== "cdn"
    ) {
      gaps.push({
        node,
        reason: "Service has no incoming traffic — potentially orphaned or misconfigured",
      });
    }

    // Critical service with single source
    if (
      (node.data.type === "docker" || node.data.type === "kubernetes") &&
      incoming === 1
    ) {
      gaps.push({
        node,
        reason: "Service has only 1 upstream dependency — no failover if upstream goes down",
      });
    }
  }

  return gaps;
}
