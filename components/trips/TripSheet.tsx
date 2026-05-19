"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import type { Trip } from "@/lib/types";

const CURRENCIES = ["IDR", "USD", "EUR", "SGD", "AUD", "GBP", "JPY", "MYR"];

interface Props {
  open: boolean;
  onClose: () => void;
  trip: Trip | null; // null = create mode
  householdId: string;
  onSaved: (trip: Trip, isNew: boolean) => void;
}

export default function TripSheet({ open, onClose, trip, householdId, onSaved }: Props) {
  const isEdit = trip !== null;

  const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
  const twoWeeksStr = new Date(Date.now() + 14 * 86400000).toLocaleDateString("en-CA", {
    timeZone: "Asia/Jakarta",
  });

  const [name, setName] = useState(trip?.name ?? "");
  const [startDate, setStartDate] = useState(trip?.start_date ?? todayStr);
  const [endDate, setEndDate] = useState(trip?.end_date ?? twoWeeksStr);
  const [currency, setCurrency] = useState(trip?.currency ?? "USD");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (!open) return null;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) { setError("Name is required"); return; }
    if (endDate < startDate) { setError("End date must be after start date"); return; }

    setLoading(true);
    setError("");
    const supabase = createClient();
    const payload = {
      household_id: householdId,
      name: name.trim(),
      start_date: startDate,
      end_date: endDate,
      currency,
    };

    if (isEdit) {
      const { data, error: err } = await supabase
        .from("trips")
        .update(payload)
        .eq("id", trip.id)
        .select()
        .single();
      if (err) { setError(err.message); setLoading(false); return; }
      onSaved(data as Trip, false);
    } else {
      const { data, error: err } = await supabase
        .from("trips")
        .insert({ ...payload, status: "active" })
        .select()
        .single();
      if (err) { setError(err.message); setLoading(false); return; }
      onSaved(data as Trip, true);
    }
    setLoading(false);
  }

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
              {isEdit ? "Edit trip" : "New trip"}
            </h2>
            <button onClick={onClose} className="text-brand-text-muted">
              <CloseIcon />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-brand-text-muted mb-1.5">Trip name</label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Europe Summer 2026"
                autoFocus
                className="w-full bg-brand-primary border border-brand-border rounded-xl px-4 py-3.5 text-brand-text placeholder:text-brand-text-muted focus:outline-none focus:border-brand-accent"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-sm text-brand-text-muted mb-1.5">Start</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full bg-brand-primary border border-brand-border rounded-xl px-3 py-3.5 text-brand-text focus:outline-none focus:border-brand-accent"
                />
              </div>
              <div>
                <label className="block text-sm text-brand-text-muted mb-1.5">End</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full bg-brand-primary border border-brand-border rounded-xl px-3 py-3.5 text-brand-text focus:outline-none focus:border-brand-accent"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm text-brand-text-muted mb-1.5">
                Trip currency
              </label>
              <p className="text-xs text-brand-text-muted mb-2">
                Default currency for trip envelopes
              </p>
              <div className="flex flex-wrap gap-2">
                {CURRENCIES.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCurrency(c)}
                    className={`px-3 py-1.5 rounded-full text-sm font-mono border transition-colors ${
                      currency === c
                        ? "bg-brand-accent border-brand-accent text-white"
                        : "border-brand-border text-brand-text-muted"
                    }`}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>

            {error && <p className="text-red-400 text-sm">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-brand-accent text-white font-semibold rounded-xl py-4 disabled:opacity-50"
            >
              {loading ? "Saving…" : isEdit ? "Save changes" : "Create trip"}
            </button>
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
