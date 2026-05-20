import { supabase } from "@/lib/supabase";
import type { Envelope } from "@/lib/types";
import { parseToMinorUnits } from "@/lib/currency";
import { splitCsvLine, normalizeDate } from "@/lib/importHistory";

export const GOODBUDGET_IMPORT_NOTE = "Goodbudget import";

export type GoodbudgetTxKind = "expense" | "transfer" | "income" | "skip";

export interface GoodbudgetRow {
  date: string;
  envelopeRaw: string;
  envelopeKey: string;
  merchant: string;
  amountMinor: number;
  kind: GoodbudgetTxKind;
}

export interface GoodbudgetImportPreview {
  expenses: number;
  transfers: number;
  skipped: number;
  envelopeNames: string[];
  monthlyBudgets: Record<string, number>;
  unmapped: string[];
}

export interface GoodbudgetImportResult {
  imported: number;
  transfers: number;
  skipped: number;
  budgetsUpdated: number;
  errors: string[];
}

function parseCsvAmount(raw: string): number {
  const cleaned = raw.trim().replace(/[^\d.,-]/g, "");
  if (!cleaned) return 0;
  const neg = cleaned.startsWith("-");
  const digits = cleaned.replace(/-/g, "").replace(/,/g, "");
  if (!digits) return 0;
  const minor = parseToMinorUnits(digits, "IDR");
  return neg ? -minor : minor;
}

const SKIP_NAMES = new Set([
  "Fill Envelopes",
  "Fill from Available",
  "Fill from Unallocated",
]);

export function normalizeGoodbudgetEnvelope(raw: string): string {
  const trimmed = raw.trim().replace(/\s+/g, " ");
  if (!trimmed) return "";
  if (trimmed.includes(":")) {
    const parts = trimmed.split(":").map((p) => p.trim()).filter(Boolean);
    return parts[parts.length - 1] ?? trimmed;
  }
  return trimmed;
}

export function isGoodbudgetCsv(text: string): boolean {
  const first = text.trim().split(/\r?\n/)[0]?.toLowerCase() ?? "";
  return first.includes("envelope") && first.includes("date") && first.includes("amount");
}

export function parseGoodbudgetCsv(text: string): GoodbudgetRow[] {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];

  const header = splitCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  const dateIdx = header.findIndex((h) => h === "date");
  const envIdx = header.findIndex((h) => h === "envelope");
  const nameIdx = header.findIndex((h) => h === "name");
  const amtIdx = header.findIndex((h) => h === "amount");
  if (dateIdx < 0 || envIdx < 0 || nameIdx < 0 || amtIdx < 0) {
    throw new Error("Not a Goodbudget export (expected Date, Envelope, Name, Amount columns)");
  }

  const parsed: GoodbudgetRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i]);
    const dateRaw = cols[dateIdx]?.trim();
    const envelopeRaw = cols[envIdx]?.trim() ?? "";
    const name = cols[nameIdx]?.trim() ?? "";
    const amountRaw = cols[amtIdx]?.trim() ?? "";
    const date = dateRaw ? normalizeDate(dateRaw) : null;
    const amountMinor = parseCsvAmount(amountRaw);
    if (!date) continue;

    if (name === "Income") {
      parsed.push({
        date,
        envelopeRaw,
        envelopeKey: "",
        merchant: name,
        amountMinor: Math.abs(amountMinor),
        kind: "income",
      });
      continue;
    }

    if (name === "Envelope Transfer") {
      if (!envelopeRaw || amountMinor === 0) continue;
      parsed.push({
        date,
        envelopeRaw,
        envelopeKey: normalizeGoodbudgetEnvelope(envelopeRaw),
        merchant: "Envelope Transfer",
        amountMinor,
        kind: "transfer",
      });
      continue;
    }

    if (SKIP_NAMES.has(name) || !envelopeRaw || amountMinor === 0) {
      parsed.push({
        date,
        envelopeRaw,
        envelopeKey: normalizeGoodbudgetEnvelope(envelopeRaw),
        merchant: name,
        amountMinor,
        kind: "skip",
      });
      continue;
    }

    if (amountMinor < 0) {
      parsed.push({
        date,
        envelopeRaw,
        envelopeKey: normalizeGoodbudgetEnvelope(envelopeRaw),
        merchant: name,
        amountMinor: Math.abs(amountMinor),
        kind: "expense",
      });
    } else if (amountMinor > 0) {
      parsed.push({
        date,
        envelopeRaw,
        envelopeKey: normalizeGoodbudgetEnvelope(envelopeRaw),
        merchant: name,
        amountMinor,
        kind: "income",
      });
    }
  }

  return parsed;
}

