import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import Sheet from "@/components/ui/Sheet";
import { supabase } from "@/lib/supabase";
import type { Envelope, FxRates } from "@/lib/types";
import { CURRENCY_DECIMALS, parseToMinorUnits, format } from "@/lib/currency";
import { envelopeDailyAmount, saveTripDraws, syncTripDailyDraws } from "@/lib/tripDraws";

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  householdId: string;
  userId: string;
  envelopes: Envelope[];
  fxRates: FxRates;
}

const CURRENCIES = Object.keys(CURRENCY_DECIMALS);

export default function TripPlannerSheet({ open, onClose, onSaved, householdId, userId, envelopes, fxRates }: Props) {
  const [tripName, setTripName] = useState("");
  const [startDate, setStartDate] = useState(todayISO());
  const [endDate, setEndDate] = useState(addDays(todayISO(), 6));
  const [tripCurrency, setTripCurrency] = useState("EUR");
  const [drawEnvelopes, setDrawEnvelopes] = useState<Record<string, boolean>>({});
  const [lineItems, setLineItems] = useState<Array<{ id: string; name: string; amount: string }>>([
    { id: crypto.randomUUID(), name: "Shopping", amount: "" },
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const envelopesById = useMemo(() => new Map(envelopes.map((env) => [env.id, env])), [envelopes]);

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

      if (activeDrawIds.length > 0) {
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
        await syncTripDailyDraws({ householdId, userId, fxRates });
      }

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
          drawn_idr_snapshot: 0,
          sort_order: idx,
        };
      });

      if (customRows.length > 0) {
        const { error: envErr } = await supabase.from("envelopes").insert(customRows);
        if (envErr) throw envErr;
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
    setEndDate(addDays(todayISO(), 6));
    setTripCurrency("EUR");
    setDrawEnvelopes({});
    setLineItems([{ id: crypto.randomUUID(), name: "Shopping", amount: "" }]);
    setError("");
  }

  return (
    <Sheet open={open} onClose={onClose} title="plan a trip budget">
      <form onSubmit={handleCreateTrip} className="space-y-4">
        <Field label="trip name">
          <input
            required
            type="text"
            value={tripName}
            onChange={(e) => setTripName(e.target.value)}
            placeholder="Paris Summer"
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
            {envelopes.map((env) => {
              const enabled = drawEnvelopes[env.id] ?? false;
              const daily = envelopeDailyAmount(env);
              return (
                <div key={env.id} className="rounded-lg px-2 py-2 hover:bg-brand-bg">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <span className="text-sm font-medium text-brand-text">{env.name}</span>
                      {enabled && (
                        <p className="text-xs text-brand-text-muted">
                          {format(daily, env.budget_currency)}/day → labeled Vacation
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
            Each day of the trip, the daily amount is deducted from that envelope as &quot;Vacation&quot; — for tracking only, not added to trip budgets.
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
                  placeholder="Golfing"
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
