"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Save,
  FolderOpen,
  Trash2,
  Plus,
  X,
  Download,
  Upload,
} from "lucide-react";
import useCanvasStore from "@/store/useCanvasStore";
import {
  type SavedArchitecture,
  listSaved,
  saveArchitecture,
  deleteArchitecture,
  loadArchitecture,
  generateId,
  setCurrentId,
  getCurrentId,
} from "@/lib/persistence";

interface SaveLoadPanelProps {
  open: boolean;
  onClose: () => void;
}

export default function SaveLoadPanel({ open, onClose }: SaveLoadPanelProps) {
  const [saved, setSaved] = useState<SavedArchitecture[]>([]);
  const [currentId, setCurrentIdState] = useState<string | null>(null);
  const [saveName, setSaveName] = useState("");
  const [showSaveForm, setShowSaveForm] = useState(false);

  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const setNodes = useCanvasStore((s) => s.setNodes);
  const setEdges = useCanvasStore((s) => s.setEdges);

  const refresh = useCallback(() => {
    setSaved(listSaved());
    setCurrentIdState(getCurrentId());
  }, []);

  useEffect(() => {
    if (open) refresh();
  }, [open, refresh]);

  const handleSave = () => {
    if (!saveName.trim()) return;
    const id = currentId || generateId();
    const arch: SavedArchitecture = {
      id,
      name: saveName.trim(),
      description: `${nodes.length} nodes, ${edges.length} edges`,
      nodes,
      edges,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    };
    saveArchitecture(arch);
    setCurrentId(id);
    setShowSaveForm(false);
    setSaveName("");
    refresh();
  };

  const handleQuickSave = () => {
    if (!currentId) {
      setShowSaveForm(true);
      return;
    }
    const existing = loadArchitecture(currentId);
    if (!existing) return;
    saveArchitecture({
      ...existing,
      nodes,
      edges,
      description: `${nodes.length} nodes, ${edges.length} edges`,
      updatedAt: Date.now(),
    });
    refresh();
  };

  const handleLoad = (id: string) => {
    const arch = loadArchitecture(id);
    if (!arch) return;
    useCanvasStore.getState().resetChaos();
    setNodes(arch.nodes);
    setEdges(arch.edges);
    setCurrentId(id);
    setCurrentIdState(id);
  };

  const handleDelete = (id: string) => {
    deleteArchitecture(id);
    if (currentId === id) {
      setCurrentId(null);
      setCurrentIdState(null);
    }
    refresh();
  };

  const handleNew = () => {
    useCanvasStore.getState().resetChaos();
    setNodes([]);
    setEdges([]);
    setCurrentId(null);
    setCurrentIdState(null);
  };

  const handleExportJson = () => {
    const data = { nodes, edges, exportedAt: new Date().toISOString() };
    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "cloud-wiz-architecture.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImportJson = () => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;
      const text = await file.text();
      try {
        const data = JSON.parse(text);
        if (data.nodes && data.edges) {
          useCanvasStore.getState().resetChaos();
          setNodes(data.nodes);
          setEdges(data.edges);
        }
      } catch {
        // invalid JSON
      }
    };
    input.click();
  };

  if (!open) return null;

  const formatDate = (ts: number) =>
    new Date(ts).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <div className="flex w-[340px] flex-col border-l border-green bg-black">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-green px-3 py-2">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-green">
          <FolderOpen className="h-3.5 w-3.5" />
          Projects
        </div>
        <button
          onClick={onClose}
          className="p-1 text-gray-light transition-colors hover:text-green"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Actions */}
      <div className="flex flex-wrap gap-1.5 border-b border-gray px-3 py-2">
        <button
          onClick={handleQuickSave}
          disabled={nodes.length === 0}
          className="flex items-center gap-1 border border-green px-2 py-1 text-[10px] font-bold uppercase text-green transition-colors hover:bg-green hover:text-black disabled:opacity-30"
        >
          <Save className="h-3 w-3" />
          {currentId ? "Save" : "Save As"}
        </button>
        <button
          onClick={() => setShowSaveForm(true)}
          disabled={nodes.length === 0}
          className="flex items-center gap-1 border border-green px-2 py-1 text-[10px] font-bold uppercase text-green transition-colors hover:bg-green hover:text-black disabled:opacity-30"
        >
          <Plus className="h-3 w-3" />
          Save New
        </button>
        <button
          onClick={handleNew}
          className="flex items-center gap-1 border border-green px-2 py-1 text-[10px] font-bold uppercase text-green transition-colors hover:bg-green hover:text-black"
        >
          <Plus className="h-3 w-3" />
          New
        </button>
        <button
          onClick={handleExportJson}
          disabled={nodes.length === 0}
          className="flex items-center gap-1 border border-green px-2 py-1 text-[10px] font-bold uppercase text-green transition-colors hover:bg-green hover:text-black disabled:opacity-30"
        >
          <Download className="h-3 w-3" />
          JSON
        </button>
        <button
          onClick={handleImportJson}
          className="flex items-center gap-1 border border-green px-2 py-1 text-[10px] font-bold uppercase text-green transition-colors hover:bg-green hover:text-black"
        >
          <Upload className="h-3 w-3" />
          Import
        </button>
      </div>

      {/* Save form */}
      {showSaveForm && (
        <div className="border-b border-green p-3">
          <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-gray-light">
            Save Architecture
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              placeholder="Architecture name..."
              className="flex-1 border border-green bg-black px-2 py-1 text-xs text-white placeholder-gray-light outline-none caret-green"
              autoFocus
              onKeyDown={(e) => e.key === "Enter" && handleSave()}
            />
            <button
              onClick={handleSave}
              disabled={!saveName.trim()}
              className="border border-green px-2 py-1 text-[10px] font-bold uppercase text-green transition-colors hover:bg-green hover:text-black disabled:opacity-30"
            >
              Save
            </button>
          </div>
        </div>
      )}

      {/* Saved list */}
      <div className="flex-1 overflow-auto">
        {saved.length === 0 ? (
          <div className="p-4 text-center text-xs text-gray-light">
            No saved architectures yet.
            <br />
            Generate one and save it.
          </div>
        ) : (
          <div className="divide-y divide-gray">
            {saved.map((arch) => (
              <div
                key={arch.id}
                className={`group flex items-start gap-2 px-3 py-2.5 transition-colors hover:bg-green/5 ${
                  currentId === arch.id ? "bg-green/10" : ""
                }`}
              >
                <div
                  className="flex-1 cursor-pointer"
                  onClick={() => handleLoad(arch.id)}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-white">
                      {arch.name}
                    </span>
                    {currentId === arch.id && (
                      <span className="bg-green px-1 text-[8px] font-bold text-black">
                        ACTIVE
                      </span>
                    )}
                  </div>
                  <div className="text-[10px] text-gray-light">
                    {arch.description}
                  </div>
                  <div className="text-[9px] text-gray-light">
                    {formatDate(arch.updatedAt)}
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(arch.id)}
                  className="mt-1 p-1 text-gray-light opacity-0 transition-all hover:text-orange group-hover:opacity-100"
                >
                  <Trash2 className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
