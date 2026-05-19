"use client";

import { useState } from "react";
import { format, parseToMinorUnits, toInputValue, convert, type FxRates } from "@/lib/currency";
import type { Category, Envelope } from "@/lib/types";

interface Allocation {
  envelope_id: string;
  amount: number; // minor units, same currency as transaction
}

interface Props {
  envelopes: Envelope[];
  categories: Category[];
  totalAmount: number;   // minor units in transaction currency
  currency: string;      // transaction currency
  fxRates: FxRates;
  displayCurrency: string;
  onConfirm: (allocations: Allocation[]) => void;
}

export default function EnvelopePicker({
  envelopes,
  categories,
  totalAmount,
  currency,
  fxRates,
  displayCurrency,
  onConfirm,
}: Props) {
  const [splitMode, setSplitMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  // split amounts: envelope_id → user-typed major-unit string
  const [splitInputs, setSplitInputs] = useState<Record<string, string>>({});

  // ── Single-mode: tap envelope → immediately allocate full amount ───────────
  function selectSingle(id: string) {
    onConfirm([{ envelope_id: id, amount: totalAmount }]);
  }

  // ── Split-mode helpers ─────────────────────────────────────────────────────
  function toggleSelected(id: string) {
    setSelectedIds((prev) => {
      const next = prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id];
      // When adding first envelope in split, pre-fill with full amount
      if (!prev.includes(id) && next.length === 1) {
        setSplitInputs({ [id]: toInputValue(totalAmount, currency) });
      } else if (!prev.includes(id) && next.length > 1) {
        // Distribute remainder to new envelope
        const allocated = Object.values(splitInputs).reduce(
          (s, v) => s + parseToMinorUnits(v || "0", currency),
          0
        );
        const remainder = totalAmount - allocated;
        setSplitInputs((prev) => ({
          ...prev,
          [id]: toInputValue(Math.max(remainder, 0), currency),
        }));
      } else {
        // Deselecting: remove its input
        setSplitInputs((prev) => {
          const next = { ...prev };
          delete next[id];
          return next;
        });
      }
      return next;
    });
  }

  function setSplitAmount(id: string, val: string) {
    setSplitInputs((prev) => ({ ...prev, [id]: val }));
  }

  const totalAllocated = selectedIds.reduce(
    (sum, id) => sum + parseToMinorUnits(splitInputs[id] || "0", currency),
    0
  );
  const remaining = totalAmount - totalAllocated;
  const fullyAllocated = remaining === 0 && selectedIds.length > 0;

  function confirmSplit() {
    if (!fullyAllocated) return;
    onConfirm(
      selectedIds.map((id) => ({
        envelope_id: id,
        amount: parseToMinorUnits(splitInputs[id] || "0", currency),
      }))
    );
  }

  // ── Grouped display ────────────────────────────────────────────────────────
  const grouped = categories
    .map((cat) => ({
      category: cat,
      envelopes: envelopes.filter((e) => e.category_id === cat.id),
    }))
    .filter((g) => g.envelopes.length > 0);
  const uncategorized = envelopes.filter((e) => !e.category_id);

  if (envelopes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center px-8">
        <p className="text-brand-text-muted text-sm">
          No envelopes yet. Create envelopes first.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Split mode toggle */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-brand-border">
        <span className="text-sm text-brand-text-muted">
          {splitMode ? "Tap envelopes to select" : "Tap an envelope to allocate"}
        </span>
        <button
          onClick={() => {
            setSplitMode((v) => !v);
            setSelectedIds([]);
            setSplitInputs({});
          }}
          className={`text-sm font-medium px-3 py-1 rounded-full border transition-colors ${
            splitMode
              ? "border-brand-accent text-brand-accent"
              : "border-brand-border text-brand-text-muted"
          }`}
        >
          Split
        </button>
      </div>

      {/* Split mode: allocation summary */}
      {splitMode && selectedIds.length > 0 && (
        <div
          className={`px-4 py-2 text-sm font-mono text-center ${
            remaining === 0
              ? "text-brand-accent"
              : remaining < 0
              ? "text-red-400"
              : "text-brand-text-muted"
          }`}
        >
          {remaining === 0
            ? "Fully allocated"
            : remaining > 0
            ? `${format(remaining, currency)} remaining`
            : `${format(Math.abs(remaining), currency)} over`}
        </div>
      )}

      {/* Envelope list */}
      <div className="flex-1 overflow-y-auto px-4 py-3 space-y-5">
        {[...grouped, ...(uncategorized.length > 0 ? [{ category: { id: "__other", name: "Other", sort_order: 999, household_id: "", created_at: "" }, envelopes: uncategorized }] : [])].map(
          ({ category, envelopes: catEnvelopes }) => (
            <div key={category.id}>
              <p className="text-[11px] text-brand-text-muted uppercase tracking-widest mb-2">
                {category.name}
              </p>
              <div className="space-y-2">
                {catEnvelopes.map((env) => {
                  const isSelected = selectedIds.includes(env.id);
                  const budgetDisplay = convert(
                    env.budget_amount,
                    env.budget_currency,
                    displayCurrency,
                    fxRates
                  );

                  return (
                    <div key={env.id}>
                      <button
                        onClick={() =>
                          splitMode ? toggleSelected(env.id) : selectSingle(env.id)
                        }
                        className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl border transition-colors text-left ${
                          isSelected
                            ? "border-brand-accent bg-brand-primary"
                            : "border-brand-border bg-brand-surface"
                        }`}
                      >
                        <span className="text-brand-text font-medium">{env.name}</span>
                        <span className="text-brand-text-muted text-sm font-mono">
                          {format(budgetDisplay, displayCurrency)}
                        </span>
                      </button>

                      {/* Split amount input for selected envelope */}
                      {splitMode && isSelected && (
                        <div className="mt-1.5 px-1">
                          <input
                            type="number"
                            value={splitInputs[env.id] ?? ""}
                            onChange={(e) => setSplitAmount(env.id, e.target.value)}
                            placeholder="0"
                            min="0"
                            step={currency === "IDR" ? "1" : "0.01"}
                            className="w-full bg-brand-primary border border-brand-accent rounded-xl px-4 py-2.5 text-brand-text font-mono text-sm focus:outline-none"
                          />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )
        )}
      </div>

      {/* Split confirm button */}
      {splitMode && (
        <div className="px-4 py-3 border-t border-brand-border">
          <button
            onClick={confirmSplit}
            disabled={!fullyAllocated}
            className="w-full bg-brand-accent text-white font-semibold rounded-xl py-4 disabled:opacity-40 transition-opacity"
          >
            Confirm split
          </button>
        </div>
      )}
    </div>
  );
}
