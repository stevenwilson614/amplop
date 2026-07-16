/** Bar fill = share of budget spent, capped at 100% (120/100 → full bar). */
export function budgetSpentPct(spentIdr: number, availableIdr: number): number {
  if (availableIdr <= 0) return spentIdr > 0 ? 100 : 0;
  return Math.max(0, Math.min(100, Math.round((spentIdr / availableIdr) * 100)));
}

/** Bar fill = share of budget remaining (trip envelopes — full green when unspent). */
export function budgetRemainingPct(spentIdr: number, availableIdr: number): number {
  if (availableIdr <= 0) return 0;
  const balance = availableIdr - spentIdr;
  if (balance <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((balance / availableIdr) * 100)));
}

export function budgetBarPct(
  spentIdr: number,
  availableIdr: number,
  mode: "spent" | "remaining"
): number {
  return mode === "remaining"
    ? budgetRemainingPct(spentIdr, availableIdr)
    : budgetSpentPct(spentIdr, availableIdr);
}

/**
 * Household bar aligned with the big "amount left" number:
 * fill = balance ÷ monthly budget (capped at 100%).
 * So ~full monthly leftover → nearly full green; overspent → empty.
 */
export function balanceVsMonthlyBarPct(balanceIdr: number, monthlyBudgetIdr: number): number {
  if (monthlyBudgetIdr <= 0) return balanceIdr > 0 ? 100 : 0;
  if (balanceIdr <= 0) return 0;
  return Math.max(0, Math.min(100, Math.round((balanceIdr / monthlyBudgetIdr) * 100)));
}
