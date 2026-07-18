import type { CashSnapshot, FxRates } from "@/lib/types";
import { convert } from "@/lib/currency";

export function snapshotTotalMinor(snapshot: CashSnapshot): number {
  const bucketed =
    (snapshot.business_amount ?? 0) +
    (snapshot.personal_amount ?? 0) +
    (snapshot.savings_amount ?? 0) +
    (snapshot.other_amount ?? 0);
  return bucketed > 0 ? bucketed : snapshot.amount;
}

export function snapshotTotalIdr(snapshot: CashSnapshot, fxRates?: FxRates): number {
  if (snapshot.amount_idr_snapshot && snapshotTotalMinor(snapshot) === snapshot.amount) {
    return snapshot.amount_idr_snapshot;
  }
  const total = snapshotTotalMinor(snapshot);
  const currency = snapshot.currency || "USD";
  return fxRates ? convert(total, currency, "IDR", fxRates) : total;
}

export interface SnapshotWithDelta extends CashSnapshot {
  totalMinor: number;
  deltaMinor: number | null;
  businessDelta: number | null;
  personalDelta: number | null;
  savingsDelta: number | null;
  otherDelta: number | null;
}

export function attachSnapshotDeltas(snapshots: CashSnapshot[]): SnapshotWithDelta[] {
  const sorted = [...snapshots].sort(
    (a, b) => b.as_of_date.localeCompare(a.as_of_date) || b.created_at.localeCompare(a.created_at)
  );
  return sorted.map((snapshot, index) => {
    const prev = sorted[index + 1];
    const totalMinor = snapshotTotalMinor(snapshot);
    const prevTotal = prev ? snapshotTotalMinor(prev) : null;
    return {
      ...snapshot,
      totalMinor,
      deltaMinor: prevTotal === null ? null : totalMinor - prevTotal,
      businessDelta: prev ? (snapshot.business_amount ?? 0) - (prev.business_amount ?? 0) : null,
      personalDelta: prev ? (snapshot.personal_amount ?? 0) - (prev.personal_amount ?? 0) : null,
      savingsDelta: prev ? (snapshot.savings_amount ?? 0) - (prev.savings_amount ?? 0) : null,
      otherDelta: prev ? (snapshot.other_amount ?? 0) - (prev.other_amount ?? 0) : null,
    };
  });
}

export function bucketPayload(args: {
  business: number;
  personal: number;
  savings: number;
  other: number;
  otherLabel?: string;
}) {
  const amount = args.business + args.personal + args.savings + args.other;
  return {
    currency: "USD",
    amount,
    business_amount: args.business,
    personal_amount: args.personal,
    savings_amount: args.savings,
    other_amount: args.other,
    other_label: args.otherLabel?.trim() || null,
  };
}
