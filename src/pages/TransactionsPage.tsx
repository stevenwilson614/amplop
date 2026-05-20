import { useState, useEffect, useCallback } from "react";
import { useHousehold } from "@/context/HouseholdContext";
import { supabase } from "@/lib/supabase";
import type { Transaction, Envelope } from "@/lib/types";
import TransactionList from "@/components/transactions/TransactionList";

export default function TransactionsPage() {
  const { household, dbUser, fxRates } = useHousehold();
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [envelopes, setEnvelopes] = useState<Envelope[]>([]);

  const load = useCallback(async () => {
    if (!household) return;
    const [{ data: txs }, { data: envs }] = await Promise.all([
      supabase
        .from("transactions")
        .select("*, allocations:transaction_allocations(*)")
        .eq("household_id", household.id)
        .order("date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(100),
      supabase.from("envelopes").select("*").eq("household_id", household.id),
    ]);
    setTransactions(txs ?? []);
    setEnvelopes(envs ?? []);
  }, [household]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    function onChange() { load(); }
    window.addEventListener("amplop:data-changed", onChange);
    return () => window.removeEventListener("amplop:data-changed", onChange);
  }, [load]);

  const dc = dbUser?.display_currency ?? "IDR";

  return (
    <div className="flex flex-col min-h-full">
      <div className="sticky top-0 z-10 flex items-center justify-between px-4 py-3 bg-brand-bg border-b border-brand-border">
        <h1 className="font-mono font-bold text-brand-text">transactions</h1>
      </div>

      <div className="flex-1 overflow-auto p-4 pb-24">
        <TransactionList
          transactions={transactions}
          envelopes={envelopes}
          displayCurrency={dc}
          fxRates={fxRates}
        />
      </div>
    </div>
  );
}
