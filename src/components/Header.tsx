"use client";

import { Terminal, Zap, ExternalLink } from "lucide-react";

export default function Header() {
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

      {/* Center status */}
      <div className="hidden items-center gap-2 text-xs text-gray-light sm:flex">
        <span className="inline-block h-2 w-2 bg-green" />
        SYSTEM ONLINE
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-2">
        {/* Chaos button placeholder — will be wired in Phase 4 */}
        <button
          disabled
          className="flex items-center gap-1.5 border border-orange bg-black px-3 py-1 text-xs font-bold uppercase text-orange opacity-40 transition-opacity hover:opacity-100 disabled:cursor-not-allowed disabled:opacity-40"
        >
          <Zap className="h-3.5 w-3.5" />
          Chaos
        </button>

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
