import { useState, useEffect, useMemo } from "react";
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
type SplitMode = "amount" | "percent";
interface SplitItem { envelope_id: string; value: string }

export default function TransactionEntry({
  open, onClose, onSaved, envelopes, dbUser, household, fxRates, defaultEnvelope,
}: Props) {
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("IDR");
  const [envelopeId, setEnvelopeId] = useState("");
  const [splitMode, setSplitMode] = useState<SplitMode>("amount");
  const [splits, setSplits] = useState<SplitItem[]>([]);
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
      setSplitMode("amount");
      const initialEnvelope = defaultEnvelope?.id ?? envelopes[0]?.id ?? "";
      setSplits(initialEnvelope ? [{ envelope_id: initialEnvelope, value: "" }] : []);
    }
  }, [open, defaultEnvelope, envelopes]);

  const orderedEnvelopes = useMemo(() => {
    return [...envelopes].sort((a, b) => {
      const aTripMatch = a.trip_id && a.budget_currency === currency ? 1 : 0;
      const bTripMatch = b.trip_id && b.budget_currency === currency ? 1 : 0;
      if (aTripMatch !== bTripMatch) return bTripMatch - aTripMatch;
      const aTrip = a.trip_id ? 1 : 0;
      const bTrip = b.trip_id ? 1 : 0;
      if (aTrip !== bTrip) return bTrip - aTrip;
      const aCurr = a.budget_currency === currency ? 1 : 0;
      const bCurr = b.budget_currency === currency ? 1 : 0;
      if (aCurr !== bCurr) return bCurr - aCurr;
      return a.name.localeCompare(b.name);
    });
  }, [envelopes, currency]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!envelopeId && splits.length === 0) { setError("select an envelope"); return; }
    setLoading(true);
    setError("");
    try {
      const amountMinor = parseToMinorUnits(amount, currency);
      if (amountMinor <= 0) throw new Error("enter amount");
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

      const finalSplits = buildFinalSplits({
        splits: splits.length > 0 ? splits : [{ envelope_id: envelopeId, value: "" }],
        mode: splitMode,
        totalAmountMinor: amountMinor,
        currency,
      });
      if (finalSplits.length === 0) throw new Error("add at least one split");
      const allocRows = finalSplits.map((s) => ({
        transaction_id: tx.id,
        envelope_id: s.envelope_id,
        amount: s.amountMinor,
      }));
      const { error: allocErr } = await supabase.from("transaction_allocations").insert(allocRows);
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

  function addSplit() {
    const fallback = orderedEnvelopes[0]?.id ?? "";
    setSplits((prev) => [...prev, { envelope_id: fallback, value: "" }]);
  }

  function removeSplit(idx: number) {
    setSplits((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateSplit(idx: number, patch: Partial<SplitItem>) {
    setSplits((prev) => {
      const next = prev.map((s, i) => (i === idx ? { ...s, ...patch } : s));
      if (splitMode === "amount" && next.length === 2 && patch.value !== undefined) {
        const totalMinor = parseToMinorUnits(amount || "0", currency);
        const enteredMinor = parseToMinorUnits(next[idx].value || "0", currency);
        const otherIdx = idx === 0 ? 1 : 0;
        const otherMinor = Math.max(0, totalMinor - enteredMinor);
        next[otherIdx] = { ...next[otherIdx], value: toMajorString(otherMinor, currency) };
      }
      return next;
    });
  }

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
              onChange={e => {
                setEnvelopeId(e.target.value);
                if (splits.length === 0) setSplits([{ envelope_id: e.target.value, value: "" }]);
              }}
              className="w-full bg-transparent text-right font-mono text-2xl text-brand-text focus:outline-none"
            >
              <optgroup label="Travel + same currency first">
                {orderedEnvelopes.filter(env => env.trip_id && env.budget_currency === currency).map(env => (
                  <option key={env.id} value={env.id}>✈ {env.name}</option>
                ))}
              </optgroup>
              <optgroup label="Other travel envelopes">
                {orderedEnvelopes.filter(env => env.trip_id && env.budget_currency !== currency).map(env => (
                  <option key={env.id} value={env.id}>✈ {env.name}</option>
                ))}
              </optgroup>
              <optgroup label="Regular envelopes">
                {orderedEnvelopes.filter(env => !env.trip_id).map(env => (
                  <option key={env.id} value={env.id}>{env.name}</option>
                ))}
              </optgroup>
            </select>
          </Row>
          <Row label="Account">
            <span className="font-mono text-2xl">{dbUser.display_name || "My Account"}</span>
          </Row>
          <div className="border-t border-brand-border px-4 py-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="font-mono text-sm text-brand-text-muted">Split</span>
              <div className="flex gap-2">
                <button type="button" onClick={() => setSplitMode("amount")} className={`rounded px-2 py-1 text-xs ${splitMode === "amount" ? "bg-brand-accent text-white" : "border border-brand-border text-brand-text-muted"}`}>amount</button>
                <button type="button" onClick={() => setSplitMode("percent")} className={`rounded px-2 py-1 text-xs ${splitMode === "percent" ? "bg-brand-accent text-white" : "border border-brand-border text-brand-text-muted"}`}>percent</button>
              </div>
            </div>
            <div className="space-y-2">
              {splits.map((split, idx) => (
                <div key={idx} className="grid grid-cols-[1fr_100px_28px] gap-2 rounded-lg border border-brand-border p-2">
                  <select
                    value={split.envelope_id}
                    onChange={(e) => updateSplit(idx, { envelope_id: e.target.value })}
                    className="bg-transparent text-sm text-brand-text focus:outline-none"
                  >
                    {orderedEnvelopes.map((env) => (
                      <option key={env.id} value={env.id}>{env.trip_id ? `✈ ${env.name}` : env.name}</option>
                    ))}
                  </select>
                  <input
                    value={split.value}
                    onChange={(e) => updateSplit(idx, { value: e.target.value })}
                    placeholder={splitMode === "amount" ? "0" : "%"}
                    className="bg-transparent text-right text-sm text-brand-text focus:outline-none"
                    inputMode="decimal"
                  />
                  <button type="button" onClick={() => removeSplit(idx)} className="text-brand-text-muted">×</button>
                </div>
              ))}
              <button type="button" onClick={addSplit} className="text-xs text-brand-accent">+ add split</button>
            </div>
          </div>
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

function buildFinalSplits(args: {
  splits: SplitItem[];
  mode: SplitMode;
  totalAmountMinor: number;
  currency: string;
}): Array<{ envelope_id: string; amountMinor: number }> {
  const { splits, mode, totalAmountMinor, currency } = args;
  const cleaned = splits.filter((s) => s.envelope_id);
  if (cleaned.length === 0) return [];
  if (cleaned.length === 1) return [{ envelope_id: cleaned[0].envelope_id, amountMinor: totalAmountMinor }];

  if (mode === "percent") {
    let used = 0;
    return cleaned.map((s, idx) => {
      if (idx === cleaned.length - 1) return { envelope_id: s.envelope_id, amountMinor: Math.max(0, totalAmountMinor - used) };
      const pct = Math.max(0, Number.parseFloat(s.value || "0"));
      const amt = Math.round((pct / 100) * totalAmountMinor);
      used += amt;
      return { envelope_id: s.envelope_id, amountMinor: amt };
    });
  }

  let used = 0;
  return cleaned.map((s, idx) => {
    if (idx === cleaned.length - 1) return { envelope_id: s.envelope_id, amountMinor: Math.max(0, totalAmountMinor - used) };
    const amt = parseToMinorUnits(s.value || "0", currency);
    used += amt;
    return { envelope_id: s.envelope_id, amountMinor: amt };
  });
}

function toMajorString(amountMinor: number, currency: string): string {
  const decimals = CURRENCY_DECIMALS[currency] ?? 2;
  return (amountMinor / Math.pow(10, decimals)).toFixed(decimals);
}
