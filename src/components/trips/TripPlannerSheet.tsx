import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import Sheet from "@/components/ui/Sheet";
import { supabase } from "@/lib/supabase";
import type { Envelope, FxRates } from "@/lib/types";
import { CURRENCY_DECIMALS, parseToMinorUnits, format, convert } from "@/lib/currency";
import { envelopeDailyAmount, saveTripDraws, syncTripDailyDraws } from "@/lib/tripDraws";
import { computeTripFunding } from "@/lib/tripFunding";
import { saveTransaction } from "@/lib/saveTransaction";

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  householdId: string;
  userId: string;
  envelopes: Envelope[];
  fxRates: FxRates;
  balancesById?: Record<string, number>;
}

const CURRENCIES = Object.keys(CURRENCY_DECIMALS);

export default function TripPlannerSheet({
  open, onClose, onSaved, householdId, userId, envelopes, fxRates, balancesById = {},
}: Props) {
  const [tripName, setTripName] = useState("");
  const [startDate, setStartDate] = useState(todayISO());
  const [endDate, setEndDate] = useState(addDays(todayISO(), 6));
  const [tripCurrency, setTripCurrency] = useState("USD");
  const [drawEnvelopes, setDrawEnvelopes] = useState<Record<string, boolean>>({});
  const [lineItems, setLineItems] = useState<Array<{ id: string; name: string; amount: string }>>([
    { id: crypto.randomUUID(), name: "Shopping", amount: "" },
  ]);
  const [transferFromCover, setTransferFromCover] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const envelopesById = useMemo(() => new Map(envelopes.map((env) => [env.id, env])), [envelopes]);

  const funding = useMemo(() => {
    const activeDrawIds = Object.entries(drawEnvelopes)
      .filter(([, enabled]) => enabled)
      .map(([id]) => id);
    return computeTripFunding({
      startDate,
      endDate,
      tripCurrency,
      lineItems: lineItems.map((item) => ({
        amountMinor: parseToMinorUnits(item.amount || "0", tripCurrency),
      })),
      drawEnvelopeIds: activeDrawIds,
      envelopes,
      balancesById,
      fxRates,
    });
  }, [startDate, endDate, tripCurrency, lineItems, drawEnvelopes, envelopes, balancesById, fxRates]);

  function toggleDrawEnvelope(id: string, enabled: boolean) {
    setDrawEnvelopes((prev) => ({ ...prev, [id]: enabled }));
  }

  function updateLineItem(id: string, key: "name" | "amount", value: string) {
    setLineItems((prev) => prev.map((item) => (item.id === id ? { ...item, [key]: value } : item)));
  }

  function addLineItem() {
    setLineItems((prev) => [...prev, { id: crypto.randomUUID(), name: "", amount: "" }]);
  }

  function removeLineItem(id: string) {
    setLineItems((prev) => prev.filter((item) => item.id !== id));
  }

  async function handleCreateTrip(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      if (endDate < startDate) throw new Error("End date must be on or after start date.");

      const { data: trip, error: tripErr } = await supabase
        .from("trips")
        .insert({
          household_id: householdId,
          name: tripName.trim(),
          start_date: startDate,
          end_date: endDate,
          currency: tripCurrency,
          status: "active",
        })
        .select()
        .single();
      if (tripErr) throw tripErr;

      const activeDrawIds = Object.entries(drawEnvelopes)
        .filter(([, enabled]) => enabled)
        .map(([id]) => id);

      const cleanedLineItems = lineItems
        .map((item) => ({ ...item, name: item.name.trim() }))
        .filter((item) => item.name.length > 0);

      const customRows = cleanedLineItems.map((item, idx) => {
        const amount = parseToMinorUnits(item.amount || "0", tripCurrency);
        return {
          household_id: householdId,
          trip_id: trip.id,
          parent_envelope_id: null,
          category_id: null,
          name: item.name,
          budget_amount: Math.max(0, amount),
          budget_currency: tripCurrency,
          sort_order: idx,
        };
      });

      let createdTripEnvs: Envelope[] = [];
      if (customRows.length > 0) {
        const { data: inserted, error: envErr } = await supabase
          .from("envelopes")
          .insert(customRows)
          .select();
        if (envErr) throw envErr;
        createdTripEnvs = (inserted as Envelope[]) ?? [];
      }

      if (activeDrawIds.length > 0) {
        try {
          await saveTripDraws({
            tripId: trip.id,
            draws: activeDrawIds.map((envelopeId) => {
              const env = envelopesById.get(envelopeId) as Envelope;
              return {
                envelopeId,
                dailyAmount: envelopeDailyAmount(env),
                label: "Vacation",
              };
            }),
          });
          if (userId) {
            await syncTripDailyDraws({ householdId, userId, fxRates });
          }
        } catch (drawErr) {
          const drawMsg = drawErr instanceof Error ? drawErr.message : "Daily draws failed";
          console.warn("Trip daily draws failed:", drawMsg);
        }
      }

      // Optional: transfer from suggested cover envelopes into first trip line item
      if (
        transferFromCover &&
        userId &&
        funding.gapIdr > 0 &&
        funding.covers.length > 0 &&
        createdTripEnvs[0]
      ) {
        const dest = createdTripEnvs[0];
        for (const cover of funding.covers) {
          if (cover.useIdr <= 0) continue;
          const amountMinor =
            dest.budget_currency === "IDR"
              ? cover.useIdr
              : convert(cover.useIdr, "IDR", dest.budget_currency, fxRates);
          if (amountMinor <= 0) continue;
          try {
            await saveTransaction({
              householdId,
              userId,
              txType: "transfer",
              amountMinor,
              currency: dest.budget_currency,
              date: startDate,
              notes: `trip cover: ${tripName.trim()}`,
              allocations: [
                { envelope_id: cover.envelope.id, amountMinor },
                { envelope_id: dest.id, amountMinor: -amountMinor },
              ],
              fxRates,
            });
          } catch (transferErr) {
            console.warn("Trip cover transfer failed", transferErr);
          }
        }
      }

      onSaved();
      onClose();
      resetForm();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Trip creation failed");
    } finally {
      setLoading(false);
    }
  }

  function resetForm() {
    setTripName("");
    setStartDate(todayISO());
    setEndDate(addDays(todayISO(), 13));
    setTripCurrency("USD");
    setDrawEnvelopes({});
    setLineItems([{ id: crypto.randomUUID(), name: "Shopping", amount: "" }]);
    setTransferFromCover(true);
    setError("");
  }

  const gapDisplay = format(
    funding.gapIdr === 0
      ? 0
      : tripCurrency === "IDR"
        ? funding.gapIdr
        : convert(funding.gapIdr, "IDR", tripCurrency, fxRates),
    tripCurrency
  );

  return (
    <Sheet open={open} onClose={onClose} title="plan a trip budget">
      <form onSubmit={handleCreateTrip} className="space-y-4">
        <Field label="trip name">
          <input
            required
            type="text"
            value={tripName}
            onChange={(e) => setTripName(e.target.value)}
            placeholder="Amerika home"
            className={inputCls}
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="start date">
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="end date">
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className={inputCls}
            />
          </Field>
        </div>

        <Field label="local trip currency">
          <select
            value={tripCurrency}
            onChange={(e) => setTripCurrency(e.target.value)}
            className={inputCls}
          >
            {CURRENCIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </Field>

        <Field label="daily draw from envelopes (shows as Vacation)">
          <div className="max-h-48 space-y-2 overflow-auto rounded-xl border border-brand-border bg-brand-surface p-2">
            {envelopes.length === 0 && (
              <p className="px-2 py-1 text-sm text-brand-text-muted">No base envelopes yet.</p>
            )}
            {envelopes.filter((e) => (e.kind ?? "monthly") === "monthly").map((env) => {
              const enabled = drawEnvelopes[env.id] ?? false;
              const daily = envelopeDailyAmount(env);
              return (
                <div key={env.id} className="rounded-lg px-2 py-2 hover:bg-brand-bg">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <span className="text-sm font-medium text-brand-text">{env.name}</span>
                      {enabled && (
                        <p className="text-xs text-brand-text-muted">
                          {format(daily, env.budget_currency)}/day × {funding.tripDays} days
                        </p>
                      )}
                    </div>
                    <input
                      type="checkbox"
                      checked={enabled}
                      onChange={(e) => toggleDrawEnvelope(env.id, e.target.checked)}
                      className="h-4 w-4 shrink-0 accent-[#34A853]"
                    />
                  </div>
                </div>
              );
            })}
          </div>
          <p className="mt-1 text-xs text-brand-text-muted">
            Each day of the trip, the daily amount is deducted from that envelope as &quot;Vacation&quot;.
          </p>
        </Field>

        <Field label="trip line items with amount">
          <div className="space-y-2">
            {lineItems.map((item) => (
              <div key={item.id} className="grid grid-cols-[1fr_130px_36px] gap-2">
                <input
                  type="text"
                  value={item.name}
                  onChange={(e) => updateLineItem(item.id, "name", e.target.value)}
                  placeholder="Flights"
                  className={inputCls}
                />
                <input
                  type="number"
                  step="any"
                  min="0"
                  value={item.amount}
                  onChange={(e) => updateLineItem(item.id, "amount", e.target.value)}
                  placeholder="0"
                  className={inputCls}
                />
                <button
                  type="button"
                  className="rounded-xl border border-brand-border text-sm text-brand-text-muted"
                  onClick={() => removeLineItem(item.id)}
                >
                  ×
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={addLineItem}
              className="rounded-lg border border-brand-border px-3 py-1 text-xs font-semibold text-brand-text-muted"
            >
              + add line item
            </button>
          </div>
        </Field>

        <div className={`rounded-xl border px-3 py-3 font-mono text-xs ${
          funding.gapCovered || funding.gapIdr === 0
            ? "border-green-200 bg-[#E8F8EC]"
            : "border-amber-200 bg-amber-50"
        }`}>
          <p className="text-[10px] uppercase tracking-wider text-brand-text-muted">funding summary</p>
          <p className="mt-1 text-brand-text">
            {funding.tripDays} days · trip total{" "}
            {format(
              tripCurrency === "IDR"
                ? funding.tripTotalIdr
                : convert(funding.tripTotalIdr, "IDR", tripCurrency, fxRates),
              tripCurrency
            )}
          </p>
          <p className="text-brand-text-muted">
            covered by daily draws{" "}
            {format(
              tripCurrency === "IDR"
                ? funding.drawsCoveredIdr
                : convert(funding.drawsCoveredIdr, "IDR", tripCurrency, fxRates),
              tripCurrency
            )}
          </p>
          <p className="mt-1 font-semibold text-brand-text">
            gap {gapDisplay}
            {funding.gapIdr === 0
              ? " — fully covered by daily budgets"
              : funding.gapCovered
                ? " — covered by leftovers / save-for"
                : ` — short by ${format(
                    tripCurrency === "IDR"
                      ? funding.shortByIdr
                      : convert(funding.shortByIdr, "IDR", tripCurrency, fxRates),
                    tripCurrency
                  )}`}
          </p>
          {funding.covers.length > 0 && funding.gapIdr > 0 && (
            <ul className="mt-2 space-y-1 text-brand-text-muted">
              {funding.covers.map((c) => (
                <li key={c.envelope.id}>
                  from {c.envelope.name}:{" "}
                  {format(
                    tripCurrency === "IDR"
                      ? c.useIdr
                      : convert(c.useIdr, "IDR", tripCurrency, fxRates),
                    tripCurrency
                  )}
                </li>
              ))}
            </ul>
          )}
          {funding.gapIdr > 0 && funding.covers.length > 0 && (
            <label className="mt-3 flex items-center gap-2 text-brand-text">
              <input
                type="checkbox"
                checked={transferFromCover}
                onChange={(e) => setTransferFromCover(e.target.checked)}
                className="accent-[#34A853]"
              />
              transfer cover into first trip envelope on create
            </label>
          )}
        </div>

        {error && <p className="text-sm text-red-500">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-brand-accent py-3 text-sm font-semibold text-white disabled:opacity-50"
        >
          {loading ? "creating trip..." : "create trip budget"}
        </button>
      </form>
    </Sheet>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-brand-text-muted">
        {label}
      </label>
      {children}
    </div>
  );
}

function todayISO(): string {
  return new Date().toLocaleDateString("en-CA");
}

function addDays(startIso: string, days: number): string {
  const dt = new Date(`${startIso}T00:00:00`);
  dt.setDate(dt.getDate() + days);
  return dt.toLocaleDateString("en-CA");
}

const inputCls =
  "w-full rounded-xl border border-brand-border bg-brand-bg px-3 py-2 text-sm text-brand-text placeholder-brand-text-muted focus:outline-none focus:ring-2 focus:ring-brand-accent";
