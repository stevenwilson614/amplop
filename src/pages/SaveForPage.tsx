import { useCallback, useEffect, useMemo, useState } from "react";
import { useHousehold } from "@/context/HouseholdContext";
import { supabase } from "@/lib/supabase";
import type { Envelope, EnvelopeKind, EnvelopeSpent } from "@/lib/types";
import SinkingFundsSection from "@/components/envelopes/SinkingFundsSection";
import EnvelopeSheet from "@/components/envelopes/EnvelopeSheet";
import EnvelopeDetailSheet from "@/components/envelopes/EnvelopeDetailSheet";
import { useTransactionModal } from "@/context/TransactionModalContext";
import {
  budgetMonthsElapsed,
  buildFirstActivityMap,
  buildMonthSpentByEnvelope,
  computeAvailableIdr,
  envelopeBudgetStartDate,
  fetchAllHouseholdTransactions,
  monthlyBudgetIdr,
  resolveEnvelopeBalanceIdr,
} from "@/lib/envelopeBudget";
import { isSinking } from "@/lib/sinkingFunds";
import { totalMonthlyGhostUsd } from "@/lib/ghostExpenses";
import { format } from "@/lib/currency";

export default function SaveForPage() {
  const { household, dbUser, fxRates, fxRatesAvg30d, refetch } = useHousehold();
  const { openTransaction, setContextEnvelope } = useTransactionModal();
  const [envelopes, setEnvelopes] = useState<Envelope[]>([]);
  const [spentMap, setSpentMap] = useState<Record<string, number>>({});
  const [monthSpentMap, setMonthSpentMap] = useState<Record<string, number>>({});
  const [monthSpentByEnvelope, setMonthSpentByEnvelope] = useState<Record<string, Record<string, number>>>({});
  const [firstActivityMap, setFirstActivityMap] = useState<Record<string, string>>({});
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editEnvelope, setEditEnvelope] = useState<Envelope | undefined>();
  const [detailEnvelope, setDetailEnvelope] = useState<Envelope | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

  const load = useCallback(async () => {
    if (!household) return;
    const monthStartIso = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toLocaleDateString("en-CA");

    const [{ data: envs }, { data: spent }, historyTxs] = await Promise.all([
      supabase.from("envelopes").select("*").eq("household_id", household.id).is("trip_id", null).order("sort_order"),
      supabase.rpc("get_envelope_spent"),
      fetchAllHouseholdTransactions(household.id),
    ]);

    setEnvelopes((envs ?? []) as Envelope[]);
    const map: Record<string, number> = {};
    for (const row of (spent as EnvelopeSpent[] ?? [])) map[row.envelope_id] = Number(row.spent_idr);
    setSpentMap(map);
    setFirstActivityMap(buildFirstActivityMap(historyTxs));
    const monthSpentByEnv = buildMonthSpentByEnvelope(historyTxs);
    setMonthSpentByEnvelope(monthSpentByEnv);

    const monthMap: Record<string, number> = {};
    for (const tx of historyTxs) {
      if (tx.date < monthStartIso) continue;
      const total = Number(tx.amount) || 0;
      const totalIdr = Number(tx.amount_idr_snapshot) || 0;
      if (!total || !tx.allocations) continue;
      for (const alloc of tx.allocations) {
        const allocIdr = Math.round((Number(alloc.amount) / total) * totalIdr);
        monthMap[alloc.envelope_id] = (monthMap[alloc.envelope_id] ?? 0) + allocIdr;
      }
    }
    setMonthSpentMap(monthMap);
  }, [household]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    function onChange() { load(); }
    window.addEventListener("amplop:data-changed", onChange);
    return () => window.removeEventListener("amplop:data-changed", onChange);
  }, [load]);

  useEffect(() => {
    if (detailOpen && detailEnvelope) setContextEnvelope(detailEnvelope);
    else setContextEnvelope(null);
    return () => setContextEnvelope(null);
  }, [detailOpen, detailEnvelope, setContextEnvelope]);

  const dc = dbUser?.display_currency ?? "IDR";
  const planningFx = Object.keys(fxRatesAvg30d).length ? fxRatesAvg30d : fxRates;
  const sinkingEnvelopes = useMemo(() => envelopes.filter(isSinking), [envelopes]);

  const perfMap = useMemo(() => {
    const now = new Date();
    const day = now.getDate();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const monthPaceFactor = day / Math.max(1, daysInMonth);
    const perf: Record<string, {
      availableIdr: number;
      monthSpentIdr: number;
      monthSpentByMonth: Record<string, number>;
      paceDeltaIdr: number;
      paceMarkerPct: number;
      budgetMonths: number;
    }> = {};

    for (const env of sinkingEnvelopes) {
      const monthly = monthlyBudgetIdr(env, fxRates);
      const budgetStart = envelopeBudgetStartDate(env, firstActivityMap[env.id]);
      const monthSpentIdr = monthSpentMap[env.id] ?? 0;
      const expectedByToday = Math.round(monthly * monthPaceFactor);
      perf[env.id] = {
        availableIdr: computeAvailableIdr(env, fxRates, firstActivityMap[env.id], now),
        monthSpentIdr,
        monthSpentByMonth: monthSpentByEnvelope[env.id] ?? {},
        paceDeltaIdr: expectedByToday - monthSpentIdr,
        paceMarkerPct: Math.max(0, Math.min(100, Math.round((1 - monthPaceFactor) * 100))),
        budgetMonths: budgetMonthsElapsed(budgetStart, now),
      };
    }
    return perf;
  }, [sinkingEnvelopes, monthSpentMap, monthSpentByEnvelope, firstActivityMap, fxRates]);

  const balanceIdrById = useMemo(() => {
    const next: Record<string, number> = {};
    for (const env of sinkingEnvelopes) {
      const monthly = monthlyBudgetIdr(env, fxRates);
      const perf = perfMap[env.id];
      next[env.id] = resolveEnvelopeBalanceIdr({
        envelope: env,
        isTrip: false,
        monthlyBudgetIdr: monthly,
        spentIdr: spentMap[env.id] ?? 0,
        monthSpentIdr: perf?.monthSpentIdr ?? 0,
        budgetMonths: perf?.budgetMonths ?? 1,
        availableIdr: perf?.availableIdr ?? monthly,
        monthSpentByMonth: perf?.monthSpentByMonth ?? {},
      });
    }
    return next;
  }, [sinkingEnvelopes, spentMap, fxRates, perfMap]);

  const monthlyTotalUsd = useMemo(
    () => totalMonthlyGhostUsd(sinkingEnvelopes, planningFx),
    [sinkingEnvelopes, planningFx]
  );

  function openAdd() {
    setEditEnvelope(undefined);
    setSheetOpen(true);
  }

  function openDetail(env: Envelope) {
    setDetailEnvelope(env);
    setDetailOpen(true);
  }

  return (
    <div className="flex min-h-full flex-col bg-brand-surface">
      <div className="sticky top-0 z-10 border-b border-brand-border bg-brand-accent px-4 pb-3 pt-5 text-white">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="font-mono text-2xl font-semibold tracking-tight">Save for</h1>
            <p className="font-mono text-xs text-white/80">rent · visa · trips · insurance</p>
          </div>
          <button
            type="button"
            onClick={openAdd}
            className="flex h-12 w-12 items-center justify-center rounded-full bg-[#8AF4A6] text-3xl leading-none text-[#0F3C1B]"
          >
            +
          </button>
        </div>
      </div>

      <div className="border-b border-brand-border bg-brand-surface px-4 py-2">
        <p className="font-mono text-sm text-brand-text-muted text-right">
          Monthly set-asides: {format(monthlyTotalUsd, "USD")}
        </p>
      </div>

      <div className="flex-1 overflow-auto px-4 py-4">
        <SinkingFundsSection
          envelopes={sinkingEnvelopes}
          balanceIdrById={balanceIdrById}
          spentMap={spentMap}
          perfMap={perfMap}
          displayCurrency={dc}
          fxRates={planningFx}
          budgetYearStartMonth={household?.budget_year_start_month ?? 1}
          onOpen={openDetail}
          onAdd={openAdd}
        />
      </div>

      <EnvelopeSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onSaved={() => { load(); refetch(); }}
        householdId={household?.id ?? ""}
        categories={[]}
        envelope={editEnvelope}
        defaultKind={"sinking" satisfies EnvelopeKind}
      />

      <EnvelopeDetailSheet
        open={detailOpen}
        onClose={() => setDetailOpen(false)}
        envelope={detailEnvelope}
        spentIdr={detailEnvelope ? spentMap[detailEnvelope.id] ?? 0 : 0}
        availableIdr={detailEnvelope ? perfMap[detailEnvelope.id]?.availableIdr ?? detailEnvelope.budget_amount : 0}
        monthSpentIdr={detailEnvelope ? perfMap[detailEnvelope.id]?.monthSpentIdr ?? 0 : 0}
        budgetMonths={detailEnvelope ? perfMap[detailEnvelope.id]?.budgetMonths ?? 1 : 1}
        monthSpentByMonth={detailEnvelope ? perfMap[detailEnvelope.id]?.monthSpentByMonth ?? {} : {}}
        paceDeltaIdr={detailEnvelope ? perfMap[detailEnvelope.id]?.paceDeltaIdr ?? 0 : 0}
        paceMarkerPct={detailEnvelope ? perfMap[detailEnvelope.id]?.paceMarkerPct ?? 0 : 0}
        displayCurrency={dc}
        fxRates={fxRates}
        onEdit={() => {
          if (!detailEnvelope) return;
          setDetailOpen(false);
          setEditEnvelope(detailEnvelope);
          setSheetOpen(true);
        }}
        onAddTransaction={() => {
          if (!detailEnvelope) return;
          openTransaction(detailEnvelope);
        }}
      />
    </div>
  );
}
