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
import type { FailureImpact, ResilienceReport } from "@/lib/graphAnalysis";

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

export interface ContainerMeta {
  repoUrl: string;
  language: string;
  framework: string;
  dockerfile: string;
  k8sYaml: string;
}

export interface InfraNodeData extends Record<string, unknown> {
  label: string;
  type: InfraNodeType;
  chaosAffected?: boolean;
  containerMeta?: ContainerMeta;
  sourceRepo?: string;
}

export type InfraNode = Node<InfraNodeData>;

export type CloudProvider = "aws" | "digitalocean" | "local-k8s";

export type BudgetTier = "bootstrapped" | "startup" | "enterprise";
export type ScaleTier = "mvp" | "launch" | "hypergrowth";
export type OpsPref = "solo" | "small-team" | "full-control";

export interface Constraints {
  budget: BudgetTier;
  scale: ScaleTier;
  ops: OpsPref;
}

interface CanvasState {
  nodes: InfraNode[];
  edges: Edge[];
  chaosMode: boolean;
  failureImpact: FailureImpact | null;
  resilienceReport: ResilienceReport | null;
  chaosReportOpen: boolean;

  // Cloud provider
  activeCloud: CloudProvider;
  cloudFlash: boolean;

  // Constraint modal
  pendingPrompt: string | null;
  constraintModalOpen: boolean;

  // React Flow handlers
  onNodesChange: OnNodesChange;
  onEdgesChange: OnEdgesChange;
  onConnect: OnConnect;

  // Actions
  setNodes: (nodes: InfraNode[]) => void;
  setEdges: (edges: Edge[]) => void;
  addNode: (node: InfraNode) => void;
  removeNode: (id: string) => void;

  // Cloud provider
  setActiveCloud: (cloud: CloudProvider) => void;

  // Constraint modal
  setPendingPrompt: (prompt: string) => void;
  setConstraintModalOpen: (open: boolean) => void;
  clearPendingPrompt: () => void;

  // Chaos
  setChaosMode: (active: boolean) => void;
  setChaosAffected: (nodeId: string, affected: boolean) => void;
  setFailureImpact: (impact: FailureImpact) => void;
  setResilienceReport: (report: ResilienceReport) => void;
  setChaosReportOpen: (open: boolean) => void;
  resetChaos: () => void;
}

const useCanvasStore = create<CanvasState>((set, get) => ({
  nodes: [],
  edges: [],
  chaosMode: false,
  failureImpact: null,
  resilienceReport: null,
  chaosReportOpen: false,

  activeCloud: "aws",
  cloudFlash: false,

  pendingPrompt: null,
  constraintModalOpen: false,

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

  setActiveCloud: (cloud) => {
    set({ activeCloud: cloud, cloudFlash: true });
    setTimeout(() => set({ cloudFlash: false }), 400);
  },

  setPendingPrompt: (prompt) =>
    set({ pendingPrompt: prompt, constraintModalOpen: true }),
  setConstraintModalOpen: (open) => set({ constraintModalOpen: open }),
  clearPendingPrompt: () =>
    set({ pendingPrompt: null, constraintModalOpen: false }),

  setChaosMode: (active) => set({ chaosMode: active }),

  setChaosAffected: (nodeId, affected) =>
    set((s) => ({
      nodes: s.nodes.map((n) =>
        n.id === nodeId
          ? { ...n, data: { ...n.data, chaosAffected: affected } }
          : n
      ),
    })),

  setFailureImpact: (impact) => set({ failureImpact: impact }),
  setResilienceReport: (report) => set({ resilienceReport: report }),
  setChaosReportOpen: (open) => set({ chaosReportOpen: open }),

  resetChaos: () =>
    set((s) => ({
      chaosMode: false,
      failureImpact: null,
      resilienceReport: null,
      chaosReportOpen: false,
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
