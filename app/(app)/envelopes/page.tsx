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

  // Fetch user profile (display_currency + household linkage)
  const { data: profile } = await supabase
    .from("users")
    .select("display_currency, household_id")
    .eq("id", user.id)
    .single();

  // User exists in auth but not yet in users table (not onboarded)
  if (!profile) redirect("/settings");

  // Latest fx_rates — one row per pair, ordered newest first
  const { data: rateRows } = await supabase
    .from("fx_rates")
    .select("currency_pair, rate")
    .order("fetched_at", { ascending: false });

  // Build FxRates map, keeping only the latest rate per pair
  const fxRates: FxRates = {};
  for (const row of rateRows ?? []) {
    if (!fxRates[row.currency_pair]) {
      fxRates[row.currency_pair] = Number(row.rate);
    }
  }

  const { data: categories } = await supabase
    .from("categories")
    .select("id, household_id, name, sort_order, created_at")
    .order("sort_order");

  // Fetch top-level envelopes only (no trip sub-envelopes)
  const { data: envelopes } = await supabase
    .from("envelopes")
    .select(
      "id, household_id, category_id, trip_id, parent_envelope_id, name, budget_amount, budget_currency, sort_order, created_at"
    )
    .is("trip_id", null)
    .is("parent_envelope_id", null)
    .order("sort_order");

  return (
    <EnvelopeDashboard
      displayCurrency={profile.display_currency}
      fxRates={fxRates}
      categories={(categories as Category[]) ?? []}
      initialEnvelopes={(envelopes as Envelope[]) ?? []}
      householdId={profile.household_id}
    />
  );
}
