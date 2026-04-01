"use client";

import { useState } from "react";
import { Send, Loader2 } from "lucide-react";

export default function PromptBar() {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || loading) return;
    // Will be wired to Gemini API in Phase 3
    setLoading(true);
    setTimeout(() => setLoading(false), 1500);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex items-center gap-3 border-t border-green bg-black px-4 py-3"
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
        disabled={loading}
      />

      {/* Submit */}
      <button
        type="submit"
        disabled={!prompt.trim() || loading}
        className="flex items-center gap-1.5 border border-green px-4 py-1.5 text-xs font-bold uppercase text-green transition-colors hover:bg-green hover:text-black disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-green"
      >
        {loading ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <Send className="h-3.5 w-3.5" />
        )}
        {loading ? "Generating..." : "Synthesize"}
      </button>
    </form>
  );
}
