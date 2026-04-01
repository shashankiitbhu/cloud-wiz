"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  X,
  GitBranch,
  GitPullRequest,
  Lock,
  Unlock,
  Search,
  Loader2,
  ExternalLink,
  FolderOpen,
} from "lucide-react";

function GithubIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
    </svg>
  );
}
import useCanvasStore from "@/store/useCanvasStore";
import {
  fetchUser,
  fetchRepos,
  createRepo,
  syncToGitHub,
  type GitHubUser,
  type GitHubRepo,
  type LogLevel,
} from "@/lib/GitHubService";

// ── Constants ──────────────────────────────────────────

const TOKEN_KEY = "cloud-wiz-gh-token";
const GREEN = "#39FF14";
const ORANGE = "#FF5F1F";

// ── Types ──────────────────────────────────────────────

interface LogEntry {
  message: string;
  level: LogLevel;
  ts: number;
}

type RepoMode = "existing" | "new";

// ── Component ──────────────────────────────────────────

interface SyncPanelProps {
  open: boolean;
  onClose: () => void;
}

export default function SyncPanel({ open, onClose }: SyncPanelProps) {
  // Auth
  const [token, setToken] = useState(() =>
    typeof window !== "undefined"
      ? localStorage.getItem(TOKEN_KEY) ?? ""
      : ""
  );
  const [tokenInput, setTokenInput] = useState("");
  const [user, setUser] = useState<GitHubUser | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  // Repo selection
  const [repoMode, setRepoMode] = useState<RepoMode>("existing");
  const [repos, setRepos] = useState<GitHubRepo[]>([]);
  const [repoSearch, setRepoSearch] = useState("");
  const [selectedRepo, setSelectedRepo] = useState<GitHubRepo | null>(null);
  const [reposLoading, setReposLoading] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);

  // New repo
  const [newRepoName, setNewRepoName] = useState("");
  const [newRepoPrivate, setNewRepoPrivate] = useState(true);

  // Directory
  const [baseDir, setBaseDir] = useState("./infra");

  // Sync
  const [syncing, setSyncing] = useState(false);
  const [lastPrUrl, setLastPrUrl] = useState<string | null>(null);

  // Console log
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const consoleRef = useRef<HTMLDivElement>(null);

  const nodes = useCanvasStore((s) => s.nodes);
  const edges = useCanvasStore((s) => s.edges);
  const activeCloud = useCanvasStore((s) => s.activeCloud);

  // ── Helpers ────────────────────────────────────────

  const addLog = useCallback((message: string, level: LogLevel) => {
    setLogs((prev) => [...prev, { message, level, ts: Date.now() }]);
  }, []);

  useEffect(() => {
    consoleRef.current?.scrollTo(0, consoleRef.current.scrollHeight);
  }, [logs]);

  // Auto-authenticate on mount if token exists
  useEffect(() => {
    if (token && !user) {
      setAuthLoading(true);
      fetchUser(token)
        .then((u) => {
          setUser(u);
          addLog(`Authenticated as ${u.login}`, "success");
        })
        .catch(() => {
          localStorage.removeItem(TOKEN_KEY);
          setToken("");
        })
        .finally(() => setAuthLoading(false));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Fetch repos when authenticated
  useEffect(() => {
    if (user && token) {
      setReposLoading(true);
      fetchRepos(token)
        .then(setRepos)
        .catch(() => addLog("Failed to load repositories", "error"))
        .finally(() => setReposLoading(false));
    }
  }, [user, token, addLog]);

  // ── Actions ────────────────────────────────────────

  const handleConnect = async () => {
    if (!tokenInput.trim()) return;
    setAuthLoading(true);
    addLog("Authenticating with GitHub...", "info");
    try {
      const u = await fetchUser(tokenInput.trim());
      setToken(tokenInput.trim());
      localStorage.setItem(TOKEN_KEY, tokenInput.trim());
      setUser(u);
      setTokenInput("");
      addLog(`Authenticated as ${u.login} [OK]`, "success");
    } catch {
      addLog("Authentication failed — check your token", "error");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleDisconnect = () => {
    localStorage.removeItem(TOKEN_KEY);
    setToken("");
    setUser(null);
    setRepos([]);
    setSelectedRepo(null);
    setLogs([]);
    addLog("Disconnected from GitHub", "info");
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
      addLog("Repo search failed", "error");
    } finally {
      setReposLoading(false);
    }
  };

  const handleSync = async () => {
    if (nodes.length === 0) {
      addLog("Canvas is empty — nothing to sync", "error");
      return;
    }

    setSyncing(true);
    setLastPrUrl(null);
    addLog("Starting sync...", "info");

    try {
      let targetRepo = selectedRepo;

      // Create new repo if needed
      if (repoMode === "new") {
        if (!newRepoName.trim()) {
          addLog("Repo name is required", "error");
          setSyncing(false);
          return;
        }
        addLog(`Creating repository: ${newRepoName}...`, "info");
        targetRepo = await createRepo(token, newRepoName.trim(), newRepoPrivate);
        setSelectedRepo(targetRepo);
        addLog(`Repository created: ${targetRepo.full_name}`, "success");
      }

      if (!targetRepo) {
        addLog("No repository selected", "error");
        setSyncing(false);
        return;
      }

      addLog(`Target: ${targetRepo.full_name}/${baseDir.replace(/^\.\//, "")}`, "info");
      addLog("Calculating diff...", "info");

      const result = await syncToGitHub(
        token,
        targetRepo,
        baseDir,
        nodes,
        edges,
        activeCloud,
        addLog
      );

      setLastPrUrl(result.prUrl);
    } catch (err) {
      addLog(
        err instanceof Error ? err.message : "Sync failed — unknown error",
        "error"
      );
    } finally {
      setSyncing(false);
    }
  };

  // ── Render ─────────────────────────────────────────

  if (!open) return null;

  const filteredRepos = repos;
  const isConnected = !!user;

  return (
    <div className="flex w-[420px] flex-col border-l border-green bg-black">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-green px-3 py-2">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-green">
          <GithubIcon className="h-3.5 w-3.5" />
          Git Sync
        </div>
        <button
          onClick={onClose}
          className="p-1 text-gray-light transition-colors hover:text-green"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Scrollable body */}
      <div className="flex-1 overflow-auto">
        {/* ── Auth Section ── */}
        <div className="border-b border-gray px-3 py-3">
          <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-gray-light">
            GitHub Connection
          </div>

          {!isConnected ? (
            <div className="space-y-2">
              <p className="text-[10px] text-gray-light">
                Enter a GitHub Personal Access Token with <span className="text-green">repo</span> scope.
              </p>
              <input
                type="password"
                value={tokenInput}
                onChange={(e) => setTokenInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleConnect()}
                placeholder="ghp_xxxxxxxxxxxx"
                className="w-full border border-gray bg-black px-2 py-1.5 text-xs text-green placeholder-gray-light outline-none focus:border-green"
                style={{ fontFamily: "inherit" }}
              />
              <button
                onClick={handleConnect}
                disabled={authLoading || !tokenInput.trim()}
                className="flex w-full items-center justify-center gap-2 border border-green px-3 py-1.5 text-xs font-bold uppercase text-green transition-colors hover:bg-green hover:text-black disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-green"
              >
                {authLoading ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <GithubIcon className="h-3 w-3" />
                )}
                Connect GitHub
              </button>
            </div>
          ) : (
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <img
                  src={user.avatar_url}
                  alt=""
                  className="h-5 w-5 border border-green"
                  style={{ borderRadius: 0 }}
                />
                <span className="text-xs text-green">{user.login}</span>
              </div>
              <button
                onClick={handleDisconnect}
                className="text-[10px] uppercase text-gray-light transition-colors hover:text-orange"
                style={{ color: undefined }}
              >
                Disconnect
              </button>
            </div>
          )}
        </div>

        {/* ── Repo Selection ── */}
        {isConnected && (
          <div className="border-b border-gray px-3 py-3">
            <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-gray-light">
              Repository
            </div>

            {/* Mode tabs */}
            <div className="mb-3 flex border border-gray">
              <button
                onClick={() => setRepoMode("existing")}
                className={`flex-1 px-2 py-1 text-[10px] font-bold uppercase transition-colors ${
                  repoMode === "existing"
                    ? "bg-green/10 text-green"
                    : "text-gray-light hover:text-green"
                }`}
              >
                Existing Repo
              </button>
              <button
                onClick={() => setRepoMode("new")}
                className={`flex-1 border-l border-gray px-2 py-1 text-[10px] font-bold uppercase transition-colors ${
                  repoMode === "new"
                    ? "bg-green/10 text-green"
                    : "text-gray-light hover:text-green"
                }`}
              >
                New Repo
              </button>
            </div>

            {repoMode === "existing" ? (
              <div className="space-y-2">
                {/* Search */}
                <div className="relative">
                  <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-gray-light" />
                  <input
                    type="text"
                    value={repoSearch}
                    onChange={(e) => handleRepoSearch(e.target.value)}
                    onFocus={() => setDropdownOpen(true)}
                    placeholder="Search repositories..."
                    className="w-full border border-gray bg-black py-1.5 pl-7 pr-2 text-xs text-green placeholder-gray-light outline-none focus:border-green"
                    style={{ fontFamily: "inherit" }}
                  />
                  {reposLoading && (
                    <Loader2 className="absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 animate-spin text-gray-light" />
                  )}
                </div>

                {/* Dropdown */}
                {dropdownOpen && (
                  <div className="max-h-40 overflow-auto border border-gray bg-black">
                    {filteredRepos.length === 0 ? (
                      <div className="px-2 py-2 text-[10px] text-gray-light">
                        {reposLoading ? "Loading..." : "No repos found"}
                      </div>
                    ) : (
                      filteredRepos.map((r) => (
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

                {/* Selected */}
                {selectedRepo && !dropdownOpen && (
                  <div className="flex items-center gap-2 border border-green/30 px-2 py-1.5 text-xs text-green">
                    <GitBranch className="h-3 w-3 shrink-0" />
                    <span className="truncate">{selectedRepo.full_name}</span>
                    <span className="ml-auto text-[10px] text-gray-light">
                      {selectedRepo.default_branch}
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                <input
                  type="text"
                  value={newRepoName}
                  onChange={(e) => setNewRepoName(e.target.value)}
                  placeholder="my-infrastructure"
                  className="w-full border border-gray bg-black px-2 py-1.5 text-xs text-green placeholder-gray-light outline-none focus:border-green"
                  style={{ fontFamily: "inherit" }}
                />
                <div className="flex items-center gap-3">
                  <label className="flex cursor-pointer items-center gap-1.5 text-[10px] text-gray-light">
                    <input
                      type="radio"
                      checked={newRepoPrivate}
                      onChange={() => setNewRepoPrivate(true)}
                      className="accent-green"
                      style={{ accentColor: GREEN }}
                    />
                    <Lock className="h-3 w-3" />
                    Private
                  </label>
                  <label className="flex cursor-pointer items-center gap-1.5 text-[10px] text-gray-light">
                    <input
                      type="radio"
                      checked={!newRepoPrivate}
                      onChange={() => setNewRepoPrivate(false)}
                      className="accent-green"
                      style={{ accentColor: GREEN }}
                    />
                    <Unlock className="h-3 w-3" />
                    Public
                  </label>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── Directory Config ── */}
        {isConnected && (repoMode === "new" || selectedRepo) && (
          <div className="border-b border-gray px-3 py-3">
            <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-gray-light">
              Base Directory
            </div>
            <div className="relative">
              <FolderOpen className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-gray-light" />
              <input
                type="text"
                value={baseDir}
                onChange={(e) => setBaseDir(e.target.value)}
                className="w-full border border-gray bg-black py-1.5 pl-7 pr-2 text-xs text-green outline-none focus:border-green"
                style={{ fontFamily: "inherit" }}
              />
            </div>
            <p className="mt-1 text-[9px] text-gray-light">
              Files will only be created within this path.
            </p>
          </div>
        )}

        {/* ── Sync Button ── */}
        {isConnected && (
          <div className="border-b border-gray px-3 py-3">
            <button
              onClick={handleSync}
              disabled={
                syncing ||
                nodes.length === 0 ||
                (repoMode === "existing" && !selectedRepo) ||
                (repoMode === "new" && !newRepoName.trim())
              }
              className="flex w-full items-center justify-center gap-2 border border-green px-3 py-2 text-xs font-bold uppercase tracking-wide text-green transition-colors hover:bg-green hover:text-black disabled:opacity-40 disabled:hover:bg-transparent disabled:hover:text-green"
            >
              {syncing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <GitPullRequest className="h-3.5 w-3.5" />
              )}
              {syncing ? "Syncing..." : "Commit to GitHub"}
            </button>

            {nodes.length === 0 && (
              <p className="mt-1.5 text-center text-[9px]" style={{ color: ORANGE }}>
                Canvas is empty — add nodes first
              </p>
            )}

            {lastPrUrl && (
              <a
                href={lastPrUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-2 flex items-center justify-center gap-1.5 text-[10px] text-green underline transition-colors hover:text-white"
              >
                <ExternalLink className="h-3 w-3" />
                View Pull Request
              </a>
            )}
          </div>
        )}
      </div>

      {/* ── Git Console ── */}
      <div className="border-t border-green">
        <div className="flex items-center justify-between border-b border-gray px-3 py-1">
          <span className="text-[10px] font-bold uppercase tracking-widest text-gray-light">
            Git Console
          </span>
          {logs.length > 0 && (
            <button
              onClick={() => setLogs([])}
              className="text-[9px] uppercase text-gray-light transition-colors hover:text-green"
            >
              Clear
            </button>
          )}
        </div>
        <div
          ref={consoleRef}
          className="h-40 overflow-auto px-3 py-2"
          style={{ fontFamily: "inherit" }}
        >
          {logs.length === 0 ? (
            <div className="text-[10px] text-gray-light">
              Waiting for commands...
              <span className="inline-block animate-blink ml-0.5">_</span>
            </div>
          ) : (
            logs.map((entry) => (
              <div
                key={entry.ts + entry.message}
                className="text-[10px] leading-relaxed"
                style={{
                  color:
                    entry.level === "success"
                      ? GREEN
                      : entry.level === "error"
                        ? ORANGE
                        : "#888888",
                }}
              >
                <span className="select-none" style={{ color: "#555" }}>
                  {"> "}
                </span>
                {entry.message}
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
