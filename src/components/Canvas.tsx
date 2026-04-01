"use client";

import { useMemo, useCallback, useState, useEffect } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  MiniMap,
  BackgroundVariant,
  useReactFlow,
  getNodesBounds,
  getViewportForBounds,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { toPng } from "html-to-image";
import {
  FolderOpen,
  Upload,
  Layout,
  Container,
  Trash2,
  Workflow,
  Download,
  Terminal,
  Zap,
  DollarSign,
  ShieldCheck,
  GitBranch,
  Globe,
  FileCode,
  Sparkles,
} from "lucide-react";

import useCanvasStore from "@/store/useCanvasStore";
import TerminalNode from "@/components/nodes/TerminalNode";
import {
  type SavedArchitecture,
  listSaved,
  loadArchitecture,
  deleteArchitecture,
  setCurrentId,
} from "@/lib/persistence";

// ── Welcome Screen (empty state) ──────────────────────

function WelcomeScreen({
  onOpenTemplates,
  onOpenContainerizer,
  onOpenImport,
  onOpenCombinedFlow,
}: {
  onOpenTemplates: () => void;
  onOpenContainerizer: () => void;
  onOpenImport: () => void;
  onOpenCombinedFlow: () => void;
}) {
  const [saved, setSaved] = useState<SavedArchitecture[]>([]);
  const setNodes = useCanvasStore((s) => s.setNodes);
  const setEdges = useCanvasStore((s) => s.setEdges);

  useEffect(() => {
    setSaved(listSaved());
  }, []);

  const handleLoad = (id: string) => {
    const arch = loadArchitecture(id);
    if (!arch) return;
    useCanvasStore.getState().resetChaos();
    setNodes(arch.nodes);
    setEdges(arch.edges);
    setCurrentId(id);
  };

  const handleDelete = (id: string) => {
    deleteArchitecture(id);
    setSaved((prev) => prev.filter((a) => a.id !== id));
  };

  const formatDate = (ts: number) =>
    new Date(ts).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  const FEATURES = [
    { icon: Sparkles, label: "AI Architecture", desc: "Describe in plain English, get a full infra graph" },
    { icon: Globe, label: "Multi-Cloud", desc: "Toggle AWS / DigitalOcean / Local K8s instantly" },
    { icon: Workflow, label: "Combined Flow", desc: "Wire multiple repos into one deployment" },
    { icon: Zap, label: "Chaos Testing", desc: "Simulate failures and see cascade impact" },
    { icon: DollarSign, label: "Cost Estimation", desc: "Compare pricing across cloud providers" },
    { icon: ShieldCheck, label: "Compliance", desc: "SOC2, HIPAA, Well-Architected checks" },
    { icon: FileCode, label: "Code Export", desc: "Terraform + K8s YAML per provider" },
    { icon: GitBranch, label: "Git Sync", desc: "Push infra as a PR with CI/CD workflow" },
  ];

  return (
    <div className="relative flex flex-1 overflow-hidden bg-black">
      {/* Dot grid background */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(circle, #39FF1418 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />
      {/* Scanline sweep */}
      <div className="scanline-overlay absolute inset-0 pointer-events-none" />

      <div className="relative z-10 flex flex-1 flex-col items-center overflow-auto py-10 px-6">
        {/* ── Hero ── */}
        <div className="flex flex-col items-center gap-1 text-center mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="border border-green p-2.5">
              <Terminal className="h-6 w-6 text-green" />
            </div>
          </div>
          <h1 className="text-lg font-bold uppercase tracking-[0.25em] text-green">
            Cloud Wiz
          </h1>
          <p className="text-[10px] uppercase tracking-widest text-gray-light">
            Interactive Cloud Architecture Synthesizer
          </p>
          <div className="mt-2 flex items-center gap-2 text-[10px] text-gray-light">
            <span className="inline-block h-1.5 w-1.5 bg-green animate-pulse" />
            System Online — Ready for input
          </div>
        </div>

        {/* ── Quick Start ── */}
        <div className="w-full max-w-2xl mb-8">
          <div className="mb-3 text-[10px] font-bold uppercase tracking-widest text-gray-light text-center">
            Quick Start
          </div>
          <div className="grid grid-cols-2 gap-px bg-gray sm:grid-cols-4">
            {[
              { icon: Terminal, label: "Prompt", desc: "Describe below", action: undefined as (() => void) | undefined },
              { icon: Layout, label: "Template", desc: "Pre-built stacks", action: onOpenTemplates },
              { icon: Container, label: "Containerize", desc: "Analyze a repo", action: onOpenContainerizer },
              { icon: Workflow, label: "Combined Flow", desc: "Multi-repo deploy", action: onOpenCombinedFlow },
            ].map((item) => (
              <button
                key={item.label}
                onClick={item.action}
                disabled={!item.action}
                className="flex flex-col items-center gap-2 bg-black p-4 text-green transition-colors hover:bg-green/10 disabled:cursor-default disabled:opacity-60"
              >
                <div className="border border-green/40 p-2">
                  <item.icon className="h-5 w-5" />
                </div>
                <span className="text-[10px] font-bold uppercase tracking-wide">{item.label}</span>
                <span className="text-[8px] text-gray-light">{item.desc}</span>
              </button>
            ))}
          </div>
          <button
            onClick={onOpenImport}
            className="mt-px flex w-full items-center justify-center gap-2 bg-black border border-gray py-2 text-[10px] font-bold uppercase tracking-wide text-gray-light transition-colors hover:bg-green/5 hover:text-green"
          >
            <Upload className="h-3 w-3" />
            Import Existing (docker-compose, Terraform, K8s YAML)
          </button>
        </div>

        {/* ── Features Grid ── */}
        <div className="w-full max-w-2xl mb-8">
          <div className="mb-3 text-[10px] font-bold uppercase tracking-widest text-gray-light text-center">
            Capabilities
          </div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {FEATURES.map((f) => (
              <div key={f.label} className="group border border-gray bg-black p-3 transition-colors hover:border-green/50">
                <f.icon className="mb-2 h-4 w-4 text-green/60 transition-colors group-hover:text-green" />
                <div className="text-[10px] font-bold uppercase tracking-wide text-white mb-0.5">{f.label}</div>
                <div className="text-[9px] leading-relaxed text-gray-light">{f.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* ── Saved Projects ── */}
        {saved.length > 0 && (
          <div className="w-full max-w-md mb-6">
            <div className="mb-2 flex items-center justify-center gap-2 text-[10px] font-bold uppercase tracking-widest text-gray-light">
              <FolderOpen className="h-3 w-3" />
              Recent Projects
            </div>
            <div className="border border-gray bg-black">
              {saved.slice(0, 4).map((arch) => (
                <div
                  key={arch.id}
                  className="group flex items-center gap-3 border-b border-gray px-3 py-2 last:border-b-0"
                >
                  <div
                    className="flex-1 cursor-pointer transition-colors hover:text-green"
                    onClick={() => handleLoad(arch.id)}
                  >
                    <div className="text-xs font-bold text-white group-hover:text-green">
                      {arch.name}
                    </div>
                    <div className="flex items-center gap-3 text-[10px] text-gray-light">
                      <span>{arch.description}</span>
                      <span>{formatDate(arch.updatedAt)}</span>
                    </div>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(arch.id);
                    }}
                    className="p-1 text-gray-light opacity-0 transition-all hover:text-orange group-hover:opacity-100"
                  >
                    <Trash2 className="h-3 w-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── Footer hint ── */}
        <div className="flex items-center gap-2 text-[9px] text-gray-light">
          <span className="text-green">$</span>
          Type a prompt below to generate your architecture
          <span className="inline-block h-3 w-px bg-green animate-blink" />
        </div>
      </div>
    </div>
  );
}

// ── Download Button (must be inside ReactFlow provider) ──

function DownloadButton() {
  const { getNodes } = useReactFlow();

  const handleDownload = useCallback(() => {
    const nodesBounds = getNodesBounds(getNodes());
    const padding = 50;
    const width = nodesBounds.width + padding * 2;
    const height = nodesBounds.height + padding * 2;

    const viewport = getViewportForBounds(
      nodesBounds,
      width,
      height,
      0.5,
      2,
      0.15
    );

    const viewportEl = document.querySelector(
      ".react-flow__viewport"
    ) as HTMLElement | null;
    if (!viewportEl) return;

    toPng(viewportEl, {
      backgroundColor: "#000000",
      width,
      height,
      style: {
        width: `${width}px`,
        height: `${height}px`,
        transform: `translate(${viewport.x}px, ${viewport.y}px) scale(${viewport.zoom})`,
      },
    }).then((dataUrl) => {
      const a = document.createElement("a");
      a.href = dataUrl;
      a.download = "cloud-wiz-architecture.png";
      a.click();
    });
  }, [getNodes]);

  return (
    <button
      onClick={handleDownload}
      className="absolute right-3 top-3 z-10 flex items-center gap-1.5 border border-green bg-black px-2.5 py-1 text-[10px] font-bold uppercase text-green transition-colors hover:bg-green hover:text-black"
    >
      <Download className="h-3 w-3" />
      PNG
    </button>
  );
}

// ── Canvas ─────────────────────────────────────────────

interface CanvasProps {
  onOpenTemplates: () => void;
  onOpenContainerizer: () => void;
  onOpenImport: () => void;
  onOpenCombinedFlow: () => void;
}

export default function Canvas({
  onOpenTemplates,
  onOpenContainerizer,
  onOpenImport,
  onOpenCombinedFlow,
}: CanvasProps) {
  const {
    nodes,
    edges,
    onNodesChange,
    onEdgesChange,
    onConnect,
  } = useCanvasStore();

  const nodeTypes: NodeTypes = useMemo(() => ({ terminal: TerminalNode }), []);

  const proOptions = useMemo(() => ({ hideAttribution: true }), []);

  const defaultEdgeOptions = useMemo(
    () => ({
      style: { stroke: "#39FF14", strokeWidth: 1.5 },
      type: "smoothstep" as const,
    }),
    [],
  );

  const onNodeDelete = useCallback((deleted: { id: string }[]) => {
    const store = useCanvasStore.getState();
    const deletedIds = new Set(deleted.map((n) => n.id));
    store.setEdges(
      store.edges.filter(
        (e) => !deletedIds.has(e.source) && !deletedIds.has(e.target),
      ),
    );
  }, []);

  // Empty state — show welcome screen
  if (nodes.length === 0) {
    return (
      <WelcomeScreen
        onOpenTemplates={onOpenTemplates}
        onOpenContainerizer={onOpenContainerizer}
        onOpenImport={onOpenImport}
        onOpenCombinedFlow={onOpenCombinedFlow}
      />
    );
  }

  return (
    <div className="relative flex-1">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodesDelete={onNodeDelete}
        nodeTypes={nodeTypes}
        proOptions={proOptions}
        defaultEdgeOptions={defaultEdgeOptions}
        fitView
        fitViewOptions={{ padding: 0.15 }}
        deleteKeyCode={["Backspace", "Delete"]}
        className="bg-black"
        style={{ background: "#000000" }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={24}
          size={1}
          color="#39FF1420"
          style={{ background: "#000000" }}
        />
        <Controls
          showInteractive={false}
          className="!bg-black !border !border-green !shadow-none [&>button]:!bg-black [&>button]:!border-green [&>button]:!text-green [&>button]:!border [&>button]:hover:!bg-green/10 [&>button>svg]:!fill-green"
        />
        <MiniMap
          nodeColor={(n) => {
            const data = n.data as { chaosAffected?: boolean };
            return data?.chaosAffected ? "#FF5F1F" : "#39FF14";
          }}
          maskColor="#000000cc"
          style={{
            background: "#000000",
            border: "1px solid #39FF14",
            borderRadius: 0,
          }}
        />
        <DownloadButton />
      </ReactFlow>
    </div>
  );
}
