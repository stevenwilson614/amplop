import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import type { Envelope, DbUser, Household, FxRates } from "@/lib/types";
import { parseToMinorUnits, getRate, convert, format, CURRENCY_DECIMALS } from "@/lib/currency";

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  envelopes: Envelope[];
  dbUser: DbUser;
  household: Household;
  fxRates: FxRates;
  defaultEnvelope?: Envelope;
}

const CURRENCIES = Object.keys(CURRENCY_DECIMALS);
const today = () => new Date().toLocaleDateString("en-CA");

export default function TransactionEntry({
  open, onClose, onSaved, envelopes, dbUser, household, fxRates, defaultEnvelope,
}: Props) {
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("IDR");
  const [envelopeId, setEnvelopeId] = useState("");
  const [merchant, setMerchant] = useState("");
  const [notes, setNotes] = useState("");
  const [date, setDate] = useState(today());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (open) {
      setAmount("");
      setMerchant("");
      setNotes("");
      setDate(today());
      setError("");
      setEnvelopeId(defaultEnvelope?.id ?? envelopes[0]?.id ?? "");
      setCurrency(defaultEnvelope?.budget_currency ?? "IDR");
    }
  }, [open, defaultEnvelope, envelopes]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!envelopeId) { setError("select an envelope"); return; }
    setLoading(true);
    setError("");
    try {
      const amountMinor = parseToMinorUnits(amount, currency);
      const amountIdr = convert(amountMinor, currency, "IDR", fxRates);
      const fxRate = currency === "IDR" ? 1 : getRate(fxRates, currency, "IDR");

      const { data: tx, error: txErr } = await supabase
        .from("transactions")
        .insert({
          household_id: household.id,
          user_id: dbUser.id,
          amount: amountMinor,
          currency,
          amount_idr_snapshot: amountIdr,
          fx_rate_snapshot: fxRate,
          date,
          merchant_name: merchant || null,
          notes: notes || null,
        })
        .select()
        .single();
      if (txErr) throw txErr;

      const { error: allocErr } = await supabase.from("transaction_allocations").insert({
        transaction_id: tx.id,
        envelope_id: envelopeId,
        amount: amountMinor,
      });
      if (allocErr) throw allocErr;

      onSaved();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setLoading(false);
    }
  }

  if (!open) return null;

  const selectedEnv = envelopes.find(e => e.id === envelopeId);
  const dc = dbUser.display_currency;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-brand-bg">
      <div className="flex items-center justify-between p-4 border-b border-brand-border">
        <button onClick={onClose} className="font-mono text-sm text-brand-text-muted">cancel</button>
        <h1 className="font-mono font-bold text-brand-text">new transaction</h1>
        <button
          onClick={handleSave}
          disabled={loading || !amount}
          className="font-mono text-sm font-semibold text-brand-accent disabled:opacity-40"
        >
          {loading ? "..." : "save"}
        </button>
      </div>

      <form onSubmit={handleSave} className="flex-1 overflow-auto">
        {/* Amount */}
        <div className="flex items-center gap-3 p-6 border-b border-brand-border">
          <select
            value={currency}
            onChange={e => setCurrency(e.target.value)}
            className="bg-transparent font-mono text-sm text-brand-accent focus:outline-none"
          >
            {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <input
            type="number" required min="0.01" step="any"
            value={amount} onChange={e => setAmount(e.target.value)}
            placeholder="0"
            className="flex-1 bg-transparent font-mono text-4xl font-bold text-brand-text placeholder-brand-border focus:outline-none text-right"
            autoFocus
          />
        </div>

        <div className="p-4 space-y-4">
          {/* Envelope */}
          <div className="space-y-1">
            <label className="font-mono text-xs text-brand-text-muted uppercase tracking-wider">envelope</label>
            <div className="grid grid-cols-2 gap-2">
              {envelopes.map(env => (
                <button
                  key={env.id} type="button"
                  onClick={() => setEnvelopeId(env.id)}
                  className={`rounded-lg p-3 text-left border transition-colors ${
                    env.id === envelopeId
                      ? "border-brand-accent bg-brand-primary"
                      : "border-brand-border bg-brand-surface"
                  }`}
                >
                  <p className="font-mono text-xs text-brand-text font-semibold truncate">{env.name}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Merchant */}
          <div className="space-y-1">
            <label className="font-mono text-xs text-brand-text-muted uppercase tracking-wider">merchant</label>
            <input
              type="text" value={merchant} onChange={e => setMerchant(e.target.value)}
              placeholder="Indomaret" className={inputCls}
            />
          </div>

          {/* Date */}
          <div className="space-y-1">
            <label className="font-mono text-xs text-brand-text-muted uppercase tracking-wider">date</label>
            <input
              type="date" value={date} onChange={e => setDate(e.target.value)}
              className={inputCls}
            />
          </div>

          {/* Notes */}
          <div className="space-y-1">
            <label className="font-mono text-xs text-brand-text-muted uppercase tracking-wider">notes</label>
            <input
              type="text" value={notes} onChange={e => setNotes(e.target.value)}
              placeholder="optional" className={inputCls}
            />
          </div>

          {currency !== "IDR" && amount && (
            <p className="font-mono text-xs text-brand-text-muted">
              ≈ {format(convert(parseToMinorUnits(amount, currency), currency, "IDR", fxRates), "IDR")} IDR
            </p>
          )}

          {error && <p className="font-mono text-xs text-red-400">{error}</p>}
        </div>
      </form>
    </div>
  );
}

const inputCls = "w-full rounded-lg border border-brand-border bg-brand-surface px-4 py-3 font-mono text-sm text-brand-text placeholder-brand-text-muted focus:outline-none focus:ring-2 focus:ring-brand-accent";