export function previewGoodbudgetImport(
  rows: GoodbudgetRow[],
  envelopes: Envelope[]
): GoodbudgetImportPreview {
  const envelopeNames = [...new Set(rows.filter((r) => r.kind === "expense").map((r) => r.envelopeKey))];
  const monthlyBudgets = computeMonthlyBudgets(rows);
  const unmapped = envelopeNames.filter((name) => !findEnvelope(envelopes, name));

  return {
    expenses: rows.filter((r) => r.kind === "expense").length,
    transfers: rows.filter((r) => r.kind === "transfer").length / 2,
    skipped: rows.filter((r) => r.kind === "skip").length,
    envelopeNames,
    monthlyBudgets,
    unmapped,
  };
}

export function computeMonthlyBudgets(rows: GoodbudgetRow[], monthsBack = 6): Record<string, number> {
  const now = new Date();
  const cutoff = new Date(now.getFullYear(), now.getMonth() - (monthsBack - 1), 1);
  const monthTotals: Record<string, Record<string, number>> = {};
  const monthMtd: Record<string, number> = {};

  for (const row of rows) {
    if (row.kind !== "expense" || !row.envelopeKey) continue;
    const d = new Date(`${row.date}T12:00:00`);
    const monthKey = row.date.slice(0, 7);
    if (d >= cutoff) {
      if (!monthTotals[row.envelopeKey]) monthTotals[row.envelopeKey] = {};
      monthTotals[row.envelopeKey][monthKey] = (monthTotals[row.envelopeKey][monthKey] ?? 0) + row.amountMinor;
    }
    if (monthKey === now.toLocaleDateString("en-CA").slice(0, 7)) {
      monthMtd[row.envelopeKey] = (monthMtd[row.envelopeKey] ?? 0) + row.amountMinor;
    }
  }

  const budgets: Record<string, number> = {};
  for (const [envKey, months] of Object.entries(monthTotals)) {
    const vals = Object.values(months);
    const avg = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
    const mtd = monthMtd[envKey] ?? 0;
    const day = now.getDate();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const projected = day > 0 ? Math.round((mtd / day) * daysInMonth) : mtd;
    budgets[envKey] = roundBudget(Math.max(avg, projected, mtd));
  }
  return budgets;
}

function roundBudget(amount: number): number {
  if (amount <= 0) return 0;
  if (amount < 500_000) return Math.ceil(amount / 50_000) * 50_000;
  return Math.ceil(amount / 100_000) * 100_000;
}

const ENVELOPE_ALIASES: Record<string, string[]> = {
  "groceries": ["food: groceries"],
  "eating out": ["food: eating out"],
  "giving": ["giving"],
  "olivia": ["personal: olivia"],
  "steven": ["personal: steven"],
  "grab / gas": ["grab / gas", "grab/gas"],
  "vacation / fun": ["vacation / fun", "vacation/fun"],
  "house maintenance": ["house maintenance", "house mainetence"],
  "rocky": ["rocky"],
  "private classes": ["private classes", "private class"],
};

