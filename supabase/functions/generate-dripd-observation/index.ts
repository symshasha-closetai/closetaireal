import { serve } from "https://deno.land/std@0.177.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `You are DRIPD AI Stylist — elite fashion intelligence.

Analyze outfit history using structured data + drip scores + user_memory.

RULES:
- No generic lines
- No repetition
- Be sharp, specific, high-IQ
- Focus: silhouette, contrast, structure, color, vibe

MEMORY:
If user_memory (past drip checks) exists:
- Subtly reference past patterns
- Show progression or stagnation
- Keep it natural, not forced

OUTPUT (strict):
1. WORKS: 1–2 insights about their style strengths
2. OFF: 0–1 issue (if any)
3. FIX: 2–3 precise upgrades they should try
4. OBSERVATION: 1 sharp, premium closing line reflecting overall style trajectory

STYLE:
- Clean, confident, slightly edgy
- No fluff, no explanation
- Occasionally reference improvement, ego, or past attempts to create emotional engagement

Return ONLY a JSON object:
{"works":"string","off":"string or empty","fix":["string","string"],"observation":"string"}

CRITICAL: Return ONLY valid JSON. No markdown. No extra text.`;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { dripHistory, gender } = await req.json();

    if (!dripHistory || !Array.isArray(dripHistory) || dripHistory.length === 0) {
      return new Response(JSON.stringify({ error: "No drip history provided" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("OPENAI_API_KEY");
    if (!apiKey) throw new Error("OPENAI_API_KEY not configured");

    // Build user memory from history
    const memory = dripHistory.map((entry: any, i: number) => {
      const score = entry.score || 0;
      const tag = entry.killer_tag || "N/A";
      const desc = entry.praise_line || entry.outfit_description || "N/A";
      const date = entry.created_at ? new Date(entry.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" }) : `Entry ${i + 1}`;
      return `${date}: Score ${score}/10 | Tag: "${tag}" | ${desc}`;
    }).join("\n");

    const avgScore = (dripHistory.reduce((sum: number, e: any) => sum + (e.score || 0), 0) / dripHistory.length).toFixed(1);
    const scores = dripHistory.map((e: any) => e.score || 0);
    const trend = scores.length >= 3
      ? scores[scores.length - 1] > scores[0] ? "improving" : scores[scores.length - 1] < scores[0] ? "declining" : "stable"
      : "too few entries";

    const userMessage = `Analyze this user's style trajectory.

Gender: ${gender || "unknown"}
Total checks: ${dripHistory.length}
Average score: ${avgScore}/10
Trend: ${trend}

Recent history (newest first):
${memory}

Generate your style observation based on their patterns, evolution, and current trajectory.`;

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "gpt-4.1",
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: userMessage },
        ],
        temperature: 0.8,
        max_tokens: 400,
      }),
    });

    if (!res.ok) {
      const t = await res.text();
      console.error(`OpenAI error [${res.status}]:`, t.substring(0, 300));
      throw new Error(`OpenAI ${res.status}`);
    }

    const data = await res.json();
    const content = data.choices?.[0]?.message?.content || "";
    const cleaned = content.replace(/```json\n?/g, "").replace(/```\n?/g, "").trim();

    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      const m = cleaned.match(/\{[\s\S]*\}/);
      if (m) parsed = JSON.parse(m[0]);
      else throw new Error("Failed to parse observation");
    }

    return new Response(JSON.stringify({ observation: parsed }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e: any) {
    console.error("generate-dripd-observation error:", e);
    return new Response(JSON.stringify({ error: e?.message || "Unknown error" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
