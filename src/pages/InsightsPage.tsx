import { useState, useEffect, useCallback } from "react";
import { useHousehold } from "@/context/HouseholdContext";
import { supabase } from "@/lib/supabase";
import type { Envelope, EnvelopeSpent } from "@/lib/types";
import { format, convert } from "@/lib/currency";

export default function InsightsPage() {
  const { household, dbUser, fxRates } = useHousehold();
  const [envelopes, setEnvelopes] = useState<Envelope[]>([]);
  const [spentMap, setSpentMap] = useState<Record<string, number>>({});

  const load = useCallback(async () => {
    if (!household) return;
    const [{ data: envs }, { data: spent }] = await Promise.all([
      supabase.from("envelopes").select("*").eq("household_id", household.id).is("trip_id", null),
      supabase.rpc("get_envelope_spent"),
    ]);
    setEnvelopes(envs ?? []);
    const map: Record<string, number> = {};
    for (const row of (spent as EnvelopeSpent[] ?? [])) map[row.envelope_id] = Number(row.spent_idr);
    setSpentMap(map);
  }, [household]);

  useEffect(() => { load(); }, [load]);

  const dc = dbUser?.display_currency ?? "IDR";

  const totalBudgetIdr = envelopes.reduce((s, e) => {
    const idr = e.budget_currency === "IDR" ? e.budget_amount : convert(e.budget_amount, e.budget_currency, "IDR", fxRates);
    return s + idr;
  }, 0);
  const totalSpentIdr = Object.values(spentMap).reduce((s, v) => s + v, 0);
  const totalBalanceIdr = totalBudgetIdr - totalSpentIdr;

  const budgetDisplay = dc === "IDR" ? totalBudgetIdr : convert(totalBudgetIdr, "IDR", dc, fxRates);
  const spentDisplay = dc === "IDR" ? totalSpentIdr : convert(totalSpentIdr, "IDR", dc, fxRates);
  const balanceDisplay = dc === "IDR" ? totalBalanceIdr : convert(totalBalanceIdr, "IDR", dc, fxRates);

  return (
    <div className="flex flex-col min-h-full">
      <div className="sticky top-0 z-10 px-4 py-3 bg-brand-bg border-b border-brand-border">
        <h1 className="font-mono font-bold text-brand-text">insights</h1>
      </div>

      <div className="flex-1 overflow-auto p-4 pb-24 space-y-6">
        {/* Summary cards */}
        <div className="grid grid-cols-3 gap-3">
          <SummaryCard label="budget" value={format(budgetDisplay, dc)} />
          <SummaryCard label="spent" value={format(spentDisplay, dc)} />
          <SummaryCard label="left" value={format(balanceDisplay, dc)} highlight={totalBalanceIdr < 0} />
        </div>

        {/* Per-envelope breakdown */}
        <div>
          <p className="font-mono text-xs text-brand-text-muted uppercase tracking-widest mb-3">by envelope</p>
          <div className="space-y-2">
            {envelopes.map(env => {
              const budgetIdr = env.budget_currency === "IDR" ? env.budget_amount : convert(env.budget_amount, env.budget_currency, "IDR", fxRates);
              const spentIdr = spentMap[env.id] ?? 0;
              const pct = budgetIdr > 0 ? Math.min(100, Math.round(spentIdr / budgetIdr * 100)) : 0;
              const spentD = dc === "IDR" ? spentIdr : convert(spentIdr, "IDR", dc, fxRates);
              const budgetD = dc === "IDR" ? budgetIdr : convert(budgetIdr, "IDR", dc, fxRates);
              return (
                <div key={env.id} className="rounded-xl bg-brand-primary border border-brand-border p-3">
                  <div className="flex justify-between mb-1">
                    <span className="font-mono text-xs text-brand-text">{env.name}</span>
                    <span className="font-mono text-xs text-brand-text-muted">{pct}%</span>
                  </div>
                  <div className="w-full h-1 rounded-full bg-brand-border overflow-hidden mb-1">
                    <div className={`h-full rounded-full ${pct > 100 ? "bg-red-400" : "bg-brand-accent"}`} style={{ width: `${pct}%` }} />
                  </div>
                  <div className="flex justify-between">
                    <span className="font-mono text-xs text-brand-text-muted">{format(spentD, dc)}</span>
                    <span className="font-mono text-xs text-brand-text-muted">{format(budgetD, dc)}</span>
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

function SummaryCard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className="rounded-xl bg-brand-primary border border-brand-border p-3 text-center">
      <p className="font-mono text-xs text-brand-text-muted mb-1">{label}</p>
      <p className={`font-mono text-sm font-bold ${highlight ? "text-red-400" : "text-brand-text"}`}>{value}</p>
    </div>
  );
}
