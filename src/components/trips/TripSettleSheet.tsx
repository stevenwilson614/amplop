import { useEffect, useMemo, useState } from "react";
import Sheet from "@/components/ui/Sheet";
import { supabase } from "@/lib/supabase";
import type { Envelope, FxRates, Trip } from "@/lib/types";
import { convert } from "@/lib/currency";
import { formatDualAmount } from "@/lib/investableSurplus";
import { saveTransaction } from "@/lib/saveTransaction";
import {
  computeTripSettlement,
  defaultReturnEnvelope,
  fetchExpensesIdrByEnvelope,
} from "@/lib/tripSettle";

interface Props {
  open: boolean;
  onClose: () => void;
  onSettled: () => void;
  householdId: string;
  userId: string;
  trip: Trip | null;
  tripEnvelopes: Envelope[];
  householdEnvelopes: Envelope[];
  balancesById: Record<string, number>;
  fxRates: FxRates;
  displayCurrency: string;
}

export default function TripSettleSheet({
  open, onClose, onSettled, householdId, userId, trip,
  tripEnvelopes, householdEnvelopes, balancesById, fxRates, displayCurrency,
}: Props) {
  const [expensesById, setExpensesById] = useState<Record<string, number>>({});
  const [expensesLoaded, setExpensesLoaded] = useState(false);
  const [coverChoice, setCoverChoice] = useState("");
  const [returnEnvelopeId, setReturnEnvelopeId] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open || !trip) return;
    let cancelled = false;
    setExpensesLoaded(false);
    setCoverChoice("");
    setError("");
    setReturnEnvelopeId(defaultReturnEnvelope(householdEnvelopes)?.id ?? "");
    (async () => {
      try {
        const map = await fetchExpensesIdrByEnvelope(
          householdId,
          tripEnvelopes.map((e) => e.id)
        );
        if (cancelled) return;
        setExpensesById(map);
        setExpensesLoaded(true);
      } catch (err: unknown) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Couldn’t load trip spending");
      }
    })();
    return () => { cancelled = true; };
  }, [open, trip, householdId, tripEnvelopes, householdEnvelopes]);

  const settlement = useMemo(
    () =>
      computeTripSettlement({
        tripEnvelopes,
        expensesIdrById: expensesById,
        householdEnvelopes,
        balancesById,
        fxRates,
        coverEnvelopeId: coverChoice,
      }),
    [tripEnvelopes, expensesById, householdEnvelopes, balancesById, fxRates, coverChoice]
  );

  const fmt = (idr: number) => formatDualAmount(Math.abs(idr), displayCurrency, fxRates).primary;

  async function endTrip() {
    if (!trip) return;
    const { error: endErr } = await supabase
      .from("trips")
      .update({ status: "ended" })
      .eq("id", trip.id);
    if (endErr) throw endErr;
  }

  async function handleSettle(withTransfers: boolean) {
    if (!trip) return;
    setLoading(true);
    setError("");
    try {
      const today = new Date().toLocaleDateString("en-CA");
      const notes = `trip settle: ${trip.name}`;

      if (withTransfers && settlement.netIdr > 0) {
        // Cover overspend: savings → most-overspent trip lines
        const dests = settlement.lines
          .filter((l) => l.diffIdr > 0)
          .sort((a, b) => b.diffIdr - a.diffIdr)
          .map((l) => ({ envelope: l.envelope, remainingIdr: l.diffIdr }));
        let d = 0;
        for (const cover of settlement.covers) {
          let leftIdr = cover.useIdr;
          while (leftIdr > 0 && d < dests.length) {
            const dest = dests[d];
            const moveIdr = Math.min(leftIdr, dest.remainingIdr);
            if (moveIdr > 0) {
              const currency = dest.envelope.budget_currency;
              const amountMinor = currency === "IDR" ? moveIdr : convert(moveIdr, "IDR", currency, fxRates);
              if (amountMinor > 0) {
                await saveTransaction({
                  householdId,
                  userId,
                  txType: "transfer",
                  amountMinor,
                  currency,
                  date: today,
                  notes,
                  allocations: [
                    { envelope_id: cover.envelope.id, amountMinor },
                    { envelope_id: dest.envelope.id, amountMinor: -amountMinor },
                  ],
                  fxRates,
                });
              }
              leftIdr -= moveIdr;
              dest.remainingIdr -= moveIdr;
            }
            if (dest.remainingIdr <= 0) d++;
          }
        }
      }

      if (withTransfers && settlement.netIdr < 0 && returnEnvelopeId) {
        // Return leftover: underspent trip lines → chosen envelope
        const dest = householdEnvelopes.find((e) => e.id === returnEnvelopeId);
        if (dest) {
          const sources = settlement.lines
            .filter((l) => l.diffIdr < 0)
            .sort((a, b) => a.diffIdr - b.diffIdr);
          let remainingIdr = -settlement.netIdr;
          for (const src of sources) {
            if (remainingIdr <= 0) break;
            const takeIdr = Math.min(remainingIdr, -src.diffIdr);
            const currency = dest.budget_currency;
            const amountMinor = currency === "IDR" ? takeIdr : convert(takeIdr, "IDR", currency, fxRates);
            if (amountMinor > 0) {
              await saveTransaction({
                householdId,
                userId,
                txType: "transfer",
                amountMinor,
                currency,
                date: today,
                notes,
                allocations: [
                  { envelope_id: src.envelope.id, amountMinor },
                  { envelope_id: dest.id, amountMinor: -amountMinor },
                ],
                fxRates,
              });
            }
            remainingIdr -= takeIdr;
          }
        }
      }

      await endTrip();
      onSettled();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Settle failed");
    } finally {
      setLoading(false);
    }
  }

  if (!trip) return null;

  const overspent = settlement.netIdr > 0;
  const leftover = settlement.netIdr < 0;
  const coverCandidates = householdEnvelopes.filter(
    (e) => !e.trip_id && (balancesById[e.id] ?? 0) > 0
  );

  return (
    <Sheet open={open} onClose={onClose} title={`settle up · ${trip.name}`}>
      <div className="space-y-4">
        {!expensesLoaded && !error && (
          <p className="font-mono text-sm text-brand-text-muted">adding up the trip…</p>
        )}

        {expensesLoaded && (
          <>
            <div className="rounded-2xl border border-brand-border bg-brand-bg p-3 font-mono text-xs">
              <p className="text-[10px] uppercase tracking-wider text-brand-text-muted">
                spent vs plan
              </p>
              <ul className="mt-2 space-y-1.5">
                {settlement.lines.map((line) => (
                  <li key={line.envelope.id} className="flex items-baseline justify-between gap-2">
                    <span className="text-brand-text">{line.envelope.name}</span>
                    <span className="text-right text-brand-text-muted">
                      {fmt(line.expensesIdr)} / {fmt(line.budgetIdr)}
                      <span
                        className={`ml-2 ${
                          line.diffIdr > 0
                            ? "text-red-600"
                            : line.diffIdr < 0
                              ? "text-[#0F3C1B]"
                              : "text-brand-text-muted"
                        }`}
                      >
                        {line.diffIdr > 0 ? `+${fmt(line.diffIdr)}` : line.diffIdr < 0 ? `−${fmt(line.diffIdr)}` : "on plan"}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
              <div className="mt-3 border-t border-brand-border pt-2">
                <p className={`text-sm font-semibold ${overspent ? "text-red-600" : "text-[#0F3C1B]"}`}>
                  {overspent
                    ? `over by ${fmt(settlement.netIdr)}`
                    : leftover
                      ? `under by ${fmt(settlement.netIdr)}`
                      : "right on plan"}
                </p>
              </div>
            </div>

            {overspent && (
              <div className="rounded-2xl border border-brand-border bg-brand-bg p-3 font-mono text-xs">
                <p className="text-[10px] uppercase tracking-wider text-brand-text-muted">
                  take it from
                </p>
                <select
                  value={coverChoice}
                  onChange={(e) => setCoverChoice(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-brand-border bg-brand-surface px-3 py-2 text-sm text-brand-text"
                >
                  <option value="">suggested mix (save-for first)</option>
                  {coverCandidates.map((env) => (
                    <option key={env.id} value={env.id}>
                      {env.name}
                      {(env.kind ?? "monthly") === "sinking" ? " (save-for)" : ""}
                    </option>
                  ))}
                </select>
                {settlement.covers.length > 0 && (
                  <ul className="mt-2 space-y-1 text-brand-text-muted">
                    {settlement.covers.map((c) => (
                      <li key={c.envelope.id}>
                        from {c.envelope.name}: {fmt(c.useIdr)}
                      </li>
                    ))}
                  </ul>
                )}
                {settlement.shortByIdr > 0 && (
                  <p className="mt-2 text-amber-600">
                    {fmt(settlement.shortByIdr)} has no envelope to come from — it will just reduce
                    what’s investable.
                  </p>
                )}
              </div>
            )}

            {leftover && (
              <div className="rounded-2xl border border-brand-border bg-brand-bg p-3 font-mono text-xs">
                <p className="text-[10px] uppercase tracking-wider text-brand-text-muted">
                  return leftover to
                </p>
                <select
                  value={returnEnvelopeId}
                  onChange={(e) => setReturnEnvelopeId(e.target.value)}
                  className="mt-2 w-full rounded-xl border border-brand-border bg-brand-surface px-3 py-2 text-sm text-brand-text"
                >
                  {householdEnvelopes.filter((e) => !e.trip_id).map((env) => (
                    <option key={env.id} value={env.id}>
                      {env.name}
                      {(env.kind ?? "monthly") === "sinking" ? " (save-for)" : ""}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {error && <p className="font-mono text-sm text-red-500">{error}</p>}

            <button
              type="button"
              disabled={loading}
              onClick={() => handleSettle(true)}
              className="w-full rounded-xl bg-brand-accent py-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              {loading
                ? "settling…"
                : overspent
                  ? "cover it & end trip"
                  : leftover
                    ? "return leftover & end trip"
                    : "end trip"}
            </button>
            {(overspent || leftover) && (
              <button
                type="button"
                disabled={loading}
                onClick={() => handleSettle(false)}
                className="w-full rounded-xl border border-brand-border py-2.5 text-xs font-semibold text-brand-text-muted disabled:opacity-50"
              >
                just end the trip — no transfers
              </button>
            )}
          </>
        )}

        {error && !expensesLoaded && (
          <p className="font-mono text-sm text-red-500">{error}</p>
        )}
      </div>
    </Sheet>
  );
}
