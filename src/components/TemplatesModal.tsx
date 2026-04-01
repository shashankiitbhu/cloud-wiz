"use client";

import { X, Layout, Tag } from "lucide-react";
import useCanvasStore from "@/store/useCanvasStore";
import { TEMPLATES, type ArchTemplate } from "@/lib/templates";

interface TemplatesModalProps {
  open: boolean;
  onClose: () => void;
}

export default function TemplatesModal({ open, onClose }: TemplatesModalProps) {
  const setNodes = useCanvasStore((s) => s.setNodes);
  const setEdges = useCanvasStore((s) => s.setEdges);

  const handleSelect = (template: ArchTemplate) => {
    useCanvasStore.getState().resetChaos();
    // Deep clone to avoid shared references
    const nodes = JSON.parse(JSON.stringify(template.nodes));
    const edges = JSON.parse(JSON.stringify(template.edges));
    setNodes(nodes);
    setEdges(edges);
    onClose();
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
      <div className="w-[720px] max-h-[80vh] flex flex-col border border-green bg-black">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-green px-4 py-2">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-green">
            <Layout className="h-3.5 w-3.5" />
            Architecture Templates
          </div>
          <button
            onClick={onClose}
            className="p-1 text-gray-light transition-colors hover:text-green"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-4 text-xs text-gray-light">
          Start from a battle-tested pattern. Click to load, then customize.
        </div>

        {/* Template grid */}
        <div className="flex-1 overflow-auto px-4 pb-4">
          <div className="grid grid-cols-2 gap-3">
            {TEMPLATES.map((t) => (
              <button
                key={t.id}
                onClick={() => handleSelect(t)}
                className="group border border-gray bg-black p-4 text-left transition-all hover:border-green hover:bg-green/5"
              >
                <div className="mb-1 text-xs font-bold text-white group-hover:text-green">
                  {t.name}
                </div>
                <div className="mb-3 text-[10px] leading-relaxed text-gray-light">
                  {t.description}
                </div>
                <div className="mb-2 flex gap-3 text-[10px] text-gray-light">
                  <span>
                    <span className="text-green">{t.nodes.length}</span> nodes
                  </span>
                  <span>
                    <span className="text-green">{t.edges.length}</span> edges
                  </span>
                </div>
                <div className="flex flex-wrap gap-1">
                  {t.tags.map((tag) => (
                    <span
                      key={tag}
                      className="flex items-center gap-0.5 border border-gray px-1.5 py-0.5 text-[8px] uppercase text-gray-light group-hover:border-green/50 group-hover:text-green"
                    >
                      <Tag className="h-2 w-2" />
                      {tag}
                    </span>
                  ))}
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
