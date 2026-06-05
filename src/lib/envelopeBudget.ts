import type { Envelope, FxRates } from "@/lib/types";
import { convert } from "@/lib/currency";

/** Calendar months from start (inclusive of start month) through now. */
export function budgetMonthsElapsed(startDate: Date, now = new Date()): number {
  return Math.max(
    1,
    (now.getFullYear() - startDate.getFullYear()) * 12 +
      (now.getMonth() - startDate.getMonth()) +
      1
  );
}

/** Budget accrual starts at first spend or envelope creation, whichever is earlier. */
export function envelopeBudgetStartDate(env: Envelope, firstTxDate?: string | null): Date {
  const created = new Date(env.created_at);
  if (!firstTxDate) return created;
  const first = new Date(`${firstTxDate}T00:00:00`);
  return first.getTime() < created.getTime() ? first : created;
}

export function monthlyBudgetIdr(env: Envelope, fxRates: FxRates): number {
  return env.budget_currency === "IDR"
    ? env.budget_amount
    : convert(env.budget_amount, env.budget_currency, "IDR", fxRates);
}

/** Total funded = monthly budget × months (includes prior-month rollover pool). */
export function computeAvailableIdr(
  env: Envelope,
  fxRates: FxRates,
  firstTxDate?: string | null,
  now = new Date()
): number {
  const monthly = monthlyBudgetIdr(env, fxRates);
  const start = envelopeBudgetStartDate(env, firstTxDate);
  const months = budgetMonthsElapsed(start, now);
  return monthly * months;
}

/**
 * Goodbudget-style balance: this month's fill + carryover from prior months − spent.
 * Equivalent to total funded − lifetime spent when months align with history.
 */
export function computeEnvelopeBalanceIdr(args: {
  monthlyBudgetIdr: number;
  spentIdr: number;
  monthSpentIdr: number;
  budgetMonths: number;
}): number {
  const { monthlyBudgetIdr, spentIdr, monthSpentIdr, budgetMonths } = args;
  const spentBeforeMonth = Math.max(0, spentIdr - monthSpentIdr);
  const monthsBeforeCurrent = Math.max(0, budgetMonths - 1);
  const carryover = monthlyBudgetIdr * monthsBeforeCurrent - spentBeforeMonth;
  return monthlyBudgetIdr + carryover - monthSpentIdr;
}

/** Trip envelopes use total budget − spent; household uses monthly fill + carryover − spent. */
export function resolveEnvelopeBalanceIdr(args: {
  isTrip: boolean;
  monthlyBudgetIdr: number;
  spentIdr: number;
  monthSpentIdr: number;
  budgetMonths: number;
  availableIdr: number;
}): number {
  if (args.isTrip) return args.availableIdr - args.spentIdr;
  return computeEnvelopeBalanceIdr({
    monthlyBudgetIdr: args.monthlyBudgetIdr,
    spentIdr: args.spentIdr,
    monthSpentIdr: args.monthSpentIdr,
    budgetMonths: args.budgetMonths,
  });
}

export function buildFirstActivityMap(
  transactions: Array<{
    date: string;
    allocations?: Array<{ envelope_id: string }> | null;
  }>
): Record<string, string> {
  const map: Record<string, string> = {};
  for (const tx of transactions) {
    for (const alloc of tx.allocations ?? []) {
      const id = alloc.envelope_id;
      if (!map[id] || tx.date < map[id]) map[id] = tx.date;
    }
  }
  return map;
}
