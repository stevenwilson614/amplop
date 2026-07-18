import { useEffect, useState } from "react";
import Sheet from "@/components/ui/Sheet";
import { supabase } from "@/lib/supabase";
import type { FxRates } from "@/lib/types";
import { CURRENCY_DECIMALS, convert, getRate, parseToMinorUnits } from "@/lib/currency";

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  householdId: string;
  userId: string;
  fxRates: FxRates;
  defaultCurrency: string;
}

const CURRENCIES = Object.keys(CURRENCY_DECIMALS);

export default function CashSnapshotSheet({
  open, onClose, onSaved, householdId, userId, fxRates, defaultCurrency,
}: Props) {
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState(defaultCurrency);
  const [date, setDate] = useState(new Date().toLocaleDateString("en-CA"));
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setAmount("");
    setCurrency(defaultCurrency);
    setDate(new Date().toLocaleDateString("en-CA"));
    setNotes("");
    setError("");
  }, [open, defaultCurrency]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const amountMinor = parseToMinorUnits(amount, currency);
      if (amountMinor <= 0) throw new Error("enter cash total");
      const amountIdr = convert(amountMinor, currency, "IDR", fxRates);
      const fxRate = currency === "IDR" ? 1 : getRate(fxRates, currency, "IDR");

      const { error: err } = await supabase.from("cash_snapshots").insert({
        household_id: householdId,
        as_of_date: date,
        amount: amountMinor,
        currency,
        amount_idr_snapshot: amountIdr,
        fx_rate_snapshot: fxRate,
        notes: notes.trim() || null,
        created_by: userId,
      });
      if (err) throw err;
      onSaved();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="log cash on hand">
      <form onSubmit={handleSave} className="space-y-4">
        <div className="space-y-1">
          <label className="font-mono text-xs uppercase tracking-wider text-brand-text-muted">total liquid cash</label>
          <div className="flex gap-2">
            <input
              type="number"
              required
              min="0"
              step="any"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0"
              className={inputCls + " flex-1 text-2xl"}
            />
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value)}
              className={inputCls + " w-28"}
            >
              {CURRENCIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="space-y-1">
          <label className="font-mono text-xs uppercase tracking-wider text-brand-text-muted">as of</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
        </div>

        <div className="space-y-1">
          <label className="font-mono text-xs uppercase tracking-wider text-brand-text-muted">notes</label>
          <input
            type="text"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="optional"
            className={inputCls}
          />
        </div>

        {error && <p className="font-mono text-xs text-red-400">{error}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-lg bg-brand-accent py-3 font-mono text-sm font-semibold text-white disabled:opacity-50"
        >
          {loading ? "saving..." : "save snapshot"}
        </button>
      </form>
    </Sheet>
  );
}

const inputCls =
  "w-full rounded-lg border border-brand-border bg-brand-bg px-4 py-3 font-mono text-sm text-brand-text placeholder-brand-text-muted focus:outline-none focus:ring-2 focus:ring-brand-accent";
