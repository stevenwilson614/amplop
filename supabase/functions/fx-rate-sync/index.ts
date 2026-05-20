// fx-rate-sync Edge Function
// Fetches daily FX rates — primary: open.er-api.com (market rates),
// fallback: Frankfurter/ECB.
//
// Deploy: supabase functions deploy fx-rate-sync --no-verify-jwt

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const TARGET_CURRENCIES = [
  "IDR",
  "EUR",
  "SGD",
  "AUD",
  "GBP",
  "JPY",
  "MYR",
  "THB",
  "PHP",
  "KRW",
  "CNY",
  "HKD",
];

async function fetchOpenErApi(): Promise<{ usdToIdr: number; date: string } | null> {
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD", {
      headers: { "User-Agent": "Amplop/1.0 (household-budgeting)" },
    });
    if (!res.ok) return null;
    const body = (await res.json()) as {
      result?: string;
      time_last_update_utc?: string;
      rates?: Record<string, number>;
    };
    const usdToIdr = body.rates?.IDR;
    if (!usdToIdr) return null;
    return { usdToIdr, date: body.time_last_update_utc ?? new Date().toISOString() };
  } catch {
    return null;
  }
}

async function fetchFrankfurter(): Promise<{ usdToIdr: number; date: string; rates: Record<string, number> } | null> {
  try {
    const res = await fetch(
      `https://api.frankfurter.app/latest?from=USD&to=${TARGET_CURRENCIES.join(",")}`,
      { headers: { "User-Agent": "Amplop/1.0 (household-budgeting)" } }
    );
    if (!res.ok) return null;
    const body = (await res.json()) as { rates: Record<string, number>; date: string };
    const usdToIdr = body.rates["IDR"];
    if (!usdToIdr) return null;
    return { usdToIdr, date: body.date, rates: body.rates };
  } catch {
    return null;
  }
}

Deno.serve(async (_req) => {
  try {
    const openEr = await fetchOpenErApi();
    const frankfurter = openEr ? null : await fetchFrankfurter();

    let usdToIdr: number;
    let crossRates: Record<string, number>;
    let sourceDate: string;

    if (openEr) {
      usdToIdr = openEr.usdToIdr;
      sourceDate = openEr.date;
      const res = await fetch("https://open.er-api.com/v6/latest/USD");
      const body = (await res.json()) as { rates: Record<string, number> };
      crossRates = body.rates ?? {};
    } else if (frankfurter) {
      usdToIdr = frankfurter.usdToIdr;
      sourceDate = frankfurter.date;
      crossRates = frankfurter.rates;
    } else {
      throw new Error("All FX sources failed");
    }

    const fetchedAt = new Date().toISOString();

    const rows = [
      { currency_pair: "USD/IDR", rate: usdToIdr, fetched_at: fetchedAt },
      ...TARGET_CURRENCIES.filter((c) => c !== "IDR" && crossRates[c])
        .map((c) => ({
          currency_pair: `${c}/IDR`,
          rate: usdToIdr / crossRates[c],
          fetched_at: fetchedAt,
        })),
    ];

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    const { error } = await supabase.from("fx_rates").insert(rows);
    if (error) throw error;

    console.log(`fx-rate-sync: inserted ${rows.length} pairs. USD/IDR = ${usdToIdr} (${sourceDate})`);

    return new Response(
      JSON.stringify({ ok: true, pairs: rows.length, usd_idr: usdToIdr, date: sourceDate }),
      { headers: { "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("fx-rate-sync failed:", err);
    return new Response(
      JSON.stringify({ ok: false, error: String(err) }),
      { status: 500, headers: { "Content-Type": "application/json" } }
    );
  }
});
