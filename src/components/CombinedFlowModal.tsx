"use client";

import { useState, useCallback, useEffect } from "react";
import {
  X,
  Loader2,
  Plus,
  Trash2,
  Search,
  Lock,
  Unlock,
  Copy,
  Check,
  GitBranch,
  Workflow,
} from "lucide-react";
import useCanvasStore from "@/store/useCanvasStore";
import { fetchUser, fetchRepos, type GitHubRepo, type GitHubUser } from "@/lib/GitHubService";
import { layoutFromResponse } from "@/lib/layoutNodes";

// ── Constants ──────────────────────────────────────────

const GREEN = "#39FF14";
const ORANGE = "#FF5F1F";
const TOKEN_KEY = "cloud-wiz-gh-token";

// ── Types ──────────────────────────────────────────────

interface ServiceResult {
  repoFullName: string;
  role: string;
  language: string;
  framework: string;
  port: number;
  dockerfile: string;
  envVars: string[];
}

interface CombinedResult {
  services: ServiceResult[];
  architecture: {
    nodes: { id: string; label: string; type: string }[];
    edges: { id: string; source: string; target: string }[];
  };
  cicd: string;
  envConfig: string;
}

type Step = "repos" | "loading" | "results";

// ── Code Panel ─────────────────────────────────────────

function CodePanel({ title, code }: { title: string; code: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div className="flex flex-col border" style={{ borderColor: GREEN }}>
      <div
        className="flex items-center justify-between border-b px-3 py-1.5"
        style={{ borderColor: GREEN, background: "#39FF140D" }}
      >
        <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: GREEN }}>
          {title}
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 text-[9px] uppercase transition-colors hover:text-white"
          style={{ color: "#888" }}
        >
          {copied ? <Check className="h-2.5 w-2.5" style={{ color: GREEN }} /> : <Copy className="h-2.5 w-2.5" />}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <div className="max-h-52 overflow-auto p-3">
        <pre className="whitespace-pre text-[10px] leading-relaxed" style={{ color: `${GREEN}cc` }}>
          {code}
        </pre>
      </div>
    </div>
  );
}

// ── Modal ──────────────────────────────────────────────

interface CombinedFlowModalProps {
  open: boolean;
  onClose: () => void;
}

