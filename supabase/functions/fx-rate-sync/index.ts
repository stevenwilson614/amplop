// fx-rate-sync Edge Function
// Fetches daily FX rates from Frankfurter (https://frankfurter.app)
// — free, no API key, backed by the European Central Bank.
//
// Deploy: supabase functions deploy fx-rate-sync --no-verify-jwt
// Test:   curl -X POST https://vqvknxpbdbqlibzhqutz.supabase.co/functions/v1/fx-rate-sync
// Cron:   see supabase/migrations/20260519000004_fx_cron.sql

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Currencies to fetch relative to IDR (via USD as the API base).
// Frankfurter returns X/USD rates; we cross-compute X/IDR = USD/IDR ÷ USD/X.
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

Deno.serve(async (_req) => {
  try {
    const res = await fetch(
      `https://api.frankfurter.app/latest?from=USD&to=${TARGET_CURRENCIES.join(",")}`,
      { headers: { "User-Agent": "Amplop/1.0 (household-budgeting)" } }
    );
    if (!res.ok) throw new Error(`Frankfurter returned HTTP ${res.status}`);

    const body = (await res.json()) as {
      rates: Record<string, number>;
      date: string;
    };
    const rates = body.rates;

    const usdToIdr = rates["IDR"];
    if (!usdToIdr) throw new Error("IDR rate missing from Frankfurter response");

    const fetchedAt = new Date().toISOString();

    // USD/IDR stored directly.
    // EUR/IDR etc. computed as: (USD→IDR) ÷ (USD→X) = X→IDR
    const rows = [
      { currency_pair: "USD/IDR", rate: usdToIdr, fetched_at: fetchedAt },
      ...Object.entries(rates)
        .filter(([c]) => c !== "IDR")
        .map(([c, usdRate]) => ({
          currency_pair: `${c}/IDR`,
          rate: usdToIdr / usdRate,
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

    console.log(`fx-rate-sync: inserted ${rows.length} pairs. USD/IDR = ${usdToIdr}`);

    return new Response(
      JSON.stringify({ ok: true, pairs: rows.length, usd_idr: usdToIdr, date: body.date }),
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
