"use client";

import {
  Layers,
  Network,
  FileCode,
  Box,
  Database,
  Shield,
  Server,
} from "lucide-react";
import useCanvasStore from "@/store/useCanvasStore";

interface SidebarProps {
  onToggleExport: () => void;
  exportOpen: boolean;
}

const NODE_PALETTE = [
  { icon: Server, label: "Server" },
  { icon: Database, label: "Database" },
  { icon: Box, label: "Container" },
  { icon: Shield, label: "Firewall" },
] as const;

export default function Sidebar({ onToggleExport, exportOpen }: SidebarProps) {
  const nodeCount = useCanvasStore((s) => s.nodes.length);
  const edgeCount = useCanvasStore((s) => s.edges.length);
  const chaosMode = useCanvasStore((s) => s.chaosMode);

  return (
    <aside className="flex w-48 flex-col border-r border-green bg-black">
      {/* Navigation */}
      <nav className="flex flex-col border-b border-green">
        <div className="border-b border-gray px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-light">
          Navigation
        </div>
        <button
          className="flex items-center gap-2 px-3 py-2 text-xs transition-colors bg-green/10 text-green"
        >
          <Layers className="h-3.5 w-3.5" />
          Canvas
        </button>
        <button
          className="flex items-center gap-2 px-3 py-2 text-xs transition-colors text-gray-light hover:bg-green/5 hover:text-green"
        >
          <Network className="h-3.5 w-3.5" />
          Topology
        </button>
        <button
          onClick={onToggleExport}
          className={`flex items-center gap-2 px-3 py-2 text-xs transition-colors ${
            exportOpen
              ? "bg-green/10 text-green"
              : "text-gray-light hover:bg-green/5 hover:text-green"
          }`}
        >
          <FileCode className="h-3.5 w-3.5" />
          Export
        </button>
      </nav>

      {/* Node Palette */}
      <div className="flex flex-1 flex-col">
        <div className="border-b border-gray px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-light">
          Node Palette
        </div>
        <div className="grid grid-cols-2 gap-px bg-gray p-px">
          {NODE_PALETTE.map((node) => (
            <div
              key={node.label}
              className="flex cursor-grab flex-col items-center gap-1 bg-black p-3 text-green transition-colors hover:bg-green/10 active:cursor-grabbing"
            >
              <node.icon className="h-5 w-5" />
              <span className="text-[9px] uppercase tracking-wide">
                {node.label}
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* Footer stats */}
      <div className="border-t border-green p-3">
        <div className="space-y-1 text-[10px] text-gray-light">
          <div className="flex justify-between">
            <span>Nodes</span>
            <span className="text-green">{nodeCount}</span>
          </div>
          <div className="flex justify-between">
            <span>Edges</span>
            <span className="text-green">{edgeCount}</span>
          </div>
          <div className="flex justify-between">
            <span>Status</span>
            <span className={chaosMode ? "text-orange" : "text-green"}>
              {chaosMode ? "CHAOS" : nodeCount > 0 ? "ACTIVE" : "IDLE"}
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
}