export function findEnvelope(envelopes: Envelope[], key: string): Envelope | undefined {
  const q = key.trim().toLowerCase();
  if (!q) return undefined;

  for (const env of envelopes) {
    const names = [env.name, normalizeGoodbudgetEnvelope(env.name)].map((n) => n.toLowerCase());
    if (names.includes(q) || names.some((n) => n.includes(q) || q.includes(n))) return env;
  }

  for (const [canonical, aliases] of Object.entries(ENVELOPE_ALIASES)) {
    if (q === canonical || aliases.includes(q)) {
      return envelopes.find((e) => e.name.toLowerCase() === canonical)
        ?? envelopes.find((e) => normalizeGoodbudgetEnvelope(e.name).toLowerCase() === canonical);
    }
    if (aliases.some((a) => a.toLowerCase() === q) || canonical === q) {
      return envelopes.find((e) => e.name.toLowerCase() === canonical)
        ?? envelopes.find((e) => normalizeGoodbudgetEnvelope(e.name).toLowerCase() === canonical);
    }
  }

  return undefined;
}

function pairTransfers(rows: GoodbudgetRow[]): Array<{ date: string; fromKey: string; toKey: string; amountMinor: number }> {
  const transfers = rows.filter((r) => r.kind === "transfer");
  const used = new Set<number>();
  const pairs: Array<{ date: string; fromKey: string; toKey: string; amountMinor: number }> = [];

  for (let i = 0; i < transfers.length; i++) {
    if (used.has(i)) continue;
    const a = transfers[i];
    for (let j = i + 1; j < transfers.length; j++) {
      if (used.has(j)) continue;
      const b = transfers[j];
      if (a.date !== b.date) continue;
      if (Math.abs(a.amountMinor) !== Math.abs(b.amountMinor)) continue;
      if (a.amountMinor === b.amountMinor) continue;
      const from = a.amountMinor < 0 ? a : b;
      const to = a.amountMinor > 0 ? a : b;
      pairs.push({
        date: a.date,
        fromKey: from.envelopeKey,
        toKey: to.envelopeKey,
        amountMinor: Math.abs(a.amountMinor),
      });
      used.add(i);
      used.add(j);
      break;
    }
  }
  return pairs;
}

function earliestDateForEnvelope(rows: GoodbudgetRow[], envelopeKey: string): string | null {
  let earliest: string | null = null;
  for (const row of rows) {
    if (row.envelopeKey !== envelopeKey) continue;
    if (!earliest || row.date < earliest) earliest = row.date;
  }
  return earliest;
}

export async function syncEnvelopeBudgetsFromGoodbudget(args: {
  rows: GoodbudgetRow[];
  envelopes: Envelope[];
}): Promise<number> {
  const { rows, envelopes } = args;
  const budgets = computeMonthlyBudgets(rows);
  let updated = 0;

  for (const env of envelopes) {
    const key = normalizeGoodbudgetEnvelope(env.name);
    const altKeys = [key, env.name];
    let budget = 0;
    for (const k of altKeys) {
      if (budgets[k]) { budget = budgets[k]; break; }
    }
    if (!budget) continue;

    const firstDate = earliestDateForEnvelope(rows, key)
      ?? rows.find((r) => r.envelopeRaw.includes(env.name))?.date
      ?? "2023-12-01";

    const { error } = await supabase
      .from("envelopes")
      .update({
        budget_amount: budget,
        budget_currency: "IDR",
        created_at: `${firstDate}T00:00:00.000Z`,
      })
      .eq("id", env.id);
    if (!error) updated++;
  }
  return updated;
}

export async function clearGoodbudgetImports(householdId: string): Promise<void> {
  const { data: txs } = await supabase
    .from("transactions")
    .select("id")
    .eq("household_id", householdId)
    .like("notes", `${GOODBUDGET_IMPORT_NOTE}%`);

  const ids = (txs ?? []).map((t) => t.id);
  if (ids.length === 0) return;

  for (let i = 0; i < ids.length; i += 100) {
    const chunk = ids.slice(i, i + 100);
    await supabase.from("transaction_allocations").delete().in("transaction_id", chunk);
    await supabase.from("transactions").delete().in("id", chunk);
  }
}

