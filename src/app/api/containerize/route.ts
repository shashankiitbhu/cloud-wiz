import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

// ── GitHub tree inspection ─────────────────────────────

const DEPENDENCY_FILES: Record<string, string> = {
  "package.json": "node",
  "requirements.txt": "python",
  "Pipfile": "python",
  "pom.xml": "java",
  "build.gradle": "java",
  "go.mod": "go",
};

interface TreeItem {
  path: string;
  type: string;
  url: string;
}

function ghHeaders(ghToken?: string): HeadersInit {
  const h: HeadersInit = { Accept: "application/vnd.github+json" };
  if (ghToken) h.Authorization = `Bearer ${ghToken}`;
  return h;
}

async function fetchRepoTree(
  owner: string,
  repo: string,
  ghToken?: string
): Promise<TreeItem[]> {
  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/git/trees/HEAD?recursive=0`,
    {
      headers: ghHeaders(ghToken),
      next: { revalidate: 0 },
    }
  );
  if (!res.ok) {
    const status = res.status;
    if (status === 404) throw new Error("Repository not found");
    throw new Error(`GitHub API error: ${status}`);
  }
  const data = await res.json();
  return data.tree ?? [];
}

async function fetchFileContent(
  owner: string,
  repo: string,
  path: string,
  ghToken?: string
): Promise<string> {
  const h: HeadersInit = { Accept: "application/vnd.github.raw+json" };
  if (ghToken) h.Authorization = `Bearer ${ghToken}`;
  const res = await fetch(
    `https://api.github.com/repos/${owner}/${repo}/contents/${path}`,
    {
      headers: h,
      next: { revalidate: 0 },
    }
  );
  if (!res.ok) throw new Error(`Could not fetch ${path}: ${res.status}`);
  return res.text();
}

// ── Gemini synthesis ───────────────────────────────────

const CONTAINER_SYSTEM_PROMPT = `You are an expert DevOps engineer. Analyze this dependency file. Identify the language, framework, and likely entry point. Generate two things in strict JSON format:
1. A highly optimized, multi-stage, production-ready Dockerfile.
2. A standard Kubernetes deployment.yaml and service.yaml to run this container.

Your response MUST be valid JSON matching this exact schema — no markdown, no code fences, no explanation:
{
  "language": "string — detected language (e.g. node, python, java, go)",
  "framework": "string — detected framework (e.g. express, fastapi, spring-boot, gin)",
  "entrypoint": "string — likely entry point file",
  "dockerfile": "string — the full Dockerfile content as a single string with \\n for newlines",
  "k8sYaml": "string — the full deployment.yaml + service.yaml as a single string with \\n for newlines"
}

Rules:
- Use multi-stage builds to minimize final image size.
- Pin base image versions (e.g. node:20-alpine, python:3.12-slim).
- Add proper HEALTHCHECK instructions.
- Use non-root users in the final stage.
- The Kubernetes deployment should use 2 replicas, resource requests/limits, and a readiness probe.
- The service should be ClusterIP on an appropriate port for the framework.
- Return ONLY the raw JSON object.`;

export async function POST(req: NextRequest) {
  try {
    const { owner, repo, ghToken } = await req.json();

    if (!owner || !repo) {
      return NextResponse.json(
        { error: "owner and repo are required" },
        { status: 400 }
      );
    }

    // 1 — Fetch root tree (authenticated if token provided)
    const tree = await fetchRepoTree(owner, repo, ghToken);

    // 2 — Detect dependency files
    const rootFiles = tree
      .filter((t) => t.type === "blob")
      .map((t) => t.path);

    let detectedFile: string | null = null;
    let detectedLang: string | null = null;

    for (const file of Object.keys(DEPENDENCY_FILES)) {
      if (rootFiles.includes(file)) {
        detectedFile = file;
        detectedLang = DEPENDENCY_FILES[file];
        break;
      }
    }

    if (!detectedFile || !detectedLang) {
      return NextResponse.json(
        {
          error:
            "No supported dependency file found. Looked for: " +
            Object.keys(DEPENDENCY_FILES).join(", "),
        },
        { status: 422 }
      );
    }

    // 3 — Fetch raw content
    const depContent = await fetchFileContent(owner, repo, detectedFile, ghToken);

    // 4 — Send to Gemini
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { error: "GEMINI_API_KEY not configured. Add it to .env.local" },
        { status: 500 }
      );
    }

    const genAI = new GoogleGenerativeAI(apiKey);
    const model = genAI.getGenerativeModel({
      model: "gemini-2.0-flash",
      generationConfig: {
        temperature: 0.4,
        topP: 0.9,
        maxOutputTokens: 4096,
        responseMimeType: "application/json",
      },
    });

    const result = await model.generateContent([
      { text: CONTAINER_SYSTEM_PROMPT },
      {
        text: `Repository: ${owner}/${repo}\nDependency file (${detectedFile}):\n\n${depContent}`,
      },
    ]);

    const text = result.response.text();

    let parsed: {
      language: string;
      framework: string;
      entrypoint: string;
      dockerfile: string;
      k8sYaml: string;
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

    if (!parsed.dockerfile || !parsed.k8sYaml) {
      return NextResponse.json(
        { error: "AI response missing required fields" },
        { status: 502 }
      );
    }

    return NextResponse.json({
      owner,
      repo,
      detectedFile,
      detectedLang,
      language: parsed.language || detectedLang,
      framework: parsed.framework || "unknown",
      entrypoint: parsed.entrypoint || "unknown",
      dockerfile: parsed.dockerfile,
      k8sYaml: parsed.k8sYaml,
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
