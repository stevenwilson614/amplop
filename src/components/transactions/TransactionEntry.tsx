import { useState, useEffect, useMemo } from "react";
import type { ReactNode } from "react";
import { supabase } from "@/lib/supabase";
import type { Envelope, DbUser, Household, FxRates, Category, TxType } from "@/lib/types";
import { parseToMinorUnits, getRate, convert, format, CURRENCY_DECIMALS } from "@/lib/currency";
import EnvelopePicker from "@/components/transactions/EnvelopePicker";
import PayeePicker from "@/components/transactions/PayeePicker";
import type { TransactionPrefill } from "@/context/TransactionModalContext";
import {
  aggregatePayeeHistoryFromTxs,
  buildPayeeHistoryMap,
  resolveEnvelopeForPayee,
} from "@/lib/payeeEnvelopeMatch";

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  envelopes: Envelope[];
  categories?: Category[];
  dbUser: DbUser;
  household: Household;
  fxRates: FxRates;
  defaultEnvelope?: Envelope;
  prefill?: TransactionPrefill;
}

const CURRENCIES = Object.keys(CURRENCY_DECIMALS);
const today = () => new Date().toLocaleDateString("en-CA");
type SplitMode = "amount" | "percent";
type Screen = "main" | "type" | "payee" | "envelope" | "from";
interface SplitItem { envelope_id: string; value: string }

const TX_TYPE_LABELS: Record<TxType, string> = {
  expense: "Expense",
  income: "Income",
  transfer: "Envelope transfer",
};

