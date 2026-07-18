import { useEffect, useMemo, useState } from "react";
import { useHousehold } from "@/context/HouseholdContext";
import { supabase } from "@/lib/supabase";
import type { Envelope } from "@/lib/types";
import { format } from "@/lib/currency";
import { parseQuickExpense } from "@/lib/quickExpenseParse";
import { saveTransaction } from "@/lib/saveTransaction";
import {
  aggregatePayeeHistoryFromTxs,
  buildPayeeHistoryMap,
  resolveEnvelopeForPayee,
} from "@/lib/payeeEnvelopeMatch";

export default function VoicePage() {
  const { household, dbUser, fxRates } = useHousehold();
  const [text, setText] = useState("");
  const [envelopes, setEnvelopes] = useState<Envelope[]>([]);
  const [payeeHistoryMap, setPayeeHistoryMap] = useState<Map<string, string>>(new Map());
  const [envelopeId, setEnvelopeId] = useState("");
  const [loading, setLoading] = useState(false);
  const [msg, setMsg] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    if (!household) return;
    let cancelled = false;
    (async () => {
      const [{ data: envs }, { data: txs }] = await Promise.all([
        supabase
          .from("envelopes")
          .select("*")
          .eq("household_id", household.id)
          .order("sort_order"),
        supabase
          .from("transactions")
          .select("merchant_name, allocations:transaction_allocations(envelope_id)")
          .eq("household_id", household.id)
          .not("merchant_name", "is", null)
          .order("created_at", { ascending: false })
          .limit(400),
      ]);
      if (cancelled) return;
      setEnvelopes((envs as Envelope[]) ?? []);
      setPayeeHistoryMap(buildPayeeHistoryMap(aggregatePayeeHistoryFromTxs(txs ?? [])));
    })();
    return () => { cancelled = true; };
  }, [household]);

  const parsed = useMemo(() => parseQuickExpense(text), [text]);

  useEffect(() => {
    if (!parsed) return;
    const match = resolveEnvelopeForPayee(parsed.merchant, envelopes, payeeHistoryMap);
    if (match) setEnvelopeId(match.id);
  }, [parsed, envelopes, payeeHistoryMap]);

  async function handleConfirm() {
    if (!household || !dbUser || !parsed) return;
    if (!envelopeId) {
      setError("pick an envelope");
      return;
    }
    setLoading(true);
    setError("");
    setMsg("");
    try {
      const { data: voiceRow } = await supabase
        .from("voice_commands")
        .insert({
          household_id: household.id,
          user_id: dbUser.id,
          transcript: parsed.raw,
          parsed_action: {
            amountMinor: parsed.amountMinor,
            currency: parsed.currency,
            merchant: parsed.merchant,
            envelopeId,
          },
          confirmed: false,
        })
        .select("id")
        .single();

      await saveTransaction({
        householdId: household.id,
        userId: dbUser.id,
        txType: "expense",
        amountMinor: parsed.amountMinor,
        currency: parsed.currency,
        date: new Date().toLocaleDateString("en-CA"),
        merchantName: parsed.merchant,
        notes: null,
        allocations: [{ envelope_id: envelopeId, amountMinor: parsed.amountMinor }],
        fxRates,
      });

      if (voiceRow?.id) {
        await supabase
          .from("voice_commands")
          .update({ confirmed: true })
          .eq("id", voiceRow.id);
      }

      setMsg(`logged ${format(parsed.amountMinor, parsed.currency)} · ${parsed.merchant}`);
      setText("");
      window.dispatchEvent(new CustomEvent("amplop:data-changed"));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setLoading(false);
    }
  }

  const selected = envelopes.find((e) => e.id === envelopeId);

  return (
    <div className="flex min-h-full flex-col bg-brand-surface">
      <div className="border-b border-brand-border bg-brand-accent px-4 pb-3 pt-5 text-white">
        <h1 className="font-mono text-2xl font-semibold tracking-tight">Quick log</h1>
        <p className="mt-1 font-mono text-xs text-white/80">type it like a note — confirm before it saves</p>
      </div>

      <div className="flex-1 space-y-4 p-4">
        <div>
          <label className="font-mono text-xs uppercase tracking-wider text-brand-text-muted">
            expense
          </label>
          <input
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="45.000rp ambrogio"
            className="mt-1 w-full rounded-xl border border-brand-border bg-brand-bg px-4 py-3 font-mono text-base text-brand-text placeholder:text-brand-text-muted focus:outline-none focus:ring-2 focus:ring-brand-accent"
            autoFocus
          />
          <p className="mt-1 font-mono text-[11px] text-brand-text-muted">
            examples: 500.000rp doctors visit · $12 coffee · 12 usd grab
          </p>
        </div>

        {text.trim() && !parsed && (
          <p className="font-mono text-sm text-amber-600">couldn’t parse that yet</p>
        )}

        {parsed && (
          <div className="rounded-2xl border border-brand-border bg-brand-bg p-4 font-mono">
            <p className="text-[10px] uppercase tracking-wider text-brand-text-muted">confirm</p>
            <p className="mt-1 text-2xl font-semibold text-brand-text">
              {format(parsed.amountMinor, parsed.currency)}
            </p>
            <p className="text-sm text-brand-text">{parsed.merchant}</p>

            <label className="mt-4 block text-[10px] uppercase tracking-wider text-brand-text-muted">
              envelope
            </label>
            <select
              value={envelopeId}
              onChange={(e) => setEnvelopeId(e.target.value)}
              className="mt-1 w-full rounded-xl border border-brand-border bg-brand-surface px-3 py-2 text-sm text-brand-text"
            >
              <option value="">select…</option>
              {envelopes.map((env) => (
                <option key={env.id} value={env.id}>
                  {env.trip_id ? `✈ ${env.name}` : env.name}
                  {(env.kind ?? "monthly") === "sinking" ? " (save-for)" : ""}
                </option>
              ))}
            </select>
            {selected && (
              <p className="mt-1 text-[11px] text-brand-text-muted">→ {selected.name}</p>
            )}

            <button
              type="button"
              disabled={loading || !envelopeId}
              onClick={handleConfirm}
              className="mt-4 w-full rounded-xl bg-brand-accent py-3 text-sm font-semibold text-white disabled:opacity-50"
            >
              {loading ? "saving…" : "log expense"}
            </button>
          </div>
        )}

        {msg && <p className="font-mono text-sm text-green-700">{msg}</p>}
        {error && <p className="font-mono text-sm text-red-500">{error}</p>}
      </div>
    </div>
  );
}
