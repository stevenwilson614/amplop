import { useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
import { useHousehold } from "@/context/HouseholdContext";
import { supabase } from "@/lib/supabase";
import type { Envelope, EnvelopeSpent } from "@/lib/types";
import { format, convert } from "@/lib/currency";
import WhaleMood from "@/components/ui/WhaleMood";
import {
  buildBudgetSnapshot,
  fetchBudgetInsights,
  speakInsight,
  executeTransfer,
  resolveSuggestion,
  type InsightResponse,
  type TransferSuggestion,
} from "@/lib/budgetInsights";

export default function InsightsPage() {
  const { household, dbUser, fxRates } = useHousehold();
  const [envelopes, setEnvelopes] = useState<Envelope[]>([]);
  const [spentMap, setSpentMap] = useState<Record<string, number>>({});
  const [monthTxs, setMonthTxs] = useState<Array<{
    date: string;
    amount: number;
    amount_idr_snapshot: number;
    allocations?: { envelope_id: string; amount: number }[];
  }>>([]);
  const [insight, setInsight] = useState<InsightResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [transferring, setTransferring] = useState<number | null>(null);
  const [spoken, setSpoken] = useState(false);

  const load = useCallback(async () => {
    if (!household) return;
    const start = new Date();
    start.setMonth(start.getMonth() - 5);
    start.setDate(1);
    const startIso = start.toLocaleDateString("en-CA");

    const [{ data: envs }, { data: spent }, { data: txs }] = await Promise.all([
      supabase.from("envelopes").select("*").eq("household_id", household.id).is("trip_id", null),
      supabase.rpc("get_envelope_spent"),
      supabase
        .from("transactions")
        .select("date, amount, amount_idr_snapshot, allocations:transaction_allocations(envelope_id, amount)")
        .eq("household_id", household.id)
        .gte("date", startIso),
    ]);
    setEnvelopes(envs ?? []);
    setMonthTxs(txs ?? []);
    const map: Record<string, number> = {};
    for (const row of (spent as EnvelopeSpent[] ?? [])) map[row.envelope_id] = Number(row.spent_idr);
    setSpentMap(map);
  }, [household]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    function onChange() { load(); }
    window.addEventListener("amplop:data-changed", onChange);
    return () => window.removeEventListener("amplop:data-changed", onChange);
  }, [load]);

  const dc = dbUser?.display_currency ?? "IDR";

  async function runCoach() {
    if (!dbUser || !household) return;
    setLoading(true);
    setError("");
    setInsight(null);
    setSpoken(false);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Not signed in");

      const snapshot = buildBudgetSnapshot({
        envelopes,
        spentMap,
        monthTxs,
        fxRates,
        displayCurrency: dc,
      });

      const result = await fetchBudgetInsights(snapshot, session.access_token);
      setInsight(result);
      speakInsight(result.message);
      setSpoken(true);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not get insights");
    } finally {
      setLoading(false);
    }
  }

  async function applyTransfer(suggestion: TransferSuggestion, index: number) {
    if (!dbUser || !household) return;
    const resolved = resolveSuggestion(suggestion, envelopes);
    if (!resolved) {
      setError("Could not match envelope names for transfer");
      return;
    }
    setTransferring(index);
    setError("");
    try {
      await executeTransfer({
        householdId: household.id,
        userId: dbUser.id,
        fromEnvelopeId: resolved.fromId,
        toEnvelopeId: resolved.toId,
        amountIdr: resolved.amountIdr,
      });
      window.dispatchEvent(new CustomEvent("amplop:data-changed"));
      await load();
      setInsight((prev) => prev ? {
        ...prev,
        message: `Done! Transferred ${format(resolved.amountIdr, "IDR")} from ${suggestion.fromEnvelope} to ${suggestion.toEnvelope}.`,
        suggestions: prev.suggestions.filter((_, i) => i !== index),
      } : null);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Transfer failed");
    } finally {
      setTransferring(null);
    }
  }

  const totalBudgetIdr = envelopes.reduce((s, e) => {
    const idr = e.budget_currency === "IDR" ? e.budget_amount : convert(e.budget_amount, e.budget_currency, "IDR", fxRates);
    return s + idr;
  }, 0);
  const totalSpentIdr = Object.values(spentMap).reduce((s, v) => s + v, 0);

  return (
    <div className="flex min-h-full flex-col">
      <div className="sticky top-0 z-10 border-b border-brand-border bg-brand-bg px-4 py-3">
        <div className="flex items-center justify-between">
          <h1 className="font-mono font-bold text-brand-text">AI Assistant</h1>
          <Link to="/envelopes" className="font-mono text-xs text-brand-accent">← envelopes</Link>
        </div>
      </div>

      <div className="flex-1 space-y-6 overflow-auto p-4 pb-24">
        <section className="rounded-2xl border border-brand-border bg-brand-surface p-4">
          <div className="mb-3 flex items-center gap-3">
            <WhaleMood happy={!error} className="h-12 w-12" />
            <div>
              <p className="font-mono text-sm font-semibold text-brand-text">Budget coach</p>
              <p className="font-mono text-xs text-brand-text-muted">Analyzes your monthly patterns and suggests moves</p>
            </div>
          </div>

          <button
            type="button"
            onClick={runCoach}
            disabled={loading || envelopes.length === 0}
            className="w-full rounded-xl bg-brand-accent py-3 font-mono text-sm font-semibold text-white disabled:opacity-50"
          >
            {loading ? "Thinking..." : "Get AI insight"}
          </button>

          {insight && (
            <div className="mt-4 space-y-3">
              <p className="font-mono text-sm leading-relaxed text-brand-text">{insight.message}</p>
              {spoken && (
                <button
                  type="button"
                  onClick={() => speakInsight(insight.message)}
                  className="font-mono text-xs text-brand-accent"
                >
                  🔊 Listen again
                </button>
              )}
              {insight.suggestions.map((s, i) => (
                <div key={i} className="rounded-xl border border-brand-border bg-brand-bg p-3">
                  <p className="font-mono text-xs text-brand-text-muted">{s.reason}</p>
                  <p className="mt-1 font-mono text-sm text-brand-text">
                    Move {format(s.amountIdr, "IDR")} from <strong>{s.fromEnvelope}</strong> → <strong>{s.toEnvelope}</strong>
                  </p>
                  <button
                    type="button"
                    disabled={transferring === i}
                    onClick={() => applyTransfer(s, i)}
                    className="mt-2 rounded-lg bg-brand-accent px-3 py-1.5 font-mono text-xs font-semibold text-white disabled:opacity-50"
                  >
                    {transferring === i ? "Transferring..." : "Yes, transfer"}
                  </button>
                </div>
              ))}
            </div>
          )}

          {error && (
            <p className="mt-3 font-mono text-xs text-red-500">{error}</p>
          )}
        </section>

        <div className="grid grid-cols-2 gap-3">
          <SummaryCard label="monthly budget" value={format(dc === "IDR" ? totalBudgetIdr : convert(totalBudgetIdr, "IDR", dc, fxRates), dc)} />
          <SummaryCard label="total spent" value={format(dc === "IDR" ? totalSpentIdr : convert(totalSpentIdr, "IDR", dc, fxRates), dc)} />
        </div>

        <div>
          <p className="mb-3 font-mono text-xs uppercase tracking-widest text-brand-text-muted">by envelope</p>
          <div className="space-y-2">
            {envelopes.map((env) => {
              const budgetIdr = env.budget_currency === "IDR" ? env.budget_amount : convert(env.budget_amount, env.budget_currency, "IDR", fxRates);
              const spentIdr = spentMap[env.id] ?? 0;
              const pct = budgetIdr > 0 ? Math.min(100, Math.round((spentIdr / budgetIdr) * 100)) : 0;
              return (
                <div key={env.id} className="rounded-xl border border-brand-border bg-brand-surface p-3">
                  <div className="mb-1 flex justify-between">
                    <span className="font-mono text-xs text-brand-text">{env.name}</span>
                    <span className="font-mono text-xs text-brand-text-muted">{pct}% of month</span>
                  </div>
                  <div className="mb-1 h-1 w-full overflow-hidden rounded-full bg-brand-border">
                    <div className={`h-full ${pct > 100 ? "bg-red-400" : "bg-brand-accent"}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-brand-border bg-brand-surface p-3 text-center">
      <p className="mb-1 font-mono text-xs text-brand-text-muted">{label}</p>
      <p className="font-mono text-sm font-bold text-brand-text">{value}</p>
    </div>
  );
}
