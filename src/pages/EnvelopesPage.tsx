import { useState, useEffect, useCallback } from "react";
import { useHousehold } from "@/context/HouseholdContext";
import { supabase } from "@/lib/supabase";
import type { Envelope, Category, EnvelopeSpent, Trip } from "@/lib/types";
import EnvelopeCard from "@/components/envelopes/EnvelopeCard";
import EnvelopeSheet from "@/components/envelopes/EnvelopeSheet";
import TransactionEntry from "@/components/transactions/TransactionEntry";
import { convert, format } from "@/lib/currency";
import TripPlannerSheet from "@/components/trips/TripPlannerSheet";
import EnvelopeDetailSheet from "@/components/envelopes/EnvelopeDetailSheet";

export default function EnvelopesPage() {
  const { household, dbUser, fxRates, refetch } = useHousehold();
  const [categories, setCategories] = useState<Category[]>([]);
  const [envelopes, setEnvelopes] = useState<Envelope[]>([]);
  const [spentMap, setSpentMap] = useState<Record<string, number>>({});
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editEnvelope, setEditEnvelope] = useState<Envelope | undefined>();
  const [txOpen, setTxOpen] = useState(false);
  const [defaultEnvelope, setDefaultEnvelope] = useState<Envelope | undefined>();
  const [tripSheetOpen, setTripSheetOpen] = useState(false);
  const [activeTrip, setActiveTrip] = useState<Trip | null>(null);
  const [tripEnvelopes, setTripEnvelopes] = useState<Envelope[]>([]);
  const [monthSpentMap, setMonthSpentMap] = useState<Record<string, number>>({});
  const [detailEnvelope, setDetailEnvelope] = useState<Envelope | null>(null);
  const [detailOpen, setDetailOpen] = useState(false);

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

  function openTx(env?: Envelope) {
    setDefaultEnvelope(env);
    setTxOpen(true);
  }

  const dc = dbUser?.display_currency ?? "IDR";
  const totalBudgetIdr = envelopes.reduce((sum, env) => {
    const budgetIdr = env.budget_currency === "IDR"
      ? env.budget_amount
      : convert(env.budget_amount, env.budget_currency, "IDR", fxRates);
    return sum + budgetIdr;
  }, 0);
  const totalSpentIdr = envelopes.reduce((sum, env) => sum + (spentMap[env.id] ?? 0), 0);
  const totalAvailableIdr = totalBudgetIdr - totalSpentIdr;
  const totalBudgetDisplay = dc === "IDR" ? totalBudgetIdr : convert(totalBudgetIdr, "IDR", dc, fxRates);
  const totalAvailableDisplay = dc === "IDR" ? totalAvailableIdr : convert(totalAvailableIdr, "IDR", dc, fxRates);
  const tripBudgetMinor = tripEnvelopes.reduce((sum, env) => sum + env.budget_amount, 0);
  const tripSpentMinor = tripEnvelopes.reduce((sum, env) => sum + (spentMap[env.id] ?? 0), 0);
  const tripSpentLocal = activeTrip
    ? (activeTrip.currency === "IDR" ? tripSpentMinor : convert(tripSpentMinor, "IDR", activeTrip.currency, fxRates))
    : 0;

  // Group envelopes by category (plus uncategorised)
  const grouped = groupByCategory(envelopes, categories);
  const perfMap = buildEnvelopePerfMap([...envelopes, ...tripEnvelopes], monthSpentMap, fxRates);

  return (
    <div className="flex min-h-full flex-col bg-brand-surface">
      <div className="sticky top-0 z-10 border-b border-brand-border bg-brand-accent px-4 pb-4 pt-6 text-white">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <button
              className="rounded-full bg-[#8AF4A6] px-4 py-2 font-mono text-sm font-semibold text-[#0F3C1B]"
              type="button"
              onClick={() => setTripSheetOpen(true)}
            >
              Trip
            </button>
            <button
            className="rounded-full bg-[#8AF4A6] px-4 py-2 font-mono text-sm font-semibold text-[#0F3C1B]"
            type="button"
          >
            Edit
            </button>
          </div>
          <h1 className="font-mono text-3xl font-semibold tracking-tight">Envelopes</h1>
          <button
            onClick={openAdd}
            className="flex h-11 w-11 items-center justify-center rounded-full bg-[#8AF4A6] text-2xl leading-none text-[#0F3C1B]"
            type="button"
          >
            +
          </button>
        </div>
      </div>

      <div className="border-b border-brand-border bg-brand-surface px-4 py-2 text-right">
        <p className="font-mono text-sm text-brand-text-muted">
          All Envelopes: {format(totalBudgetDisplay, dc)}
        </p>
      </div>

      <div className="flex-1 space-y-6 overflow-auto px-4 pb-28 pt-3">
        {grouped.length === 0 && (
          <div className="text-center py-12">
            <p className="font-mono text-sm text-brand-text-muted">no envelopes yet</p>
            <button onClick={openAdd} className="mt-3 font-mono text-sm text-brand-accent">+ add envelope</button>
          </div>
        )}
        {grouped.map(({ category, items }) => (
          <div key={category?.id ?? "__none__"}>
            {category && <p className="mb-2 font-mono text-2xl font-semibold tracking-tight text-brand-text">{category.name}</p>}
            <div className="space-y-4">
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
        ))}
        {grouped.length > 0 && (
          <div className="border-t border-brand-border pt-4">
            <div className="flex items-center justify-between">
              <span className="font-mono text-2xl font-semibold tracking-tight text-brand-text">Available</span>
              <span className={`font-mono text-[34px] font-semibold leading-none ${totalAvailableDisplay < 0 ? "text-red-500" : "text-brand-text"}`}>
                {format(totalAvailableDisplay, dc)}
              </span>
            </div>
          </div>
        )}

        {activeTrip && (
          <div className="border-t border-brand-border pt-5">
            <div className="mb-2 flex items-center justify-between">
              <div>
                <p className="font-mono text-2xl font-semibold text-brand-text">{activeTrip.name}</p>
                <p className="font-mono text-xs text-brand-text-muted">
                  {activeTrip.start_date} to {activeTrip.end_date} - local {activeTrip.currency}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setTripSheetOpen(true)}
                className="rounded-lg border border-brand-border px-2 py-1 text-xs font-semibold text-brand-text-muted"
              >
                add categories
              </button>
            </div>
            <div className="space-y-3">
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
            <p className="mt-3 text-xs text-brand-text-muted">
              Trip total {format(tripBudgetMinor, activeTrip.currency)} - spent {format(tripSpentLocal, activeTrip.currency)}.
            </p>
          </div>
        )}
      </div>

      {/* FAB: add transaction */}
      <button
        onClick={() => openTx()}
        className="fixed bottom-24 right-6 z-20 flex h-14 w-14 items-center justify-center rounded-full bg-brand-accent text-3xl leading-none text-white shadow-lg sm:right-[calc((100vw-430px)/2+1.5rem)]"
      >+</button>

      <EnvelopeSheet
        open={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onSaved={() => { load(); refetch(); }}
        householdId={household?.id ?? ""}
        categories={categories}
        envelope={editEnvelope}
      />

      {dbUser && household && (
        <TransactionEntry
          open={txOpen}
          onClose={() => setTxOpen(false)}
          onSaved={() => { load(); refetch(); }}
          envelopes={[...envelopes, ...tripEnvelopes]}
          dbUser={dbUser}
          household={household}
          fxRates={fxRates}
          defaultEnvelope={defaultEnvelope}
        />
      )}

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
        displayCurrency={detailEnvelope?.budget_currency ?? dc}
        fxRates={fxRates}
        onClose={() => setDetailOpen(false)}
        onEdit={() => {
          if (!detailEnvelope) return;
          setDetailOpen(false);
          openEdit(detailEnvelope);
        }}
      />
    </div>
  );
}

