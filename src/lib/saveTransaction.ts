import { supabase } from "@/lib/supabase";
import type { FxRates, TxType } from "@/lib/types";
import { convert, getRate } from "@/lib/currency";

export interface SaveTransactionAllocation {
  envelope_id: string;
  amountMinor: number;
}

export interface SaveTransactionInput {
  householdId: string;
  userId: string;
  txType: TxType;
  amountMinor: number;
  currency: string;
  date: string;
  merchantName?: string | null;
  notes?: string | null;
  allocations: SaveTransactionAllocation[];
  fxRates: FxRates;
}

/** Shared insert path for TransactionEntry and quick text logging. */
export async function saveTransaction(input: SaveTransactionInput): Promise<{ id: string }> {
  const {
    householdId,
    userId,
    txType,
    amountMinor,
    currency,
    date,
    merchantName,
    notes,
    allocations,
    fxRates,
  } = input;

  if (amountMinor <= 0) throw new Error("enter amount");
  if (!allocations.length) throw new Error("select envelope(s)");

  const amountIdr = convert(amountMinor, currency, "IDR", fxRates);
  const fxRate = currency === "IDR" ? 1 : getRate(fxRates, currency, "IDR");

  const { data: tx, error: txErr } = await supabase
    .from("transactions")
    .insert({
      household_id: householdId,
      user_id: userId,
      tx_type: txType,
      amount: amountMinor,
      currency,
      amount_idr_snapshot: amountIdr,
      fx_rate_snapshot: fxRate,
      date,
      merchant_name: txType === "transfer" ? null : (merchantName || null),
      notes: notes || null,
    })
    .select("id")
    .single();
  if (txErr) throw txErr;

  const { error: allocErr } = await supabase.from("transaction_allocations").insert(
    allocations.map((a) => ({
      transaction_id: tx.id,
      envelope_id: a.envelope_id,
      amount: a.amountMinor,
    }))
  );
  if (allocErr) throw allocErr;

  return { id: tx.id };
}
