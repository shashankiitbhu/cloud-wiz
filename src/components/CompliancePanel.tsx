"use client";

import { useMemo } from "react";
import {
  X,
  ShieldCheck,
  ShieldAlert,
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle2,
} from "lucide-react";
import useCanvasStore from "@/store/useCanvasStore";
import { runComplianceChecks, type Severity } from "@/lib/complianceChecker";

interface CompliancePanelProps {
  open: boolean;
  onClose: () => void;
}

const SEVERITY_CONFIG: Record<
  Severity,
  { icon: typeof AlertTriangle; color: string; bg: string; border: string }
> = {
  critical: { icon: ShieldAlert, color: "text-red-500", bg: "bg-red-500/10", border: "border-red-500" },
  high: { icon: AlertTriangle, color: "text-orange", bg: "bg-orange/10", border: "border-orange" },
  medium: { icon: AlertCircle, color: "text-yellow-400", bg: "bg-yellow-400/10", border: "border-yellow-400" },
  low: { icon: Info, color: "text-blue-400", bg: "bg-blue-400/10", border: "border-blue-400" },
};

export default function CompliancePanel({ open, onClose }: CompliancePanelProps) {
  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);

  const report = useMemo(() => runComplianceChecks(nodes, edges), [nodes, edges]);

  if (!open) return null;

  const scoreColor =
    report.score >= 80 ? "text-green" : report.score >= 60 ? "text-yellow-400" : "text-orange";

  return (
    <div className="flex w-[420px] flex-col border-l border-green bg-black">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-green px-3 py-2">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-green">
          <ShieldCheck className="h-3.5 w-3.5" />
          Compliance
        </div>
        <button
          onClick={onClose}
          className="p-1 text-gray-light transition-colors hover:text-green"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-auto">
        {/* Score */}
        <div className="border-b border-gray p-4">
          <div className="flex items-end gap-3">
            <span className={`text-4xl font-bold ${scoreColor}`}>
              {report.score}
            </span>
            <span className="mb-1.5 text-xs text-gray-light">/ 100</span>
          </div>
          <div className="mt-2 h-1.5 w-full bg-gray">
            <div
              className="h-full transition-all duration-500"
              style={{
                width: `${report.score}%`,
                background:
                  report.score >= 80 ? "#39FF14" : report.score >= 60 ? "#FFD700" : "#FF5F1F",
              }}
            />
          </div>
        </div>

        {/* Summary badges */}
        <div className="flex gap-2 border-b border-gray px-4 py-3">
          {(["critical", "high", "medium", "low"] as Severity[]).map((sev) => {
            const count = report.summary[sev];
            const cfg = SEVERITY_CONFIG[sev];
            return (
              <div
                key={sev}
                className={`flex items-center gap-1 border px-2 py-1 text-[10px] font-bold uppercase ${
                  count > 0 ? `${cfg.border} ${cfg.color}` : "border-gray text-gray-light"
                }`}
              >
                {count} {sev}
              </div>
            );
          })}
        </div>

        {/* Violations */}
        {report.violations.length > 0 && (
          <div className="border-b border-gray p-4">
            <div className="mb-3 text-[10px] font-bold uppercase tracking-widest text-gray-light">
              Violations ({report.violations.length})
            </div>
            <div className="space-y-2">
              {report.violations.map((v) => {
                const cfg = SEVERITY_CONFIG[v.severity];
                const Icon = cfg.icon;
                return (
                  <div key={v.id} className={`border-l-2 ${cfg.border} ${cfg.bg} p-3`}>
                    <div className="mb-1 flex items-center gap-2">
                      <Icon className={`h-3.5 w-3.5 shrink-0 ${cfg.color}`} />
                      <span className="text-[10px] font-bold text-white">
                        {v.title}
                      </span>
                      <span className={`ml-auto text-[8px] font-bold uppercase ${cfg.color}`}>
                        {v.severity}
                      </span>
                    </div>
                    <p className="mb-2 text-[10px] leading-relaxed text-gray-light">
                      {v.description}
                    </p>
                    <div className="mb-2 border border-gray/50 bg-black/50 p-2">
                      <div className="text-[9px] font-bold uppercase text-green">
                        Recommendation
                      </div>
                      <p className="mt-0.5 text-[10px] leading-relaxed text-gray-light">
                        {v.recommendation}
                      </p>
                    </div>
                    {v.affectedNodes.length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {v.affectedNodes.map((n) => (
                          <span
                            key={n.id}
                            className={`border ${cfg.border} px-1.5 py-0.5 text-[8px] ${cfg.color}`}
                          >
                            {n.data.label}
                          </span>
                        ))}
                      </div>
                    )}
                    <div className="mt-1.5 text-[8px] text-gray-light">
                      {v.framework}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Passed checks */}
        {report.passed.length > 0 && (
          <div className="p-4">
            <div className="mb-3 text-[10px] font-bold uppercase tracking-widest text-gray-light">
              Passed ({report.passed.length})
            </div>
            <div className="space-y-1">
              {report.passed.map((p, i) => (
                <div key={i} className="flex items-center gap-2 bg-green/5 px-2 py-1.5">
                  <CheckCircle2 className="h-3 w-3 shrink-0 text-green" />
                  <span className="text-[10px] text-white">{p.title}</span>
                  <span className="ml-auto text-[8px] text-gray-light">{p.framework}</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
