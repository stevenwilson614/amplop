import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { FxRates } from "@/lib/currency";
import type { Category, Envelope } from "@/lib/types";
import EnvelopeDashboard from "@/components/envelopes/EnvelopeDashboard";

export default async function EnvelopesPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("display_currency, household_id")
    .eq("id", user.id)
    .single();

  if (!profile) redirect("/settings");

  // Latest fx_rates (one per pair, newest first) — also grab fetched_at for freshness badge
  const { data: rateRows } = await supabase
    .from("fx_rates")
    .select("currency_pair, rate, fetched_at")
    .order("fetched_at", { ascending: false });

  const fxRates: FxRates = {};
  let ratesUpdatedAt: string | null = null;
  for (const row of rateRows ?? []) {
    if (!fxRates[row.currency_pair]) {
      fxRates[row.currency_pair] = Number(row.rate);
      if (!ratesUpdatedAt) ratesUpdatedAt = row.fetched_at;
    }
  }

  const { data: categories } = await supabase
    .from("categories")
    .select("id, household_id, name, sort_order, created_at")
    .order("sort_order");

  const { data: envelopes } = await supabase
    .from("envelopes")
    .select(
      "id, household_id, category_id, trip_id, parent_envelope_id, name, budget_amount, budget_currency, sort_order, created_at"
    )
    .is("trip_id", null)
    .is("parent_envelope_id", null)
    .order("sort_order");

  // Spent amounts in IDR per envelope (locked historical snapshots)
  const { data: spentRows } = await supabase.rpc("get_envelope_spent");
  const spentIdr: Record<string, number> = {};
  for (const row of spentRows ?? []) {
    spentIdr[row.envelope_id] = Number(row.spent_idr);
  }

  return (
    <EnvelopeDashboard
      displayCurrency={profile.display_currency}
      fxRates={fxRates}
      categories={(categories as Category[]) ?? []}
      initialEnvelopes={(envelopes as Envelope[]) ?? []}
      householdId={profile.household_id}
      spentIdr={spentIdr}
      ratesUpdatedAt={ratesUpdatedAt}
    />
  );
}
