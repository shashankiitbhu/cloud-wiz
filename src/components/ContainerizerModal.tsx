"use client";

import { useState, useCallback, useEffect } from "react";
import {
  X,
  Loader2,
  ExternalLink,
  Copy,
  Check,
  Search,
  Lock,
  Unlock,
  GitBranch,
} from "lucide-react";
import useCanvasStore from "@/store/useCanvasStore";
import { fetchUser, fetchRepos, type GitHubRepo, type GitHubUser } from "@/lib/GitHubService";

// ── Constants ──────────────────────────────────────────

const GREEN = "#39FF14";
const ORANGE = "#FF5F1F";
const TOKEN_KEY = "cloud-wiz-gh-token";

// ── Types ──────────────────────────────────────────────

interface ContainerizeResult {
  owner: string;
  repo: string;
  detectedFile: string;
  language: string;
  framework: string;
  entrypoint: string;
  dockerfile: string;
  k8sYaml: string;
}

// ── Code Panel sub-component ───────────────────────────

function CodePanel({ title, code }: { title: string; code: string }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    await navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="flex flex-1 flex-col border" style={{ borderColor: GREEN }}>
      <div
        className="flex items-center justify-between border-b px-3 py-1.5"
        style={{ borderColor: GREEN, background: "#39FF140D" }}
      >
        <span
          className="text-[10px] font-bold uppercase tracking-widest"
          style={{ color: GREEN }}
        >
          {title}
        </span>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 text-[9px] uppercase transition-colors hover:text-white"
          style={{ color: "#888" }}
        >
          {copied ? (
            <Check className="h-2.5 w-2.5" style={{ color: GREEN }} />
          ) : (
            <Copy className="h-2.5 w-2.5" />
          )}
          {copied ? "Copied" : "Copy"}
        </button>
      </div>
      <div className="flex-1 overflow-auto p-3">
        <pre
          className="whitespace-pre text-[10px] leading-relaxed"
          style={{ color: `${GREEN}cc` }}
        >
          {code}
        </pre>
      </div>
    </div>
  );
}

// ── Modal ──────────────────────────────────────────────

interface ContainerizerModalProps {
  open: boolean;
  onClose: () => void;
}

