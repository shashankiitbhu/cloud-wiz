"use client";

import { useState, useMemo } from "react";
import { X, Copy, Check, FileCode, Download } from "lucide-react";
import useCanvasStore from "@/store/useCanvasStore";
import { generateK8sYaml } from "@/lib/generateK8s";
import { generateProviderTerraform, CLOUD_LABELS } from "@/lib/cloudProviders";

type Tab = "k8s" | "terraform";

interface ExportPanelProps {
  open: boolean;
  onClose: () => void;
}

export default function ExportPanel({ open, onClose }: ExportPanelProps) {
  const [tab, setTab] = useState<Tab>("k8s");
  const [copied, setCopied] = useState(false);
  const nodes = useCanvasStore((s) => s.nodes);
  const activeCloud = useCanvasStore((s) => s.activeCloud);

  const k8sCode = useMemo(() => generateK8sYaml(nodes), [nodes]);
  const tfCode = useMemo(
    () =>
      generateProviderTerraform(
        activeCloud,
        nodes.map((n) => ({ label: n.data.label, type: n.data.type }))
      ),
    [nodes, activeCloud]
  );
  const code = tab === "k8s" ? k8sCode : tfCode;

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = () => {
    const ext = tab === "k8s" ? "yaml" : "tf";
    const filename = `cloud-wiz-export.${ext}`;
    const blob = new Blob([code], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (!open) return null;

  return (
    <div className="flex w-[420px] flex-col border-l border-green bg-black">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-green px-3 py-2">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-green">
          <FileCode className="h-3.5 w-3.5" />
          Code Export
        </div>
        <button
          onClick={onClose}
          className="p-1 text-gray-light transition-colors hover:text-green"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex border-b border-green">
        <button
          onClick={() => setTab("k8s")}
          className={`flex-1 px-3 py-2 text-xs font-bold uppercase tracking-wide transition-colors ${
            tab === "k8s"
              ? "border-b-2 border-green bg-green/10 text-green"
              : "text-gray-light hover:text-green"
          }`}
        >
          Kubernetes YAML
        </button>
        <button
          onClick={() => setTab("terraform")}
          className={`flex-1 px-3 py-2 text-xs font-bold uppercase tracking-wide transition-colors ${
            tab === "terraform"
              ? "border-b-2 border-green bg-green/10 text-green"
              : "text-gray-light hover:text-green"
          }`}
        >
          Terraform ({CLOUD_LABELS[activeCloud]})
        </button>
      </div>

      {/* Actions */}
      <div className="flex gap-2 border-b border-gray px-3 py-2">
        <button
          onClick={handleCopy}
          className="flex items-center gap-1.5 border border-green px-2.5 py-1 text-[10px] font-bold uppercase text-green transition-colors hover:bg-green hover:text-black"
        >
          {copied ? (
            <Check className="h-3 w-3" />
          ) : (
            <Copy className="h-3 w-3" />
          )}
          {copied ? "Copied" : "Copy"}
        </button>
        <button
          onClick={handleDownload}
          className="flex items-center gap-1.5 border border-green px-2.5 py-1 text-[10px] font-bold uppercase text-green transition-colors hover:bg-green hover:text-black"
        >
          <Download className="h-3 w-3" />
          Download
        </button>
        <div className="ml-auto text-[10px] text-gray-light self-center">
          {nodes.length} node{nodes.length !== 1 && "s"}
        </div>
      </div>

      {/* Code */}
      <div className="flex-1 overflow-auto p-3">
        <pre className="whitespace-pre text-[11px] leading-relaxed text-green/80">
          {code}
        </pre>
      </div>
    </div>
  );
}
