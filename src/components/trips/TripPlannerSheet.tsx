import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import Sheet from "@/components/ui/Sheet";
import { supabase } from "@/lib/supabase";
import type { Envelope } from "@/lib/types";
import type { FxRates } from "@/lib/currency";
import { CURRENCY_DECIMALS, convert } from "@/lib/currency";

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  householdId: string;
  envelopes: Envelope[];
  fxRates: FxRates;
}

const CURRENCIES = Object.keys(CURRENCY_DECIMALS);

export default function TripPlannerSheet({ open, onClose, onSaved, householdId, envelopes, fxRates }: Props) {
  const [tripName, setTripName] = useState("");
  const [startDate, setStartDate] = useState(todayISO());
  const [durationDays, setDurationDays] = useState(7);
  const [tripCurrency, setTripCurrency] = useState("EUR");
  const [customCategories, setCustomCategories] = useState("");
  const [selectedEnvelopeIds, setSelectedEnvelopeIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const envelopesById = useMemo(
    () => new Map(envelopes.map((env) => [env.id, env])),
    [envelopes]
  );

  function toggleEnvelope(id: string) {
    setSelectedEnvelopeIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }

  async function handleCreateTrip(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const endDate = addDays(startDate, durationDays - 1);
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

      const selectedBase = selectedEnvelopeIds
        .map((id) => envelopesById.get(id))
        .filter(Boolean) as Envelope[];
      const custom = splitCategories(customCategories);

      const selectedNames = new Set(selectedBase.map((e) => e.name.toLowerCase()));
      const uniqueCustom = custom.filter((name) => !selectedNames.has(name.toLowerCase()));

      const derivedRows = selectedBase.map((env, idx) => {
        const dailyAmount = Math.round(env.budget_amount / 30);
        const scaledAmount = Math.round(dailyAmount * durationDays);
        const localAmount =
          env.budget_currency === tripCurrency
            ? scaledAmount
            : convert(scaledAmount, env.budget_currency, tripCurrency, fxRates);
        return {
          household_id: householdId,
          trip_id: trip.id,
          parent_envelope_id: env.id,
          category_id: null,
          name: env.name,
          budget_amount: Math.max(0, localAmount),
          budget_currency: tripCurrency,
          sort_order: idx,
        };
      });

      const customRows = uniqueCustom.map((name, idx) => ({
        household_id: householdId,
        trip_id: trip.id,
        parent_envelope_id: null,
        category_id: null,
        name,
        budget_amount: 0,
        budget_currency: tripCurrency,
        sort_order: derivedRows.length + idx,
      }));

      const rows = [...derivedRows, ...customRows];
      if (rows.length > 0) {
        const { error: envErr } = await supabase.from("envelopes").insert(rows);
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
    setDurationDays(7);
    setTripCurrency("EUR");
    setCustomCategories("");
    setSelectedEnvelopeIds([]);
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
          <Field label="duration">
            <select
              value={durationDays}
              onChange={(e) => setDurationDays(Number(e.target.value))}
              className={inputCls}
            >
              <option value={7}>1 week</option>
              <option value={14}>2 weeks</option>
              <option value={21}>3 weeks</option>
              <option value={30}>1 month</option>
            </select>
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

        <Field label="use normal budgets as daily trip budgets">
          <div className="max-h-48 space-y-2 overflow-auto rounded-xl border border-brand-border bg-brand-surface p-2">
            {envelopes.length === 0 && (
              <p className="px-2 py-1 text-sm text-brand-text-muted">No base envelopes yet.</p>
            )}
            {envelopes.map((env) => (
              <label
                key={env.id}
                className="flex items-center justify-between rounded-lg px-2 py-2 hover:bg-brand-bg"
              >
                <span className="text-sm font-medium text-brand-text">{env.name}</span>
                <input
                  type="checkbox"
                  checked={selectedEnvelopeIds.includes(env.id)}
                  onChange={() => toggleEnvelope(env.id)}
                  className="h-4 w-4 accent-[#34A853]"
                />
              </label>
            ))}
          </div>
          <p className="mt-1 text-xs text-brand-text-muted">
            Selected envelopes are scaled by trip days (monthly budget / 30 x days), then converted to local currency.
          </p>
        </Field>

        <Field label="extra travel categories (comma or line separated)">
          <textarea
            rows={3}
            value={customCategories}
            onChange={(e) => setCustomCategories(e.target.value)}
            placeholder={"Shopping\nGolfing\nEntertainment"}
            className={`${inputCls} resize-none`}
          />
          <p className="mt-1 text-xs text-brand-text-muted">
            Custom categories start at 0 so you can set exact trip amounts after creation.
          </p>
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

function splitCategories(input: string): string[] {
  return input
    .split(/[,\n]/)
    .map((x) => x.trim())
    .filter(Boolean);
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