export default function ContainerizerModal({
  open,
  onClose,
}: ContainerizerModalProps) {
  // GitHub auth (shared with SyncPanel via localStorage)
  const [token, setToken] = useState("");
  const [tokenInput, setTokenInput] = useState("");
  const [user, setUser] = useState<GitHubUser | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  // Repo selection
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [repoSearch, setRepoSearch] = useState("");
  const [selectedRepo, setSelectedRepo] = useState<GitHubRepo | null>(null);
  const [reposLoading, setReposLoading] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // Analysis
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<ContainerizeResult | null>(null);

  const addNode = useCanvasStore((s) => s.addNode);
  const nodes = useCanvasStore((s) => s.nodes);

  // Read token from shared localStorage on open & auto-auth
  useEffect(() => {
    if (open) {
      const stored = localStorage.getItem(TOKEN_KEY) ?? "";
      setToken(stored);
      if (stored && !user) {
        setAuthLoading(true);
        fetchUser(stored)
          .then((u) => setUser(u))
          .catch(() => {
            localStorage.removeItem(TOKEN_KEY);
            setToken("");
          })
          .finally(() => setAuthLoading(false));
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Fetch repos when authenticated
  useEffect(() => {
    if (!token || !user) return;
    setReposLoading(true);
    fetchRepos(token)
      .then(setRepos)
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
      setError("Authentication failed — check your token");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleRepoSearch = async (q: string) => {
    setRepoSearch(q);
    if (!token) return;
    setReposLoading(true);
    try {
      const results = q.trim()
        ? await fetchRepos(token, q.trim())
        : await fetchRepos(token);
      setRepos(results);
    } catch {
      /* ignore */
    } finally {
      setReposLoading(false);
    }
  };

  const handleAnalyze = useCallback(async () => {
    if (!selectedRepo || !token) return;

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const res = await fetch("/api/containerize", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          owner: selectedRepo.owner.login,
          repo: selectedRepo.name,
          ghToken: token,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Analysis failed");
        return;
      }

      setResult(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    } finally {
      setLoading(false);
    }
  }, [selectedRepo, token]);

  const handlePushToCanvas = useCallback(() => {
    if (!result || !selectedRepo) return;

    const id = `container-${Date.now()}`;
    const maxX = nodes.reduce(
      (max, n) => Math.max(max, (n.position?.x ?? 0) + 250),
      100
    );

    addNode({
      id,
      type: "terminal",
      position: { x: maxX, y: 200 },
      data: {
        label: `${result.repo} (${result.framework})`,
        type: "docker",
        containerMeta: {
          repoUrl: `https://github.com/${selectedRepo.full_name}`,
          language: result.language,
          framework: result.framework,
          dockerfile: result.dockerfile,
          k8sYaml: result.k8sYaml,
        },
      },
    });

    onClose();
    setResult(null);
    setSelectedRepo(null);
  }, [result, selectedRepo, nodes, addNode, onClose]);

  const handleClose = () => {
    onClose();
    setResult(null);
    setError(null);
  };

  if (!open) return null;

  const isConnected = !!token && !!user;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80">
      <div
        className="flex max-h-[85vh] w-full flex-col border bg-black"
        style={{
          borderColor: GREEN,
          maxWidth: result ? 900 : 540,
          transition: "max-width 0.2s",
        }}
      >
        {/* ── Header ── */}
        <div
          className="flex items-center justify-between border-b px-4 py-2"
          style={{ borderColor: GREEN }}
        >
          <div className="flex items-center gap-3">
            <span
              className="text-xs font-bold uppercase tracking-widest"
              style={{ color: GREEN }}
            >
              Source : Ingest
            </span>
            {result && (
              <span className="text-[10px] text-gray-light">
                {result.owner}/{result.repo}
              </span>
            )}
          </div>
          <button
            onClick={handleClose}
            className="p-1 transition-colors hover:text-green"
            style={{ color: "#888" }}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* ── Connect GitHub ── */}
        {!isConnected && (
          <div className="border-b px-4 py-4" style={{ borderColor: "#333" }}>
            <div
              className="mb-2 text-[10px] font-bold uppercase tracking-widest"
              style={{ color: "#888" }}
            >
              Connect GitHub
            </div>
            <p className="mb-3 text-[10px]" style={{ color: "#888" }}>
              Enter a GitHub Personal Access Token with{" "}
              <span style={{ color: GREEN }}>repo</span> scope.
            </p>
            <div className="flex gap-2">
              <input
                type="password"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleConnect()}
                placeholder="ghp_xxxxxxxxxxxx"
                className="flex-1 border bg-black px-2 py-1.5 text-xs outline-none focus:border-green"
                style={{
                  borderColor: "#333",
                  fontFamily: "inherit",
                  color: GREEN,
                }}
                disabled={authLoading}
              />
              <button
                onClick={handleConnect}
                disabled={authLoading || !tokenInput.trim()}
                className="flex items-center gap-2 border px-4 py-1.5 text-xs font-bold uppercase tracking-wide transition-colors disabled:opacity-30"
                style={{
                  borderColor: GREEN,
                  color: GREEN,
                }}
              >
                {authLoading ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : null}
                Connect
              </button>
            </div>
          </div>
        )}

        {/* ── Repo Selection ── */}
        {isConnected && !result && (
          <div className="border-b px-4 py-3" style={{ borderColor: "#333" }}>
            <div
              className="mb-2 text-[10px] font-bold uppercase tracking-widest"
              style={{ color: "#888" }}
            >
              Select Repository to Containerize
            </div>

            {/* Search input */}
            <div className="mb-2 flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-gray-light" />
                <input
                  type="text"
                  value={repoSearch}
                  onChange={(e) => handleRepoSearch(e.target.value)}
                  onFocus={() => setDropdownOpen(true)}
                  placeholder="Search your repositories..."
                  className="w-full border bg-black py-1.5 pl-7 pr-2 text-xs outline-none focus:border-green"
                  style={{
                    borderColor: "#333",
                    fontFamily: "inherit",
                    color: GREEN,
                  }}
                  disabled={loading}
                />
                {reposLoading && (
                  <Loader2 className="absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 animate-spin text-gray-light" />
                )}
              </div>
              <button
                onClick={handleAnalyze}
                disabled={!selectedRepo || loading}
                className="flex items-center gap-2 border px-4 py-1.5 text-xs font-bold uppercase tracking-wide transition-colors disabled:opacity-30"
                style={{
                  borderColor: GREEN,
                  color: !loading && selectedRepo ? "#000" : GREEN,
                  backgroundColor:
                    !loading && selectedRepo ? GREEN : "transparent",
                }}
              >
                {loading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : null}
                {loading ? "Analyzing..." : "[ ANALYZE REPO ]"}
              </button>
            </div>

            {/* Dropdown */}
            {dropdownOpen && !loading && (
              <div className="max-h-40 overflow-auto border bg-black" style={{ borderColor: "#333" }}>
                {repos.length === 0 ? (
                  <div className="px-2 py-2 text-[10px] text-gray-light">
                    {reposLoading ? "Loading..." : "No repos found"}
                  </div>
                ) : (
                  repos.map((r) => (
                    <button
                      key={r.id}
                      onClick={() => {
                        setSelectedRepo(r);
                        setDropdownOpen(false);
                        setRepoSearch("");
                      }}
                      className={`flex w-full items-center gap-2 px-2 py-1.5 text-left text-xs transition-colors hover:bg-green/10 ${
                        selectedRepo?.id === r.id
                          ? "text-green"
                          : "text-gray-light"
                      }`}
                    >
                      {r.private ? (
                        <Lock className="h-3 w-3 shrink-0" />
                      ) : (
                        <Unlock className="h-3 w-3 shrink-0" />
                      )}
                      <span className="truncate">{r.full_name}</span>
                    </button>
                  ))
                )}
              </div>
            )}

            {/* Selected repo chip */}
            {selectedRepo && !dropdownOpen && (
              <div
                className="flex items-center gap-2 border px-2 py-1.5 text-xs"
                style={{ borderColor: `${GREEN}4d`, color: GREEN }}
              >
                <GitBranch className="h-3 w-3 shrink-0" />
                <span className="truncate">{selectedRepo.full_name}</span>
                <span className="ml-auto text-[10px] text-gray-light">
                  {selectedRepo.default_branch}
                </span>
              </div>
            )}
          </div>
        )}

        {/* ── Error ── */}
        {error && (
          <div
            className="mx-4 mt-3 px-3 py-2 text-xs"
            style={{ color: ORANGE, borderLeft: `2px solid ${ORANGE}` }}
          >
            {error}
          </div>
        )}

        {/* ── Detection Summary ── */}
        {result && selectedRepo && (
          <div className="border-b px-4 py-3" style={{ borderColor: "#333" }}>
            <div className="flex flex-wrap gap-x-6 gap-y-1">
              {(
                [
                  ["Language", result.language],
                  ["Framework", result.framework],
                  ["Entry Point", result.entrypoint],
                  ["Dep File", result.detectedFile],
                ] as const
              ).map(([label, value]) => (
                <div key={label} className="text-[10px]">
                  <span style={{ color: "#888" }}>{label}: </span>
                  <span style={{ color: GREEN }}>{value}</span>
                </div>
              ))}
              <a
                href={`https://github.com/${selectedRepo.full_name}`}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1 text-[10px] transition-colors hover:text-white"
                style={{ color: "#888" }}
              >
                <ExternalLink className="h-2.5 w-2.5" />
                View Repo
              </a>
            </div>
          </div>
        )}

        {/* ── Code Output (side-by-side) ── */}
        {result && (
          <div className="flex flex-1 gap-px overflow-hidden bg-gray p-px">
            <CodePanel title="Dockerfile" code={result.dockerfile} />
            <CodePanel title="K8s Manifest" code={result.k8sYaml} />
          </div>
        )}

        {/* ── Footer ── */}
        {result && (
          <div
            className="flex items-center justify-between border-t px-4 py-3"
            style={{ borderColor: GREEN }}
          >
            <div className="text-[10px]" style={{ color: "#888" }}>
              Ready to deploy to canvas
            </div>
            <button
              onClick={handlePushToCanvas}
              className="flex items-center gap-2 border px-4 py-1.5 text-xs font-bold uppercase tracking-wide transition-colors hover:bg-green hover:text-black"
              style={{ borderColor: GREEN, color: GREEN }}
            >
              [ PUSH TO INFRASTRUCTURE CANVAS ]
            </button>
          </div>
        )}

        {/* ── Loading state ── */}
        {loading && (
          <div className="flex flex-1 items-center justify-center py-12">
            <div className="flex flex-col items-center gap-3">
              <Loader2
                className="h-6 w-6 animate-spin"
                style={{ color: GREEN }}
              />
              <div className="space-y-1 text-center">
                <div className="text-xs" style={{ color: GREEN }}>
                  Inspecting repository...
                </div>
                <div className="text-[10px]" style={{ color: "#888" }}>
                  Fetching dependency tree &rarr; Detecting stack &rarr;
                  Generating containers
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
