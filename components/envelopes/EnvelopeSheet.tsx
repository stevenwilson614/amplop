"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  CURRENCY_DECIMALS,
  parseToMinorUnits,
  toInputValue,
} from "@/lib/currency";
import type { Category, Envelope } from "@/lib/types";

const SUPPORTED_CURRENCIES = [
  "IDR",
  "USD",
  "EUR",
  "SGD",
  "AUD",
  "GBP",
  "JPY",
  "MYR",
];

interface Props {
  open: boolean;
  onClose: () => void;
  envelope: Envelope | null; // null = create mode
  categories: Category[];
  householdId: string;
  onSaved: (envelope: Envelope, isNew: boolean) => void;
}

export default function EnvelopeSheet({
  open,
  onClose,
  envelope,
  categories,
  householdId,
  onSaved,
}: Props) {
  const isEdit = envelope !== null;

  const [name, setName] = useState(envelope?.name ?? "");
  const [categoryId, setCategoryId] = useState(
    envelope?.category_id ?? categories[0]?.id ?? ""
  );
  const [currency, setCurrency] = useState(
    envelope?.budget_currency ?? "IDR"
  );
  const [amountInput, setAmountInput] = useState(
    isEdit ? toInputValue(envelope.budget_amount, envelope.budget_currency) : ""
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!open) return null;

  const amountStep = (CURRENCY_DECIMALS[currency] ?? 2) === 0 ? "1" : "0.01";
  const amountPlaceholder =
    currency === "IDR" ? "e.g. 1000000" : "e.g. 250.00";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Name is required");
      return;
    }

    setLoading(true);
    setError("");

    const supabase = createClient();
    const budgetAmount = parseToMinorUnits(amountInput, currency);

    const payload = {
      household_id: householdId,
      name: name.trim(),
      category_id: categoryId || null,
      budget_amount: budgetAmount,
      budget_currency: currency,
    };

    if (isEdit) {
      const { data, error: err } = await supabase
        .from("envelopes")
        .update(payload)
        .eq("id", envelope.id)
        .select()
        .single();
      if (err) {
        setError(err.message);
        setLoading(false);
        return;
      }
      onSaved(data as Envelope, false);
    } else {
      const { data, error: err } = await supabase
        .from("envelopes")
        .insert({ ...payload, sort_order: 0 })
        .select()
        .single();
      if (err) {
        setError(err.message);
        setLoading(false);
        return;
      }
      onSaved(data as Envelope, true);
    }

    setLoading(false);
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60"
        onClick={onClose}
      />

      {/* Sheet */}
      <div className="relative bg-brand-surface rounded-t-2xl border-t border-brand-border safe-bottom">
        {/* Drag handle */}
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-brand-border" />
        </div>

        <div className="px-5 pb-6">
          <div className="flex items-center justify-between py-3 mb-1">
            <h2 className="text-lg font-semibold text-brand-text">
              {isEdit ? "Edit envelope" : "New envelope"}
            </h2>
            <button
              onClick={onClose}
              className="w-8 h-8 flex items-center justify-center text-brand-text-muted"
            >
              <CloseIcon />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name */}
            <div>
              <label className="block text-sm text-brand-text-muted mb-1.5">
                Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Groceries"
                className="w-full bg-brand-primary border border-brand-border rounded-xl px-4 py-3.5 text-brand-text placeholder:text-brand-text-muted focus:outline-none focus:border-brand-accent text-base"
                autoFocus
              />
            </div>

            {/* Category */}
            {categories.length > 0 && (
              <div>
                <label className="block text-sm text-brand-text-muted mb-1.5">
                  Category
                </label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className="w-full bg-brand-primary border border-brand-border rounded-xl px-4 py-3.5 text-brand-text focus:outline-none focus:border-brand-accent appearance-none"
                >
                  <option value="">No category</option>
                  {categories.map((cat) => (
                    <option key={cat.id} value={cat.id}>
                      {cat.name}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Budget amount + currency */}
            <div>
              <label className="block text-sm text-brand-text-muted mb-1.5">
                Monthly budget
              </label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={amountInput}
                  onChange={(e) => setAmountInput(e.target.value)}
                  placeholder={amountPlaceholder}
                  min="0"
                  step={amountStep}
                  className="flex-1 min-w-0 bg-brand-primary border border-brand-border rounded-xl px-4 py-3.5 text-brand-text placeholder:text-brand-text-muted focus:outline-none focus:border-brand-accent font-mono text-base"
                />
                <select
                  value={currency}
                  onChange={(e) => {
                    setCurrency(e.target.value);
                    setAmountInput(""); // clear amount when currency changes
                  }}
                  className="bg-brand-primary border border-brand-border rounded-xl px-3 py-3.5 text-brand-text focus:outline-none focus:border-brand-accent font-mono"
                >
                  {SUPPORTED_CURRENCIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>
              {currency !== "IDR" && (
                <p className="text-[11px] text-brand-text-muted mt-1.5">
                  Budget anchored in {currency}. Displays in IDR using daily FX
                  rate.
                </p>
              )}
            </div>

            {error && <p className="text-red-400 text-sm">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-brand-accent text-white font-semibold rounded-xl py-4 text-base active:opacity-90 disabled:opacity-50 transition-opacity"
            >
              {loading
                ? "Saving…"
                : isEdit
                ? "Save changes"
                : "Create envelope"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

function CloseIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="w-5 h-5"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M6 18L18 6M6 6l12 12"
      />
    </svg>
  );
}
