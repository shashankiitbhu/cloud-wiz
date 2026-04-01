"use client";

import { useCallback, useRef } from "react";
import { Terminal, Zap, RotateCcw, ExternalLink } from "lucide-react";
import useCanvasStore, { type CloudProvider } from "@/store/useCanvasStore";
import { analyzeFailure, analyzeResilience } from "@/lib/graphAnalysis";
import { CLOUD_LABELS, CLOUD_TAGS } from "@/lib/cloudProviders";

const CLOUDS: CloudProvider[] = ["aws", "digitalocean", "local-k8s"];

export default function Header() {
  const chaosMode = useCanvasStore((s) => s.chaosMode);
  const nodeCount = useCanvasStore((s) => s.nodes.length);
  const activeCloud = useCanvasStore((s) => s.activeCloud);
  const setActiveCloud = useCanvasStore((s) => s.setActiveCloud);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const triggerChaos = useCallback(() => {
    const store = useCanvasStore.getState();
    if (store.nodes.length === 0) return;

    // Reset any prior chaos
    store.resetChaos();

    // Run real analysis
    const impact = analyzeFailure(store.nodes, store.edges);
    const resilience = analyzeResilience(store.nodes, store.edges);

    store.setFailureImpact(impact);
    store.setResilienceReport(resilience);
    store.setChaosMode(true);
    store.setChaosReportOpen(true);

    // Clear any existing timers
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];

    // Animate waves from the real analysis
    impact.waves.forEach((wave, i) => {
      const timer = setTimeout(() => {
        const current = useCanvasStore.getState();

        // Mark nodes as chaos-affected
        for (const node of wave.nodes) {
          current.setChaosAffected(node.id, true);
        }

        // Turn affected edges orange
        const affectedEdgeIds = new Set(wave.edges.map((e) => e.id));
        const updatedEdges = useCanvasStore.getState().edges.map((e) =>
          affectedEdgeIds.has(e.id)
            ? {
                ...e,
                style: { stroke: "#FF5F1F", strokeWidth: 2 },
                animated: true,
              }
            : e
        );
        useCanvasStore.getState().setEdges(updatedEdges);
      }, i * 600);
      timersRef.current.push(timer);
    });
  }, []);

  const resetChaos = useCallback(() => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
    useCanvasStore.getState().resetChaos();
  }, []);

  return (
    <header className="flex items-center justify-between border-b border-green bg-black px-4 py-2 select-none">
      {/* Logo & Title */}
      <div className="flex items-center gap-3">
        <Terminal className="h-5 w-5 text-green" />
        <h1 className="text-sm font-bold tracking-widest text-green uppercase">
          Cloud&nbsp;Wiz
        </h1>
        <span className="ml-2 border border-green px-2 py-0.5 text-[10px] text-green">
          v0.1.0
        </span>
      </div>

      {/* Cloud Toggle */}
      <div className="hidden items-center gap-2 sm:flex">
        <span className="text-[10px] font-bold uppercase tracking-widest text-gray-light">
          Target:
        </span>
        <div className="flex border border-green">
          {CLOUDS.map((c) => (
            <button
              key={c}
              onClick={() => setActiveCloud(c)}
              className={`px-3 py-1 text-[10px] font-bold uppercase tracking-wide transition-colors ${
                activeCloud === c
                  ? "bg-green text-black"
                  : "text-green hover:bg-green/10"
              }`}
            >
              {CLOUD_LABELS[c]}
              <span
                className={`ml-1 text-[8px] ${
                  activeCloud === c ? "text-black/60" : "text-gray-light"
                }`}
              >
                {CLOUD_TAGS[c]}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-2">
        {chaosMode ? (
          <button
            onClick={resetChaos}
            className="flex items-center gap-1.5 border border-green bg-black px-3 py-1 text-xs font-bold uppercase text-green transition-colors hover:bg-green hover:text-black"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset
          </button>
        ) : (
          <button
            onClick={triggerChaos}
            disabled={nodeCount === 0}
            className="flex items-center gap-1.5 border border-orange bg-black px-3 py-1 text-xs font-bold uppercase text-orange transition-all hover:bg-orange hover:text-black disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-orange"
          >
            <Zap className="h-3.5 w-3.5" />
            Chaos
          </button>
        )}

        <a
          href="https://github.com"
          target="_blank"
          rel="noopener noreferrer"
          className="border border-green p-1.5 text-green transition-colors hover:bg-green hover:text-black"
        >
          <ExternalLink className="h-4 w-4" />
        </a>
      </div>
    </header>
  );
}
