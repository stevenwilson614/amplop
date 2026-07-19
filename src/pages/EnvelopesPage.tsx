import { useState, useEffect, useCallback, useMemo } from "react";
import { useHousehold } from "@/context/HouseholdContext";
import { supabase } from "@/lib/supabase";
import type { Envelope, Category, EnvelopeSpent, Trip, EnvelopeKind } from "@/lib/types";
import EnvelopeCard from "@/components/envelopes/EnvelopeCard";
import EnvelopeSheet from "@/components/envelopes/EnvelopeSheet";
import { convert, format } from "@/lib/currency";
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
import { useTransactionModal } from "@/context/TransactionModalContext";
import TripPlannerSheet from "@/components/trips/TripPlannerSheet";
import TripLineItemSheet from "@/components/trips/TripLineItemSheet";
import TripSettleSheet from "@/components/trips/TripSettleSheet";
import { syncTripDailyDraws, deleteTripDrawTransactions } from "@/lib/tripDraws";
import EnvelopeDetailSheet from "@/components/envelopes/EnvelopeDetailSheet";
import EditBudgetMode from "@/components/envelopes/EditBudgetMode";
import CategorySheet from "@/components/envelopes/CategorySheet";
import { isSinking } from "@/lib/sinkingFunds";
import { formatUsdIdrLabel } from "@/lib/fxAverage";

