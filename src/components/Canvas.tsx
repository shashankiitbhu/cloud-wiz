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
import { FolderOpen, Upload, Layout, Container, Trash2, Workflow, Download } from "lucide-react";

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

  return (
    <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-black">
      {/* Dot grid background */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(circle, #39FF1418 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />

      <div className="relative z-10 flex w-full max-w-2xl flex-col items-center gap-6 px-6">
        {/* Title */}
        <div className="flex flex-col items-center gap-2 text-center">
          <p className="text-sm font-bold uppercase tracking-widest text-green">
            Cloud Wiz
          </p>
          <p className="text-xs text-gray-light">
            Describe your architecture in below chat, or start from one of
            these options.
          </p>
        </div>

        {/* Quick actions */}
        <div className="flex flex-wrap justify-center gap-2">
          <button
            onClick={onOpenTemplates}
            className="flex items-center gap-2 border border-green px-4 py-2 text-xs font-bold uppercase tracking-wide text-green transition-colors hover:bg-green hover:text-black"
          >
            <Layout className="h-3.5 w-3.5" />
            Start from Template
          </button>
          <button
            onClick={onOpenContainerizer}
            className="flex items-center gap-2 border border-green px-4 py-2 text-xs font-bold uppercase tracking-wide text-green transition-colors hover:bg-green hover:text-black"
          >
            <Container className="h-3.5 w-3.5" />
            Containerize a Repo
          </button>
          <button
            onClick={onOpenCombinedFlow}
            className="flex items-center gap-2 border border-green px-4 py-2 text-xs font-bold uppercase tracking-wide text-green transition-colors hover:bg-green hover:text-black"
          >
            <Workflow className="h-3.5 w-3.5" />
            Combined Flow
          </button>
          <button
            onClick={onOpenImport}
            className="flex items-center gap-2 border border-green px-4 py-2 text-xs font-bold uppercase tracking-wide text-green transition-colors hover:bg-green hover:text-black"
          >
            <Upload className="h-3.5 w-3.5" />
            Import
          </button>
        </div>

        {/* Saved projects */}
        {saved.length > 0 && (
          <div className="w-full max-w-md">
            <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-gray-light">
              <FolderOpen className="h-3 w-3" />
              Saved Projects
            </div>
            <div className="border border-gray bg-black">
              {saved.slice(0, 5).map((arch) => (
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

        {/* Decorative corner brackets */}
        <div className="absolute -left-2 -top-2 h-6 w-6 border-l border-t border-green" />
        <div className="absolute -right-2 -top-2 h-6 w-6 border-r border-t border-green" />
        <div className="absolute -bottom-2 -left-2 h-6 w-6 border-b border-l border-green" />
        <div className="absolute -bottom-2 -right-2 h-6 w-6 border-b border-r border-green" />
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
