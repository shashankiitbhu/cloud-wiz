"use client";

import { useState, useCallback } from "react";
import { Loader2 } from "lucide-react";
import useCanvasStore, {
  type BudgetTier,
  type ScaleTier,
  type OpsPref,
} from "@/store/useCanvasStore";
import { layoutFromResponse } from "@/lib/layoutNodes";

// ── Option definitions ─────────────────────────────────

const BUDGET_OPTIONS: { value: BudgetTier; label: string }[] = [
  { value: "bootstrapped", label: "Bootstrapped (Strictly Free Tiers / <$10)" },
  { value: "startup", label: "Startup ($50 - $250)" },
  { value: "enterprise", label: "Enterprise ($1,000+)" },
];

const SCALE_OPTIONS: { value: ScaleTier; label: string }[] = [
  { value: "mvp", label: "MVP (< 1,000 users)" },
  { value: "launch", label: "Launch (10k - 50k users)" },
  { value: "hypergrowth", label: "Hypergrowth (100k+ users)" },
];

const OPS_OPTIONS: { value: OpsPref; label: string }[] = [
  { value: "solo", label: "Solo Dev (Prefer PaaS, Serverless, BaaS like Supabase/Vercel)" },
  { value: "small-team", label: "Small Team (Comfortable with Docker, VPS, basic Cloud)" },
  { value: "full-control", label: "Full Control (AWS/GCP Native, Kubernetes, Complex Networking)" },
];

// ── Human-readable labels for the API payload ──────────

const BUDGET_LABELS: Record<BudgetTier, string> = {
  bootstrapped: "Bootstrapped (Free Tiers / <$10/mo)",
  startup: "Startup ($50 - $250/mo)",
  enterprise: "Enterprise ($1,000+/mo)",
};

const SCALE_LABELS: Record<ScaleTier, string> = {
  mvp: "MVP (< 1,000 users)",
  launch: "Launch (10k - 50k users)",
  hypergrowth: "Hypergrowth (100k+ users)",
};

const OPS_LABELS: Record<OpsPref, string> = {
  solo: "Solo Dev — PaaS, Serverless, BaaS (Supabase, Vercel, Render)",
  "small-team": "Small Team — Docker, VPS, basic Cloud",
  "full-control": "Full Control — AWS/GCP Native, Kubernetes, Complex Networking",
};

// ── Radio Group ────────────────────────────────────────

