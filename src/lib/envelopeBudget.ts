import type { Envelope, FxRates } from "@/lib/types";
import { convert } from "@/lib/currency";
import { supabase } from "@/lib/supabase";

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

export function currentMonthKey(now = new Date()): string {
  return now.toLocaleDateString("en-CA").slice(0, 7);
}

export function nextMonthKey(monthKey: string): string {
  const [year, month] = monthKey.split("-").map(Number);
  const d = new Date(year, month, 1);
  return d.toLocaleDateString("en-CA").slice(0, 7);
}

/** Total funded = monthly budget × months (legacy fallback when no carryover snapshot). */
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

export function buildMonthSpentByEnvelope(
  transactions: Array<{
    date: string;
    amount: number;
    amount_idr_snapshot: number;
    allocations?: Array<{ envelope_id: string; amount: number }> | null;
  }>
): Record<string, Record<string, number>> {
  const map: Record<string, Record<string, number>> = {};
  for (const tx of transactions) {
    const total = Number(tx.amount) || 0;
    const totalIdr = Number(tx.amount_idr_snapshot) || 0;
    if (!total || !tx.allocations?.length) continue;
    const month = tx.date.slice(0, 7);
    for (const alloc of tx.allocations) {
      const allocMinor = Number(alloc.amount) || 0;
      const allocIdr = Math.round((allocMinor / total) * totalIdr);
      if (!map[alloc.envelope_id]) map[alloc.envelope_id] = {};
      map[alloc.envelope_id][month] = (map[alloc.envelope_id][month] ?? 0) + allocIdr;
    }
  }
  return map;
}

/** Leftover from prior months, rolled forward through completed calendar months. */
export function rolledCarryoverIdr(args: {
  carryoverIdr: number;
  carryoverMonth: string;
  monthlyBudgetIdr: number;
  monthSpentByMonth: Record<string, number>;
  now?: Date;
}): number {
  const { carryoverIdr, carryoverMonth, monthlyBudgetIdr, monthSpentByMonth, now = new Date() } = args;
  const currentMonth = currentMonthKey(now);
  let carryover = carryoverIdr;
  let cursor = carryoverMonth;
  while (cursor < currentMonth) {
    carryover += monthlyBudgetIdr - (monthSpentByMonth[cursor] ?? 0);
    cursor = nextMonthKey(cursor);
  }
  return carryover;
}

/**
 * Goodbudget-style balance when carryover snapshot exists:
 * prior leftover + this month's budget − this month's spending.
 */
export function computeBalanceFromCarryover(args: {
  envelope: Envelope;
  monthlyBudgetIdr: number;
  monthSpentIdr: number;
  monthSpentByMonth: Record<string, number>;
  now?: Date;
}): number | null {
  const { envelope, monthlyBudgetIdr, monthSpentIdr, monthSpentByMonth, now = new Date() } = args;
  if (!envelope.carryover_month) return null;

  const priorRemaining = rolledCarryoverIdr({
    carryoverIdr: envelope.carryover_idr ?? 0,
    carryoverMonth: envelope.carryover_month,
    monthlyBudgetIdr,
    monthSpentByMonth,
    now,
  });
  return priorRemaining + monthlyBudgetIdr - monthSpentIdr;
}

/** Legacy fallback: total funded − lifetime spent. */
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

export function resolveEnvelopeBalanceIdr(args: {
  envelope: Envelope;
  isTrip: boolean;
  monthlyBudgetIdr: number;
  spentIdr: number;
  monthSpentIdr: number;
  budgetMonths: number;
  availableIdr: number;
  monthSpentByMonth?: Record<string, number>;
  now?: Date;
}): number {
  if (args.isTrip) return args.availableIdr - args.spentIdr;

  const fromCarryover = computeBalanceFromCarryover({
    envelope: args.envelope,
    monthlyBudgetIdr: args.monthlyBudgetIdr,
    monthSpentIdr: args.monthSpentIdr,
    monthSpentByMonth: args.monthSpentByMonth ?? {},
    now: args.now,
  });
  if (fromCarryover !== null) return fromCarryover;

  return computeEnvelopeBalanceIdr({
    monthlyBudgetIdr: args.monthlyBudgetIdr,
    spentIdr: args.spentIdr,
    monthSpentIdr: args.monthSpentIdr,
    budgetMonths: args.budgetMonths,
  });
}

/** Set carryover snapshot from a Goodbudget remaining balance (mid-month safe). */
export function carryoverFromRemaining(args: {
  remainingIdr: number;
  monthlyBudgetIdr: number;
  monthSpentIdr: number;
}): number {
  return args.remainingIdr + args.monthSpentIdr - args.monthlyBudgetIdr;
}

type HouseholdTxRow = {
  date: string;
  amount: number;
  amount_idr_snapshot: number;
  allocations?: Array<{ envelope_id: string; amount: number }> | null;
};

/** Paginate past Supabase's 1000-row default limit. */
export async function fetchAllHouseholdTransactions(householdId: string): Promise<HouseholdTxRow[]> {
  const pageSize = 1000;
  let offset = 0;
  const all: HouseholdTxRow[] = [];
  while (true) {
    const { data, error } = await supabase
      .from("transactions")
      .select("date, amount, amount_idr_snapshot, allocations:transaction_allocations(envelope_id, amount)")
      .eq("household_id", householdId)
      .order("date", { ascending: true })
      .range(offset, offset + pageSize - 1);
    if (error) throw error;
    const chunk = (data ?? []) as HouseholdTxRow[];
    all.push(...chunk);
    if (chunk.length < pageSize) break;
    offset += pageSize;
  }
  return all;
}
