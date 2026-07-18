import type { Envelope, FxRates } from "@/lib/types";
import { convert } from "@/lib/currency";

/** Start of current budget year given start month (1–12). */
export function budgetYearStart(startMonth = 1, now = new Date()): Date {
  const m = Math.min(12, Math.max(1, startMonth)) - 1;
  const year = now.getMonth() < m ? now.getFullYear() - 1 : now.getFullYear();
  return new Date(year, m, 1);
}

export function budgetYearEnd(startMonth = 1, now = new Date()): Date {
  const start = budgetYearStart(startMonth, now);
  return new Date(start.getFullYear() + 1, start.getMonth(), 0);
}

/** ISO date range for current budget year. */
export function budgetYearRange(startMonth = 1, now = new Date()): { startIso: string; endIso: string } {
  const start = budgetYearStart(startMonth, now);
  const end = budgetYearEnd(startMonth, now);
  return {
    startIso: start.toLocaleDateString("en-CA"),
    endIso: end.toLocaleDateString("en-CA"),
  };
}

export function monthsUntilDue(dueDate: string | null | undefined, now = new Date()): number | null {
  if (!dueDate) return null;
  const due = new Date(`${dueDate}T00:00:00`);
  if (due.getTime() <= now.getTime()) return 0;
  const months =
    (due.getFullYear() - now.getFullYear()) * 12 +
    (due.getMonth() - now.getMonth());
  return Math.max(0, months);
}

export function targetAmountIdr(env: Envelope, fxRates: FxRates): number {
  if (!env.target_amount) return 0;
  const currency = env.target_currency || env.budget_currency || "IDR";
  return currency === "IDR"
    ? env.target_amount
    : convert(env.target_amount, currency, "IDR", fxRates);
}

export function sinkingLeftToFundIdr(env: Envelope, fundedIdr: number, fxRates: FxRates): number {
  return Math.max(0, targetAmountIdr(env, fxRates) - Math.max(0, fundedIdr));
}

/** Suggested monthly fill to hit target by due date. */
export function suggestedMonthlyFillIdr(
  env: Envelope,
  fundedIdr: number,
  fxRates: FxRates,
  now = new Date()
): number {
  const left = sinkingLeftToFundIdr(env, fundedIdr, fxRates);
  if (left <= 0) return 0;
  const months = monthsUntilDue(env.due_date, now);
  if (months === null || months <= 0) return left;
  return Math.ceil(left / months);
}

export function isSinking(env: Envelope): boolean {
  return (env.kind ?? "monthly") === "sinking";
}