function RadioGroup<T extends string>({
  title,
  options,
  value,
  onChange,
}: {
  title: string;
  options: { value: T; label: string }[];
  value: T | null;
  onChange: (v: T) => void;
}) {
  return (
    <div>
      <div
        className="mb-2 text-[10px] font-bold uppercase tracking-widest"
        style={{ color: "#888" }}
      >
        {title}
      </div>
      <div className="space-y-1">
        {options.map((opt) => {
          const selected = value === opt.value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className="flex w-full items-start gap-2 px-2 py-1.5 text-left text-xs transition-colors hover:bg-green/5"
              style={{ color: selected ? "#39FF14" : "#888" }}
            >
              <span className="shrink-0 font-bold" style={{ fontFamily: "inherit" }}>
                {selected ? "[X]" : "[ ]"}
              </span>
              <span>{opt.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ── Modal ──────────────────────────────────────────────

export default function ConstraintModal() {
  const pendingPrompt = useCanvasStore((s) => s.pendingPrompt);
  const isOpen = useCanvasStore((s) => s.constraintModalOpen);
  const clearPendingPrompt = useCanvasStore((s) => s.clearPendingPrompt);
  const setNodes = useCanvasStore((s) => s.setNodes);
  const setEdges = useCanvasStore((s) => s.setEdges);
  const resetChaos = useCanvasStore((s) => s.resetChaos);

  const [budget, setBudget] = useState<BudgetTier | null>(null);
  const [scale, setScale] = useState<ScaleTier | null>(null);
  const [ops, setOps] = useState<OpsPref | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allSelected = budget && scale && ops;

  const handleCancel = useCallback(() => {
    clearPendingPrompt();
    setBudget(null);
    setScale(null);
    setOps(null);
    setError(null);
  }, [clearPendingPrompt]);

  const handleExecute = useCallback(async () => {
    if (!pendingPrompt || !budget || !scale || !ops) return;

    setLoading(true);
    setError(null);
    resetChaos();

    const constrainedPrompt = [
      `Original Request: ${pendingPrompt}`,
      `CRITICAL CONSTRAINTS:`,
      `- Budget Limit: ${BUDGET_LABELS[budget]}`,
      `- Expected Traffic: ${SCALE_LABELS[scale]}`,
      `- Infrastructure Complexity: ${OPS_LABELS[ops]}`,
    ].join("\n");

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: constrainedPrompt }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Generation failed");
        setLoading(false);
        return;
      }

      const { nodes, edges } = layoutFromResponse(data.nodes, data.edges);
      setNodes(nodes);
      setEdges(edges);

      // Clean up
      clearPendingPrompt();
      setBudget(null);
      setScale(null);
      setOps(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setLoading(false);
    }
  }, [pendingPrompt, budget, scale, ops, resetChaos, setNodes, setEdges, clearPendingPrompt]);

  if (!isOpen || !pendingPrompt) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
      <div
        className="w-full max-w-xl border bg-black"
        style={{ borderColor: "#39FF14" }}
      >
        {/* Header */}
        <div
          className="flex items-center justify-between border-b px-4 py-2"
          style={{ borderColor: "#39FF14" }}
        >
          <div
            className="text-xs font-bold uppercase tracking-widest"
            style={{ color: "#39FF14" }}
          >
            Architecture Right-Sizing
          </div>
          <button
            onClick={handleCancel}
            className="text-xs transition-colors hover:text-green"
            style={{ color: "#888" }}
          >
            [ESC]
          </button>
        </div>

        {/* Target prompt */}
        <div
          className="border-b px-4 py-3"
          style={{ borderColor: "#333" }}
        >
          <div className="text-xs" style={{ color: "#888" }}>
            <span style={{ color: "#39FF14" }}>&gt;</span> Target:{" "}
            <span className="text-white">&quot;{pendingPrompt}&quot;</span>
          </div>
        </div>

        {/* Constraint groups */}
        <div className="space-y-4 px-4 py-4">
          <RadioGroup
            title="1. Monthly Budget"
            options={BUDGET_OPTIONS}
            value={budget}
            onChange={setBudget}
          />
          <RadioGroup
            title="2. Expected Scale"
            options={SCALE_OPTIONS}
            value={scale}
            onChange={setScale}
          />
          <RadioGroup
            title="3. Operational Preference"
            options={OPS_OPTIONS}
            value={ops}
            onChange={setOps}
          />
        </div>

        {/* Error */}
        {error && (
          <div
            className="mx-4 mb-2 px-3 py-2 text-xs"
            style={{ color: "#FF5F1F", borderLeft: "2px solid #FF5F1F" }}
          >
            {error}
          </div>
        )}

        {/* Footer */}
        <div
          className="flex items-center justify-between border-t px-4 py-3"
          style={{ borderColor: "#39FF14" }}
        >
          <button
            onClick={handleCancel}
            className="px-3 py-1.5 text-[10px] font-bold uppercase tracking-wide transition-colors hover:text-white"
            style={{ color: "#888" }}
          >
            Cancel
          </button>
          <button
            onClick={handleExecute}
            disabled={!allSelected || loading}
            className="flex items-center gap-2 border px-4 py-1.5 text-xs font-bold uppercase tracking-wide transition-colors disabled:opacity-30"
            style={{
              borderColor: "#39FF14",
              color: allSelected && !loading ? "#000" : "#39FF14",
              backgroundColor: allSelected && !loading ? "#39FF14" : "transparent",
            }}
          >
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : null}
            {loading ? "Generating..." : "[ EXECUTE --GENERATE-ARCHITECTURE ]"}
          </button>
        </div>
      </div>
    </div>
  );
}
