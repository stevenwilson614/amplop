"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const DISPLAY_CURRENCIES = [
  { code: "IDR", label: "IDR — Indonesian Rupiah" },
  { code: "USD", label: "USD — US Dollar" },
  { code: "EUR", label: "EUR — Euro" },
  { code: "SGD", label: "SGD — Singapore Dollar" },
  { code: "AUD", label: "AUD — Australian Dollar" },
  { code: "GBP", label: "GBP — British Pound" },
  { code: "JPY", label: "JPY — Japanese Yen" },
  { code: "MYR", label: "MYR — Malaysian Ringgit" },
];

interface Props {
  userId: string;
  displayName: string;
  displayCurrency: string;
  ratesUpdatedAt: string | null;
}

export default function SettingsForm({
  userId,
  displayName,
  displayCurrency: initialCurrency,
  ratesUpdatedAt,
}: Props) {
  const router = useRouter();
  const [currency, setCurrency] = useState(initialCurrency);
  const [saving, setSaving] = useState(false);
  const [signingOut, setSigningOut] = useState(false);

  async function saveCurrency(next: string) {
    if (next === currency || saving) return;
    setSaving(true);
    const supabase = createClient();
    await supabase
      .from("users")
      .update({ display_currency: next })
      .eq("id", userId);
    setCurrency(next);
    setSaving(false);
    // Re-run all server components so envelopes/transactions render in new currency
    router.refresh();
  }

  async function signOut() {
    setSigningOut(true);
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  const ratesLabel = ratesUpdatedAt ? fxAge(ratesUpdatedAt) : "No rates loaded";

  return (
    <div className="p-4 pb-8">
      <header className="py-2 mb-6">
        <h1 className="text-xl font-semibold text-brand-text">Settings</h1>
      </header>

      <div className="space-y-8">
        {/* Profile */}
        <section>
          <h2 className="text-xs font-semibold text-brand-text-muted uppercase tracking-widest mb-3">
            Profile
          </h2>
          <div className="bg-brand-surface border border-brand-border rounded-xl px-4 py-3.5">
            <p className="text-brand-text font-medium">{displayName}</p>
          </div>
        </section>

        {/* Display currency */}
        <section>
          <h2 className="text-xs font-semibold text-brand-text-muted uppercase tracking-widest mb-1">
            Display currency
          </h2>
          <p className="text-brand-text-muted text-xs mb-3 leading-relaxed">
            Envelope budgets and balances are shown in this currency. Your
            transactions are always stored in their original currency.
          </p>
          <div className="space-y-2">
            {DISPLAY_CURRENCIES.map(({ code, label }) => (
              <button
                key={code}
                onClick={() => saveCurrency(code)}
                disabled={saving}
                className={`w-full flex items-center justify-between px-4 py-3.5 rounded-xl border transition-colors text-left ${
                  currency === code
                    ? "border-brand-accent bg-brand-primary"
                    : "border-brand-border bg-brand-surface"
                }`}
              >
                <span
                  className={
                    currency === code ? "text-brand-text font-medium" : "text-brand-text-muted"
                  }
                >
                  {label}
                </span>
                {currency === code && <CheckIcon />}
              </button>
            ))}
          </div>
        </section>

        {/* FX rates status */}
        <section>
          <h2 className="text-xs font-semibold text-brand-text-muted uppercase tracking-widest mb-3">
            Exchange rates
          </h2>
          <div className="bg-brand-surface border border-brand-border rounded-xl px-4 py-3.5 flex items-center justify-between">
            <div>
              <p className="text-brand-text text-sm font-medium">Frankfurter / ECB</p>
              <p className="text-brand-text-muted text-xs mt-0.5">{ratesLabel}</p>
            </div>
            <RatesIcon />
          </div>
          <p className="text-brand-text-muted text-xs mt-2">
            Rates refresh daily at 00:00 UTC via the fx-rate-sync Edge Function.
          </p>
        </section>

        {/* Sign out */}
        <section>
          <button
            onClick={signOut}
            disabled={signingOut}
            className="w-full bg-brand-surface border border-brand-border rounded-xl py-4 text-red-400 font-medium active:opacity-70 disabled:opacity-50 transition-opacity"
          >
            {signingOut ? "Signing out…" : "Sign out"}
          </button>
        </section>
      </div>
    </div>
  );
}

function fxAge(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffH = diffMs / 1000 / 3600;
  if (diffH < 1) return "Updated just now";
  if (diffH < 24) return `Updated ${Math.floor(diffH)}h ago`;
  if (diffH < 48) return "Updated yesterday";
  return `Updated ${Math.floor(diffH / 24)} days ago`;
}

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      className="w-4 h-4 text-brand-accent shrink-0"
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
    </svg>
  );
}

function RatesIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      className="w-5 h-5 text-brand-muted"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z"
      />
    </svg>
  );
}
