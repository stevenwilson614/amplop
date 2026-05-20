import { useState, useEffect } from "react";
import type { ReactNode } from "react";
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
  const convertedPreview = currency !== "IDR" && amount
    ? format(convert(parseToMinorUnits(amount, currency), currency, "IDR", fxRates), "IDR")
    : null;

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-brand-bg sm:mx-auto sm:h-[896px] sm:max-w-[430px] sm:overflow-hidden sm:rounded-[34px]">
      <div className="flex items-center justify-between bg-brand-accent px-4 pb-4 pt-7 text-white">
        <button onClick={onClose} className="rounded-full bg-[#8AF4A6] px-3 py-2 font-mono text-sm font-semibold text-[#0F3C1B]">✕</button>
        <h1 className="font-mono text-3xl font-semibold">Add Transaction</h1>
        <button
          onClick={handleSave}
          disabled={loading || !amount}
          className="rounded-full bg-[#8AF4A6] px-4 py-2 font-mono text-sm font-semibold text-[#0F3C1B] disabled:opacity-40"
        >
          {loading ? "..." : "Save"}
        </button>
      </div>

      <form onSubmit={handleSave} className="flex-1 overflow-auto bg-brand-bg pb-10">
        <section className="mt-4 border-y border-brand-border bg-brand-surface">
          <Row label="Type">
            <span className="font-mono text-2xl font-medium">Expense</span>
          </Row>
          <Row label="Payee">
            <input
              type="text"
              value={merchant}
              onChange={e => setMerchant(e.target.value)}
              placeholder="Who received payment?"
              className="w-full bg-transparent text-right font-mono text-2xl text-brand-text placeholder:text-[#B9C0CB] focus:outline-none"
            />
          </Row>
          <Row label="Amount">
            <div className="flex items-center justify-end gap-2">
              <input
                type="number"
                required
                min="0.01"
                step="any"
                value={amount}
                onChange={e => setAmount(e.target.value)}
                placeholder="Amt"
                autoFocus
                className="w-28 bg-transparent text-right font-mono text-2xl text-brand-text placeholder:text-[#B9C0CB] focus:outline-none"
              />
              <select
                value={currency}
                onChange={e => setCurrency(e.target.value)}
                className="bg-transparent font-mono text-xl text-brand-text focus:outline-none"
              >
                {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </Row>
          <Row label="Envelope">
            <select
              value={envelopeId}
              onChange={e => setEnvelopeId(e.target.value)}
              className="w-full bg-transparent text-right font-mono text-2xl text-brand-text focus:outline-none"
            >
              {envelopes.map(env => (
                <option key={env.id} value={env.id}>{env.name}</option>
              ))}
            </select>
          </Row>
          <Row label="Account">
            <span className="font-mono text-2xl">{dbUser.display_name || "My Account"}</span>
          </Row>
        </section>

        <div className="px-4 py-2 font-mono text-3xl font-semibold text-brand-text-muted">Details</div>

        <section className="border-y border-brand-border bg-brand-surface">
          <Row label="Date">
            <input
              type="date"
              value={date}
              onChange={e => setDate(e.target.value)}
              className="bg-transparent text-right font-mono text-2xl text-brand-text focus:outline-none"
            />
          </Row>
          <Row label="Notes">
            <input
              type="text"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Optional"
              className="w-full bg-transparent text-right font-mono text-2xl text-brand-text placeholder:text-[#B9C0CB] focus:outline-none"
            />
          </Row>
        </section>

        <div className="px-4 pt-4">
          {convertedPreview && (
            <p className="font-mono text-sm text-brand-text-muted">Approx. {convertedPreview} IDR</p>
          )}
          {selectedEnv && (
            <p className="font-mono text-sm text-brand-text-muted">Envelope: {selectedEnv.name}</p>
          )}
          {error && <p className="mt-2 font-mono text-sm text-red-500">{error}</p>}
        </div>
      </form>
    </div>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex items-center justify-between gap-4 border-b border-brand-border px-4 py-4 last:border-b-0">
      <span className="font-mono text-2xl text-brand-text">{label}</span>
      <div className="min-w-0 flex-1">{children}</div>
    </label>
  );
}
