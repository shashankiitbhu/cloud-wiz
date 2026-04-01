import type { InfraNode, CloudProvider } from "@/store/useCanvasStore";
import type { Edge } from "@xyflow/react";
import { generateProviderTerraform } from "./cloudProviders";
import { generateK8sYaml } from "./generateK8s";

// ── Types ──────────────────────────────────────────────

export interface GitHubUser {
  login: string;
  avatar_url: string;
  name: string | null;
}

export interface GitHubRepo {
  id: number;
  full_name: string;
  name: string;
  private: boolean;
  default_branch: string;
  owner: { login: string };
}

export interface SyncResult {
  prUrl: string;
  prNumber: number;
  branch: string;
}

export type LogLevel = "info" | "success" | "error";
export type LogCallback = (message: string, level: LogLevel) => void;

// ── Service ────────────────────────────────────────────

const API = "https://api.github.com";

function headers(token: string): HeadersInit {
  return {
    Authorization: `Bearer ${token}`,
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28",
  };
}

export async function fetchUser(token: string): Promise<GitHubUser> {
  const res = await fetch(`${API}/user`, { headers: headers(token) });
  if (!res.ok) throw new Error(`GitHub auth failed: ${res.status}`);
  return res.json();
}

export async function fetchRepos(
  token: string,
  query?: string
): Promise<GitHubRepo[]> {
  const perPage = 30;
  const url = query
    ? `${API}/search/repositories?q=${encodeURIComponent(query)}+user:@me&per_page=${perPage}`
    : `${API}/user/repos?sort=updated&per_page=${perPage}`;

  const res = await fetch(url, { headers: headers(token) });
  if (!res.ok) throw new Error(`Failed to fetch repos: ${res.status}`);

  const data = await res.json();
  return query ? data.items : data;
}

export async function createRepo(
  token: string,
  name: string,
  isPrivate: boolean
): Promise<GitHubRepo> {
  const res = await fetch(`${API}/user/repos`, {
    method: "POST",
    headers: headers(token),
    body: JSON.stringify({
      name,
      private: isPrivate,
      auto_init: true,
      description: "Infrastructure managed by Cloud Wiz",
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(
      err.message || `Failed to create repo: ${res.status}`
    );
  }
  return res.json();
}

// ── Build node summary for PR body ─────────────────────

function buildChangeSummary(nodes: InfraNode[]): string {
  const counts: Record<string, number> = {};
  for (const n of nodes) {
    const t = n.data.type;
    counts[t] = (counts[t] || 0) + 1;
  }
  return Object.entries(counts)
    .map(([type, count]) => `- ${count} ${type} node${count > 1 ? "s" : ""}`)
    .join("\n");
}

// ── Sync flow via GitHub Data API ──────────────────────

export async function syncToGitHub(
  token: string,
  repo: GitHubRepo,
  baseDir: string,
  nodes: InfraNode[],
  edges: Edge[],
  activeCloud: CloudProvider,
  log: LogCallback
): Promise<SyncResult> {
  const owner = repo.owner.login;
  const repoName = repo.name;
  const h = headers(token);

  // 1 — Resolve default branch ref
  log("Resolving default branch...", "info");
  const refRes = await fetch(
    `${API}/repos/${owner}/${repoName}/git/ref/heads/${repo.default_branch}`,
    { headers: h }
  );
  if (!refRes.ok) throw new Error("Could not resolve default branch ref");
  const refData = await refRes.json();
  const baseSha: string = refData.object.sha;

  // 2 — Generate code from canvas state
  log("Converting canvas state to code...", "info");
  const terraformContent = generateProviderTerraform(
    activeCloud,
    nodes.map((n) => ({ label: n.data.label, type: n.data.type }))
  );
  const k8sContent = generateK8sYaml(nodes);

  const dir = baseDir.replace(/^\.\//, "").replace(/\/$/, "");

  const files = [
    { path: `${dir}/main.tf`, content: terraformContent },
    { path: `${dir}/deployment.yaml`, content: k8sContent },
  ];

  // 3 — Create blobs
  log("Creating file blobs...", "info");
  const blobShas: { path: string; sha: string }[] = [];
  for (const file of files) {
    const blobRes = await fetch(
      `${API}/repos/${owner}/${repoName}/git/blobs`,
      {
        method: "POST",
        headers: h,
        body: JSON.stringify({
          content: file.content,
          encoding: "utf-8",
        }),
      }
    );
    if (!blobRes.ok) throw new Error(`Failed to create blob for ${file.path}`);
    const blob = await blobRes.json();
    blobShas.push({ path: file.path, sha: blob.sha });
  }
  log(`Created ${blobShas.length} blobs`, "success");

  // 4 — Create tree
  log("Building tree object...", "info");
  const treeRes = await fetch(
    `${API}/repos/${owner}/${repoName}/git/trees`,
    {
      method: "POST",
      headers: h,
      body: JSON.stringify({
        base_tree: baseSha,
        tree: blobShas.map((b) => ({
          path: b.path,
          mode: "100644",
          type: "blob",
          sha: b.sha,
        })),
      }),
    }
  );
  if (!treeRes.ok) throw new Error("Failed to create tree");
  const tree = await treeRes.json();

  // 5 — Create commit
  log("Creating commit...", "info");
  const commitRes = await fetch(
    `${API}/repos/${owner}/${repoName}/git/commits`,
    {
      method: "POST",
      headers: h,
      body: JSON.stringify({
        message: `vibe-sync: infrastructure update\n\nGenerated by Cloud Wiz\n${buildChangeSummary(nodes)}`,
        tree: tree.sha,
        parents: [baseSha],
      }),
    }
  );
  if (!commitRes.ok) throw new Error("Failed to create commit");
  const commit = await commitRes.json();

  // 6 — Create branch
  const now = new Date();
  const ts = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  const branchName = `vibe-sync-${ts}-${Date.now().toString(36)}`;

  log(`Pushing branch: ${branchName}...`, "info");
  const branchRes = await fetch(
    `${API}/repos/${owner}/${repoName}/git/refs`,
    {
      method: "POST",
      headers: h,
      body: JSON.stringify({
        ref: `refs/heads/${branchName}`,
        sha: commit.sha,
      }),
    }
  );
  if (!branchRes.ok) throw new Error("Failed to create branch");
  log(`Branch ${branchName} pushed`, "success");

  // 7 — Open PR
  log("Opening Pull Request...", "info");
  const summary = buildChangeSummary(nodes);
  const prRes = await fetch(
    `${API}/repos/${owner}/${repoName}/pulls`,
    {
      method: "POST",
      headers: h,
      body: JSON.stringify({
        title: "Vibe-Code Sync: Infrastructure Update",
        head: branchName,
        base: repo.default_branch,
        body: `## Infrastructure Update\n\nGenerated by **Cloud Wiz** — Interactive Cloud Architecture Synthesizer\n\n### Changes\n${summary}\n\n### Files\n- \`${dir}/main.tf\` — Terraform configuration\n- \`${dir}/deployment.yaml\` — Kubernetes manifests\n\n---\n_This PR was automatically created by Cloud Wiz._`,
      }),
    }
  );
  if (!prRes.ok) {
    const err = await prRes.json().catch(() => ({}));
    throw new Error(err.message || "Failed to create PR");
  }
  const pr = await prRes.json();
  log(`Pull Request #${pr.number} created successfully.`, "success");

  return {
    prUrl: pr.html_url,
    prNumber: pr.number,
    branch: branchName,
  };
}
