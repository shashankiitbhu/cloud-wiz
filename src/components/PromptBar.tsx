"use client";

import { useState } from "react";
import { Send, Loader2, AlertTriangle } from "lucide-react";
import useCanvasStore from "@/store/useCanvasStore";
import { layoutFromResponse } from "@/lib/layoutNodes";

export default function PromptBar() {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const setNodes = useCanvasStore((s) => s.setNodes);
  const setEdges = useCanvasStore((s) => s.setEdges);
  const resetChaos = useCanvasStore((s) => s.resetChaos);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prompt.trim() || loading) return;

    setLoading(true);
    setError(null);
    resetChaos();

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: prompt.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Generation failed");
        return;
      }

      const { nodes, edges } = layoutFromResponse(data.nodes, data.edges);
      setNodes(nodes);
      setEdges(edges);
      setPrompt("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setLoading(false);
    }
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
    </div>
  );
}
