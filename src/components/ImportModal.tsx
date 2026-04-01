"use client";

import { useState, useRef } from "react";
import { Upload, FileText, AlertTriangle, X } from "lucide-react";
import useCanvasStore from "@/store/useCanvasStore";
import { detectAndParse } from "@/lib/importParsers";

interface ImportModalProps {
  open: boolean;
  onClose: () => void;
}

export default function ImportModal({ open, onClose }: ImportModalProps) {
  const [content, setContent] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const setNodes = useCanvasStore((s) => s.setNodes);
  const setEdges = useCanvasStore((s) => s.setEdges);

  const handleParse = (text: string, filename?: string) => {
    const result = detectAndParse(text, filename);
    setWarnings(result.warnings);

    if (result.nodes.length > 0) {
      useCanvasStore.getState().resetChaos();
      setNodes(result.nodes);
      setEdges(result.edges);
      onClose();
      setContent("");
      setWarnings([]);
    }
  };

  const handleFile = async (file: File) => {
    const text = await file.text();
    setContent(text);
    handleParse(text, file.name);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
      <div className="w-[600px] border border-green bg-black">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-green px-4 py-2">
          <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-green">
            <Upload className="h-3.5 w-3.5" />
            Import Infrastructure
          </div>
          <button
            onClick={() => { onClose(); setContent(""); setWarnings([]); }}
            className="p-1 text-gray-light transition-colors hover:text-green"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Drop zone */}
        <div
          className={`m-4 border-2 border-dashed p-6 text-center transition-colors ${
            dragOver ? "border-green bg-green/10" : "border-gray"
          }`}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
        >
          <FileText className="mx-auto mb-2 h-8 w-8 text-gray-light" />
          <p className="mb-1 text-xs text-white">
            Drop a file here or{" "}
            <button
              onClick={() => fileRef.current?.click()}
              className="text-green underline"
            >
              browse
            </button>
          </p>
          <p className="text-[10px] text-gray-light">
            Supports: docker-compose.yml, Kubernetes YAML, Terraform (.tf)
          </p>
          <input
            ref={fileRef}
            type="file"
            accept=".yml,.yaml,.tf,.json"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFile(file);
            }}
          />
        </div>

        {/* Or paste */}
        <div className="px-4 pb-2">
          <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-gray-light">
            Or paste your config
          </div>
          <textarea
            value={content}
            onChange={(e) => setContent(e.target.value)}
            placeholder={`# Paste docker-compose.yml, Kubernetes YAML, or Terraform here...\n\nservices:\n  web:\n    image: nginx:latest\n    depends_on:\n      - api\n  api:\n    image: node:20\n    depends_on:\n      - db\n  db:\n    image: postgres:16`}
            className="h-40 w-full border border-gray bg-black p-3 text-xs text-green placeholder-gray-light outline-none caret-green"
          />
        </div>

        {/* Warnings */}
        {warnings.length > 0 && (
          <div className="mx-4 mb-2 border border-orange bg-orange/5 p-2">
            {warnings.map((w, i) => (
              <div key={i} className="flex items-center gap-2 text-[10px] text-orange">
                <AlertTriangle className="h-3 w-3 shrink-0" />
                {w}
              </div>
            ))}
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end gap-2 border-t border-gray px-4 py-3">
          <button
            onClick={() => { onClose(); setContent(""); setWarnings([]); }}
            className="border border-gray px-3 py-1.5 text-xs text-gray-light transition-colors hover:border-green hover:text-green"
          >
            Cancel
          </button>
          <button
            onClick={() => handleParse(content)}
            disabled={!content.trim()}
            className="border border-green px-4 py-1.5 text-xs font-bold uppercase text-green transition-colors hover:bg-green hover:text-black disabled:opacity-30"
          >
            Parse & Import
          </button>
        </div>
      </div>
    </div>
  );
}