interface Group { category: Category | null; items: Envelope[] }

function groupByCategory(envelopes: Envelope[], categories: Category[]): Group[] {
  const catMap = new Map(categories.map(c => [c.id, c]));
  const groups = new Map<string, Group>();

  for (const env of envelopes) {
    const key = env.category_id ?? "__none__";
    if (!groups.has(key)) {
      groups.set(key, { category: env.category_id ? (catMap.get(env.category_id) ?? null) : null, items: [] });
    }
    groups.get(key)!.items.push(env);
  }

  return Array.from(groups.values());
}

type PerfMap = Record<string, { availableIdr: number; monthSpentIdr: number; paceDeltaIdr: number; paceMarkerPct: number }>;

function buildEnvelopePerfMap(
  envelopes: Envelope[],
  monthSpentMap: Record<string, number>,
  fxRates: Record<string, number>
): PerfMap {
  const now = new Date();
  const day = now.getDate();
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const paceFactor = day / Math.max(1, daysInMonth);
  const perf: PerfMap = {};

  for (const env of envelopes) {
    const monthlyBudgetIdr = env.budget_currency === "IDR"
      ? env.budget_amount
      : convert(env.budget_amount, env.budget_currency, "IDR", fxRates);

    const created = new Date(env.created_at);
    const monthsElapsed = Math.max(1, (now.getFullYear() - created.getFullYear()) * 12 + (now.getMonth() - created.getMonth()) + 1);
    const availableIdr = monthlyBudgetIdr * monthsElapsed;
    const monthSpentIdr = monthSpentMap[env.id] ?? 0;
    const expectedByToday = Math.round(monthlyBudgetIdr * paceFactor);
    const paceDeltaIdr = expectedByToday - monthSpentIdr;
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
