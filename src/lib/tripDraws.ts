import { supabase } from "@/lib/supabase";
import type { Envelope, FxRates, Trip, TripDraw } from "@/lib/types";
import { convert, getRate } from "@/lib/currency";

export const TRIP_DRAW_NOTE_PREFIX = "trip-draw:";

export interface TripDrawInput {
  envelopeId: string;
  dailyAmount: number;
  label?: string;
}

/** Daily allotment from monthly budget using calendar days in current month. */
export function envelopeDailyAmount(envelope: Envelope, onDate = new Date()): number {
  const daysInMonth = new Date(onDate.getFullYear(), onDate.getMonth() + 1, 0).getDate();
  return Math.max(0, Math.round(envelope.budget_amount / daysInMonth));
}

function drawNote(tripId: string, envelopeId: string, date: string): string {
  return `${TRIP_DRAW_NOTE_PREFIX}${tripId}:${envelopeId}:${date}`;
}

function datesThroughTrip(trip: Trip, through = new Date()): string[] {
  const start = new Date(`${trip.start_date}T00:00:00`);
  const end = new Date(`${trip.end_date}T23:59:59`);
  const cap = through.getTime() < end.getTime() ? through : end;
  const out: string[] = [];
  const cur = new Date(start);
  while (cur.getTime() <= cap.getTime()) {
    out.push(cur.toLocaleDateString("en-CA"));
    cur.setDate(cur.getDate() + 1);
  }
  return out;
}

export async function syncTripDailyDraws(args: {
  householdId: string;
  userId: string;
  fxRates: FxRates;
}): Promise<number> {
  const { householdId, userId, fxRates } = args;

  const { data: trips } = await supabase
    .from("trips")
    .select("*")
    .eq("household_id", householdId)
    .eq("status", "active");

  if (!trips?.length) return 0;

  const tripIds = trips.map((t) => t.id);
  const { data: draws } = await supabase
    .from("trip_draws")
    .select("*")
    .in("trip_id", tripIds);

  if (!draws?.length) return 0;

  const envelopeIds = [...new Set(draws.map((d) => d.envelope_id))];
  const { data: envs } = await supabase.from("envelopes").select("*").in("id", envelopeIds);
  const envMap = new Map((envs ?? []).map((e) => [e.id, e as Envelope]));

  const { data: existingTxs } = await supabase
    .from("transactions")
    .select("notes")
    .eq("household_id", householdId)
    .like("notes", `${TRIP_DRAW_NOTE_PREFIX}%`);

  const existingNotes = new Set((existingTxs ?? []).map((t) => t.notes).filter(Boolean));
  let created = 0;
  const today = new Date();

  for (const trip of trips as Trip[]) {
    const tripDraws = (draws as TripDraw[]).filter((d) => d.trip_id === trip.id);
    for (const draw of tripDraws) {
      const env = envMap.get(draw.envelope_id);
      if (!env) continue;

      for (const date of datesThroughTrip(trip, today)) {
        const note = drawNote(trip.id, draw.envelope_id, date);
        if (existingNotes.has(note)) continue;

        const currency = env.budget_currency || "IDR";
        const amountMinor = draw.daily_amount;
        const amountIdr = convert(amountMinor, currency, "IDR", fxRates);
        const fxRate = currency === "IDR" ? 1 : getRate(fxRates, currency, "IDR");

        const { data: tx, error: txErr } = await supabase
          .from("transactions")
          .insert({
            household_id: householdId,
            user_id: userId,
            tx_type: "expense",
            amount: amountMinor,
            currency,
            amount_idr_snapshot: amountIdr,
            fx_rate_snapshot: fxRate,
            date,
            merchant_name: draw.label || "Vacation",
            notes: note,
          })
          .select("id")
          .single();

        if (txErr || !tx) continue;

        await supabase.from("transaction_allocations").insert({
          transaction_id: tx.id,
          envelope_id: draw.envelope_id,
          amount: amountMinor,
        });

        existingNotes.add(note);
        created++;
      }
    }
  }

  return created;
}

export async function deleteTripDrawTransactions(tripId: string, householdId: string): Promise<void> {
  const { data: txs } = await supabase
    .from("transactions")
    .select("id")
    .eq("household_id", householdId)
    .like("notes", `${TRIP_DRAW_NOTE_PREFIX}${tripId}:%`);

  const ids = (txs ?? []).map((t) => t.id);
  if (ids.length === 0) return;

  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50);
    await supabase.from("transaction_allocations").delete().in("transaction_id", chunk);
    await supabase.from("transactions").delete().in("id", chunk);
  }
}

export async function saveTripDraws(args: {
  tripId: string;
  draws: TripDrawInput[];
}): Promise<void> {
  const { tripId, draws } = args;
  if (draws.length === 0) return;

  const { error } = await supabase.from("trip_draws").upsert(
    draws.map((d) => ({
      trip_id: tripId,
      envelope_id: d.envelopeId,
      daily_amount: d.dailyAmount,
      label: d.label ?? "Vacation",
    })),
    { onConflict: "trip_id,envelope_id" }
  );
  if (error) throw error;
}
