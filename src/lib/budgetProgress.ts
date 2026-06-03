/** Bar fill = share of budget spent, capped at 100% (120/100 → full bar). */
export function budgetSpentPct(spentIdr: number, availableIdr: number): number {
  if (availableIdr <= 0) return spentIdr > 0 ? 100 : 0;
  return Math.max(0, Math.min(100, Math.round((spentIdr / availableIdr) * 100)));
}
