import { useState, useEffect, useCallback } from "react";
import { useHousehold } from "@/context/HouseholdContext";
import { supabase } from "@/lib/supabase";
import type { Envelope, Category, EnvelopeSpent } from "@/lib/types";
import EnvelopeCard from "@/components/envelopes/EnvelopeCard";
import EnvelopeSheet from "@/components/envelopes/EnvelopeSheet";
import TransactionEntry from "@/components/transactions/TransactionEntry";
import { convert, format } from "@/lib/currency";

export default function EnvelopesPage() {
  const { household, dbUser, fxRates, refetch } = useHousehold();
  const [categories, setCategories] = useState<Category[]>([]);
  const [envelopes, setEnvelopes] = useState<Envelope[]>([]);
  const [spentMap, setSpentMap] = useState<Record<string, number>>({});
  const [sheetOpen, setSheetOpen] = useState(false);
  const [editEnvelope, setEditEnvelope] = useState<Envelope | undefined>();
  const [txOpen, setTxOpen] = useState(false);
  const [defaultEnvelope, setDefaultEnvelope] = useState<Envelope | undefined>();

  const load = useCallback(async () => {
    if (!household) return;
    const [{ data: cats }, { data: envs }, { data: spent }] = await Promise.all([
      supabase.from("categories").select("*").eq("household_id", household.id).order("sort_order"),
      supabase.from("envelopes").select("*").eq("household_id", household.id).is("trip_id", null).order("sort_order"),
      supabase.rpc("get_envelope_spent"),
    ]);
    setCategories(cats ?? []);
    setEnvelopes(envs ?? []);
    const map: Record<string, number> = {};
    for (const row of (spent as EnvelopeSpent[] ?? [])) {
      map[row.envelope_id] = Number(row.spent_idr);
    }
    setSpentMap(map);
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

  // Group envelopes by category (plus uncategorised)
  const grouped = groupByCategory(envelopes, categories);

  return (
    <div className="flex min-h-full flex-col bg-brand-surface">
      <div className="sticky top-0 z-10 border-b border-brand-border bg-brand-accent px-4 pb-4 pt-6 text-white">
        <div className="flex items-center justify-between">
          <button
            className="rounded-full bg-[#8AF4A6] px-4 py-2 font-mono text-sm font-semibold text-[#0F3C1B]"
            type="button"
          >
            Edit
          </button>
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
            {category && (
              <p className="mb-2 font-mono text-[42px] font-semibold tracking-tight text-brand-text">
                {category.name}
              </p>
            )}
            <div className="space-y-4">
              {items.map(env => (
                <EnvelopeCard
                  key={env.id}
                  envelope={env}
                  spentIdr={spentMap[env.id] ?? 0}
                  displayCurrency={dc}
                  fxRates={fxRates}
                  onClick={() => openEdit(env)}
                />
              ))}
            </div>
          </div>
        ))}
        {grouped.length > 0 && (
          <div className="border-t border-brand-border pt-4">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[42px] font-semibold tracking-tight text-brand-text">Available</span>
              <span className={`font-mono text-[42px] font-semibold leading-none ${totalAvailableDisplay < 0 ? "text-red-500" : "text-brand-text"}`}>
                {format(totalAvailableDisplay, dc)}
              </span>
            </div>
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
          envelopes={envelopes}
          dbUser={dbUser}
          household={household}
          fxRates={fxRates}
          defaultEnvelope={defaultEnvelope}
        />
      )}
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
