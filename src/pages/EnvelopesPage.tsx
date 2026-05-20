import { useState, useEffect, useCallback } from "react";
import { useHousehold } from "@/context/HouseholdContext";
import { supabase } from "@/lib/supabase";
import type { Envelope, Category, EnvelopeSpent } from "@/lib/types";
import EnvelopeCard from "@/components/envelopes/EnvelopeCard";
import EnvelopeSheet from "@/components/envelopes/EnvelopeSheet";
import TransactionEntry from "@/components/transactions/TransactionEntry";

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

  // Group envelopes by category (plus uncategorised)
  const grouped = groupByCategory(envelopes, categories);

  return (
    <div className="flex flex-col min-h-full">
      <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 bg-brand-bg border-b border-brand-border">
        <h1 className="font-mono font-bold text-brand-text">{household?.name ?? "envelopes"}</h1>
        <button
          onClick={openAdd}
          className="w-8 h-8 flex items-center justify-center rounded-full bg-brand-accent font-mono text-brand-text text-xl leading-none"
        >+</button>
      </div>

      <div className="flex-1 overflow-auto p-4 space-y-6 pb-24">
        {grouped.length === 0 && (
          <div className="text-center py-12">
            <p className="font-mono text-sm text-brand-text-muted">no envelopes yet</p>
            <button onClick={openAdd} className="mt-3 font-mono text-sm text-brand-accent">+ add envelope</button>
          </div>
        )}
        {grouped.map(({ category, items }) => (
          <div key={category?.id ?? "__none__"}>
            {category && (
              <p className="font-mono text-xs text-brand-text-muted uppercase tracking-widest mb-2">
                {category.name}
              </p>
            )}
            <div className="space-y-3">
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
      </div>

      {/* FAB: add transaction */}
      <button
        onClick={() => openTx()}
        className="fixed bottom-20 right-4 w-14 h-14 rounded-full bg-brand-accent shadow-lg flex items-center justify-center font-mono text-2xl text-brand-text z-20"
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
