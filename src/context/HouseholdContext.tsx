import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";
import type { DbUser, Household, FxRates } from "@/lib/types";
import { supabase } from "@/lib/supabase";
import { buildRates } from "@/lib/currency";
import { fetchLiveFxRates, mergeFxRates } from "@/lib/fxLive";

interface HouseholdCtx {
  dbUser: DbUser | null;
  household: Household | null;
  fxRates: FxRates;
  fxFetchedAt: string | null;
  loading: boolean;
  needsOnboarding: boolean;
  refetch: () => void;
}

const Ctx = createContext<HouseholdCtx>({
  dbUser: null,
  household: null,
  fxRates: {},
  fxFetchedAt: null,
  loading: true,
  needsOnboarding: false,
  refetch: () => {},
});

async function triggerFxSync() {
  await fetch(`${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fx-rate-sync`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
    },
  });
}

export function HouseholdProvider({ children }: { children: ReactNode }) {
  const [dbUser, setDbUser] = useState<DbUser | null>(null);
  const [household, setHousehold] = useState<Household | null>(null);
  const [fxRates, setFxRates] = useState<FxRates>({});
  const [fxFetchedAt, setFxFetchedAt] = useState<string | null>(null);
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
      const seen = new Set<string>();
      const latest = rates.filter((r) => {
        if (seen.has(r.currency_pair)) return false;
        seen.add(r.currency_pair);
        return true;
      });
      setFxRates(buildRates(latest));
      const usdRow = latest.find((r) => r.currency_pair === "USD/IDR");
      setFxFetchedAt(usdRow?.fetched_at ?? null);

      const fetchedMs = usdRow?.fetched_at ? new Date(usdRow.fetched_at).getTime() : 0;
      const stale = !fetchedMs || Date.now() - fetchedMs > 24 * 60 * 60 * 1000;
      if (stale) {
        await triggerFxSync();
        const { data: refreshed } = await supabase
          .from("fx_rates")
          .select("currency_pair, rate, fetched_at")
          .order("fetched_at", { ascending: false });
        if (refreshed) {
          const seen2 = new Set<string>();
          const latest2 = refreshed.filter((r) => {
            if (seen2.has(r.currency_pair)) return false;
            seen2.add(r.currency_pair);
            return true;
          });
          setFxRates(buildRates(latest2));
          const usd2 = latest2.find((r) => r.currency_pair === "USD/IDR");
          setFxFetchedAt(usd2?.fetched_at ?? null);
        }
      }

      // Always overlay live market rates so USD/IDR stays current
      const live = await fetchLiveFxRates();
      if (live) {
        setFxRates((prev) => mergeFxRates(prev, live));
      }
    } else {
      const live = await fetchLiveFxRates();
      if (live) setFxRates(live);
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
    <Ctx.Provider value={{ dbUser, household, fxRates, fxFetchedAt, loading, needsOnboarding, refetch: load }}>
      {children}
    </Ctx.Provider>
  );
}

export const useHousehold = () => useContext(Ctx);
