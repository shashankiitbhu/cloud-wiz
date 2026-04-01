import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

// ── GitHub helpers ─────────────────────────────────────

const DEPENDENCY_FILES: Record<string, string> = {
  "package.json": "node",
  "requirements.txt": "python",
  "Pipfile": "python",
  "pom.xml": "java",
  "build.gradle": "java",
  "go.mod": "go",
};

function ghHeaders(token?: string): HeadersInit {
  const h: HeadersInit = { Accept: "application/vnd.github+json" };
  if (token) h.Authorization = `Bearer ${token}`;
  return h;
}

interface RepoAnalysis {
  owner: string;
  repo: string;
  language: string;
  framework: string;
  depFile: string;
  depContent: string;
}

async function analyzeRepo(
  owner: string,
  repo: string,
  token?: string
): Promise<RepoAnalysis> {
  // Fetch root tree
  const treeRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/git/trees/HEAD?recursive=0`,
    { headers: ghHeaders(token), next: { revalidate: 0 } }
  );
  if (!treeRes.ok) throw new Error(`Repo ${owner}/${repo} not found (${treeRes.status})`);
  const treeData = await treeRes.json();
  const files = (treeData.tree ?? [])
    .filter((t: { type: string }) => t.type === "blob")
    .map((t: { path: string }) => t.path);

  // Find dependency file
  let depFile: string | null = null;
  let language: string | null = null;
  for (const file of Object.keys(DEPENDENCY_FILES)) {
    if (files.includes(file)) {
      depFile = file;
      language = DEPENDENCY_FILES[file];
      break;
    }
  }
  if (!depFile || !language) {
    throw new Error(`No dependency file found in ${owner}/${repo}`);
  }

  // Fetch content
  const h: HeadersInit = { Accept: "application/vnd.github.raw+json" };
  if (token) h.Authorization = `Bearer ${token}`;
  const contentRes = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/${depFile}`,
    { headers: h, next: { revalidate: 0 } }
  );
  if (!contentRes.ok) throw new Error(`Could not fetch ${depFile} from ${owner}/${repo}`);
  const depContent = await contentRes.text();

  return { owner, repo, language, framework: "auto-detect", depFile, depContent };
}

// ── Gemini prompt ──────────────────────────────────────

const SYSTEM_PROMPT = `You are a senior DevOps architect. The user has multiple code repositories that form a single application stack. For each repo, you receive its dependency file content.

Your job:
1. Analyze each repo to determine its role (frontend, backend, worker, etc.), language, framework, and likely port.
2. Generate a complete, wired cloud architecture with proper service-to-service connections.
3. For each repo, generate a production-ready multi-stage Dockerfile.
4. Generate a GitHub Actions CI/CD workflow that builds, pushes to a registry, and deploys.

Respond with ONLY valid JSON matching this schema — no markdown, no code fences:
{
  "services": [
    {
      "repoFullName": "owner/repo",
      "role": "frontend | backend | worker | etc",
      "language": "string",
      "framework": "string",
      "port": 3000,
      "dockerfile": "string — full Dockerfile with \\n newlines",
      "envVars": ["DATABASE_URL", "API_URL", "etc"]
    }
  ],
  "architecture": {
    "nodes": [
      { "id": "string", "label": "string", "type": "docker | kubernetes | load-balancer | database | storage | server | firewall | cdn | queue | cache | api-gateway | monitoring", "repoFullName": "owner/repo or null — set this to the repo's full name if this node represents a repo service, null for infrastructure nodes like databases or load balancers" }
    ],
    "edges": [
      { "source": "node-id", "target": "node-id" }
    ]
  },
  "cicd": "string — a complete GitHub Actions workflow YAML as a single string with \\n newlines. It should have jobs for each service: build Docker image, push to ghcr.io, and a deploy step that runs terraform apply. Include placeholder secrets (AWS_ACCESS_KEY_ID, etc) as GitHub secrets references.",
  "envConfig": "string — a .env.example file showing all required environment variables with placeholder values and comments"
}

Rules:
- Create supporting infrastructure nodes (load balancer in front, database behind backend, cache if needed).
- Wire edges: load-balancer → frontend → backend → database. Workers connect to queues.
- The Dockerfiles must use multi-stage builds, non-root users, and health checks.
- The CI/CD workflow must be a single file that handles all services.
- Generate between 5-12 architecture nodes total.
- Return ONLY raw JSON.`;

// ── Route handler ──────────────────────────────────────

interface RepoInput {
  owner: string;
  repo: string;
}

export async function POST(req: NextRequest) {
  try {
    const { repos, ghToken, description } = (await req.json()) as {
      repos: RepoInput[];
      ghToken?: string;
      description?: string;
    };

    if (!repos || !Array.isArray(repos) || repos.length === 0) {
      return NextResponse.json(
        { error: "At least one repo is required" },
        { status: 400 }
      );
    }

    // 1 — Analyze all repos in parallel
    const analyses = await Promise.all(
      repos.map((r) => analyzeRepo(r.owner, r.repo, ghToken))
    );

    // 2 — Build Gemini prompt
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY not configured" },
        { status: 500 }
      );
    }

    const repoDescriptions = analyses
      .map(
        (a, i) =>
          `Repository ${i + 1}: ${a.owner}/${a.repo}\nLanguage: ${a.language}\nDependency file (${a.depFile}):\n${a.depContent}`
      )
      .join("\n\n---\n\n");

    const userPrompt = [
      description ? `User description: ${description}` : "",
      `Repositories to deploy:\n\n${repoDescriptions}`,
    ]
      .filter(Boolean)
      .join("\n\n");

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      generationConfig: {
        temperature: 0.5,
        topP: 0.9,
        maxOutputTokens: 8192,
        responseMimeType: "application/json",
      },
    });

    const result = await model.generateContent([
      { text: SYSTEM_PROMPT },
      { text: userPrompt },
    ]);

    const text = result.response.text();

    let parsed: {
      services: {
        repoFullName: string;
        role: string;
        language: string;
        framework: string;
        port: number;
        dockerfile: string;
        envVars: string[];
      }[];
      architecture: {
        nodes: { id: string; label: string; type: string; repoFullName?: string | null }[];
        edges: { source: string; target: string }[];
      };
      cicd: string;
      envConfig: string;
    };

    try {
      parsed = JSON.parse(text);
    } catch {
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return NextResponse.json(
          { error: "AI returned invalid JSON", raw: text },
          { status: 502 }
        );
      }
      parsed = JSON.parse(jsonMatch[0]);
    }

    // Validate
    if (!parsed.architecture?.nodes || !parsed.services) {
      return NextResponse.json(
        { error: "AI response missing required fields" },
        { status: 502 }
      );
    }

    const validTypes = new Set([
      "docker", "kubernetes", "load-balancer", "database", "storage",
      "server", "firewall", "cdn", "queue", "cache", "api-gateway", "monitoring",
    ]);

    const nodeIds = new Set<string>();
    const nodes = parsed.architecture.nodes.map((n) => {
      nodeIds.add(n.id);
      return {
        id: n.id,
        label: n.label || n.id,
        type: validTypes.has(n.type) ? n.type : "server",
        ...(n.repoFullName ? { sourceRepo: n.repoFullName } : {}),
      };
    });

    const edges = (parsed.architecture.edges ?? [])
      .filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target))
      .map((e, i) => ({
        id: `e-${e.source}-${e.target}-${i}`,
        source: e.source,
        target: e.target,
      }));

    return NextResponse.json({
      services: parsed.services,
      architecture: { nodes, edges },
      cicd: parsed.cicd || "",
      envConfig: parsed.envConfig || "",
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