export default function EnvelopesPage() {
  const { household, dbUser, fxRates, fxRatesAvg30d, refetch } = useHousehold();
  const { openTransaction, setContextEnvelope } = useTransactionModal();
  const [categories, setCategories] = useState<Category[]>([]);
  const [envelopes, setEnvelopes] = useState<Envelope[]>([]);
  const [spentMap, setSpentMap] = useState<Record<string, number>>({});
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editEnvelope, setEditEnvelope] = useState<Envelope | undefined>();
  const [sheetDefaultKind, setSheetDefaultKind] = useState<EnvelopeKind>("monthly");
  const [tripSheetOpen, setTripSheetOpen] = useState(false);
  const [tripLineItemSheetOpen, setTripLineItemSheetOpen] = useState(false);
  const [tripSettleSheetOpen, setTripSettleSheetOpen] = useState(false);
  const [activeTrip, setActiveTrip] = useState<Trip | null>(null);
  const [tripEnvelopes, setTripEnvelopes] = useState<Envelope[]>([]);
  const [monthSpentMap, setMonthSpentMap] = useState<Record<string, number>>({});
  const [monthSpentByEnvelope, setMonthSpentByEnvelope] = useState<Record<string, Record<string, number>>>({});
  const [firstActivityMap, setFirstActivityMap] = useState<Record<string, string>>({});
  const [detailEnvelope, setDetailEnvelope] = useState<Envelope | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);
  const [editModeOpen, setEditModeOpen] = useState(false);
  const [categorySheetOpen, setCategorySheetOpen] = useState(false);
  const [plusMenuOpen, setPlusMenuOpen] = useState(false);

  useEffect(() => {
    if (!plusMenuOpen) return;
    function handleClick() {
      setPlusMenuOpen(false);
    }
    window.addEventListener("click", handleClick);
    return () => window.removeEventListener("click", handleClick);
  }, [plusMenuOpen]);

  const load = useCallback(async () => {
    if (!household) return;

    if (dbUser) {
      await syncTripDailyDraws({
        householdId: household.id,
        userId: dbUser.id,
        fxRates,
      });
    }

    const { data: trips } = await supabase
      .from("trips")
      .select("*")
      .eq("household_id", household.id)
      .eq("status", "active")
      .order("start_date", { ascending: true });
    const currentTrip = trips?.[0] ?? null;
    setActiveTrip(currentTrip);

    const monthStart = new Date();
    monthStart.setDate(1);
    const monthStartIso = monthStart.toLocaleDateString("en-CA");

    const [{ data: cats }, { data: envs }, { data: spent }, tripEnvsResp, historyTxs] =
      await Promise.all([
        supabase.from("categories").select("*").eq("household_id", household.id).order("sort_order"),
        supabase.from("envelopes").select("*").eq("household_id", household.id).is("trip_id", null).order("sort_order"),
        supabase.rpc("get_envelope_spent"),
        currentTrip
          ? supabase.from("envelopes").select("*").eq("household_id", household.id).eq("trip_id", currentTrip.id).is("parent_envelope_id", null).order("sort_order")
          : Promise.resolve({ data: [] as Envelope[] }),
        fetchAllHouseholdTransactions(household.id),
      ]);
    setCategories(cats ?? []);
    setEnvelopes(envs ?? []);
    setTripEnvelopes(tripEnvsResp.data ?? []);
    const map: Record<string, number> = {};
    for (const row of (spent as EnvelopeSpent[] ?? [])) {
      map[row.envelope_id] = Number(row.spent_idr);
    }
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
        const allocMinor = Number(alloc.amount) || 0;
        const allocIdr = Math.round((allocMinor / total) * totalIdr);
        monthMap[alloc.envelope_id] = (monthMap[alloc.envelope_id] ?? 0) + allocIdr;
      }
    }
    setMonthSpentMap(monthMap);
  }, [household, dbUser, fxRates]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    function onChange() { load(); }
    window.addEventListener("amplop:data-changed", onChange);
    return () => window.removeEventListener("amplop:data-changed", onChange);
  }, [load]);

  useEffect(() => {
    if (detailOpen && detailEnvelope) {
      setContextEnvelope(detailEnvelope);
    } else {
      setContextEnvelope(null);
    }
    return () => setContextEnvelope(null);
  }, [detailOpen, detailEnvelope, setContextEnvelope]);

  function openAdd(kind: EnvelopeKind = "monthly") {
    setEditEnvelope(undefined);
    setSheetDefaultKind(kind);
    setSheetOpen(true);
  }

  function openEdit(env: Envelope) {
    setEditEnvelope(env);
    setSheetDefaultKind(env.kind ?? "monthly");
    setSheetOpen(true);
  }

  function openDetail(env: Envelope) {
    setDetailEnvelope(env);
    setDetailOpen(true);
  }

  function openTxFromDetail() {
    if (!detailEnvelope) return;
    openTransaction(detailEnvelope);
  }

  function tripDaysRemaining(trip: Trip): number {
    const end = new Date(`${trip.end_date}T23:59:59`).getTime();
    const now = Date.now();
    return Math.max(1, Math.ceil((end - now) / (1000 * 60 * 60 * 24)));
  }

  async function deleteActiveTrip() {
    if (!activeTrip) return;
    const confirmed = window.confirm(`Delete trip "${activeTrip.name}" and all trip envelopes?`);
    if (!confirmed) return;
    await deleteTripDrawTransactions(activeTrip.id, household!.id);
    await supabase.from("trips").delete().eq("id", activeTrip.id);
    await load();
    refetch();
  }

  const dc = dbUser?.display_currency ?? "IDR";
  const planningFx = Object.keys(fxRatesAvg30d).length ? fxRatesAvg30d : fxRates;
  const monthlyEnvelopes = useMemo(() => envelopes.filter((e) => !isSinking(e)), [envelopes]);

  const totalBudgetIdr = monthlyEnvelopes.reduce((sum, env) => {
    const budgetIdr = env.budget_currency === "IDR"
      ? env.budget_amount
      : convert(env.budget_amount, env.budget_currency, "IDR", fxRates);
    return sum + budgetIdr;
  }, 0);
  const totalBudgetDisplay = dc === "IDR" ? totalBudgetIdr : convert(totalBudgetIdr, "IDR", dc, fxRates);
  const tripBudgetMinor = tripEnvelopes.reduce((sum, env) => sum + env.budget_amount, 0);
  const tripSpentMinor = tripEnvelopes.reduce((sum, env) => sum + (spentMap[env.id] ?? 0), 0);
  const tripSpentLocal = activeTrip
    ? (activeTrip.currency === "IDR" ? tripSpentMinor : convert(tripSpentMinor, "IDR", activeTrip.currency, fxRates))
    : 0;
  const usdIdrLabel = formatUsdIdrLabel(
    Number(fxRates["USD_IDR"] ?? 0),
    Number(fxRatesAvg30d["USD_IDR"] ?? 0)
  );

  const perfMap = buildEnvelopePerfMap(
    [...envelopes, ...tripEnvelopes],
    monthSpentMap,
    spentMap,
    fxRates,
    activeTrip,
    firstActivityMap,
    monthSpentByEnvelope
  );

  const balanceIdrById = useMemo(() => {
    const next: Record<string, number> = {};
    for (const env of monthlyEnvelopes) {
      const monthly = monthlyBudgetIdr(env, fxRates);
      const spent = spentMap[env.id] ?? 0;
      const perf = perfMap[env.id];
      next[env.id] = resolveEnvelopeBalanceIdr({
        envelope: env,
        isTrip: false,
        monthlyBudgetIdr: monthly,
        spentIdr: spent,
        monthSpentIdr: perf?.monthSpentIdr ?? 0,
        budgetMonths: perf?.budgetMonths ?? 1,
        availableIdr: perf?.availableIdr ?? monthly,
        monthSpentByMonth: perf?.monthSpentByMonth ?? {},
      });
    }
    return next;
  }, [monthlyEnvelopes, spentMap, fxRates, perfMap]);

  // Group monthly envelopes by category (plus uncategorised)
  const grouped = groupByCategory(monthlyEnvelopes, categories);

  return (
    <div className="flex min-h-full flex-col bg-brand-surface">
      <div className="sticky top-0 z-10 border-b border-brand-border bg-brand-accent px-4 pb-3 pt-5 text-white">
        <div className="flex items-center justify-between">
          <button
            className="rounded-full bg-[#8AF4A6] px-5 py-2.5 font-mono text-base font-semibold text-[#0F3C1B]"
            type="button"
            onClick={() => setEditModeOpen(true)}
          >
            Edit
          </button>
          <h1 className="font-mono text-2xl font-semibold tracking-tight">Daily</h1>
          <div className="relative">
            <button
              onClick={(e) => { e.stopPropagation(); setPlusMenuOpen((v) => !v); }}
              className="flex h-12 w-12 items-center justify-center rounded-full bg-[#8AF4A6] text-3xl leading-none text-[#0F3C1B]"
              type="button"
            >
              +
            </button>
            {plusMenuOpen && (
              <div
                className="absolute right-0 top-12 z-20 w-44 overflow-hidden rounded-xl border border-brand-border bg-brand-surface shadow-lg"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  className="block w-full px-4 py-3 text-left text-sm text-brand-text hover:bg-brand-bg"
                  onClick={() => { setPlusMenuOpen(false); openAdd("monthly"); }}
                >
                  Add Envelope
                </button>
                <button
                  type="button"
                  className="block w-full px-4 py-3 text-left text-sm text-brand-text hover:bg-brand-bg"
                  onClick={() => { setPlusMenuOpen(false); setCategorySheetOpen(true); }}
                >
                  Add Category
                </button>
                <button
                  type="button"
                  className="block w-full px-4 py-3 text-left text-sm text-brand-text hover:bg-brand-bg"
                  onClick={() => { setPlusMenuOpen(false); setTripSheetOpen(true); }}
                >
                  Add Trip
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="border-b border-brand-border bg-brand-surface px-4 py-2">
        <div className="flex items-start justify-between gap-2">
          <p className="font-mono text-[9px] text-brand-text-muted">{usdIdrLabel}</p>
          <p className="font-mono text-sm text-brand-text-muted text-right">
            Monthly budgets: {format(totalBudgetDisplay, dc)}
          </p>
        </div>
      </div>

      <div className="flex-1 space-y-6 overflow-auto px-4 pt-3">
        {grouped.length === 0 && (
          <div className="text-center py-12">
            <p className="font-mono text-sm text-brand-text-muted">no envelopes yet</p>
            <button onClick={() => openAdd("monthly")} className="mt-3 font-mono text-sm text-brand-accent">+ add envelope</button>
          </div>
        )}
        {grouped.map(({ category, items }) => {
          const categoryAvailableIdr = items.reduce((sum, env) => {
            const perf = perfMap[env.id];
            const monthly = monthlyBudgetIdr(env, fxRates);
            const spent = spentMap[env.id] ?? 0;
            const available = perf?.availableIdr ?? monthly;
            return sum + resolveEnvelopeBalanceIdr({
              envelope: env,
              isTrip: false,
              monthlyBudgetIdr: monthly,
              spentIdr: spent,
              monthSpentIdr: perf?.monthSpentIdr ?? 0,
              budgetMonths: perf?.budgetMonths ?? 1,
              availableIdr: available,
              monthSpentByMonth: perf?.monthSpentByMonth ?? {},
            });
          }, 0);
          const categoryAvailableDisplay = dc === "IDR"
            ? categoryAvailableIdr
            : convert(categoryAvailableIdr, "IDR", dc, fxRates);
          return (
          <div key={category?.id ?? "__none__"}>
            {category && (
              <div className="mb-1 flex items-center justify-between gap-3">
                <p className="font-mono text-[26px] font-semibold tracking-tight text-brand-text">{category.name}</p>
                <p className="font-mono text-sm text-brand-text-muted">{format(categoryAvailableDisplay, dc)}</p>
              </div>
            )}
            <div className="space-y-1">
              {items.map(env => (
                <EnvelopeCard
                  key={env.id}
                  envelope={env}
                  spentIdr={spentMap[env.id] ?? 0}
                  availableIdr={perfMap[env.id]?.availableIdr}
                  monthSpentIdr={perfMap[env.id]?.monthSpentIdr}
                  budgetMonths={perfMap[env.id]?.budgetMonths}
                  monthSpentByMonth={perfMap[env.id]?.monthSpentByMonth}
                  paceMarkerPct={perfMap[env.id]?.paceMarkerPct ?? 0}
                  displayCurrency={dc}
                  fxRates={fxRates}
                  onClick={() => openDetail(env)}
                />
              ))}
            </div>
          </div>
          );
        })}
        {activeTrip && (
          <div className="border-t border-brand-border pt-5">
            <div className="mb-1 flex items-center justify-between">
              <div>
                <p className="font-mono text-xl font-semibold text-brand-text">
                  <span className="mr-1" aria-hidden>✈</span>
                  {activeTrip.name}
                </p>
                <p className="font-mono text-xs text-brand-text-muted">
                  {activeTrip.start_date} to {activeTrip.end_date} - local {activeTrip.currency}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setTripSettleSheetOpen(true)}
                  className={
                    tripHasEnded(activeTrip)
                      ? "rounded-lg bg-brand-accent px-2 py-1 text-xs font-semibold text-white"
                      : "rounded-lg border border-brand-border px-2 py-1 text-xs font-semibold text-brand-text-muted"
                  }
                >
                  settle up
                </button>
                <button
                  type="button"
                  onClick={() => setTripLineItemSheetOpen(true)}
                  className="rounded-lg border border-brand-border px-2 py-1 text-xs font-semibold text-brand-text-muted"
                >
                  add categories
                </button>
                <button
                  type="button"
                  onClick={deleteActiveTrip}
                  className="rounded-lg border border-red-200 px-2 py-1 text-xs font-semibold text-red-500"
                >
                  delete trip
                </button>
              </div>
            </div>
            <div className="space-y-1">
              {tripEnvelopes.map((env) => (
                <EnvelopeCard
                  key={env.id}
                  envelope={env}
                  spentIdr={spentMap[env.id] ?? 0}
                  availableIdr={perfMap[env.id]?.availableIdr}
                  monthSpentIdr={perfMap[env.id]?.monthSpentIdr}
                  budgetMonths={perfMap[env.id]?.budgetMonths}
                  monthSpentByMonth={perfMap[env.id]?.monthSpentByMonth}
                  paceMarkerPct={perfMap[env.id]?.paceMarkerPct ?? 0}
                  displayCurrency={env.budget_currency}
                  fxRates={fxRates}
                  isTrip
                  onClick={() => openDetail(env)}
                />
              ))}
            </div>
            <p className="mt-2 text-xs text-brand-text-muted">
              Trip total {format(tripBudgetMinor, activeTrip.currency)} - spent {format(tripSpentLocal, activeTrip.currency)}.
            </p>
          </div>
        )}
      </div>

      <EnvelopeSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onSaved={() => { load(); refetch(); }}
        householdId={household?.id ?? ""}
        categories={categories}
        envelope={editEnvelope}
        defaultKind={sheetDefaultKind}
      />

      <TripPlannerSheet
        open={tripSheetOpen}
        onClose={() => setTripSheetOpen(false)}
        onSaved={() => {
          load();
          refetch();
        }}
        householdId={household?.id ?? ""}
        userId={dbUser?.id ?? ""}
        envelopes={envelopes}
        fxRates={planningFx}
        balancesById={balanceIdrById}
      />

      <TripLineItemSheet
        open={tripLineItemSheetOpen}
        onClose={() => setTripLineItemSheetOpen(false)}
        onSaved={() => {
          load();
          refetch();
        }}
        householdId={household?.id ?? ""}
        trip={activeTrip}
        nextSortOrder={tripEnvelopes.length}
      />

      <TripSettleSheet
        open={tripSettleSheetOpen}
        onClose={() => setTripSettleSheetOpen(false)}
        onSettled={() => {
          load();
          refetch();
          window.dispatchEvent(new CustomEvent("amplop:data-changed"));
        }}
        householdId={household?.id ?? ""}
        userId={dbUser?.id ?? ""}
        trip={activeTrip}
        tripEnvelopes={tripEnvelopes}
        householdEnvelopes={envelopes}
        balancesById={balanceIdrById}
        fxRates={fxRates}
        displayCurrency={dc}
      />

      <EnvelopeDetailSheet
        open={detailOpen}
        envelope={detailEnvelope}
        spentIdr={detailEnvelope ? (spentMap[detailEnvelope.id] ?? 0) : 0}
        availableIdr={detailEnvelope ? (perfMap[detailEnvelope.id]?.availableIdr ?? detailEnvelope.budget_amount) : 0}
        monthSpentIdr={detailEnvelope ? (perfMap[detailEnvelope.id]?.monthSpentIdr ?? 0) : 0}
        budgetMonths={detailEnvelope ? (perfMap[detailEnvelope.id]?.budgetMonths ?? 1) : 1}
        monthSpentByMonth={detailEnvelope ? (perfMap[detailEnvelope.id]?.monthSpentByMonth ?? {}) : {}}
        paceDeltaIdr={detailEnvelope ? (perfMap[detailEnvelope.id]?.paceDeltaIdr ?? 0) : 0}
        paceMarkerPct={detailEnvelope ? (perfMap[detailEnvelope.id]?.paceMarkerPct ?? 0) : 0}
        displayCurrency={dc}
        fxRates={fxRates}
        isTripEnvelope={Boolean(detailEnvelope?.trip_id)}
        tripDaysRemaining={activeTrip ? tripDaysRemaining(activeTrip) : 30}
        onClose={() => setDetailOpen(false)}
        onEdit={() => {
          if (!detailEnvelope) return;
          setDetailOpen(false);
          openEdit(detailEnvelope);
        }}
        onAddTransaction={openTxFromDetail}
      />

      <EditBudgetMode
        open={editModeOpen}
        onClose={() => setEditModeOpen(false)}
        onSaved={() => { load(); refetch(); }}
        onAddEnvelope={openAdd}
        envelopes={monthlyEnvelopes}
        categories={categories}
        displayCurrency={dc}
        fxRates={fxRates}
      />

      <CategorySheet
        open={categorySheetOpen}
        onClose={() => setCategorySheetOpen(false)}
        onSaved={() => { load(); refetch(); }}
        householdId={household?.id ?? ""}
        categoryCount={categories.length}
      />
    </div>
  );
}

