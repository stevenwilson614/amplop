import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { FxRates } from "@/lib/currency";
import TransactionList from "@/components/transactions/TransactionList";

export default async function TransactionsPage() {
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

  // Fetch last 100 transactions with allocations + envelope names + who added it
  const { data: transactions } = await supabase
    .from("transactions")
    .select(
      `id, amount, currency, amount_idr_snapshot, date, merchant_name, notes,
       location_name, created_at,
       transaction_allocations(id, amount, envelope_id, envelopes(id, name, budget_currency)),
       users(display_name)`
    )
    .order("date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(100);

  return (
    <TransactionList
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      initialTransactions={(transactions as any[]) ?? []}
      displayCurrency={profile.display_currency}
      fxRates={fxRates}
    />
  );
}
