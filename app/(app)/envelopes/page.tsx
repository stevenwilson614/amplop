export const runtime = "edge";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { FxRates } from "@/lib/currency";
import type { Category, Envelope, TripWithEnvelopes } from "@/lib/types";
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

  // Top-level envelopes only (no trip sub-envelopes)
  const { data: envelopes } = await supabase
    .from("envelopes")
    .select(
      "id, household_id, category_id, trip_id, parent_envelope_id, name, budget_amount, budget_currency, drawn_idr_snapshot, sort_order, created_at"
    )
    .is("trip_id", null)
    .is("parent_envelope_id", null)
    .order("sort_order");

  // Trips with their sub-envelopes; active trips first
  const { data: trips } = await supabase
    .from("trips")
    .select(
      `id, household_id, name, start_date, end_date, currency, status, created_at,
       envelopes(id, household_id, category_id, trip_id, parent_envelope_id, name,
                 budget_amount, budget_currency, drawn_idr_snapshot, sort_order, created_at)`
    )
    .order("status")          // 'active' < 'ended' alphabetically
    .order("created_at", { ascending: false });

  // Spent per envelope — covers both regular and trip sub-envelopes
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
      initialTrips={(trips as TripWithEnvelopes[]) ?? []}
    />
  );
}
