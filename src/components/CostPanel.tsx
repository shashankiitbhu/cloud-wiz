"use client";

import { useMemo, useState } from "react";
import { X, DollarSign, BarChart3, TrendingDown } from "lucide-react";
import useCanvasStore from "@/store/useCanvasStore";
import {
  type CloudProvider,
  estimateCosts,
  compareProviders,
} from "@/lib/costEstimation";

interface CostPanelProps {
  open: boolean;
  onClose: () => void;
}

const PROVIDER_LABELS: Record<CloudProvider, string> = {
  aws: "AWS",
  gcp: "GCP",
  azure: "Azure",
};

export default function CostPanel({ open, onClose }: CostPanelProps) {
  const [provider, setProvider] = useState<CloudProvider>("aws");
  const [showCompare, setShowCompare] = useState(false);
  const nodes = useCanvasStore((s) => s.nodes);

  const estimate = useMemo(() => estimateCosts(nodes, provider), [nodes, provider]);
  const comparison = useMemo(() => showCompare ? compareProviders(nodes) : null, [nodes, showCompare]);

  if (!open) return null;

  const maxCost = comparison
    ? Math.max(...Object.values(comparison).map((c) => c.totalMonthly))
    : estimate.totalMonthly;

  return (
    <div className="flex w-[400px] flex-col border-l border-green bg-black">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-green px-3 py-2">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-green">
          <DollarSign className="h-3.5 w-3.5" />
          Cost Estimate
        </div>
        <button
          onClick={onClose}
          className="p-1 text-gray-light transition-colors hover:text-green"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Provider tabs */}
      <div className="flex border-b border-green">
        {(["aws", "gcp", "azure"] as CloudProvider[]).map((p) => (
          <button
            key={p}
            onClick={() => setProvider(p)}
            className={`flex-1 px-3 py-2 text-xs font-bold uppercase tracking-wide transition-colors ${
              provider === p
                ? "border-b-2 border-green bg-green/10 text-green"
                : "text-gray-light hover:text-green"
            }`}
          >
            {PROVIDER_LABELS[p]}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-auto">
        {/* Totals */}
        <div className="border-b border-gray p-4">
          <div className="grid grid-cols-2 gap-3">
            <div className="border border-green bg-green/5 p-3 text-center">
              <div className="text-2xl font-bold text-green">
                ${estimate.totalMonthly.toLocaleString()}
              </div>
              <div className="text-[9px] uppercase text-gray-light">
                Per Month
              </div>
            </div>
            <div className="border border-green bg-green/5 p-3 text-center">
              <div className="text-2xl font-bold text-green">
                ${estimate.totalAnnual.toLocaleString()}
              </div>
              <div className="text-[9px] uppercase text-gray-light">
                Per Year
              </div>
            </div>
          </div>
        </div>

        {/* Compare toggle */}
        <div className="border-b border-gray px-4 py-2">
          <button
            onClick={() => setShowCompare((v) => !v)}
            className={`flex items-center gap-1.5 border px-2.5 py-1 text-[10px] font-bold uppercase transition-colors ${
              showCompare
                ? "border-green bg-green/10 text-green"
                : "border-gray text-gray-light hover:border-green hover:text-green"
            }`}
          >
            <BarChart3 className="h-3 w-3" />
            Compare All Providers
          </button>
        </div>

        {/* Provider comparison */}
        {comparison && (
          <div className="border-b border-gray p-4">
            <div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-gray-light">
              <TrendingDown className="h-3 w-3" />
              Monthly Cost Comparison
            </div>
            <div className="space-y-2">
              {(Object.entries(comparison) as [CloudProvider, ReturnType<typeof estimateCosts>][])
                .sort((a, b) => a[1].totalMonthly - b[1].totalMonthly)
                .map(([p, est], i) => (
                  <div key={p} className="flex items-center gap-3">
                    <span className="w-12 text-[10px] font-bold text-white">
                      {PROVIDER_LABELS[p]}
                    </span>
                    <div className="flex-1">
                      <div
                        className="h-4 transition-all duration-300"
                        style={{
                          width: `${maxCost > 0 ? (est.totalMonthly / maxCost) * 100 : 0}%`,
                          background: i === 0 ? "#39FF14" : i === 1 ? "#39FF1488" : "#39FF1444",
                          minWidth: 4,
                        }}
                      />
                    </div>
                    <span className={`w-16 text-right text-xs font-bold ${i === 0 ? "text-green" : "text-gray-light"}`}>
                      ${est.totalMonthly}
                    </span>
                    {i === 0 && (
                      <span className="bg-green px-1 text-[8px] font-bold text-black">
                        LOWEST
                      </span>
                    )}
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Item breakdown */}
        <div className="p-4">
          <div className="mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-gray-light">
            <DollarSign className="h-3 w-3" />
            Breakdown ({estimate.items.length} services)
          </div>
          <div className="space-y-1">
            {estimate.items.map((item, i) => (
              <div
                key={i}
                className="flex items-start gap-2 border border-gray bg-gray/10 p-2"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] font-bold text-white">
                      {item.node.data.label}
                    </span>
                  </div>
                  <div className="text-[9px] text-gray-light">
                    {item.service} — {item.notes}
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-xs font-bold text-green">
                    ${item.monthlyCost}
                  </div>
                  <div className="text-[8px] text-gray-light">/mo</div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Disclaimer */}
        <div className="px-4 pb-4">
          <p className="text-[9px] leading-relaxed text-gray-light">
            * Estimates based on typical production configs and public pricing.
            Actual costs vary based on usage, reserved instances, and discounts.
          </p>
        </div>
      </div>
    </div>
  );
}
