"use client";

import {
  Layers,
  FileCode,
  FolderOpen,
  Upload,
  Layout,
  DollarSign,
  ShieldCheck,
  Box,
  Database,
  Shield,
  Server,
  GitBranch as GitBranchIcon,
  Container,
  Workflow,
} from "lucide-react";
import useCanvasStore from "@/store/useCanvasStore";

export type SidebarPanel = "export" | "save" | "cost" | "compliance" | "github" | null;

interface SidebarProps {
  activePanel: SidebarPanel;
  onPanelChange: (panel: SidebarPanel) => void;
  onOpenImport: () => void;
  onOpenTemplates: () => void;
  onOpenContainerizer: () => void;
  onOpenCombinedFlow: () => void;
}

const NODE_PALETTE = [
  { icon: Server, label: "Server" },
  { icon: Database, label: "Database" },
  { icon: Box, label: "Container" },
  { icon: Shield, label: "Firewall" },
] as const;

interface NavItem {
  icon: typeof Layers;
  label: string;
  panel?: SidebarPanel;
  action?: () => void;
}

export default function Sidebar({
  activePanel,
  onPanelChange,
  onOpenImport,
  onOpenTemplates,
  onOpenContainerizer,
  onOpenCombinedFlow,
}: SidebarProps) {
  const nodeCount = useCanvasStore((s) => s.nodes.length);
  const edgeCount = useCanvasStore((s) => s.edges.length);
  const chaosMode = useCanvasStore((s) => s.chaosMode);

  const navItems: NavItem[] = [
    { icon: Layers, label: "Canvas", panel: null },
    { icon: FileCode, label: "Export", panel: "export" },
    { icon: FolderOpen, label: "Projects", panel: "save" },
    { icon: DollarSign, label: "Costs", panel: "cost" },
    { icon: ShieldCheck, label: "Compliance", panel: "compliance" },
    { icon: GitBranchIcon, label: "Git Sync", panel: "github" },
    { icon: Container, label: "Containerize", action: onOpenContainerizer },
    { icon: Workflow, label: "Combined Flow", action: onOpenCombinedFlow },
    { icon: Upload, label: "Import", action: onOpenImport },
    { icon: Layout, label: "Templates", action: onOpenTemplates },
  ];

  return (
    <aside className="flex w-48 flex-col border-r border-green bg-black">
      {/* Navigation */}
      <nav className="flex flex-col border-b border-green">
        <div className="border-b border-gray px-3 py-1.5 text-[10px] font-bold uppercase tracking-widest text-gray-light">
          Navigation
        </div>
        {navItems.map((item) => {
          const isActive =
            item.panel !== undefined && activePanel === item.panel;
          const isCanvas = item.panel === null && !item.action && activePanel === null;

          return (
            <button
              key={item.label}
              onClick={() => {
                if (item.action) {
                  item.action();
                } else if (item.panel !== undefined) {
                  onPanelChange(activePanel === item.panel ? null : item.panel);
                } else {
                  onPanelChange(null);
                }
              }}
              className={`flex items-center gap-2 px-3 py-2 text-xs transition-colors ${
                isActive || isCanvas
                  ? "bg-green/10 text-green"
                  : "text-gray-light hover:bg-green/5 hover:text-green"
              }`}
            >
              <item.icon className="h-3.5 w-3.5" />
              {item.label}
            </button>
          );
        })}
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