export default function CombinedFlowModal({ open, onClose }: CombinedFlowModalProps) {
  // Auth
  const [token, setToken] = useState("");
  const [tokenInput, setTokenInput] = useState("");
  const [user, setUser] = useState<GitHubUser | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  // Repo picking
  const [allRepos, setAllRepos] = useState<GitHubRepo[]>([]);
  const [repoSearch, setRepoSearch] = useState("");
  const [reposLoading, setReposLoading] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [selectedRepos, setSelectedRepos] = useState<GitHubRepo[]>([]);
  const [description, setDescription] = useState("");

  // Flow
  const [step, setStep] = useState<Step>("repos");
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<CombinedResult | null>(null);
  const [activeTab, setActiveTab] = useState<"arch" | "dockerfiles" | "cicd" | "env">("arch");

  const setNodes = useCanvasStore((s) => s.setNodes);
  const setEdges = useCanvasStore((s) => s.setEdges);

  // Auth on open
  useEffect(() => {
    if (open) {
      const stored = localStorage.getItem(TOKEN_KEY) ?? "";
      setToken(stored);
      if (stored && !user) {
        setAuthLoading(true);
        fetchUser(stored)
          .then((u) => setUser(u))
          .catch(() => { localStorage.removeItem(TOKEN_KEY); setToken(""); })
          .finally(() => setAuthLoading(false));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Fetch repos
  useEffect(() => {
    if (!token || !user) return;
    setReposLoading(true);
    fetchRepos(token)
      .then(setAllRepos)
      .catch(() => {})
      .finally(() => setReposLoading(false));
  }, [token, user]);

  const handleConnect = async () => {
    if (!tokenInput.trim()) return;
    setAuthLoading(true);
    setError(null);
    try {
      const u = await fetchUser(tokenInput.trim());
      const t = tokenInput.trim();
      setToken(t);
      localStorage.setItem(TOKEN_KEY, t);
      setUser(u);
      setTokenInput("");
    } catch {
      setError("Authentication failed");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleRepoSearch = async (q: string) => {
    setRepoSearch(q);
    if (!token) return;
    setReposLoading(true);
    try {
      const results = q.trim() ? await fetchRepos(token, q.trim()) : await fetchRepos(token);
      setAllRepos(results);
    } catch { /* ignore */ }
    finally { setReposLoading(false); }
  };

  const addRepo = (repo: GitHubRepo) => {
    if (selectedRepos.find((r) => r.id === repo.id)) return;
    setSelectedRepos((prev) => [...prev, repo]);
    setDropdownOpen(false);
    setRepoSearch("");
  };

  const removeRepo = (id: number) => {
    setSelectedRepos((prev) => prev.filter((r) => r.id !== id));
  };

  // Execute combined flow
  const handleExecute = useCallback(async () => {
    if (selectedRepos.length === 0) return;
    setStep("loading");
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/combined-flow", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          repos: selectedRepos.map((r) => ({ owner: r.owner.login, repo: r.name })),
          ghToken: token,
          description: description.trim() || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Analysis failed");
        setStep("repos");
        return;
      }
      setResult(data);
      setStep("results");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
      setStep("repos");
    }
  }, [selectedRepos, token, description]);

  // Push to canvas
  const handlePushToCanvas = useCallback(() => {
    if (!result) return;
    const { nodes, edges } = layoutFromResponse(
      result.architecture.nodes,
      result.architecture.edges
    );
    useCanvasStore.getState().resetChaos();
    setNodes(nodes);
    setEdges(edges);
    handleClose();
  }, [result, setNodes, setEdges]);

  const handleClose = () => {
    onClose();
    setStep("repos");
    setResult(null);
    setError(null);
    setActiveTab("arch");
  };

  if (!open) return null;

  const isConnected = !!token && !!user;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
      <div
        className="flex max-h-[88vh] w-full flex-col border bg-black"
        style={{ borderColor: GREEN, maxWidth: step === "results" ? 960 : 580 }}
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between border-b px-4 py-2" style={{ borderColor: GREEN }}>
          <div className="flex items-center gap-3">
            <Workflow className="h-3.5 w-3.5" style={{ color: GREEN }} />
            <span className="text-xs font-bold uppercase tracking-widest" style={{ color: GREEN }}>
              Combined Flow
            </span>
            {step === "results" && (
              <span className="text-[10px] text-gray-light">
                {result?.services.length} services detected
              </span>
            )}
          </div>
          <button onClick={handleClose} className="p-1 transition-colors hover:text-green" style={{ color: "#888" }}>
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* ── Connect GitHub ── */}
        {!isConnected && (
          <div className="border-b px-4 py-4" style={{ borderColor: "#333" }}>
            <div className="mb-2 text-[10px] font-bold uppercase tracking-widest" style={{ color: "#888" }}>
              Connect GitHub
            </div>
            <p className="mb-3 text-[10px]" style={{ color: "#888" }}>
              Enter a GitHub Personal Access Token with <span style={{ color: GREEN }}>repo</span> scope.
            </p>
            <div className="flex gap-2">
              <input
                type="password"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleConnect()}
                placeholder="ghp_xxxxxxxxxxxx"
                className="flex-1 border bg-black px-2 py-1.5 text-xs outline-none focus:border-green"
                style={{ borderColor: "#333", fontFamily: "inherit", color: GREEN }}
                disabled={authLoading}
              />
              <button
                onClick={handleConnect}
                disabled={authLoading || !tokenInput.trim()}
                className="flex items-center gap-2 border px-4 py-1.5 text-xs font-bold uppercase tracking-wide transition-colors disabled:opacity-30"
                style={{ borderColor: GREEN, color: GREEN }}
              >
                {authLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                Connect
              </button>
            </div>
          </div>
        )}

        {/* ── Step: Repo Selection ── */}
        {isConnected && step === "repos" && (
          <div className="flex-1 overflow-auto">
            {/* Selected repos list */}
            <div className="border-b px-4 py-3" style={{ borderColor: "#333" }}>
              <div className="mb-2 text-[10px] font-bold uppercase tracking-widest" style={{ color: "#888" }}>
                Selected Repositories ({selectedRepos.length})
              </div>
              {selectedRepos.length === 0 ? (
                <p className="text-[10px]" style={{ color: "#555" }}>Add at least one repo to get started.</p>
              ) : (
                <div className="space-y-1">
                  {selectedRepos.map((r) => (
                    <div
                      key={r.id}
                      className="flex items-center justify-between border px-2 py-1.5 text-xs"
                      style={{ borderColor: `${GREEN}4d`, color: GREEN }}
                    >
                      <div className="flex items-center gap-2">
                        <GitBranch className="h-3 w-3 shrink-0" />
                        <span className="truncate">{r.full_name}</span>
                        {r.private && <Lock className="h-2.5 w-2.5" style={{ color: "#888" }} />}
                      </div>
                      <button onClick={() => removeRepo(r.id)} className="p-0.5 transition-colors hover:text-orange">
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Add repo search */}
            <div className="border-b px-4 py-3" style={{ borderColor: "#333" }}>
              <div className="mb-2 text-[10px] font-bold uppercase tracking-widest" style={{ color: "#888" }}>
                <Plus className="mr-1 inline h-3 w-3" />
                Add Repository
              </div>
              <div className="relative">
                <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-gray-light" />
                <input
                  type="text"
                  value={repoSearch}
                  onChange={(e) => handleRepoSearch(e.target.value)}
                  onFocus={() => setDropdownOpen(true)}
                  placeholder="Search your repositories..."
                  className="w-full border bg-black py-1.5 pl-7 pr-2 text-xs outline-none focus:border-green"
                  style={{ borderColor: "#333", fontFamily: "inherit", color: GREEN }}
                />
                {reposLoading && (
                  <Loader2 className="absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 animate-spin text-gray-light" />
                )}
              </div>
              {dropdownOpen && (
                <div className="mt-1 max-h-36 overflow-auto border bg-black" style={{ borderColor: "#333" }}>
                  {allRepos.length === 0 ? (
                    <div className="px-2 py-2 text-[10px] text-gray-light">
                      {reposLoading ? "Loading..." : "No repos found"}
                    </div>
                  ) : (
                    allRepos
                      .filter((r) => !selectedRepos.find((s) => s.id === r.id))
                      .map((r) => (
                        <button
                          key={r.id}
                          onClick={() => addRepo(r)}
                          className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-xs text-gray-light transition-colors hover:bg-green/10 hover:text-green"
                        >
                          {r.private ? <Lock className="h-3 w-3 shrink-0" /> : <Unlock className="h-3 w-3 shrink-0" />}
                          <span className="truncate">{r.full_name}</span>
                        </button>
                      ))
                  )}
                </div>
              )}
            </div>

            {/* Description */}
            <div className="border-b px-4 py-3" style={{ borderColor: "#333" }}>
              <div className="mb-2 text-[10px] font-bold uppercase tracking-widest" style={{ color: "#888" }}>
                Describe How They Connect (Optional)
              </div>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="e.g., React frontend calls the Express backend API. Backend uses Postgres for storage and Redis for sessions."
                rows={3}
                className="w-full resize-none border bg-black px-2 py-1.5 text-xs outline-none focus:border-green"
                style={{ borderColor: "#333", fontFamily: "inherit", color: GREEN }}
              />
            </div>

            {/* Error */}
            {error && (
              <div className="mx-4 mt-3 px-3 py-2 text-xs" style={{ color: ORANGE, borderLeft: `2px solid ${ORANGE}` }}>
                {error}
              </div>
            )}

            {/* Execute button */}
            <div className="px-4 py-3">
              <button
                onClick={handleExecute}
                disabled={selectedRepos.length === 0}
                className="flex w-full items-center justify-center gap-2 border px-4 py-2 text-xs font-bold uppercase tracking-wide transition-colors disabled:opacity-30"
                style={{
                  borderColor: GREEN,
                  color: selectedRepos.length > 0 ? "#000" : GREEN,
                  backgroundColor: selectedRepos.length > 0 ? GREEN : "transparent",
                }}
              >
                <Workflow className="h-3.5 w-3.5" />
                [ EXECUTE --COMBINED-FLOW ]
              </button>
            </div>
          </div>
        )}

        {/* ── Step: Loading ── */}
        {step === "loading" && (
          <div className="flex flex-1 items-center justify-center py-16">
            <div className="flex flex-col items-center gap-4">
              <Loader2 className="h-7 w-7 animate-spin" style={{ color: GREEN }} />
              <div className="space-y-1 text-center">
                <div className="text-xs" style={{ color: GREEN }}>Analyzing {selectedRepos.length} repositories...</div>
                <div className="text-[10px]" style={{ color: "#888" }}>
                  Inspecting dependencies &rarr; Detecting stack &rarr; Generating architecture &rarr; Building CI/CD
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ── Step: Results ── */}
        {step === "results" && result && (
          <>
            {/* Tabs */}
            <div className="flex border-b" style={{ borderColor: GREEN }}>
              {(
                [
                  ["arch", `Architecture (${result.architecture.nodes.length} nodes)`],
                  ["dockerfiles", `Dockerfiles (${result.services.length})`],
                  ["cicd", "CI/CD Workflow"],
                  ["env", "Env Config"],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  onClick={() => setActiveTab(key)}
                  className={`flex-1 px-3 py-2 text-[10px] font-bold uppercase tracking-wide transition-colors ${
                    activeTab === key
                      ? "border-b-2 border-green bg-green/10 text-green"
                      : "text-gray-light hover:text-green"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="flex-1 overflow-auto p-4">
              {activeTab === "arch" && (
                <div className="space-y-3">
                  {/* Services summary */}
                  <div className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#888" }}>
                    Detected Services
                  </div>
                  <div className="space-y-1">
                    {result.services.map((svc) => (
                      <div
                        key={svc.repoFullName}
                        className="flex items-center justify-between border px-3 py-2"
                        style={{ borderColor: "#333" }}
                      >
                        <div>
                          <span className="text-xs text-white">{svc.repoFullName}</span>
                          <span className="ml-2 text-[9px] uppercase" style={{ color: GREEN }}>
                            {svc.role}
                          </span>
                        </div>
                        <div className="flex gap-3 text-[10px] text-gray-light">
                          <span>{svc.language}</span>
                          <span>{svc.framework}</span>
                          <span>:{svc.port}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                  {/* Node list */}
                  <div className="text-[10px] font-bold uppercase tracking-widest" style={{ color: "#888" }}>
                    Architecture Nodes
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {result.architecture.nodes.map((n) => (
                      <span
                        key={n.id}
                        className="border px-2 py-1 text-[10px]"
                        style={{ borderColor: `${GREEN}4d`, color: GREEN }}
                      >
                        {n.label} ({n.type})
                      </span>
                    ))}
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {result.architecture.edges.map((e) => (
                      <span key={e.id} className="text-[9px] text-gray-light">
                        {e.source} → {e.target}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === "dockerfiles" && (
                <div className="space-y-3">
                  {result.services.map((svc) => (
                    <CodePanel key={svc.repoFullName} title={`${svc.repoFullName} (${svc.role})`} code={svc.dockerfile} />
                  ))}
                </div>
              )}

              {activeTab === "cicd" && <CodePanel title="GitHub Actions Workflow (.github/workflows/deploy.yml)" code={result.cicd} />}

              {activeTab === "env" && <CodePanel title=".env.example" code={result.envConfig} />}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between border-t px-4 py-3" style={{ borderColor: GREEN }}>
              <button
                onClick={() => { setStep("repos"); setResult(null); }}
                className="text-[10px] uppercase text-gray-light transition-colors hover:text-green"
              >
                &larr; Back
              </button>
              <button
                onClick={handlePushToCanvas}
                className="flex items-center gap-2 border px-4 py-1.5 text-xs font-bold uppercase tracking-wide transition-colors hover:bg-green hover:text-black"
                style={{ borderColor: GREEN, color: GREEN }}
              >
                [ PUSH TO CANVAS ]
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
