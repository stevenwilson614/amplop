import { useState, useEffect, useCallback } from "react";
import { useHousehold } from "@/context/HouseholdContext";
import { supabase } from "@/lib/supabase";
import type { Envelope, Category, EnvelopeSpent, Trip } from "@/lib/types";
import EnvelopeCard from "@/components/envelopes/EnvelopeCard";
import EnvelopeSheet from "@/components/envelopes/EnvelopeSheet";
import { convert, format } from "@/lib/currency";
import { useTransactionModal } from "@/context/TransactionModalContext";
import TripPlannerSheet from "@/components/trips/TripPlannerSheet";
import EnvelopeDetailSheet from "@/components/envelopes/EnvelopeDetailSheet";
import EditBudgetMode from "@/components/envelopes/EditBudgetMode";
import CategorySheet from "@/components/envelopes/CategorySheet";

export default function EnvelopesPage() {
  const { household, dbUser, fxRates, refetch } = useHousehold();
  const { openTransaction } = useTransactionModal();
  const [categories, setCategories] = useState<Category[]>([]);
  const [envelopes, setEnvelopes] = useState<Envelope[]>([]);
  const [spentMap, setSpentMap] = useState<Record<string, number>>({});
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editEnvelope, setEditEnvelope] = useState<Envelope | undefined>();
  const [tripSheetOpen, setTripSheetOpen] = useState(false);
  const [activeTrip, setActiveTrip] = useState<Trip | null>(null);
  const [tripEnvelopes, setTripEnvelopes] = useState<Envelope[]>([]);
  const [monthSpentMap, setMonthSpentMap] = useState<Record<string, number>>({});
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

    const [{ data: cats }, { data: envs }, { data: spent }, tripEnvsResp, monthTxResp] = await Promise.all([
      supabase.from("categories").select("*").eq("household_id", household.id).order("sort_order"),
      supabase.from("envelopes").select("*").eq("household_id", household.id).is("trip_id", null).order("sort_order"),
      supabase.rpc("get_envelope_spent"),
      currentTrip
        ? supabase.from("envelopes").select("*").eq("household_id", household.id).eq("trip_id", currentTrip.id).order("sort_order")
        : Promise.resolve({ data: [] as Envelope[] }),
      supabase
        .from("transactions")
        .select("id, amount, amount_idr_snapshot, date, allocations:transaction_allocations(envelope_id, amount)")
        .eq("household_id", household.id)
        .gte("date", monthStartIso),
    ]);
    setCategories(cats ?? []);
    setEnvelopes(envs ?? []);
    setTripEnvelopes(tripEnvsResp.data ?? []);
    const map: Record<string, number> = {};
    for (const row of (spent as EnvelopeSpent[] ?? [])) {
      map[row.envelope_id] = Number(row.spent_idr);
    }
    setSpentMap(map);

    const monthMap: Record<string, number> = {};
    for (const tx of monthTxResp.data ?? []) {
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
  }, [household]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    function onChange() { load(); }
    window.addEventListener("amplop:data-changed", onChange);
    return () => window.removeEventListener("amplop:data-changed", onChange);
  }, [load]);

  function openAdd() {
    setEditEnvelope(undefined);
    setSheetOpen(true);
  }

  function openEdit(env: Envelope) {
    setEditEnvelope(env);
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
    await supabase.from("trips").delete().eq("id", activeTrip.id);
    await load();
    refetch();
  }

  const dc = dbUser?.display_currency ?? "IDR";
  const totalBudgetIdr = envelopes.reduce((sum, env) => {
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
  const usdIdrRate = Number(fxRates["USD_IDR"] ?? 0);
  const usdIdrLabel = usdIdrRate
    ? `USD/IDR Rp ${new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(usdIdrRate)}`
    : "USD/IDR -";

  // Group envelopes by category (plus uncategorised)
  const grouped = groupByCategory(envelopes, categories);
  const perfMap = buildEnvelopePerfMap([...envelopes, ...tripEnvelopes], monthSpentMap, spentMap, fxRates, activeTrip);

  return (
    <div className="flex min-h-full flex-col bg-brand-surface">
      <div className="sticky top-0 z-10 border-b border-brand-border bg-brand-accent px-4 pb-4 pt-6 text-white">
        <div className="flex items-center justify-between">
          <button
            className="rounded-full bg-[#8AF4A6] px-5 py-2.5 font-mono text-base font-semibold text-[#0F3C1B]"
            type="button"
            onClick={() => setEditModeOpen(true)}
          >
            Edit
          </button>
          <h1 className="font-mono text-2xl font-semibold tracking-tight">Envelopes</h1>
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
                  onClick={() => { setPlusMenuOpen(false); openAdd(); }}
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
            All Envelopes: {format(totalBudgetDisplay, dc)}
          </p>
        </div>
      </div>

      <div className="flex-1 space-y-6 overflow-auto px-4 pb-28 pt-3">
        {grouped.length === 0 && (
          <div className="text-center py-12">
            <p className="font-mono text-sm text-brand-text-muted">no envelopes yet</p>
            <button onClick={openAdd} className="mt-3 font-mono text-sm text-brand-accent">+ add envelope</button>
          </div>
        )}
        {grouped.map(({ category, items }) => {
          const categoryMonthSpentIdr = items.reduce(
            (sum, env) => sum + (monthSpentMap[env.id] ?? 0),
            0
          );
          const categoryMonthDisplay = dc === "IDR"
            ? categoryMonthSpentIdr
            : convert(categoryMonthSpentIdr, "IDR", dc, fxRates);
          return (
          <div key={category?.id ?? "__none__"}>
            {category && (
              <div className="mb-2 flex items-center justify-between gap-3">
                <p className="font-mono text-[26px] font-semibold tracking-tight text-brand-text">{category.name}</p>
                <p className="font-mono text-sm text-brand-text-muted">{format(categoryMonthDisplay, dc)}</p>
              </div>
            )}
            <div className="space-y-2">
              {items.map(env => (
                <EnvelopeCard
                  key={env.id}
                  envelope={env}
                  spentIdr={spentMap[env.id] ?? 0}
                  availableIdr={perfMap[env.id]?.availableIdr}
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
            <div className="mb-2 flex items-center justify-between">
              <div>
                <p className="font-mono text-xl font-semibold text-brand-text">{activeTrip.name}</p>
                <p className="font-mono text-xs text-brand-text-muted">
                  {activeTrip.start_date} to {activeTrip.end_date} - local {activeTrip.currency}
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setTripSheetOpen(true)}
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
            <div className="space-y-2">
              {tripEnvelopes.map((env) => (
                <EnvelopeCard
                  key={env.id}
                  envelope={env}
                  spentIdr={spentMap[env.id] ?? 0}
                  availableIdr={perfMap[env.id]?.availableIdr}
                  paceMarkerPct={perfMap[env.id]?.paceMarkerPct ?? 0}
                  displayCurrency={env.budget_currency}
                  fxRates={fxRates}
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
      />

      <TripPlannerSheet
        open={tripSheetOpen}
        onClose={() => setTripSheetOpen(false)}
        onSaved={() => {
          load();
          refetch();
        }}
        householdId={household?.id ?? ""}
        envelopes={envelopes}
        fxRates={fxRates}
      />

      <EnvelopeDetailSheet
        open={detailOpen}
        envelope={detailEnvelope}
        spentIdr={detailEnvelope ? (spentMap[detailEnvelope.id] ?? 0) : 0}
        availableIdr={detailEnvelope ? (perfMap[detailEnvelope.id]?.availableIdr ?? detailEnvelope.budget_amount) : 0}
        monthSpentIdr={detailEnvelope ? (perfMap[detailEnvelope.id]?.monthSpentIdr ?? 0) : 0}
        paceDeltaIdr={detailEnvelope ? (perfMap[detailEnvelope.id]?.paceDeltaIdr ?? 0) : 0}
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
        envelopes={envelopes}
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

type PerfMap = Record<string, { availableIdr: number; monthSpentIdr: number; paceDeltaIdr: number; paceMarkerPct: number }>;

function buildEnvelopePerfMap(
  envelopes: Envelope[],
  monthSpentMap: Record<string, number>,
  spentMap: Record<string, number>,
  fxRates: Record<string, number>,
  activeTrip: Trip | null
): PerfMap {
  const now = new Date();
  const day = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const monthPaceFactor = day / Math.max(1, daysInMonth);
  const perf: PerfMap = {};

  for (const env of envelopes) {
    const monthlyBudgetIdr = env.budget_currency === "IDR"
      ? env.budget_amount
      : convert(env.budget_amount, env.budget_currency, "IDR", fxRates);

    const isTripEnvelope = Boolean(env.trip_id && activeTrip && env.trip_id === activeTrip.id);
    const availableIdr = isTripEnvelope ? monthlyBudgetIdr : (() => {
      const created = new Date(env.created_at);
      const monthsElapsed = Math.max(1, (now.getFullYear() - created.getFullYear()) * 12 + (now.getMonth() - created.getMonth()) + 1);
      return monthlyBudgetIdr * monthsElapsed;
    })();

    const monthSpentIdr = monthSpentMap[env.id] ?? 0;
    const tripSpentIdr = spentMap[env.id] ?? 0;
    const paceFactor = isTripEnvelope && activeTrip
      ? getTripPaceFactor(activeTrip, now)
      : monthPaceFactor;
    const expectedByToday = Math.round(availableIdr * paceFactor);
    const actualForPace = isTripEnvelope ? tripSpentIdr : monthSpentIdr;
    const paceDeltaIdr = expectedByToday - actualForPace;
    const paceMarkerPct = Math.max(0, Math.min(100, Math.round((1 - paceFactor) * 100)));

    perf[env.id] = {
      availableIdr,
      monthSpentIdr,
      paceDeltaIdr,
      paceMarkerPct,
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
