import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import { useHousehold } from "@/context/HouseholdContext";
import type { Category, Envelope } from "@/lib/types";
import TransactionEntry from "@/components/transactions/TransactionEntry";

export interface TransactionPrefill {
  amount?: string;
  merchant?: string;
  envelopeName?: string;
  txType?: "expense" | "income" | "transfer";
}

interface Ctx {
  openTransaction: (envelope?: Envelope, prefill?: TransactionPrefill) => void;
  setContextEnvelope: (envelope: Envelope | null) => void;
  contextEnvelope: Envelope | null;
}

const TransactionModalCtx = createContext<Ctx>({
  openTransaction: () => {},
  setContextEnvelope: () => {},
  contextEnvelope: null,
});

export function TransactionModalProvider({ children }: { children: ReactNode }) {
  const { household, dbUser, fxRates, refetch } = useHousehold();
  const [open, setOpen] = useState(false);
  const [defaultEnvelope, setDefaultEnvelope] = useState<Envelope | undefined>();
  const [contextEnvelope, setContextEnvelope] = useState<Envelope | null>(null);
  const [prefill, setPrefill] = useState<TransactionPrefill | undefined>();
  const [envelopes, setEnvelopes] = useState<Envelope[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);

  const loadEnvelopes = useCallback(async () => {
    if (!household) return;
    const [{ data: envs }, { data: cats }] = await Promise.all([
      supabase.from("envelopes").select("*").eq("household_id", household.id).order("sort_order"),
      supabase.from("categories").select("*").eq("household_id", household.id).order("sort_order"),
    ]);
    setEnvelopes(envs ?? []);
    setCategories(cats ?? []);
  }, [household]);

  useEffect(() => {
    loadEnvelopes();
  }, [loadEnvelopes]);

  const openTransaction = useCallback((envelope?: Envelope, nextPrefill?: TransactionPrefill) => {
    setDefaultEnvelope(envelope);
    setPrefill(nextPrefill);
    setOpen(true);
    loadEnvelopes();
  }, [loadEnvelopes]);

  useEffect(() => {
    function handleDeepLink() {
      const hash = window.location.hash;
      const qIndex = hash.indexOf("?");
      if (qIndex < 0) return;
      const params = new URLSearchParams(hash.slice(qIndex + 1));
      if (params.get("addTx") !== "1") return;

      const amount = params.get("amount") ?? undefined;
      const merchant = params.get("merchant") ?? params.get("payee") ?? undefined;
      const envelopeName = params.get("envelope") ?? undefined;
      const txType = params.get("type") as TransactionPrefill["txType"] | null;

      openTransaction(undefined, {
        amount,
        merchant,
        envelopeName,
        txType: txType ?? "expense",
      });

      window.history.replaceState({}, "", hash.slice(0, qIndex));
    }

    handleDeepLink();
    window.addEventListener("hashchange", handleDeepLink);
    return () => window.removeEventListener("hashchange", handleDeepLink);
  }, [openTransaction]);

  return (
    <TransactionModalCtx.Provider value={{ openTransaction, setContextEnvelope, contextEnvelope }}>
      {children}
      {dbUser && household && (
        <TransactionEntry
          open={open}
          onClose={() => { setOpen(false); setPrefill(undefined); }}
          onSaved={() => {
            loadEnvelopes();
            refetch();
            window.dispatchEvent(new CustomEvent("amplop:data-changed"));
          }}
          envelopes={envelopes}
          categories={categories}
          dbUser={dbUser}
          household={household}
          fxRates={fxRates}
          defaultEnvelope={defaultEnvelope}
          prefill={prefill}
        />
      )}
    </TransactionModalCtx.Provider>
  );
}

export const useTransactionModal = () => useContext(TransactionModalCtx);
