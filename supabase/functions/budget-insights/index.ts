// budget-insights Edge Function
// Calls Anthropic Claude to analyze envelope spending and suggest transfers.
//
// Set secret: supabase secrets set ANTHROPIC_API_KEY=sk-ant-...
// Deploy: supabase functions deploy budget-insights --no-verify-jwt

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface BudgetSnapshot {
  displayCurrency: string;
  envelopes: Array<{
    id: string;
    name: string;
    monthlyBudgetIdr: number;
    totalSpentIdr: number;
    balanceIdr: number;
    avgMonthlySpendIdr: number;
    monthHistory: { month: string; spentIdr: number }[];
  }>;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
    if (!apiKey) {
      return json({ error: "ANTHROPIC_API_KEY not configured on server" }, 503);
    }

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Unauthorized" }, 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: userErr } = await supabase.auth.getUser();
    if (userErr || !user) return json({ error: "Unauthorized" }, 401);

    const { snapshot } = (await req.json()) as { snapshot: BudgetSnapshot };
    if (!snapshot?.envelopes?.length) {
      return json({ error: "No envelope data provided" }, 400);
    }

    const prompt = buildPrompt(snapshot);

    const aiRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 1200,
        messages: [{ role: "user", content: prompt }],
      }),
    });

    if (!aiRes.ok) {
      const errText = await aiRes.text();
      console.error("Anthropic error:", errText);
      return json({ error: "AI request failed" }, 502);
    }

    const aiBody = await aiRes.json();
    const text = aiBody.content?.[0]?.text ?? "";
    const parsed = parseInsightJson(text);

    return json(parsed, 200);
  } catch (err) {
    console.error("budget-insights failed:", err);
    return json({ error: String(err) }, 500);
  }
});

function buildPrompt(snapshot: BudgetSnapshot): string {
  const lines = snapshot.envelopes.map((e) => {
    const history = e.monthHistory
      .map((m) => `${m.month}: ${m.spentIdr} IDR spent`)
      .join("; ");
    const avg = e.avgMonthlySpendIdr ?? 0;
    return `- ${e.name}: monthly budget ${e.monthlyBudgetIdr} IDR, avg monthly spend ${avg} IDR, lifetime spent ${e.totalSpentIdr}, balance ${e.balanceIdr}. Last 12 months: ${history}`;
  }).join("\n");

  return `You are a warm, concise household budget coach for a family using envelope budgeting in Indonesia (amounts in IDR — whole rupiah, no decimals).

Analyze these envelopes with up to 12 months of imported transaction history:

${lines}

Identify patterns such as:
- Envelopes consistently under-spending their monthly budget (money sitting unused)
- Envelopes consistently over-spending or running short
- Practical transfer suggestions between envelopes (round amounts to sensible IDR steps like 50000, 100000, 250000)

Respond ONLY with valid JSON (no markdown fences):
{
  "message": "2-4 conversational sentences you'd speak aloud to the user, e.g. noticing Eating Out is underused while Groceries is often short, and asking if they'd like to reallocate",
  "suggestions": [
    {
      "fromEnvelope": "exact envelope name from data",
      "toEnvelope": "exact envelope name from data",
      "amountIdr": 100000,
      "reason": "brief reason"
    }
  ]
}

Include 0-2 suggestions max. Use exact envelope names from the data. amountIdr must be a positive integer in IDR.`;
}

function parseInsightJson(text: string): { message: string; suggestions: unknown[] } {
  const trimmed = text.trim();
  const jsonMatch = trimmed.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error("No JSON in AI response");
  const parsed = JSON.parse(jsonMatch[0]);
  return {
    message: String(parsed.message ?? "No insights available."),
    suggestions: Array.isArray(parsed.suggestions) ? parsed.suggestions : [],
  };
}

function json(body: unknown, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
