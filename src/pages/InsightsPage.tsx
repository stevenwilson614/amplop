import { useState, useEffect, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import { useHousehold } from "@/context/HouseholdContext";
import { supabase } from "@/lib/supabase";
import type { Envelope, EnvelopeSpent } from "@/lib/types";
import { format, convert } from "@/lib/currency";
import WhaleMood from "@/components/ui/WhaleMood";
import {
  buildBudgetSnapshot,
  fetchBudgetInsights,
  executeTransfer,
  resolveSuggestion,
  type TransferSuggestion,
  type ChatMessage,
} from "@/lib/budgetInsights";

interface UiMessage {
  id: string;
  role: "user" | "assistant";
  author: string;
  content: string;
  suggestions?: TransferSuggestion[];
}

const QUICK_PROMPTS = [
  "How are we doing this month?",
  "Which envelopes are over budget?",
  "Where could we save money?",
];

export default function InsightsPage() {
  const { household, dbUser, fxRates } = useHousehold();
  const [envelopes, setEnvelopes] = useState<Envelope[]>([]);
  const [spentMap, setSpentMap] = useState<Record<string, number>>({});
  const [monthTxs, setMonthTxs] = useState<Array<{
    date: string;
    amount: number;
    amount_idr_snapshot: number;
    allocations?: { envelope_id: string; amount: number }[];
  }>>([]);
  const [messages, setMessages] = useState<UiMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [transferring, setTransferring] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    if (!household) return;
    const start = new Date();
    start.setMonth(start.getMonth() - 11);
    start.setDate(1);
    const startIso = start.toLocaleDateString("en-CA");

    const [{ data: envs }, { data: spent }, { data: txs }] = await Promise.all([
      supabase.from("envelopes").select("*").eq("household_id", household.id).is("trip_id", null),
      supabase.rpc("get_envelope_spent"),
      supabase
        .from("transactions")
        .select("date, amount, amount_idr_snapshot, allocations:transaction_allocations(envelope_id, amount)")
        .eq("household_id", household.id)
        .gte("date", startIso),
    ]);
    setEnvelopes(envs ?? []);
    setMonthTxs(txs ?? []);
    const map: Record<string, number> = {};
    for (const row of (spent as EnvelopeSpent[] ?? [])) map[row.envelope_id] = Number(row.spent_idr);
    setSpentMap(map);
  }, [household]);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    function onChange() { load(); }
    window.addEventListener("amplop:data-changed", onChange);
    return () => window.removeEventListener("amplop:data-changed", onChange);
  }, [load]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, loading]);

  const dc = dbUser?.display_currency ?? "IDR";
  const userName = dbUser?.display_name?.trim() || "You";

  function buildSnapshot() {
    return buildBudgetSnapshot({
      envelopes,
      spentMap,
      monthTxs,
      fxRates,
      displayCurrency: dc,
    });
  }

  function toApiHistory(msgs: UiMessage[]): ChatMessage[] {
    return msgs
      .filter((m) => m.role === "user" || m.role === "assistant")
      .slice(-10)
      .map((m) => ({ role: m.role, content: m.content }));
  }

  async function sendQuestion(question: string) {
    if (!dbUser || !household || !question.trim() || loading) return;
    const trimmed = question.trim();
    setInput("");
    setError("");

    const userMsg: UiMessage = {
      id: crypto.randomUUID(),
      role: "user",
      author: userName,
      content: trimmed,
    };
    setMessages((prev) => [...prev, userMsg]);
    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Not signed in");

      const result = await fetchBudgetInsights(buildSnapshot(), session.access_token, {
        question: trimmed,
        history: toApiHistory([...messages, userMsg]),
        userName,
      });

      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "assistant",
          author: "Insights",
          content: result.message,
          suggestions: result.suggestions?.length ? result.suggestions : undefined,
        },
      ]);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Could not get a response");
    } finally {
      setLoading(false);
    }
  }

  async function applyTransfer(suggestion: TransferSuggestion, messageId: string, index: number) {
    if (!dbUser || !household) return;
    const resolved = resolveSuggestion(suggestion, envelopes);
    if (!resolved) {
      setError("Could not match envelope names for transfer");
      return;
    }
    const key = `${messageId}-${index}`;
    setTransferring(key);
    setError("");
    try {
      await executeTransfer({
        householdId: household.id,
        userId: dbUser.id,
        fromEnvelopeId: resolved.fromId,
        toEnvelopeId: resolved.toId,
        amountIdr: resolved.amountIdr,
      });
      window.dispatchEvent(new CustomEvent("amplop:data-changed"));
      await load();
      setMessages((prev) => prev.map((m) => {
        if (m.id !== messageId) return m;
        return {
          ...m,
          suggestions: m.suggestions?.filter((_, i) => i !== index),
          content: `${m.content}\n\nDone — transferred ${format(resolved.amountIdr, "IDR")} from ${suggestion.fromEnvelope} to ${suggestion.toEnvelope}.`,
        };
      }));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Transfer failed");
    } finally {
      setTransferring(null);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    sendQuestion(input);
  }

  return (
    <div className="flex min-h-full flex-col">
      <div className="sticky top-0 z-10 border-b border-brand-border bg-brand-bg px-4 py-3">
        <div className="flex items-center justify-between">
          <h1 className="font-mono font-bold text-brand-text">Insights</h1>
          <Link to="/envelopes" className="font-mono text-xs text-brand-accent">← envelopes</Link>
        </div>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-auto px-4 py-4 pb-36">
        {messages.length === 0 && (
          <div className="mb-6 rounded-2xl border border-brand-border bg-brand-surface p-4 text-center">
            <WhaleMood happy className="mx-auto h-14 w-14" />
            <p className="mt-3 font-mono text-sm font-semibold text-brand-text">Ask about your budget</p>
            <p className="mt-1 font-mono text-xs leading-relaxed text-brand-text-muted">
              Olivia or {userName === "You" ? "you" : userName} can ask anything — spending trends, envelopes running low, or where to cut back.
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              {QUICK_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  type="button"
                  onClick={() => sendQuestion(prompt)}
                  disabled={loading || envelopes.length === 0}
                  className="rounded-full border border-brand-border bg-brand-bg px-3 py-1.5 font-mono text-[11px] text-brand-text disabled:opacity-50"
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="space-y-3">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[88%] rounded-2xl px-3 py-2 ${
                  msg.role === "user"
                    ? "bg-brand-accent text-white"
                    : "border border-brand-border bg-brand-surface text-brand-text"
                }`}
              >
                <p className="font-mono text-[10px] font-semibold opacity-70">{msg.author}</p>
                <p className="mt-0.5 whitespace-pre-wrap font-mono text-sm leading-relaxed">{msg.content}</p>
                {msg.suggestions?.map((s, i) => (
                  <div key={i} className="mt-2 rounded-xl border border-brand-border bg-brand-bg p-2">
                    <p className="font-mono text-[10px] text-brand-text-muted">{s.reason}</p>
                    <p className="mt-1 font-mono text-xs text-brand-text">
                      Move {format(s.amountIdr, "IDR")}: {s.fromEnvelope} → {s.toEnvelope}
                    </p>
                    <button
                      type="button"
                      disabled={transferring === `${msg.id}-${i}`}
                      onClick={() => applyTransfer(s, msg.id, i)}
                      className="mt-2 rounded-lg bg-brand-accent px-2.5 py-1 font-mono text-[10px] font-semibold text-white disabled:opacity-50"
                    >
                      {transferring === `${msg.id}-${i}` ? "Transferring..." : "Yes, transfer"}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="rounded-2xl border border-brand-border bg-brand-surface px-3 py-2">
                <p className="font-mono text-sm text-brand-text-muted">Thinking...</p>
              </div>
            </div>
          )}
        </div>

        {error && (
          <p className="mt-3 font-mono text-xs text-red-500">{error}</p>
        )}
      </div>

      <form
        onSubmit={handleSubmit}
        className="fixed inset-x-0 bottom-[5.75rem] z-[60] mx-auto max-w-[430px] px-3 pb-1"
      >
        <div className="flex items-center gap-2 rounded-full border border-brand-border bg-[rgba(235,238,242,0.98)] p-1.5 shadow-[0_4px_16px_rgba(16,18,23,0.12)] backdrop-blur-md">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={`Ask as ${userName}...`}
            disabled={loading || envelopes.length === 0}
            className="min-w-0 flex-1 bg-transparent px-3 py-2 font-mono text-sm text-brand-text placeholder:text-brand-text-muted focus:outline-none"
          />
          <button
            type="submit"
            disabled={loading || !input.trim() || envelopes.length === 0}
            className="shrink-0 rounded-full bg-brand-accent px-4 py-2 font-mono text-xs font-semibold text-white disabled:opacity-50"
          >
            Send
          </button>
        </div>
      </form>
    </div>
  );
}
