import { useState, useEffect, useCallback } from "react";
import { useHousehold } from "@/context/HouseholdContext";
import { supabase } from "@/lib/supabase";
import type { Transaction, Envelope, Category } from "@/lib/types";
import TransactionList from "@/components/transactions/TransactionList";
import TransactionEntry from "@/components/transactions/TransactionEntry";

export default function TransactionsPage() {
  const { household, dbUser, fxRates } = useHousehold();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [envelopes, setEnvelopes] = useState<Envelope[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [txOpen, setTxOpen] = useState(false);

  const load = useCallback(async () => {
    if (!household) return;
    const [{ data: txs }, { data: envs }, { data: cats }] = await Promise.all([
      supabase
        .from("transactions")
        .select("*, allocations:transaction_allocations(*)")
        .eq("household_id", household.id)
        .order("date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(100),
      supabase.from("envelopes").select("*").eq("household_id", household.id),
      supabase.from("categories").select("*").eq("household_id", household.id).order("sort_order"),
    ]);
    setTransactions(txs ?? []);
    setEnvelopes(envs ?? []);
    setCategories(cats ?? []);
  }, [household]);

  useEffect(() => { load(); }, [load]);

  const dc = dbUser?.display_currency ?? "IDR";

  return (
    <div className="flex flex-col min-h-full">
      <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 bg-brand-bg border-b border-brand-border">
        <h1 className="font-mono font-bold text-brand-text">transactions</h1>
        <button
          onClick={() => setTxOpen(true)}
          className="w-8 h-8 flex items-center justify-center rounded-full bg-brand-accent font-mono text-brand-text text-xl leading-none"
        >+</button>
      </div>

      <div className="flex-1 overflow-auto p-4 pb-24">
        <TransactionList
          transactions={transactions}
          envelopes={envelopes}
          displayCurrency={dc}
          fxRates={fxRates}
        />
      </div>

      {dbUser && household && (
        <TransactionEntry
          open={txOpen}
          onClose={() => setTxOpen(false)}
          onSaved={load}
          envelopes={envelopes}
          categories={categories}
          dbUser={dbUser}
          household={household}
          fxRates={fxRates}
        />
      )}
    </div>
  );
}
