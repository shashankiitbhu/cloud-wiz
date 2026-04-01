"use client";

import {
  X,
  AlertTriangle,
  Shield,
  Flame,
  Activity,
  Target,
  TrendingDown,
  CheckCircle2,
  XCircle,
  AlertCircle,
} from "lucide-react";
import useCanvasStore from "@/store/useCanvasStore";

export default function ChaosReport() {
  const open = useCanvasStore((s) => s.chaosReportOpen);
  const impact = useCanvasStore((s) => s.failureImpact);
  const resilience = useCanvasStore((s) => s.resilienceReport);
  const setChaosReportOpen = useCanvasStore((s) => s.setChaosReportOpen);

  if (!open || !impact || !resilience) return null;

  const gradeColor =
    resilience.grade === "A"
      ? "text-green"
      : resilience.grade === "B"
        ? "text-green"
        : resilience.grade === "C"
          ? "text-yellow-400"
          : "text-orange";

  return (
    <div className="flex w-[420px] flex-col border-l border-orange bg-black">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-orange px-3 py-2">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-orange">
          <Flame className="h-3.5 w-3.5" />
          Chaos Report
        </div>
        <button
          onClick={() => setChaosReportOpen(false)}
          className="p-1 text-gray-light transition-colors hover:text-orange"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-auto">
        {/* Resilience Score */}
        <div className="border-b border-gray p-4">
          <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-gray-light">
            <Shield className="h-3 w-3" />
            Resilience Score
          </div>
          <div className="flex items-end gap-3">
            <span className={`text-4xl font-bold ${gradeColor}`}>
              {resilience.score}
            </span>
            <span className={`mb-1 text-2xl font-bold ${gradeColor}`}>
              {resilience.grade}
            </span>
            <span className="mb-1.5 text-xs text-gray-light">/ 100</span>
          </div>
          {/* Score bar */}
          <div className="mt-2 h-1.5 w-full bg-gray">
            <div
              className="h-full transition-all duration-500"
              style={{
                width: `${resilience.score}%`,
                background:
                  resilience.score >= 75
                    ? "#39FF14"
                    : resilience.score >= 50
                      ? "#FFD700"
                      : "#FF5F1F",
              }}
            />
          </div>
        </div>

        {/* Blast Radius */}
        <div className="border-b border-gray p-4">
          <div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-gray-light">
            <Target className="h-3 w-3" />
            Blast Radius
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div className="border border-orange bg-orange/5 p-2 text-center">
              <div className="text-lg font-bold text-orange">
                {impact.blastRadiusPercent}%
              </div>
              <div className="text-[9px] uppercase text-gray-light">
                Affected
              </div>
            </div>
            <div className="border border-orange bg-orange/5 p-2 text-center">
              <div className="text-lg font-bold text-orange">
                {impact.totalAffected}
              </div>
              <div className="text-[9px] uppercase text-gray-light">
                Nodes Hit
              </div>
            </div>
            <div className="border border-green bg-green/5 p-2 text-center">
              <div className="text-lg font-bold text-green">
                {impact.survived.length}
              </div>
              <div className="text-[9px] uppercase text-gray-light">
                Survived
              </div>
            </div>
          </div>
        </div>

        {/* Failure Origin */}
        <div className="border-b border-gray p-4">
          <div className="mb-2 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-gray-light">
            <Flame className="h-3 w-3" />
            Failure Origin
          </div>
          <div className="flex items-center gap-2 border border-orange bg-orange/10 px-3 py-2">
            <XCircle className="h-4 w-4 shrink-0 text-orange" />
            <div>
              <div className="text-xs font-bold text-orange">
                {impact.originNode.data.label}
              </div>
              <div className="text-[10px] uppercase text-gray-light">
                {impact.originNode.data.type}
              </div>
            </div>
          </div>
        </div>

        {/* Cascade Waves */}
        <div className="border-b border-gray p-4">
          <div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-gray-light">
            <TrendingDown className="h-3 w-3" />
            Cascade Waves ({impact.waves.length})
          </div>
          <div className="space-y-2">
            {impact.waves.map((wave, i) => (
              <div key={i} className="border border-gray bg-gray/20 p-2">
                <div className="mb-1 text-[10px] font-bold text-orange">
                  WAVE {i} — {i === 0 ? "ORIGIN" : `+${i * 600}ms`}
                </div>
                <div className="flex flex-wrap gap-1">
                  {wave.nodes.map((n) => (
                    <span
                      key={n.id}
                      className="border border-orange/50 bg-orange/10 px-1.5 py-0.5 text-[9px] text-orange"
                    >
                      {n.data.label}
                    </span>
                  ))}
                </div>
                <div className="mt-1 text-[9px] text-gray-light">
                  {wave.edges.length} edge{wave.edges.length !== 1 && "s"}{" "}
                  affected
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Hard vs Soft Failures */}
        <div className="border-b border-gray p-4">
          <div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-gray-light">
            <Activity className="h-3 w-3" />
            Failure Classification
          </div>

          {impact.hardFailures.length > 0 && (
            <div className="mb-3">
              <div className="mb-1 flex items-center gap-1 text-[10px] font-bold text-orange">
                <XCircle className="h-3 w-3" />
                Hard Failures — No alternative path
              </div>
              <div className="space-y-1">
                {impact.hardFailures.map((n) => (
                  <div
                    key={n.id}
                    className="flex items-center gap-2 bg-orange/5 px-2 py-1 text-[10px]"
                  >
                    <span className="h-1.5 w-1.5 bg-orange" />
                    <span className="text-white">{n.data.label}</span>
                    <span className="ml-auto uppercase text-gray-light">
                      {n.data.type}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {impact.softFailures.length > 0 && (
            <div className="mb-3">
              <div className="mb-1 flex items-center gap-1 text-[10px] font-bold text-yellow-400">
                <AlertCircle className="h-3 w-3" />
                Soft Failures — Alternative path exists
              </div>
              <div className="space-y-1">
                {impact.softFailures.map((n) => (
                  <div
                    key={n.id}
                    className="flex items-center gap-2 bg-yellow-400/5 px-2 py-1 text-[10px]"
                  >
                    <span className="h-1.5 w-1.5 bg-yellow-400" />
                    <span className="text-white">{n.data.label}</span>
                    <span className="ml-auto uppercase text-gray-light">
                      {n.data.type}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {impact.survived.length > 0 && (
            <div>
              <div className="mb-1 flex items-center gap-1 text-[10px] font-bold text-green">
                <CheckCircle2 className="h-3 w-3" />
                Survived — Unaffected
              </div>
              <div className="space-y-1">
                {impact.survived.map((n) => (
                  <div
                    key={n.id}
                    className="flex items-center gap-2 bg-green/5 px-2 py-1 text-[10px]"
                  >
                    <span className="h-1.5 w-1.5 bg-green" />
                    <span className="text-white">{n.data.label}</span>
                    <span className="ml-auto uppercase text-gray-light">
                      {n.data.type}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Single Points of Failure */}
        {resilience.singlePointsOfFailure.length > 0 && (
          <div className="border-b border-gray p-4">
            <div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-gray-light">
              <AlertTriangle className="h-3 w-3" />
              Single Points of Failure ({resilience.singlePointsOfFailure.length})
            </div>
            <div className="space-y-1">
              {resilience.singlePointsOfFailure.map((n) => (
                <div
                  key={n.id}
                  className="flex items-center gap-2 border-l-2 border-orange bg-orange/5 px-2 py-1.5 text-[10px]"
                >
                  <AlertTriangle className="h-3 w-3 shrink-0 text-orange" />
                  <div>
                    <span className="font-bold text-white">
                      {n.data.label}
                    </span>
                    <span className="ml-2 uppercase text-gray-light">
                      {n.data.type}
                    </span>
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-2 text-[9px] leading-relaxed text-gray-light">
              Removing any of these nodes disconnects part of the architecture.
              Consider adding redundancy or failover paths.
            </p>
          </div>
        )}

        {/* Redundancy Gaps */}
        {resilience.redundancyGaps.length > 0 && (
          <div className="border-b border-gray p-4">
            <div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-gray-light">
              <AlertCircle className="h-3 w-3" />
              Redundancy Gaps ({resilience.redundancyGaps.length})
            </div>
            <div className="space-y-2">
              {resilience.redundancyGaps.map((gap, i) => (
                <div
                  key={i}
                  className="border border-gray bg-gray/10 p-2"
                >
                  <div className="text-[10px] font-bold text-white">
                    {gap.node.data.label}
                  </div>
                  <div className="mt-0.5 text-[9px] leading-relaxed text-gray-light">
                    {gap.reason}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Metrics Summary */}
        <div className="p-4">
          <div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-gray-light">
            <Activity className="h-3 w-3" />
            Metrics
          </div>
          <div className="grid grid-cols-2 gap-2">
            {[
              {
                label: "SPOF Count",
                value: resilience.metrics.spofCount,
                bad: resilience.metrics.spofCount > 0,
              },
              {
                label: "Max Cascade Depth",
                value: resilience.metrics.maxCascadeDepth,
                bad: resilience.metrics.maxCascadeDepth > 3,
              },
              {
                label: "Avg Connectivity",
                value: resilience.metrics.avgConnectivity,
                bad: resilience.metrics.avgConnectivity < 2,
              },
              {
                label: "Redundant Paths",
                value: resilience.metrics.redundantPaths,
                bad: resilience.metrics.redundantPaths === 0,
              },
              {
                label: "Critical w/o Backup",
                value: resilience.metrics.criticalWithoutBackup,
                bad: resilience.metrics.criticalWithoutBackup > 0,
              },
              {
                label: "Critical Path Len",
                value: impact.criticalPath.length,
                bad: impact.criticalPath.length > 4,
              },
            ].map((m) => (
              <div key={m.label} className="border border-gray p-2">
                <div
                  className={`text-sm font-bold ${m.bad ? "text-orange" : "text-green"}`}
                >
                  {m.value}
                </div>
                <div className="text-[9px] uppercase text-gray-light">
                  {m.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
