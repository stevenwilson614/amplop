import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { FxRates } from "@/lib/currency";
import type { Category, Envelope } from "@/lib/types";
import TransactionEntry from "@/components/transactions/TransactionEntry";

export default async function NewTransactionPage() {
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
    .select("currency_pair, rate")
    .order("fetched_at", { ascending: false });

  const fxRates: FxRates = {};
  for (const row of rateRows ?? []) {
    if (!fxRates[row.currency_pair]) fxRates[row.currency_pair] = Number(row.rate);
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

  return (
    <TransactionEntry
      envelopes={(envelopes as Envelope[]) ?? []}
      categories={(categories as Category[]) ?? []}
      fxRates={fxRates}
      userId={user.id}
      householdId={profile.household_id}
      displayCurrency={profile.display_currency}
    />
  );
}
