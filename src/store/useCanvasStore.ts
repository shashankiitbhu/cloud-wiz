import { create } from "zustand";
import {
  type Node,
  type Edge,
  type OnNodesChange,
  type OnEdgesChange,
  type OnConnect,
  applyNodeChanges,
  applyEdgeChanges,
  addEdge,
} from "@xyflow/react";

export type InfraNodeType =
  | "docker"
  | "kubernetes"
  | "load-balancer"
  | "database"
  | "storage"
  | "server"
  | "firewall"
  | "cdn"
  | "queue"
  | "cache"
  | "api-gateway"
  | "monitoring";

export interface InfraNodeData extends Record<string, unknown> {
  label: string;
  type: InfraNodeType;
  chaosAffected?: boolean;
}

export type InfraNode = Node<InfraNodeData>;

interface CanvasState {
  nodes: InfraNode[];
  edges: Edge[];
  chaosMode: boolean;

  // React Flow handlers
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;

  // Actions
  setNodes: (nodes: InfraNode[]) => void;
  setEdges: (edges: Edge[]) => void;
  addNode: (node: InfraNode) => void;
  removeNode: (id: string) => void;

  // Chaos
  setChaosMode: (active: boolean) => void;
  setChaosAffected: (nodeId: string, affected: boolean) => void;
  resetChaos: () => void;
}

const useCanvasStore = create<CanvasState>((set, get) => ({
  nodes: [],
  edges: [],
  chaosMode: false,

  onNodesChange: (changes) => {
    set({ nodes: applyNodeChanges(changes, get().nodes) as InfraNode[] });
  },

  onEdgesChange: (changes) => {
    set({ edges: applyEdgeChanges(changes, get().edges) });
  },

  onConnect: (connection) => {
    set({
      edges: addEdge(
        { ...connection, style: { stroke: "#39FF14", strokeWidth: 1.5 } },
        get().edges
      ),
    });
  },

  setNodes: (nodes) => set({ nodes }),
  setEdges: (edges) => set({ edges }),

  addNode: (node) => set((s) => ({ nodes: [...s.nodes, node] })),

  removeNode: (id) =>
    set((s) => ({
      nodes: s.nodes.filter((n) => n.id !== id),
      edges: s.edges.filter((e) => e.source !== id && e.target !== id),
    })),

  setChaosMode: (active) => set({ chaosMode: active }),

  setChaosAffected: (nodeId, affected) =>
    set((s) => ({
      nodes: s.nodes.map((n) =>
        n.id === nodeId
          ? { ...n, data: { ...n.data, chaosAffected: affected } }
          : n
      ),
    })),

  resetChaos: () =>
    set((s) => ({
      chaosMode: false,
      nodes: s.nodes.map((n) => ({
        ...n,
        data: { ...n.data, chaosAffected: false },
      })),
      edges: s.edges.map((e) => ({
        ...e,
        style: { stroke: "#39FF14", strokeWidth: 1.5 },
        animated: false,
      })),
    })),
}));

export default useCanvasStore;
