"use client";

import { MonitorDot } from "lucide-react";

export default function CanvasPlaceholder() {
  return (
    <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-black scanline-overlay">
      {/* Dot grid background */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(circle, #39FF1418 1px, transparent 1px)",
          backgroundSize: "24px 24px",
        }}
      />

      {/* Center message */}
      <div className="relative z-10 flex flex-col items-center gap-4 text-center">
        <div className="border border-green p-4">
          <MonitorDot className="h-10 w-10 text-green" />
        </div>
        <div className="space-y-2">
          <p className="text-sm font-bold uppercase tracking-widest text-green">
            Canvas Ready
          </p>
          <p className="max-w-sm text-xs leading-relaxed text-gray-light">
            Enter a prompt below to generate your cloud architecture.
            <br />
            The AI will synthesize nodes and connections in real time.
          </p>
        </div>

        {/* Decorative corner brackets */}
        <div className="absolute -left-8 -top-8 h-6 w-6 border-l border-t border-green" />
        <div className="absolute -right-8 -top-8 h-6 w-6 border-r border-t border-green" />
        <div className="absolute -bottom-8 -left-8 h-6 w-6 border-b border-l border-green" />
        <div className="absolute -bottom-8 -right-8 h-6 w-6 border-b border-r border-green" />
      </div>
    </div>
  );
}
