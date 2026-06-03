import { useState } from "react";
import type { ReactNode } from "react";
import Sheet from "@/components/ui/Sheet";
import { supabase } from "@/lib/supabase";
import type { Trip } from "@/lib/types";
import { CURRENCY_DECIMALS, parseToMinorUnits } from "@/lib/currency";

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  householdId: string;
  trip: Trip | null;
  nextSortOrder: number;
}

export default function TripLineItemSheet({
  open,
  onClose,
  onSaved,
  householdId,
  trip,
  nextSortOrder,
}: Props) {
  const [lineItems, setLineItems] = useState<Array<{ id: string; name: string; amount: string }>>([
    { id: crypto.randomUUID(), name: "", amount: "" },
  ]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  function updateLineItem(id: string, key: "name" | "amount", value: string) {
    setLineItems((prev) => prev.map((item) => (item.id === id ? { ...item, [key]: value } : item)));
  }

  function addLineItem() {
    setLineItems((prev) => [...prev, { id: crypto.randomUUID(), name: "", amount: "" }]);
  }

  function removeLineItem(id: string) {
    setLineItems((prev) => (prev.length <= 1 ? prev : prev.filter((item) => item.id !== id)));
  }

  function resetForm() {
    setLineItems([{ id: crypto.randomUUID(), name: "", amount: "" }]);
    setError("");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!trip) return;

    setLoading(true);
    setError("");

    try {
      const cleanedLineItems = lineItems
        .map((item) => ({ ...item, name: item.name.trim() }))
        .filter((item) => item.name.length > 0);

      if (cleanedLineItems.length === 0) {
        throw new Error("Add at least one line item with a name.");
      }

      const rows = cleanedLineItems.map((item, idx) => {
        const amount = parseToMinorUnits(item.amount || "0", trip.currency);
        return {
          household_id: householdId,
          trip_id: trip.id,
          parent_envelope_id: null,
          category_id: null,
          name: item.name,
          budget_amount: Math.max(0, amount),
          budget_currency: trip.currency,
          sort_order: nextSortOrder + idx,
        };
      });

      const { error: envErr } = await supabase.from("envelopes").insert(rows);
      if (envErr) throw envErr;

      onSaved();
      onClose();
      resetForm();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not add trip categories");
    } finally {
      setLoading(false);
    }
  }

  if (!trip) return null;

  return (
    <Sheet open={open} onClose={onClose} title={`add to ${trip.name}`}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <p className="text-sm text-brand-text-muted">
          Add trip budgets in {trip.currency}. These appear under your active trip.
        </p>

        <Field label="trip line items">
          <div className="space-y-2">
            {lineItems.map((item) => (
              <div key={item.id} className="grid grid-cols-[1fr_130px_36px] gap-2">
                <input
                  type="text"
                  value={item.name}
                  onChange={(e) => updateLineItem(item.id, "name", e.target.value)}
                  placeholder="Eating out"
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
          {loading ? "adding..." : "add to trip"}
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

const inputCls =
  "w-full rounded-xl border border-brand-border bg-brand-bg px-3 py-2 text-sm text-brand-text placeholder-brand-text-muted focus:outline-none focus:ring-2 focus:ring-brand-accent";
