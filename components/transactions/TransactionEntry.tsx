"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import {
  format,
  parseToMinorUnits,
  convert,
  getRate,
  type FxRates,
} from "@/lib/currency";
import type { Category, Envelope } from "@/lib/types";
import Keypad from "./Keypad";
import EnvelopePicker from "./EnvelopePicker";

const CURRENCIES = ["IDR", "USD", "EUR", "SGD", "AUD", "GBP", "JPY", "MYR"];

interface Allocation {
  envelope_id: string;
  amount: number;
}

interface Props {
  envelopes: Envelope[];
  categories: Category[];
  fxRates: FxRates;
  userId: string;
  householdId: string;
  displayCurrency: string;
}

export default function TransactionEntry({
  envelopes,
  categories,
  fxRates,
  userId,
  householdId,
  displayCurrency,
}: Props) {
  const router = useRouter();
  const [step, setStep] = useState<1 | 2 | 3>(1);

  // Step 1: amount
  const [currency, setCurrency] = useState(displayCurrency === "IDR" ? "IDR" : displayCurrency);
  const [rawInput, setRawInput] = useState("");

  // Step 2: allocations
  const [allocations, setAllocations] = useState<Allocation[]>([]);

  // Step 3: details
  const [date, setDate] = useState("");
  const [merchant, setMerchant] = useState("");
  const [notes, setNotes] = useState("");
  const [locationLat, setLocationLat] = useState<number | null>(null);
  const [locationLng, setLocationLng] = useState<number | null>(null);
  const [locationName, setLocationName] = useState("");
  const [locLoading, setLocLoading] = useState(false);

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  // Set default date to today in local time (Jakarta)
  useEffect(() => {
    const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
    setDate(today);
  }, []);

  // Auto-request geolocation when reaching step 3
  useEffect(() => {
    if (step !== 3 || locationLat !== null) return;
    setLocLoading(true);
    if (!navigator.geolocation) { setLocLoading(false); return; }
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const { latitude: lat, longitude: lng } = pos.coords;
        setLocationLat(lat);
        setLocationLng(lng);
        try {
          const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`,
            { headers: { "User-Agent": "Amplop/1.0 household-budgeting" } }
          );
          const data = await res.json();
          // Take road + city for a short location name
          const addr = data.address ?? {};
          const short = [addr.road || addr.suburb, addr.city || addr.town || addr.county]
            .filter(Boolean)
            .join(", ");
          setLocationName(short || data.display_name?.split(",")[0] || "");
        } catch {
          setLocationName("");
        }
        setLocLoading(false);
      },
      () => setLocLoading(false),
      { timeout: 8000 }
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step]);

  // ── Derived ────────────────────────────────────────────────────────────────
  const amount = parseToMinorUnits(rawInput || "0", currency);
  const amountDisplay = format(amount, currency);
  const amountIsZero = amount === 0;

  // Show amount in display currency if different from transaction currency
  const amountInDisplay =
    currency !== displayCurrency
      ? format(convert(amount, currency, displayCurrency, fxRates), displayCurrency)
      : null;

  // Step 3: envelope names for summary
  const allocationSummary = allocations
    .map((a) => envelopes.find((e) => e.id === a.envelope_id)?.name ?? "")
    .filter(Boolean)
    .join(", ");

  // ── Save ──────────────────────────────────────────────────────────────────
  async function save() {
    setSaving(true);
    setError("");
    const supabase = createClient();

    const fxRateSnapshot = getRate(currency, "IDR", fxRates);
    const amountIdrSnapshot = convert(amount, currency, "IDR", fxRates);

    const { data: txn, error: txnErr } = await supabase
      .from("transactions")
      .insert({
        household_id: householdId,
        user_id: userId,
        amount,
        currency,
        amount_idr_snapshot: amountIdrSnapshot,
        fx_rate_snapshot: fxRateSnapshot,
        date,
        merchant_name: merchant.trim() || null,
        notes: notes.trim() || null,
        location_lat: locationLat,
        location_lng: locationLng,
        location_name: locationName.trim() || null,
      })
      .select("id")
      .single();

    if (txnErr) {
      setError(txnErr.message);
      setSaving(false);
      return;
    }

    const { error: allocErr } = await supabase.from("transaction_allocations").insert(
      allocations.map((a) => ({
        transaction_id: txn.id,
        envelope_id: a.envelope_id,
        amount: a.amount,
      }))
    );

    if (allocErr) {
      // Roll back the transaction on allocation failure
      await supabase.from("transactions").delete().eq("id", txn.id);
      setError(allocErr.message);
      setSaving(false);
      return;
    }

    router.push("/transactions");
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-brand-bg">
      {/* Header */}
      <header className="flex items-center px-4 py-3 border-b border-brand-border shrink-0">
        <button
          onClick={() => (step === 1 ? router.back() : setStep((s) => (s - 1) as 1 | 2 | 3))}
          className="w-10 h-10 flex items-center justify-center text-brand-text-muted mr-2"
        >
          <ChevronLeftIcon />
        </button>
        <h1 className="text-base font-semibold text-brand-text flex-1">Add transaction</h1>
        <span className="text-xs text-brand-text-muted">{step}/3</span>
      </header>

      {/* ── Step 1: Keypad ──────────────────────────────────────────────────── */}
      {step === 1 && (
        <div className="flex flex-col flex-1 p-4 gap-4">
          {/* Currency pills */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {CURRENCIES.map((c) => (
              <button
                key={c}
                onClick={() => { setCurrency(c); setRawInput(""); }}
                className={`shrink-0 px-3 py-1.5 rounded-full text-sm font-mono border transition-colors ${
                  currency === c
                    ? "bg-brand-accent border-brand-accent text-white"
                    : "border-brand-border text-brand-text-muted"
                }`}
              >
                {c}
              </button>
            ))}
          </div>

          {/* Amount display */}
          <div className="flex-1 flex flex-col items-center justify-center">
            <div
              className={`font-mono font-bold text-center transition-all ${
                amountDisplay.length > 14
                  ? "text-3xl"
                  : amountDisplay.length > 10
                  ? "text-4xl"
                  : "text-5xl"
              } ${amountIsZero ? "text-brand-text-muted" : "text-brand-text"}`}
            >
              {amountIsZero ? format(0, currency) : amountDisplay}
            </div>
            {amountInDisplay && !amountIsZero && (
              <div className="text-brand-text-muted text-sm mt-1">{amountInDisplay}</div>
            )}
          </div>

          {/* Keypad */}
          <Keypad value={rawInput} onChange={setRawInput} currency={currency} />

          <button
            disabled={amountIsZero}
            onClick={() => setStep(2)}
            className="w-full bg-brand-accent text-white font-semibold rounded-xl py-4 disabled:opacity-30 transition-opacity"
          >
            Next — choose envelope
          </button>
        </div>
      )}

      {/* ── Step 2: Envelope picker ─────────────────────────────────────────── */}
      {step === 2 && (
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Amount summary bar */}
          <div className="px-4 py-3 bg-brand-surface border-b border-brand-border shrink-0">
            <div className="flex items-baseline gap-2">
              <span className="text-brand-text font-mono font-bold text-xl">{amountDisplay}</span>
              {amountInDisplay && (
                <span className="text-brand-text-muted text-sm">≈ {amountInDisplay}</span>
              )}
            </div>
          </div>

          <EnvelopePicker
            envelopes={envelopes}
            categories={categories}
            totalAmount={amount}
            currency={currency}
            fxRates={fxRates}
            displayCurrency={displayCurrency}
            onConfirm={(allocs) => {
              setAllocations(allocs);
              setStep(3);
            }}
          />
        </div>
      )}

      {/* ── Step 3: Details ─────────────────────────────────────────────────── */}
      {step === 3 && (
        <div className="flex flex-col flex-1 overflow-y-auto">
          {/* Summary (tappable to go back) */}
          <button
            onClick={() => setStep(2)}
            className="px-4 py-3 bg-brand-surface border-b border-brand-border text-left"
          >
            <div className="text-brand-text font-mono font-bold">{amountDisplay}</div>
            <div className="text-brand-text-muted text-sm">{allocationSummary}</div>
          </button>

          <div className="p-4 space-y-4">
            {/* Date */}
            <div>
              <label className="block text-sm text-brand-text-muted mb-1.5">Date</label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full bg-brand-surface border border-brand-border rounded-xl px-4 py-3.5 text-brand-text focus:outline-none focus:border-brand-accent"
              />
            </div>

            {/* Merchant */}
            <div>
              <label className="block text-sm text-brand-text-muted mb-1.5">
                Merchant / description
              </label>
              <input
                type="text"
                value={merchant}
                onChange={(e) => setMerchant(e.target.value)}
                placeholder="e.g. Indomaret"
                className="w-full bg-brand-surface border border-brand-border rounded-xl px-4 py-3.5 text-brand-text placeholder:text-brand-text-muted focus:outline-none focus:border-brand-accent"
              />
            </div>

            {/* Notes */}
            <div>
              <label className="block text-sm text-brand-text-muted mb-1.5">
                Notes (optional)
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Any additional notes…"
                rows={2}
                className="w-full bg-brand-surface border border-brand-border rounded-xl px-4 py-3.5 text-brand-text placeholder:text-brand-text-muted focus:outline-none focus:border-brand-accent resize-none"
              />
            </div>

            {/* Location */}
            <div>
              <label className="block text-sm text-brand-text-muted mb-1.5">Location</label>
              {locLoading ? (
                <div className="flex items-center gap-2 text-brand-text-muted text-sm">
                  <span className="animate-spin">⟳</span>
                  Getting location…
                </div>
              ) : locationName ? (
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-brand-surface border border-brand-border rounded-xl px-4 py-3 text-brand-text text-sm">
                    {locationName}
                  </div>
                  <button
                    onClick={() => {
                      setLocationLat(null);
                      setLocationLng(null);
                      setLocationName("");
                    }}
                    className="text-brand-text-muted text-sm"
                  >
                    Clear
                  </button>
                </div>
              ) : (
                <p className="text-brand-text-muted text-sm">
                  {locationLat === null ? "Location not available" : "No address found"}
                </p>
              )}
            </div>

            {error && <p className="text-red-400 text-sm">{error}</p>}

            <button
              onClick={save}
              disabled={saving}
              className="w-full bg-brand-accent text-white font-semibold rounded-xl py-4 disabled:opacity-50 transition-opacity"
            >
              {saving ? "Saving…" : "Save transaction"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ChevronLeftIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
    </svg>
  );
}