function tripHasEnded(trip: Trip): boolean {
  return trip.end_date < new Date().toLocaleDateString("en-CA");
}

interface Group { category: Category | null; items: Envelope[] }

function groupByCategory(envelopes: Envelope[], categories: Category[]): Group[] {
  const catMap = new Map(categories.map(c => [c.id, c]));
  const groups = new Map<string, Group>();

  for (const env of envelopes) {
    const category = env.category_id ? (catMap.get(env.category_id) ?? null) : null;
    const key = category?.name?.trim().toLowerCase() || "__none__";
    if (!groups.has(key)) {
      groups.set(key, { category, items: [] });
    }
    groups.get(key)!.items.push(env);
  }

  return Array.from(groups.values());
}

type PerfMap = Record<string, {
  availableIdr: number;
  monthSpentIdr: number;
  monthSpentByMonth: Record<string, number>;
  paceDeltaIdr: number;
  paceMarkerPct: number;
  budgetMonths: number;
}>;

function buildEnvelopePerfMap(
  envelopes: Envelope[],
  monthSpentMap: Record<string, number>,
  spentMap: Record<string, number>,
  fxRates: Record<string, number>,
  activeTrip: Trip | null,
  firstActivityMap: Record<string, string>,
  monthSpentByEnvelope: Record<string, Record<string, number>>
): PerfMap {
  const now = new Date();
  const day = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const monthPaceFactor = day / Math.max(1, daysInMonth);
  const perf: PerfMap = {};

  for (const env of envelopes) {
    const monthly = monthlyBudgetIdr(env, fxRates);

    const isTripEnvelope = Boolean(env.trip_id && activeTrip && env.trip_id === activeTrip.id);
    const budgetStart = envelopeBudgetStartDate(env, firstActivityMap[env.id]);
    const budgetMonths = isTripEnvelope ? 1 : budgetMonthsElapsed(budgetStart, now);
    const availableIdr = isTripEnvelope
      ? monthly
      : computeAvailableIdr(env, fxRates, firstActivityMap[env.id], now);

    const monthSpentIdr = monthSpentMap[env.id] ?? 0;
    const monthSpentByMonth = monthSpentByEnvelope[env.id] ?? {};
    const tripSpentIdr = spentMap[env.id] ?? 0;
    const paceFactor = isTripEnvelope && activeTrip
      ? getTripPaceFactor(activeTrip, now)
      : monthPaceFactor;
    const expectedByToday = Math.round(monthly * paceFactor);
    const actualForPace = isTripEnvelope ? tripSpentIdr : monthSpentIdr;
    const paceDeltaIdr = expectedByToday - actualForPace;
    const paceMarkerPct = Math.max(0, Math.min(100, Math.round((1 - paceFactor) * 100)));

    perf[env.id] = {
      availableIdr,
      monthSpentIdr,
      monthSpentByMonth,
      paceDeltaIdr,
      paceMarkerPct,
      budgetMonths,
    };
  }

  return perf;
}

function getTripPaceFactor(trip: Trip, now: Date): number {
  const start = new Date(`${trip.start_date}T00:00:00`).getTime();
  const end = new Date(`${trip.end_date}T23:59:59`).getTime();
  if (end <= start) return 1;
  const current = Math.min(Math.max(now.getTime(), start), end);
  const total = end - start;
  const elapsed = current - start;
  return Math.max(0, Math.min(1, elapsed / total));
}
