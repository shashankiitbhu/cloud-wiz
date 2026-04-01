import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";

const SYSTEM_PROMPT = `You are a cloud infrastructure architect AI. The user will describe a system they need. You MUST respond with ONLY valid JSON — no markdown, no code fences, no explanation.

The JSON must match this exact schema:
{
  "nodes": [
    {
      "id": "unique-id",
      "label": "Human readable name",
      "type": "one of: docker | kubernetes | load-balancer | database | storage | server | firewall | cdn | queue | cache | api-gateway | monitoring"
    }
  ],
  "edges": [
    {
      "source": "source-node-id",
      "target": "target-node-id"
    }
  ]
}

Rules:
1. Generate between 5 and 15 nodes that form a realistic cloud architecture.
2. Every edge must reference valid node IDs from the nodes array.
3. Create a realistic topology — load balancers in front, databases at the back, services in the middle.
4. Use descriptive labels like "Nginx Load Balancer", "Auth Service Pod", "Redis Session Cache", "PostgreSQL Primary".
5. Include monitoring/observability nodes when appropriate.
6. Return ONLY the raw JSON object. No markdown. No backticks. No text before or after.

CONSTRAINT ENFORCEMENT (if the user includes CRITICAL CONSTRAINTS):
- You MUST select infrastructure nodes that fit the user's budget and operational preference.
- If they choose "Bootstrapped" or "Solo Dev", do NOT output Kubernetes, complex load balancers, or expensive AWS services. Favor free-tier friendly services like Vercel, Supabase, Cloudflare, or Render. Use "server" or "docker" node types for simple deployments.
- If they choose "MVP" scale, keep the architecture minimal (5-7 nodes). Do not over-engineer.
- If they choose "Startup" budget with "Small Team" ops, favor Docker-based deployments, managed databases, and simple load balancers. Avoid Kubernetes unless explicitly requested.
- Only generate Kubernetes nodes, complex networking (multiple firewalls, CDN + API gateway chains), and multi-region setups for "Enterprise" budget OR "Full Control" operational preference.
- Scale the number of nodes to match the expected traffic: MVP = 5-7 nodes, Launch = 7-10 nodes, Hypergrowth = 10-15 nodes.
- Always match infrastructure complexity to the operational preference. Solo devs should get PaaS-style architectures, not Kubernetes clusters.`;

export async function POST(req: NextRequest) {
  try {
    const { prompt } = await req.json();

    if (!prompt || typeof prompt !== "string") {
      return NextResponse.json(
        { error: "Prompt is required" },
        { status: 400 }
      );
    }

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
        temperature: 0.7,
        topP: 0.9,
        maxOutputTokens: 4096,
        responseMimeType: "application/json",
      },
    });

    const result = await model.generateContent([
      { text: SYSTEM_PROMPT },
      { text: `User request: ${prompt}` },
    ]);

    const text = result.response.text();

    // Parse and validate JSON
    let parsed: { nodes: Array<{ id: string; label: string; type: string }>; edges: Array<{ source: string; target: string }> };
    try {
      parsed = JSON.parse(text);
    } catch {
      // Try to extract JSON from the response if Gemini wraps it
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (!jsonMatch) {
        return NextResponse.json(
          { error: "AI returned invalid JSON", raw: text },
          { status: 502 }
        );
      }
      parsed = JSON.parse(jsonMatch[0]);
    }

    // Validate structure
    if (!Array.isArray(parsed.nodes) || !Array.isArray(parsed.edges)) {
      return NextResponse.json(
        { error: "Invalid response structure" },
        { status: 502 }
      );
    }

    const validTypes = new Set([
      "docker", "kubernetes", "load-balancer", "database", "storage",
      "server", "firewall", "cdn", "queue", "cache", "api-gateway", "monitoring",
    ]);

    // Sanitize nodes
    const nodeIds = new Set<string>();
    const nodes = parsed.nodes.map((n) => {
      nodeIds.add(n.id);
      return {
        id: n.id,
        label: n.label || n.id,
        type: validTypes.has(n.type) ? n.type : "server",
      };
    });

    // Sanitize edges — only keep edges with valid source/target
    const edges = parsed.edges
      .filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target))
      .map((e, i) => ({
        id: `e-${e.source}-${e.target}-${i}`,
        source: e.source,
        target: e.target,
      }));

    return NextResponse.json({ nodes, edges });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
