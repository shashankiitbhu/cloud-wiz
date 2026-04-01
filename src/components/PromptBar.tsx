"use client";

import { useState } from "react";
import { Send, AlertTriangle } from "lucide-react";
import useCanvasStore from "@/store/useCanvasStore";

export default function PromptBar() {
  const [prompt, setPrompt] = useState("");
  const [error, setError] = useState<string | null>(null);

  const setPendingPrompt = useCanvasStore((s) => s.setPendingPrompt);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim()) return;

    setPendingPrompt(prompt.trim());
    setPrompt("");
    setError(null);
  };

  return (
    <div className="border-t border-green bg-black">
      {error && (
        <div className="flex items-center gap-2 border-b border-orange bg-orange/5 px-4 py-2 text-xs text-orange">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          <span className="truncate">{error}</span>
          <button
            onClick={() => setError(null)}
            className="ml-auto text-orange hover:text-white"
          >
            ×
          </button>
        </div>
      )}
      <form
        onSubmit={handleSubmit}
        className="flex items-center gap-3 px-4 py-3"
      >
        {/* Prompt indicator */}
        <div className="flex items-center gap-1 text-green">
          <span className="text-xs font-bold">$</span>
          <span className="h-4 w-px bg-green animate-blink" />
        </div>

        {/* Input */}
        <input
          type="text"
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          placeholder="e.g., I need a scalable backend for an opinion-based social media app..."
          className="flex-1 border-none bg-transparent text-sm text-white placeholder-gray-light outline-none caret-green"
        />

        {/* Submit */}
        <button
          type="submit"
          disabled={!prompt.trim()}
          className="flex items-center gap-1.5 border border-green px-4 py-1.5 text-xs font-bold uppercase text-green transition-colors hover:bg-green hover:text-black disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-green"
        >
          <Send className="h-3.5 w-3.5" />
          Synthesize
        </button>
      </form>
    </div>
  );
}
