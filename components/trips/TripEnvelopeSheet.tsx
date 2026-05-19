"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  convert,
  format,
  parseToMinorUnits,
  toInputValue,
  CURRENCY_DECIMALS,
  type FxRates,
} from "@/lib/currency";
import type { Envelope, Trip } from "@/lib/types";

const CURRENCIES = ["IDR", "USD", "EUR", "SGD", "AUD", "GBP", "JPY", "MYR"];

interface Props {
  open: boolean;
  onClose: () => void;
  envelope: Envelope | null; // null = create
  trip: Trip;
  parentEnvelopes: Envelope[]; // regular (non-trip) envelopes available to draw from
  fxRates: FxRates;
  onSaved: (envelope: Envelope, isNew: boolean) => void;
  onDeleted?: (id: string) => void;
}

export default function TripEnvelopeSheet({
  open,
  onClose,
  envelope,
  trip,
  parentEnvelopes,
  fxRates,
  onSaved,
  onDeleted,
}: Props) {
  const isEdit = envelope !== null;

  const [name, setName] = useState(envelope?.name ?? "");
  const [currency, setCurrency] = useState(envelope?.budget_currency ?? trip.currency);
  const [amountInput, setAmountInput] = useState(
    isEdit ? toInputValue(envelope.budget_amount, envelope.budget_currency) : ""
  );
  const [drawEnabled, setDrawEnabled] = useState(!!envelope?.parent_envelope_id);
  const [parentId, setParentId] = useState(envelope?.parent_envelope_id ?? "");
  const [loading, setLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState("");

  if (!open) return null;

  const budgetMinorUnits = parseToMinorUnits(amountInput || "0", currency);
  // IDR equivalent that will be locked as the draw amount
  const drawnIdr = drawEnabled && parentId
    ? convert(budgetMinorUnits, currency, "IDR", fxRates)
    : 0;

  const selectedParent = parentEnvelopes.find((e) => e.id === parentId);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError("Name is required"); return; }
    if (drawEnabled && !parentId) { setError("Select a parent envelope to draw from"); return; }

    setLoading(true);
    setError("");
    const supabase = createClient();

    const payload = {
      household_id: trip.household_id,
      trip_id: trip.id,
      name: name.trim(),
      budget_amount: budgetMinorUnits,
      budget_currency: currency,
      parent_envelope_id: drawEnabled && parentId ? parentId : null,
      drawn_idr_snapshot: drawEnabled ? drawnIdr : 0,
      sort_order: 0,
    };

    if (isEdit) {
      const { data, error: err } = await supabase
        .from("envelopes")
        .update(payload)
        .eq("id", envelope.id)
        .select()
        .single();
      if (err) { setError(err.message); setLoading(false); return; }
      onSaved(data as Envelope, false);
    } else {
      const { data, error: err } = await supabase
        .from("envelopes")
        .insert(payload)
        .select()
        .single();
      if (err) { setError(err.message); setLoading(false); return; }
      onSaved(data as Envelope, true);
    }
    setLoading(false);
  }

  async function handleDelete() {
    if (!isEdit || !onDeleted) return;
    setDeleting(true);
    const supabase = createClient();
    const { error: err } = await supabase.from("envelopes").delete().eq("id", envelope.id);
    if (err) {
      setError(err.message.includes("violates foreign key")
        ? "Cannot delete — this envelope has transactions. Remove them first."
        : err.message);
      setDeleting(false);
      return;
    }
    onDeleted(envelope.id);
  }

  const amountStep = (CURRENCY_DECIMALS[currency] ?? 2) === 0 ? "1" : "0.01";

  return (
    <div className="fixed inset-0 z-50 flex flex-col justify-end">
      <div className="absolute inset-0 bg-black/60" onClick={onClose} />
      <div className="relative bg-brand-surface rounded-t-2xl border-t border-brand-border safe-bottom">
        <div className="flex justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-brand-border" />
        </div>
        <div className="px-5 pb-6">
          <div className="flex items-center justify-between py-3 mb-1">
            <h2 className="text-lg font-semibold text-brand-text">
              {isEdit ? "Edit envelope" : "New trip envelope"}
            </h2>
            <button onClick={onClose} className="text-brand-text-muted">
              <CloseIcon />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Name */}
            <div>
              <label className="block text-sm text-brand-text-muted mb-1.5">Name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Eating Out"
                autoFocus
                className="w-full bg-brand-primary border border-brand-border rounded-xl px-4 py-3.5 text-brand-text placeholder:text-brand-text-muted focus:outline-none focus:border-brand-accent"
              />
            </div>

            {/* Budget */}
            <div>
              <label className="block text-sm text-brand-text-muted mb-1.5">Budget</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={amountInput}
                  onChange={(e) => setAmountInput(e.target.value)}
                  placeholder="0"
                  min="0"
                  step={amountStep}
                  className="flex-1 min-w-0 bg-brand-primary border border-brand-border rounded-xl px-4 py-3.5 text-brand-text placeholder:text-brand-text-muted focus:outline-none focus:border-brand-accent font-mono"
                />
                <select
                  value={currency}
                  onChange={(e) => { setCurrency(e.target.value); setAmountInput(""); }}
                  className="bg-brand-primary border border-brand-border rounded-xl px-3 py-3.5 text-brand-text focus:outline-none focus:border-brand-accent font-mono"
                >
                  {CURRENCIES.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Draw from parent */}
            {parentEnvelopes.length > 0 && (
              <div>
                <button
                  type="button"
                  onClick={() => { setDrawEnabled((v) => !v); setParentId(""); }}
                  className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl border transition-colors text-left ${
                    drawEnabled
                      ? "border-brand-accent bg-brand-primary"
                      : "border-brand-border bg-brand-surface"
                  }`}
                >
                  <span className="text-brand-text text-sm">Draw from parent envelope</span>
                  <ToggleIcon on={drawEnabled} />
                </button>

                {drawEnabled && (
                  <div className="mt-2 space-y-2">
                    <select
                      value={parentId}
                      onChange={(e) => setParentId(e.target.value)}
                      className="w-full bg-brand-primary border border-brand-border rounded-xl px-4 py-3.5 text-brand-text focus:outline-none focus:border-brand-accent"
                    >
                      <option value="">Select parent envelope…</option>
                      {parentEnvelopes.map((e) => (
                        <option key={e.id} value={e.id}>
                          {e.name}
                        </option>
                      ))}
                    </select>

                    {parentId && budgetMinorUnits > 0 && (
                      <div className="bg-brand-primary rounded-xl px-4 py-3 text-sm">
                        <p className="text-brand-text-muted">
                          Will draw{" "}
                          <span className="text-brand-accent font-mono font-medium">
                            {format(drawnIdr, "IDR")}
                          </span>{" "}
                          from{" "}
                          <span className="text-brand-text">
                            {selectedParent?.name}
                          </span>
                        </p>
                        <p className="text-brand-text-muted text-xs mt-0.5">
                          Locked at today{"'"}s FX rate. Unspent returns when trip ends.
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {error && <p className="text-red-400 text-sm">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-brand-accent text-white font-semibold rounded-xl py-4 disabled:opacity-50"
            >
              {loading ? "Saving…" : isEdit ? "Save changes" : "Add to trip"}
            </button>

            {isEdit && onDeleted && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className="w-full text-red-400 text-sm py-2 disabled:opacity-50"
              >
                {deleting ? "Removing…" : "Remove from trip"}
              </button>
            )}
          </form>
        </div>
      </div>
    </div>
  );
}

function CloseIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  );
}

function ToggleIcon({ on }: { on: boolean }) {
  return (
    <div className={`w-10 h-6 rounded-full transition-colors flex items-center px-1 ${on ? "bg-brand-accent" : "bg-brand-border"}`}>
      <div className={`w-4 h-4 rounded-full bg-white transition-transform ${on ? "translate-x-4" : "translate-x-0"}`} />
    </div>
  );
}
