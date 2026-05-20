import type { Envelope } from "@/lib/types";
import { convert } from "@/lib/currency";
import type { FxRates } from "@/lib/types";
import { supabase } from "@/lib/supabase";

export interface MonthSpend {
  month: string;
  spentIdr: number;
}

export interface EnvelopeSnapshot {
  id: string;
  name: string;
  monthlyBudgetIdr: number;
  totalSpentIdr: number;
  balanceIdr: number;
  monthHistory: MonthSpend[];
}

export interface BudgetSnapshot {
  displayCurrency: string;
  generatedAt: string;
  envelopes: EnvelopeSnapshot[];
}

interface TxRow {
  date: string;
  amount: number;
  amount_idr_snapshot: number;
  allocations?: { envelope_id: string; amount: number }[];
}

export function buildBudgetSnapshot(args: {
  envelopes: Envelope[];
  spentMap: Record<string, number>;
  monthTxs: TxRow[];
  fxRates: FxRates;
  displayCurrency: string;
  monthsBack?: number;
}): BudgetSnapshot {
  const { envelopes, spentMap, monthTxs, fxRates, displayCurrency, monthsBack = 6 } = args;

  const monthKeys = lastMonths(monthsBack);
  const historyMap: Record<string, Record<string, number>> = {};

  for (const tx of monthTxs) {
    const month = tx.date.slice(0, 7);
    if (!monthKeys.includes(month)) continue;
    const total = Number(tx.amount) || 0;
    const totalIdr = Number(tx.amount_idr_snapshot) || 0;
    if (!total || !tx.allocations) continue;
    for (const alloc of tx.allocations) {
      const allocMinor = Number(alloc.amount) || 0;
      const allocIdr = Math.round((allocMinor / total) * totalIdr);
      if (!historyMap[alloc.envelope_id]) historyMap[alloc.envelope_id] = {};
      historyMap[alloc.envelope_id][month] = (historyMap[alloc.envelope_id][month] ?? 0) + allocIdr;
    }
  }

  const envelopeSnapshots: EnvelopeSnapshot[] = envelopes.map((env) => {
    const monthlyBudgetIdr = env.budget_currency === "IDR"
      ? env.budget_amount
      : convert(env.budget_amount, env.budget_currency, "IDR", fxRates);
    const totalSpentIdr = spentMap[env.id] ?? 0;

    return {
      id: env.id,
      name: env.name,
      monthlyBudgetIdr,
      totalSpentIdr,
      balanceIdr: monthlyBudgetIdr - totalSpentIdr,
      monthHistory: monthKeys.map((month) => ({
        month,
        spentIdr: historyMap[env.id]?.[month] ?? 0,
      })),
    };
  });

  return {
    displayCurrency,
    generatedAt: new Date().toISOString(),
    envelopes: envelopeSnapshots,
  };
}

function lastMonths(count: number): string[] {
  const keys: string[] = [];
  const now = new Date();
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    keys.push(d.toLocaleDateString("en-CA").slice(0, 7));
  }
  return keys;
}

export interface TransferSuggestion {
  fromEnvelope: string;
  toEnvelope: string;
  amountIdr: number;
  reason: string;
}

export interface InsightResponse {
  message: string;
  suggestions: TransferSuggestion[];
}

export function speakInsight(text: string) {
  if (!("speechSynthesis" in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.95;
  window.speechSynthesis.speak(utterance);
}

export async function fetchBudgetInsights(snapshot: BudgetSnapshot, accessToken: string): Promise<InsightResponse> {
  const res = await fetch(
    `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/budget-insights`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      body: JSON.stringify({ snapshot }),
    }
  );

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? `Insights failed (${res.status})`);
  }

  return res.json();
}

export async function executeTransfer(args: {
  householdId: string;
  userId: string;
  fromEnvelopeId: string;
  toEnvelopeId: string;
  amountIdr: number;
}): Promise<void> {
  const { householdId, userId, fromEnvelopeId, toEnvelopeId, amountIdr } = args;
  const today = new Date().toLocaleDateString("en-CA");

  const { data: tx, error: txErr } = await supabase
    .from("transactions")
    .insert({
      household_id: householdId,
      user_id: userId,
      tx_type: "transfer",
      amount: amountIdr,
      currency: "IDR",
      amount_idr_snapshot: amountIdr,
      fx_rate_snapshot: 1,
      date: today,
      merchant_name: null,
      notes: "AI suggested transfer",
    })
    .select()
    .single();
  if (txErr) throw txErr;

  const { error: allocErr } = await supabase.from("transaction_allocations").insert([
    { transaction_id: tx.id, envelope_id: fromEnvelopeId, amount: amountIdr },
    { transaction_id: tx.id, envelope_id: toEnvelopeId, amount: -amountIdr },
  ]);
  if (allocErr) throw allocErr;
}

function findEnvelopeId(envelopes: Envelope[], name: string): string | undefined {
  const q = name.trim().toLowerCase();
  return envelopes.find((e) => e.name.toLowerCase() === q)?.id
    ?? envelopes.find((e) => e.name.toLowerCase().includes(q))?.id;
}

export function resolveSuggestion(
  suggestion: TransferSuggestion,
  envelopes: Envelope[]
): { fromId: string; toId: string; amountIdr: number } | null {
  const fromId = findEnvelopeId(envelopes, suggestion.fromEnvelope);
  const toId = findEnvelopeId(envelopes, suggestion.toEnvelope);
  if (!fromId || !toId || fromId === toId || suggestion.amountIdr <= 0) return null;
  return { fromId, toId, amountIdr: Math.round(suggestion.amountIdr) };
}
