import type { FxRates } from "@/lib/types";
import { buildRates } from "@/lib/currency";

export interface FxRateRow {
  currency_pair: string;
  rate: number;
  fetched_at: string;
}

/** Average FX rates over the last `days` days. Falls back to latest per pair if sparse. */
export function buildAverageRates(rows: FxRateRow[], days = 30, now = new Date()): FxRates {
  const cutoff = now.getTime() - days * 24 * 60 * 60 * 1000;
  const byPair = new Map<string, number[]>();
  const latestByPair = new Map<string, { rate: number; fetched_at: string }>();

  for (const row of rows) {
    const pair = row.currency_pair;
    const fetched = new Date(row.fetched_at).getTime();
    const prev = latestByPair.get(pair);
    if (!prev || fetched > new Date(prev.fetched_at).getTime()) {
      latestByPair.set(pair, { rate: Number(row.rate), fetched_at: row.fetched_at });
    }
    if (fetched >= cutoff) {
      if (!byPair.has(pair)) byPair.set(pair, []);
      byPair.get(pair)!.push(Number(row.rate));
    }
  }

  const averaged: { currency_pair: string; rate: number }[] = [];
  for (const [pair, latest] of latestByPair) {
    const samples = byPair.get(pair);
    if (samples?.length) {
      const avg = samples.reduce((a, b) => a + b, 0) / samples.length;
      averaged.push({ currency_pair: pair, rate: avg });
    } else {
      averaged.push({ currency_pair: pair, rate: latest.rate });
    }
  }
  return buildRates(averaged);
}

export function formatUsdIdrLabel(spot: number, avg30d: number): string {
  const fmt = (n: number) =>
    new Intl.NumberFormat("id-ID", { maximumFractionDigits: 0 }).format(n);
  if (avg30d && spot) {
    return `USD/IDR ~Rp ${fmt(avg30d)} avg · Rp ${fmt(spot)} today`;
  }
  if (spot) return `USD/IDR Rp ${fmt(spot)}`;
  if (avg30d) return `USD/IDR ~Rp ${fmt(avg30d)} avg`;
  return "USD/IDR -";
}
