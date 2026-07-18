import type { CashSnapshot, Envelope, FxRates } from "@/lib/types";
import { convert, format } from "@/lib/currency";
import { snapshotTotalIdr } from "@/lib/cashSnapshot";

export interface EnvelopeBalanceRow {
  envelope: Envelope;
  balanceIdr: number;
}

export interface InvestableSnapshot {
  cashIdr: number;
  earmarkedMonthlyIdr: number;
  earmarkedSinkingIdr: number;
  earmarkedTotalIdr: number;
  investableIdr: number;
  overcommitted: boolean;
  previousCashIdr: number | null;
  cashDeltaIdr: number | null;
  latestSnapshot: CashSnapshot | null;
  previousSnapshot: CashSnapshot | null;
}

export function computeInvestable(args: {
  snapshots: CashSnapshot[];
  balances: EnvelopeBalanceRow[];
  fxRates?: FxRates;
}): InvestableSnapshot {
  const sorted = [...args.snapshots].sort((a, b) =>
    b.as_of_date.localeCompare(a.as_of_date) || b.created_at.localeCompare(a.created_at)
  );
  const latest = sorted[0] ?? null;
  const previous = sorted[1] ?? null;

  let earmarkedMonthly = 0;
  let earmarkedSinking = 0;
  for (const row of args.balances) {
    const positive = Math.max(0, row.balanceIdr);
    if ((row.envelope.kind ?? "monthly") === "sinking") {
      earmarkedSinking += positive;
    } else if (!row.envelope.trip_id) {
      earmarkedMonthly += positive;
    }
  }

  const cashIdr = latest ? snapshotTotalIdr(latest, args.fxRates) : 0;
  const earmarkedTotalIdr = earmarkedMonthly + earmarkedSinking;
  const investableIdr = cashIdr - earmarkedTotalIdr;
  const previousCashIdr = previous ? snapshotTotalIdr(previous, args.fxRates) : null;

  return {
    cashIdr,
    earmarkedMonthlyIdr: earmarkedMonthly,
    earmarkedSinkingIdr: earmarkedSinking,
    earmarkedTotalIdr,
    investableIdr,
    overcommitted: investableIdr < 0,
    previousCashIdr,
    cashDeltaIdr: previousCashIdr === null ? null : cashIdr - previousCashIdr,
    latestSnapshot: latest,
    previousSnapshot: previous,
  };
}

/** True when the latest snapshot is from a previous calendar month (local time). */
export function needsMonthlySnapshot(latest: CashSnapshot | null, now = new Date()): boolean {
  if (!latest) return false;
  return latest.as_of_date.slice(0, 7) < now.toLocaleDateString("en-CA").slice(0, 7);
}

export function formatDualAmount(
  amountIdr: number,
  displayCurrency: string,
  fxRates: FxRates
): { primary: string; secondary: string | null } {
  const primaryMinor =
    displayCurrency === "IDR" ? amountIdr : convert(amountIdr, "IDR", displayCurrency, fxRates);
  const primary = format(primaryMinor, displayCurrency);
  const other = displayCurrency === "IDR" ? "USD" : "IDR";
  const secondaryMinor =
    other === "IDR" ? amountIdr : convert(amountIdr, "IDR", other, fxRates);
  return { primary, secondary: format(secondaryMinor, other) };
}
