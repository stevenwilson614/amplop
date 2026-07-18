import type { Envelope, FxRates } from "@/lib/types";
import { convert } from "@/lib/currency";
import { envelopeDailyAmount } from "@/lib/tripDraws";
import { isSinking } from "@/lib/sinkingFunds";

export interface TripFundingInput {
  startDate: string;
  endDate: string;
  tripCurrency: string;
  lineItems: Array<{ amountMinor: number }>;
  drawEnvelopeIds: string[];
  envelopes: Envelope[];
  balancesById: Record<string, number>; // IDR remainings
  fxRates: FxRates;
}

export interface TripFundingCover {
  envelope: Envelope;
  availableIdr: number;
  useIdr: number;
}

export interface TripFundingSummary {
  tripDays: number;
  tripTotalIdr: number;
  drawsCoveredIdr: number;
  gapIdr: number;
  covers: TripFundingCover[];
  coveredBySuggestedIdr: number;
  shortByIdr: number;
  gapCovered: boolean;
}

export function tripDayCount(startDate: string, endDate: string): number {
  const start = new Date(`${startDate}T00:00:00`);
  const end = new Date(`${endDate}T00:00:00`);
  const ms = end.getTime() - start.getTime();
  return Math.max(1, Math.floor(ms / (1000 * 60 * 60 * 24)) + 1);
}

export function computeTripFunding(input: TripFundingInput): TripFundingSummary {
  const days = tripDayCount(input.startDate, input.endDate);
  const tripTotalMinor = input.lineItems.reduce((s, i) => s + Math.max(0, i.amountMinor), 0);
  const tripTotalIdr =
    input.tripCurrency === "IDR"
      ? tripTotalMinor
      : convert(tripTotalMinor, input.tripCurrency, "IDR", input.fxRates);

  let drawsCoveredIdr = 0;
  for (const id of input.drawEnvelopeIds) {
    const env = input.envelopes.find((e) => e.id === id);
    if (!env) continue;
    const daily = envelopeDailyAmount(env);
    const dailyIdr =
      env.budget_currency === "IDR"
        ? daily
        : convert(daily, env.budget_currency, "IDR", input.fxRates);
    drawsCoveredIdr += dailyIdr * days;
  }

  const gapIdr = Math.max(0, tripTotalIdr - drawsCoveredIdr);

  // Prefer sinking funds whose names look like vacation/trip, then any sinking, then leftovers
  const candidates = input.envelopes
    .filter((e) => !e.trip_id && (input.balancesById[e.id] ?? 0) > 0)
    .map((e) => ({
      envelope: e,
      availableIdr: Math.max(0, input.balancesById[e.id] ?? 0),
      score: scoreCoverEnvelope(e),
    }))
    .sort((a, b) => b.score - a.score || b.availableIdr - a.availableIdr);

  const covers: TripFundingCover[] = [];
  let remaining = gapIdr;
  for (const c of candidates) {
    if (remaining <= 0) break;
    const useIdr = Math.min(c.availableIdr, remaining);
    if (useIdr <= 0) continue;
    covers.push({ envelope: c.envelope, availableIdr: c.availableIdr, useIdr });
    remaining -= useIdr;
  }

  const coveredBySuggestedIdr = gapIdr - remaining;

  return {
    tripDays: days,
    tripTotalIdr,
    drawsCoveredIdr,
    gapIdr,
    covers,
    coveredBySuggestedIdr,
    shortByIdr: remaining,
    gapCovered: remaining <= 0,
  };
}

export function scoreCoverEnvelope(env: Envelope): number {
  let score = 0;
  if (isSinking(env)) score += 50;
  if (/vacation|amerika|america|trip|home assignment|fun/i.test(env.name)) score += 100;
  return score;
}