async function insertExpenseBatch(args: {
  items: Array<{ row: GoodbudgetRow; envelopeId: string }>;
  householdId: string;
  userId: string;
}): Promise<number> {
  const { items, householdId, userId } = args;
  if (items.length === 0) return 0;

  const txRows = items.map(({ row }) => ({
    household_id: householdId,
    user_id: userId,
    tx_type: "expense" as const,
    amount: row.amountMinor,
    currency: "IDR",
    amount_idr_snapshot: row.amountMinor,
    fx_rate_snapshot: 1,
    date: row.date,
    merchant_name: row.merchant || null,
    notes: `${GOODBUDGET_IMPORT_NOTE} ${row.date}`,
  }));

  const { data: txs, error: txErr } = await supabase
    .from("transactions")
    .insert(txRows)
    .select("id");
  if (txErr || !txs?.length) return 0;

  const allocRows = txs.map((tx, i) => ({
    transaction_id: tx.id,
    envelope_id: items[i].envelopeId,
    amount: items[i].row.amountMinor,
  }));

  const { error: allocErr } = await supabase.from("transaction_allocations").insert(allocRows);
  return allocErr ? 0 : txs.length;
}

async function insertTransfer(args: {
  date: string;
  fromId: string;
  toId: string;
  amountMinor: number;
  householdId: string;
  userId: string;
}): Promise<boolean> {
  const { date, fromId, toId, amountMinor, householdId, userId } = args;
  const { data: tx, error: txErr } = await supabase
    .from("transactions")
    .insert({
      household_id: householdId,
      user_id: userId,
      tx_type: "transfer",
      amount: amountMinor,
      currency: "IDR",
      amount_idr_snapshot: amountMinor,
      fx_rate_snapshot: 1,
      date,
      merchant_name: null,
      notes: `${GOODBUDGET_IMPORT_NOTE} transfer ${date}`,
    })
    .select("id")
    .single();
  if (txErr || !tx) return false;

  const { error: allocErr } = await supabase.from("transaction_allocations").insert([
    { transaction_id: tx.id, envelope_id: fromId, amount: amountMinor },
    { transaction_id: tx.id, envelope_id: toId, amount: -amountMinor },
  ]);
  return !allocErr;
}

export async function importGoodbudgetHistory(args: {
  csvText: string;
  envelopes: Envelope[];
  householdId: string;
  userId: string;
  syncBudgets?: boolean;
  replaceExisting?: boolean;
  onProgress?: (done: number, total: number) => void;
}): Promise<GoodbudgetImportResult> {
  const {
    csvText,
    envelopes,
    householdId,
    userId,
    syncBudgets = true,
    replaceExisting = true,
    onProgress,
  } = args;

  const rows = parseGoodbudgetCsv(csvText);
  const expenses = rows.filter((r) => r.kind === "expense");
  const transfers = pairTransfers(rows);
  const total = expenses.length + transfers.length;
  let done = 0;
  let imported = 0;
  let transferCount = 0;
  let skipped = 0;
  const errors: string[] = [];

  if (replaceExisting) {
    await clearGoodbudgetImports(householdId);
  }

  if (syncBudgets) {
    await syncEnvelopeBudgetsFromGoodbudget({ rows, envelopes });
  }

  const expenseItems: Array<{ row: GoodbudgetRow; envelopeId: string }> = [];
  for (const row of expenses) {
    const env = findEnvelope(envelopes, row.envelopeKey);
    if (!env) {
      skipped++;
      if (errors.length < 20) errors.push(`No envelope: ${row.envelopeRaw}`);
      continue;
    }
    expenseItems.push({ row, envelopeId: env.id });
  }

  const BATCH = 40;
  for (let i = 0; i < expenseItems.length; i += BATCH) {
    const chunk = expenseItems.slice(i, i + BATCH);
    const count = await insertExpenseBatch({ items: chunk, householdId, userId });
    imported += count;
    if (count < chunk.length) {
      skipped += chunk.length - count;
      if (errors.length < 20) errors.push(`Batch failed at row ${i}`);
    }
    done += chunk.length;
    onProgress?.(done, total);
  }

  for (const pair of transfers) {
    const fromEnv = findEnvelope(envelopes, pair.fromKey);
    const toEnv = findEnvelope(envelopes, pair.toKey);
    if (!fromEnv || !toEnv) {
      skipped++;
      errors.push(`Transfer unmapped: ${pair.fromKey} → ${pair.toKey}`);
      done++;
      onProgress?.(done, total);
      continue;
    }
    const ok = await insertTransfer({
      date: pair.date,
      fromId: fromEnv.id,
      toId: toEnv.id,
      amountMinor: pair.amountMinor,
      householdId,
      userId,
    });
    if (ok) transferCount++;
    else {
      skipped++;
      errors.push(`Failed transfer: ${pair.fromKey} → ${pair.toKey}`);
    }
    done++;
    onProgress?.(done, total);
  }

  const budgetsUpdated = syncBudgets
    ? Object.keys(computeMonthlyBudgets(rows)).length
    : 0;

  return {
    imported,
    transfers: transferCount,
    skipped,
    budgetsUpdated,
    errors: errors.slice(0, 20),
  };
}

