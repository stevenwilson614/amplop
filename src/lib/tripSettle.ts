import { supabase } from "@/lib/supabase";
import type { Envelope, FxRates } from "@/lib/types";
import { convert } from "@/lib/currency";
import { scoreCoverEnvelope } from "@/lib/tripFunding";

export interface TripSettleLine {
  envelope: Envelope;
  budgetIdr: number;
  expensesIdr: number;
  /** expenses − budget; positive = overspent, negative = leftover */
  diffIdr: number;
}

export interface TripSettleCover {
  envelope: Envelope;
  availableIdr: number;
  useIdr: number;
}

export interface TripSettlement {
  lines: TripSettleLine[];
  totalBudgetIdr: number;
  totalExpensesIdr: number;
  /** >0 overspent, <0 leftover to return */
  netIdr: number;
  covers: TripSettleCover[];
  shortByIdr: number;
}

/**
 * Expense-only IDR spend per envelope. Transfers are excluded on purpose:
 * planner cover transfers land as negative allocations on trip envelopes,
 * so get_envelope_spent would understate what the trip actually cost.
 */
export async function fetchExpensesIdrByEnvelope(
  householdId: string,
  envelopeIds: string[]
): Promise<Record<string, number>> {
  if (!envelopeIds.length) return {};
  const { data, error } = await supabase
    .from("transaction_allocations")
    .select("envelope_id, amount, tx:transactions!inner(amount, amount_idr_snapshot, tx_type, household_id)")
    .in("envelope_id", envelopeIds)
    .eq("tx.tx_type", "expense")
    .eq("tx.household_id", householdId);
  if (error) throw error;

  const out: Record<string, number> = {};
  for (const row of data ?? []) {
    const tx = row.tx as unknown as { amount: number; amount_idr_snapshot: number };
    const total = Number(tx?.amount) || 0;
    if (!total) continue;
    const allocIdr = Math.round((Number(row.amount) / total) * Number(tx.amount_idr_snapshot || 0));
    out[row.envelope_id] = (out[row.envelope_id] ?? 0) + allocIdr;
  }
  return out;
}

export function computeTripSettlement(args: {
  tripEnvelopes: Envelope[];
  expensesIdrById: Record<string, number>;
  /** non-trip envelopes, cover candidates */
  householdEnvelopes: Envelope[];
  balancesById: Record<string, number>;
  fxRates: FxRates;
  /** restrict covering to one envelope ("" = suggested mix) */
  coverEnvelopeId?: string;
}): TripSettlement {
  const lines: TripSettleLine[] = args.tripEnvelopes.map((envelope) => {
    const budgetIdr =
      envelope.budget_currency === "IDR"
        ? envelope.budget_amount
        : convert(envelope.budget_amount, envelope.budget_currency, "IDR", args.fxRates);
    const expensesIdr = args.expensesIdrById[envelope.id] ?? 0;
    return { envelope, budgetIdr, expensesIdr, diffIdr: expensesIdr - budgetIdr };
  });

  const totalBudgetIdr = lines.reduce((s, l) => s + l.budgetIdr, 0);
  const totalExpensesIdr = lines.reduce((s, l) => s + l.expensesIdr, 0);
  const netIdr = totalExpensesIdr - totalBudgetIdr;

  const covers: TripSettleCover[] = [];
  let shortByIdr = 0;
  if (netIdr > 0) {
    const candidates = args.householdEnvelopes
      .filter((e) => !e.trip_id && (args.balancesById[e.id] ?? 0) > 0)
      .filter((e) => !args.coverEnvelopeId || e.id === args.coverEnvelopeId)
      .map((e) => ({
        envelope: e,
        availableIdr: Math.max(0, args.balancesById[e.id] ?? 0),
        score: scoreCoverEnvelope(e),
      }))
      .sort((a, b) => b.score - a.score || b.availableIdr - a.availableIdr);

    let remaining = netIdr;
    for (const c of candidates) {
      if (remaining <= 0) break;
      const useIdr = Math.min(c.availableIdr, remaining);
      if (useIdr <= 0) continue;
      covers.push({ envelope: c.envelope, availableIdr: c.availableIdr, useIdr });
      remaining -= useIdr;
    }
    shortByIdr = remaining;
  }

  return { lines, totalBudgetIdr, totalExpensesIdr, netIdr, covers, shortByIdr };
}

/** Default destination for returning trip leftovers (vacation-ish save-for first). */
export function defaultReturnEnvelope(householdEnvelopes: Envelope[]): Envelope | undefined {
  return [...householdEnvelopes]
    .filter((e) => !e.trip_id)
    .sort((a, b) => scoreCoverEnvelope(b) - scoreCoverEnvelope(a))[0];
}
