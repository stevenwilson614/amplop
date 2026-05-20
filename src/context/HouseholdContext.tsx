import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import type { DbUser, Household, FxRates } from "@/lib/types";
import { supabase } from "@/lib/supabase";
import { buildRates } from "@/lib/currency";

interface HouseholdCtx {
  dbUser: DbUser | null;
  household: Household | null;
  fxRates: FxRates;
  loading: boolean;
  needsOnboarding: boolean;
  refetch: () => void;
}

const Ctx = createContext<HouseholdCtx>({
  dbUser: null,
  household: null,
  fxRates: {},
  loading: true,
  needsOnboarding: false,
  refetch: () => {},
});

export function HouseholdProvider({ children }: { children: ReactNode }) {
  const [dbUser, setDbUser] = useState<DbUser | null>(null);
  const [household, setHousehold] = useState<Household | null>(null);
  const [fxRates, setFxRates] = useState<FxRates>({});
  const [loading, setLoading] = useState(true);
  const [needsOnboarding, setNeedsOnboarding] = useState(false);

  const load = useCallback(async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { setLoading(false); return; }

    const { data: dbUserRow } = await supabase
      .from("users")
      .select("*")
      .eq("id", user.id)
      .maybeSingle();

    if (!dbUserRow) {
      setNeedsOnboarding(true);
      setLoading(false);
      return;
    }

    setDbUser(dbUserRow);
    setNeedsOnboarding(false);

    const [{ data: hh }, { data: rates }] = await Promise.all([
      supabase.from("households").select("*").eq("id", dbUserRow.household_id).single(),
      supabase
        .from("fx_rates")
        .select("currency_pair, rate, fetched_at")
        .order("fetched_at", { ascending: false }),
    ]);

    if (hh) setHousehold(hh);
    if (rates) {
      // Deduplicate: keep only latest per pair
      const seen = new Set<string>();
      const latest = rates.filter((r) => {
        if (seen.has(r.currency_pair)) return false;
        seen.add(r.currency_pair);
        return true;
      });
      setFxRates(buildRates(latest));
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  // Realtime: re-fetch envelopes/transactions when DB changes
  useEffect(() => {
    if (!household) return;
    const channel = supabase
      .channel("household-changes")
      .on("postgres_changes", { event: "*", schema: "public", table: "envelopes" }, () => load())
      .on("postgres_changes", { event: "*", schema: "public", table: "transactions" }, () => load())
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [household, load]);

  return (
    <Ctx.Provider value={{ dbUser, household, fxRates, loading, needsOnboarding, refetch: load }}>
      {children}
    </Ctx.Provider>
  );
}

export const useHousehold = () => useContext(Ctx);