/** Parse "Groceries: 2,500,000" or "Groceries,2500000" lines into envelope → remaining IDR. */
export function parseRemainingBalances(text: string): Record<string, number> {
  const result: Record<string, number> = {};
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;

    let name = "";
    let amountRaw = "";
    if (trimmed.includes("\t")) {
      [name, amountRaw] = trimmed.split("\t");
    } else if (trimmed.includes(",")) {
      const idx = trimmed.lastIndexOf(",");
      name = trimmed.slice(0, idx);
      amountRaw = trimmed.slice(idx + 1);
    } else if (trimmed.includes(":")) {
      const idx = trimmed.lastIndexOf(":");
      name = trimmed.slice(0, idx);
      amountRaw = trimmed.slice(idx + 1);
    } else {
      const parts = trimmed.split(/\s+/);
      if (parts.length < 2) continue;
      amountRaw = parts[parts.length - 1];
      name = parts.slice(0, -1).join(" ");
    }

    const key = normalizeGoodbudgetEnvelope(name.trim());
    const digits = amountRaw.replace(/[^\d.-]/g, "");
    if (!key || !digits) continue;
    const amount = Math.round(parseFloat(digits));
    if (isNaN(amount)) continue;
    result[key] = amount;
  }
  return result;
}

function envelopeMonthsElapsed(env: Envelope): number {
  const created = new Date(env.created_at);
  const now = new Date();
  return Math.max(
    1,
    (now.getFullYear() - created.getFullYear()) * 12 +
      (now.getMonth() - created.getMonth()) +
      1
  );
}

/**
 * Set monthly budget so displayed balance matches Goodbudget "amount left"
 * after imported transaction history (balance = budget×months − spent).
 */
export async function syncEnvelopeRemainings(args: {
  remainings: Record<string, number>;
  envelopes: Envelope[];
  spentMap: Record<string, number>;
}): Promise<{ updated: number; unmatched: string[] }> {
  const { remainings, envelopes, spentMap } = args;
  let updated = 0;
  const unmatched: string[] = [];

  for (const [rawKey, remainingIdr] of Object.entries(remainings)) {
    const key = normalizeGoodbudgetEnvelope(rawKey);
    const env = findEnvelope(envelopes, key);
    if (!env) {
      unmatched.push(rawKey);
      continue;
    }

    const spentIdr = spentMap[env.id] ?? 0;
    const months = envelopeMonthsElapsed(env);
    const totalAvailable = remainingIdr + spentIdr;
    const monthlyBudget = Math.max(0, Math.ceil(totalAvailable / months));

    const { error } = await supabase
      .from("envelopes")
      .update({
        budget_amount: monthlyBudget,
        budget_currency: "IDR",
      })
      .eq("id", env.id);

    if (!error) updated++;
  }

  return { updated, unmatched };
}

export const REMAINING_BALANCES_TEMPLATE = `Groceries: 4293414
Eating Out: 1078590
Steven: 1996513
Olivia: 3844453
Vacation / Fun: 36432461
Grab / Gas: 5497822
Giving: 6799906
Rocky: 1322711
House Mainetence: 2080874
Private classes: 1741052`;