export default function TransactionEntry({
  open, onClose, onSaved, envelopes, categories = [], dbUser, household, fxRates, defaultEnvelope, prefill,
}: Props) {
  const [screen, setScreen] = useState<Screen>("main");
  const [txType, setTxType] = useState<TxType>("expense");
  const [amount, setAmount] = useState("");
  const [currency, setCurrency] = useState("IDR");
  const [envelopeId, setEnvelopeId] = useState("");
  const [fromEnvelopeId, setFromEnvelopeId] = useState("");
  const [splitMode, setSplitMode] = useState<SplitMode>("amount");
  const [splits, setSplits] = useState<SplitItem[]>([]);
  const [useSplits, setUseSplits] = useState(false);
  const [merchant, setMerchant] = useState("");
  const [notes, setNotes] = useState("");
  const [date, setDate] = useState(today());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [payeeHistoryMap, setPayeeHistoryMap] = useState<Map<string, string>>(new Map());
  const [lockEnvelope, setLockEnvelope] = useState(false);

  const regularEnvelopes = useMemo(
    () => envelopes.filter((e) => !e.trip_id),
    [envelopes]
  );

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

  useEffect(() => {
    if (!open) return;
    setScreen("main");
    setError("");
    setNotes("");
    setDate(today());
    setUseSplits(false);
    setCurrency("IDR");
    setSplitMode("amount");

    const matchedByName = prefill?.envelopeName
      ? envelopes.find((e) => e.name.toLowerCase().includes(prefill.envelopeName!.toLowerCase()))
      : undefined;
    const env = defaultEnvelope ?? matchedByName ?? envelopes[0];
    const initialId = env?.id ?? "";

    setTxType(prefill?.txType ?? "expense");
    setAmount(prefill?.amount ?? "");
    setMerchant(prefill?.merchant ?? "");
    setEnvelopeId(initialId);
    setFromEnvelopeId(initialId);
    setSplits(initialId ? [{ envelope_id: initialId, value: "" }] : []);
    setLockEnvelope(Boolean(defaultEnvelope?.id));
  }, [open, defaultEnvelope, envelopes, prefill]);

  useEffect(() => {
    if (!open || !household) return;
    let cancelled = false;
    async function loadPayeeHistory() {
      const { data } = await supabase
        .from("transactions")
        .select("merchant_name, allocations:transaction_allocations(envelope_id)")
        .eq("household_id", household.id)
        .not("merchant_name", "is", null)
        .order("created_at", { ascending: false })
        .limit(400);
      if (cancelled) return;
      const rows = aggregatePayeeHistoryFromTxs(data ?? []);
      setPayeeHistoryMap(buildPayeeHistoryMap(rows));
    }
    loadPayeeHistory();
    return () => { cancelled = true; };
  }, [open, household]);

  useEffect(() => {
    if (!open || lockEnvelope || txType !== "expense" || useSplits || !merchant.trim()) return;
    const match = resolveEnvelopeForPayee(merchant, orderedEnvelopes, payeeHistoryMap);
    if (match && match.id !== envelopeId) {
      setEnvelopeId(match.id);
      setSplits([{ envelope_id: match.id, value: "" }]);
    }
  }, [merchant, payeeHistoryMap, lockEnvelope, txType, useSplits, open, orderedEnvelopes, envelopeId]);

  useEffect(() => {
    if (txType !== "transfer") return;
    setUseSplits(true);
    setSplits((prev) => {
      if (prev.length > 0) return prev;
      const dest = orderedEnvelopes.find((e) => e.id !== fromEnvelopeId);
      return [{ envelope_id: dest?.id ?? orderedEnvelopes[0]?.id ?? "", value: "" }];
    });
  }, [txType, fromEnvelopeId, orderedEnvelopes]);

  async function handleSave(e?: React.FormEvent) {
    e?.preventDefault();
    setLoading(true);
    setError("");
    try {
      const amountMinor = parseToMinorUnits(amount, currency);
      if (amountMinor <= 0) throw new Error("enter amount");

      const amountIdr = convert(amountMinor, currency, "IDR", fxRates);
      const fxRate = currency === "IDR" ? 1 : getRate(fxRates, currency, "IDR");

      const allocRows = buildAllocationRows({
        txType,
        amountMinor,
        envelopeId,
        fromEnvelopeId,
        useSplits,
        splits,
        splitMode,
        currency,
      });
      if (allocRows.length === 0) throw new Error("select envelope(s)");

      const { data: tx, error: txErr } = await supabase
        .from("transactions")
        .insert({
          household_id: household.id,
          user_id: dbUser.id,
          tx_type: txType,
          amount: amountMinor,
          currency,
          amount_idr_snapshot: amountIdr,
          fx_rate_snapshot: fxRate,
          date,
          merchant_name: txType === "transfer" ? null : (merchant || null),
          notes: notes || null,
        })
        .select()
        .single();
      if (txErr) throw txErr;

      const { error: allocErr } = await supabase.from("transaction_allocations").insert(
        allocRows.map((a) => ({
          transaction_id: tx.id,
          envelope_id: a.envelope_id,
          amount: a.amountMinor,
        }))
      );
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

  const selectedEnv = envelopes.find((e) => e.id === envelopeId);
  const fromEnv = envelopes.find((e) => e.id === fromEnvelopeId);
  const convertedPreview = currency !== "IDR" && amount
    ? format(convert(parseToMinorUnits(amount, currency), currency, "IDR", fxRates), "IDR")
    : null;

  function addSplit() {
    const fallback = orderedEnvelopes.find((e) => e.id !== fromEnvelopeId)?.id ?? orderedEnvelopes[0]?.id ?? "";
    setSplits((prev) => [...prev, { envelope_id: fallback, value: "" }]);
    setUseSplits(true);
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

  if (screen === "payee" && txType === "expense") {
    return (
      <PayeePicker
        householdId={household.id}
        value={merchant}
        onSelect={(name) => {
          setMerchant(name);
          if (!lockEnvelope && txType === "expense" && !useSplits) {
            const match = resolveEnvelopeForPayee(name, orderedEnvelopes, payeeHistoryMap);
            if (match) {
              setEnvelopeId(match.id);
              setSplits([{ envelope_id: match.id, value: "" }]);
            }
          }
        }}
        onClose={() => setScreen("main")}
      />
    );
  }

  if (screen === "type") {
    return (
      <PickerShell title="Type" onBack={() => setScreen("main")}>
        {(["expense", "income", "transfer"] as TxType[]).map((type) => (
          <button
            key={type}
            type="button"
            onClick={() => {
              setTxType(type);
              setUseSplits(false);
              setScreen("main");
            }}
            className="flex w-full items-center justify-between border-b border-brand-border px-4 py-4 text-left"
          >
            <span className="text-xl text-brand-text">{TX_TYPE_LABELS[type]}</span>
            {txType === type && <span className="text-brand-accent">✓</span>}
          </button>
        ))}
      </PickerShell>
    );
  }

  if (screen === "envelope") {
    return (
      <EnvelopePicker
        envelopes={orderedEnvelopes}
        categories={categories}
        selectedId={envelopeId}
        displayCurrency={dbUser.display_currency}
        fxRates={fxRates}
        allowSplit={txType !== "transfer"}
        onSelect={(id) => {
          setEnvelopeId(id);
          setUseSplits(false);
          setLockEnvelope(true);
          setScreen("main");
        }}
        onSplitSelect={() => { setUseSplits(true); setScreen("main"); }}
        onClose={() => setScreen("main")}
      />
    );
  }

  if (screen === "from") {
    return (
      <EnvelopePicker
        envelopes={regularEnvelopes.length ? regularEnvelopes : orderedEnvelopes}
        categories={categories}
        selectedId={fromEnvelopeId}
        displayCurrency={dbUser.display_currency}
        fxRates={fxRates}
        allowSplit={false}
        onSelect={(id) => { setFromEnvelopeId(id); setScreen("main"); }}
        onClose={() => setScreen("main")}
      />
    );
  }

  const envelopeLabel = useSplits
    ? `${splits.length} envelopes`
    : (selectedEnv ? (selectedEnv.trip_id ? `✈ ${selectedEnv.name}` : selectedEnv.name) : "Select");

  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-brand-bg sm:mx-auto sm:h-[896px] sm:max-w-[430px] sm:overflow-hidden sm:rounded-[34px]">
      <div className="flex items-center justify-between bg-brand-accent px-4 pb-3 pt-5 text-white">
        <button onClick={onClose} className="rounded-full bg-[#8AF4A6] px-3 py-2 font-mono text-sm font-semibold text-[#0F3C1B]">✕</button>
        <h1 className="font-mono text-2xl font-semibold">Add Transaction</h1>
        <button
          onClick={() => handleSave()}
          disabled={loading || !amount}
          className="rounded-full bg-[#8AF4A6] px-4 py-2 font-mono text-sm font-semibold text-[#0F3C1B] disabled:opacity-40"
        >
          {loading ? "..." : "Save"}
        </button>
      </div>

      <form onSubmit={handleSave} className="flex-1 overflow-auto bg-brand-bg pb-10">
        <section className="mt-4 border-y border-brand-border bg-brand-surface">
          <TappableRow label="Type" onClick={() => setScreen("type")}>
            <span className="font-mono text-2xl font-medium">{TX_TYPE_LABELS[txType]}</span>
          </TappableRow>

          {txType === "expense" && (
            <TappableRow label="Payee" onClick={() => setScreen("payee")}>
              <span className={`font-mono text-2xl ${merchant ? "text-brand-text" : "text-[#B9C0CB]"}`}>
                {merchant || "Who received payment?"}
              </span>
            </TappableRow>
          )}

          <Row label="Amount">
            <div className="flex items-center justify-end gap-2">
              <input
                type="text"
                inputMode="decimal"
                value={amount}
                onChange={(e) => setAmount(e.target.value.replace(/[^0-9.]/g, ""))}
                placeholder="0"
                className="w-full bg-transparent text-right font-mono text-2xl text-brand-text placeholder:text-[#B9C0CB] focus:outline-none"
              />
              <span className="font-mono text-xl text-brand-text-muted">IDR</span>
            </div>
          </Row>

          {txType === "transfer" ? (
            <TappableRow label="From" onClick={() => setScreen("from")}>
              <span className="font-mono text-2xl text-brand-text">{fromEnv?.name ?? "Select"}</span>
            </TappableRow>
          ) : (
            <TappableRow label="Envelope" onClick={() => setScreen("envelope")}>
              <span className="font-mono text-2xl text-brand-text">{envelopeLabel}</span>
            </TappableRow>
          )}

          <Row label="Account">
            <span className="font-mono text-2xl">{dbUser.display_name || "My Account"}</span>
          </Row>

          {(useSplits || txType === "transfer") && (
            <div className="border-t border-brand-border px-4 py-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="font-mono text-sm text-brand-text-muted">
                  {txType === "transfer" ? "To envelopes" : "Split"}
                </span>
                {(txType === "income" || txType === "transfer") && (
                  <div className="flex gap-2">
                    <button type="button" onClick={() => setSplitMode("amount")} className={`rounded px-2 py-1 text-xs ${splitMode === "amount" ? "bg-brand-accent text-white" : "border border-brand-border text-brand-text-muted"}`}>amount</button>
                    <button type="button" onClick={() => setSplitMode("percent")} className={`rounded px-2 py-1 text-xs ${splitMode === "percent" ? "bg-brand-accent text-white" : "border border-brand-border text-brand-text-muted"}`}>percent</button>
                  </div>
                )}
              </div>
              <div className="space-y-2">
                {(txType === "transfer" ? splits : splits).map((split, idx) => (
                  <div key={idx} className="grid grid-cols-[1fr_100px_28px] gap-2 rounded-lg border border-brand-border p-2">
                    <select
                      value={split.envelope_id}
                      onChange={(e) => updateSplit(idx, { envelope_id: e.target.value })}
                      className="bg-transparent text-sm text-brand-text focus:outline-none"
                    >
                      {orderedEnvelopes
                        .filter((env) => txType !== "transfer" || env.id !== fromEnvelopeId)
                        .map((env) => (
                          <option key={env.id} value={env.id}>{env.trip_id ? `✈ ${env.name}` : env.name}</option>
                        ))}
                    </select>
                    <input
                      value={split.value}
                      onChange={(e) => updateSplit(idx, { value: e.target.value })}
                      placeholder={splitMode === "amount" ? "0" : "%"}
                      inputMode="decimal"
                      className="bg-transparent text-right text-sm text-brand-text focus:outline-none"
                    />
                    <button type="button" onClick={() => removeSplit(idx)} className="text-brand-text-muted">×</button>
                  </div>
                ))}
                <button type="button" onClick={addSplit} className="text-xs text-brand-accent">+ add split</button>
              </div>
            </div>
          )}
        </section>

        <div className="px-4 py-2 font-mono text-3xl font-semibold text-brand-text-muted">Details</div>

        <section className="border-y border-brand-border bg-brand-surface">
          <Row label="Date">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="bg-transparent text-right font-mono text-2xl text-brand-text focus:outline-none"
            />
          </Row>
          <Row label="Notes">
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional"
              className="w-full bg-transparent text-right font-mono text-2xl text-brand-text placeholder:text-[#B9C0CB] focus:outline-none"
            />
          </Row>
        </section>

        <div className="px-4 pt-4">
          {convertedPreview && (
            <p className="font-mono text-sm text-brand-text-muted">Approx. {convertedPreview}</p>
          )}
          {error && <p className="mt-2 font-mono text-sm text-red-500">{error}</p>}
        </div>
      </form>
    </div>
  );
}

function PickerShell({ title, onBack, children }: { title: string; onBack: () => void; children: ReactNode }) {
  return (
    <div className="fixed inset-0 z-[85] flex flex-col bg-brand-bg sm:mx-auto sm:h-[896px] sm:max-w-[430px] sm:overflow-hidden sm:rounded-[34px]">
      <div className="flex items-center justify-between bg-brand-accent px-4 pb-3 pt-5 text-white">
        <button type="button" onClick={onBack} className="rounded-full bg-[#8AF4A6] px-4 py-2 text-sm font-semibold text-[#0F3C1B]">Back</button>
        <h1 className="text-xl font-semibold">{title}</h1>
        <div className="w-16" />
      </div>
      <div className="flex-1 overflow-auto">{children}</div>
    </div>
  );
}

function TappableRow({ label, onClick, children }: { label: string; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" onClick={onClick} className="flex w-full items-center justify-between gap-4 border-b border-brand-border px-4 py-4 last:border-b-0">
      <span className="font-mono text-2xl text-brand-text">{label}</span>
      <div className="min-w-0 flex-1 text-right">{children}</div>
      <span className="text-brand-text-muted">›</span>
    </button>
  );
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="flex items-center justify-between gap-4 border-b border-brand-border px-4 py-4 last:border-b-0">
      <span className="font-mono text-2xl text-brand-text">{label}</span>
      <div className="min-w-0 flex-1 text-right">{children}</div>
    </label>
  );
}

function buildAllocationRows(args: {
  txType: TxType;
  amountMinor: number;
  envelopeId: string;
  fromEnvelopeId: string;
  useSplits: boolean;
  splits: SplitItem[];
  splitMode: SplitMode;
  currency: string;
}): Array<{ envelope_id: string; amountMinor: number }> {
  const { txType, amountMinor, envelopeId, fromEnvelopeId, useSplits, splits, splitMode, currency } = args;

  if (txType === "expense") {
    const finalSplits = useSplits
      ? buildFinalSplits({ splits, mode: splitMode, totalAmountMinor: amountMinor, currency })
      : [{ envelope_id: envelopeId, amountMinor: amountMinor }];
    return finalSplits.filter((s) => s.envelope_id);
  }

  if (txType === "income") {
    const targets = useSplits
      ? buildFinalSplits({ splits, mode: splitMode, totalAmountMinor: amountMinor, currency })
      : [{ envelope_id: envelopeId, amountMinor: amountMinor }];
    return targets
      .filter((s) => s.envelope_id)
      .map((s) => ({ envelope_id: s.envelope_id, amountMinor: -Math.abs(s.amountMinor) }));
  }

  // transfer: debit source, credit destinations
  const destinations = buildFinalSplits({
    splits: splits.length > 0 ? splits : [{ envelope_id: envelopeId, value: "" }],
    mode: splitMode,
    totalAmountMinor: amountMinor,
    currency,
  }).filter((s) => s.envelope_id && s.envelope_id !== fromEnvelopeId);

  if (!fromEnvelopeId || destinations.length === 0) return [];
  return [
    { envelope_id: fromEnvelopeId, amountMinor: amountMinor },
    ...destinations.map((s) => ({ envelope_id: s.envelope_id, amountMinor: -Math.abs(s.amountMinor) })),
  ];
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
