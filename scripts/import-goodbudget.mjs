#!/usr/bin/env node
/**
 * Import Goodbudget CSV into Amplop via Supabase service role.
 *
 * Usage:
 *   node scripts/import-goodbudget.mjs /path/to/history.csv
 *
 * Requires SUPABASE_SERVICE_ROLE_KEY and VITE_SUPABASE_URL in .env.local
 */

import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

function loadEnv() {
  const envPath = path.join(root, ".env.local");
  if (!fs.existsSync(envPath)) throw new Error("Missing .env.local");
  const env = {};
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    if (!line || line.startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx < 0) continue;
    env[line.slice(0, idx)] = line.slice(idx + 1);
  }
  return env;
}

// Inline minimal Goodbudget parser (mirrors src/lib/goodbudgetImport.ts)
function splitCsvLine(line) {
  const out = [];
  let cur = "";
  let inQuotes = false;
  for (const ch of line) {
    if (ch === '"') { inQuotes = !inQuotes; continue; }
    if (ch === "," && !inQuotes) { out.push(cur); cur = ""; continue; }
    cur += ch;
  }
  out.push(cur);
  return out;
}

function normalizeDate(raw) {
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const d = new Date(raw);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-CA");
}

function parseAmt(raw) {
  const cleaned = raw.trim().replace(/[^\d.,-]/g, "");
  if (!cleaned) return 0;
  const neg = cleaned.startsWith("-");
  const digits = cleaned.replace(/-/g, "").replace(/,/g, "");
  const v = Math.round(parseFloat(digits));
  return neg ? -v : v;
}

function normEnv(raw) {
  const t = raw.trim().replace(/\s+/g, " ");
  if (!t) return "";
  if (t.includes(":")) return t.split(":").map((p) => p.trim()).filter(Boolean).pop();
  return t;
}

function parseGoodbudget(text) {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  const header = splitCsvLine(lines[0]).map((h) => h.toLowerCase().trim());
  const dateIdx = header.indexOf("date");
  const envIdx = header.indexOf("envelope");
  const nameIdx = header.indexOf("name");
  const amtIdx = header.indexOf("amount");
  const rows = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i]);
    const date = normalizeDate(cols[dateIdx]?.trim());
    const envelopeRaw = cols[envIdx]?.trim() ?? "";
    const name = cols[nameIdx]?.trim() ?? "";
    const amountMinor = parseAmt(cols[amtIdx] ?? "");
    if (!date) continue;
    if (name === "Envelope Transfer" && envelopeRaw && amountMinor !== 0) {
      rows.push({ date, envelopeRaw, envelopeKey: normEnv(envelopeRaw), name, amountMinor, kind: "transfer" });
      continue;
    }
    if (["Fill Envelopes", "Fill from Available", "Fill from Unallocated", "Income"].includes(name)) continue;
    if (!envelopeRaw || amountMinor >= 0) continue;
    rows.push({
      date,
      envelopeRaw,
      envelopeKey: normEnv(envelopeRaw),
      name,
      amountMinor: Math.abs(amountMinor),
      kind: "expense",
    });
  }
  return rows;
}

function findEnvelope(envelopes, key) {
  const q = key.toLowerCase();
  return envelopes.find((e) => e.name.toLowerCase() === q)
    ?? envelopes.find((e) => normEnv(e.name).toLowerCase() === q)
    ?? envelopes.find((e) => e.name.toLowerCase().includes(q));
}

function computeBudgets(rows) {
  const now = new Date();
  const cutoff = new Date(now.getFullYear(), now.getMonth() - 5, 1);
  const monthTotals = {};
  for (const row of rows) {
    if (row.kind !== "expense") continue;
    const d = new Date(`${row.date}T12:00:00`);
    if (d < cutoff) continue;
    const mk = row.date.slice(0, 7);
    if (!monthTotals[row.envelopeKey]) monthTotals[row.envelopeKey] = {};
    monthTotals[row.envelopeKey][mk] = (monthTotals[row.envelopeKey][mk] ?? 0) + row.amountMinor;
  }
  const budgets = {};
  for (const [k, months] of Object.entries(monthTotals)) {
    const vals = Object.values(months);
    const avg = vals.reduce((a, b) => a + b, 0) / vals.length;
    budgets[k] = Math.ceil(avg / 100000) * 100000;
  }
  return budgets;
}

function pairTransfers(rows) {
  const transfers = rows.filter((r) => r.kind === "transfer");
  const used = new Set();
  const pairs = [];
  for (let i = 0; i < transfers.length; i++) {
    if (used.has(i)) continue;
    for (let j = i + 1; j < transfers.length; j++) {
      if (used.has(j)) continue;
      const a = transfers[i], b = transfers[j];
      if (a.date !== b.date || Math.abs(a.amountMinor) !== Math.abs(b.amountMinor) || a.amountMinor === b.amountMinor) continue;
      const from = a.amountMinor < 0 ? a : b;
      const to = a.amountMinor > 0 ? a : b;
      pairs.push({ date: a.date, fromKey: from.envelopeKey, toKey: to.envelopeKey, amountMinor: Math.abs(a.amountMinor) });
      used.add(i); used.add(j);
      break;
    }
  }
  return pairs;
}

async function main() {
  const csvPath = process.argv[2];
  if (!csvPath) {
    console.error("Usage: node scripts/import-goodbudget.mjs /path/to/history.csv");
    process.exit(1);
  }

  const env = loadEnv();
  const sb = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  const csvText = fs.readFileSync(csvPath, "utf8");
  const rows = parseGoodbudget(csvText);
  const expenses = rows.filter((r) => r.kind === "expense");
  const transfers = pairTransfers(rows);

  const { data: households } = await sb.from("households").select("id").limit(1);
  const householdId = households?.[0]?.id;
  if (!householdId) throw new Error("No household found");

  const { data: users } = await sb.from("users").select("id").eq("household_id", householdId).limit(1);
  const userId = users?.[0]?.id;
  if (!userId) throw new Error("No user found");

  const { data: envelopes } = await sb.from("envelopes").select("*").eq("household_id", householdId);
  console.log("Envelopes:", envelopes?.map((e) => e.name).join(", "));

  // Clear prior imports
  const { data: oldTxs } = await sb.from("transactions").select("id").eq("household_id", householdId).like("notes", "Goodbudget import%");
  if (oldTxs?.length) {
    const ids = oldTxs.map((t) => t.id);
    for (let i = 0; i < ids.length; i += 100) {
      const chunk = ids.slice(i, i + 100);
      await sb.from("transaction_allocations").delete().in("transaction_id", chunk);
      await sb.from("transactions").delete().in("id", chunk);
    }
    console.log(`Cleared ${ids.length} prior import transactions`);
  }

  // Sync budgets
  const budgets = computeBudgets(rows);
  let budgetUpdates = 0;
  for (const e of envelopes ?? []) {
    const key = normEnv(e.name);
    const budget = budgets[key] ?? budgets[e.name];
    if (!budget) continue;
    const firstDate = rows.filter((r) => r.envelopeKey === key).map((r) => r.date).sort()[0] ?? "2023-12-01";
    const { error } = await sb.from("envelopes").update({
      budget_amount: budget,
      budget_currency: "IDR",
      created_at: `${firstDate}T00:00:00.000Z`,
    }).eq("id", e.id);
    if (!error) {
      budgetUpdates++;
      console.log(`  Budget ${e.name}: ${budget.toLocaleString()} IDR`);
    }
  }

  let imported = 0, skipped = 0;
  for (const row of expenses) {
    const env = findEnvelope(envelopes, row.envelopeKey);
    if (!env) { skipped++; continue; }
    const { data: tx, error: txErr } = await sb.from("transactions").insert({
      household_id: householdId,
      user_id: userId,
      tx_type: "expense",
      amount: row.amountMinor,
      currency: "IDR",
      amount_idr_snapshot: row.amountMinor,
      fx_rate_snapshot: 1,
      date: row.date,
      merchant_name: row.name,
      notes: `Goodbudget import ${row.date}`,
    }).select("id").single();
    if (txErr || !tx) { skipped++; continue; }
    await sb.from("transaction_allocations").insert({ transaction_id: tx.id, envelope_id: env.id, amount: row.amountMinor });
    imported++;
    if (imported % 200 === 0) console.log(`  ${imported} expenses...`);
  }

  let transferCount = 0;
  for (const pair of transfers) {
    const fromEnv = findEnvelope(envelopes, pair.fromKey);
    const toEnv = findEnvelope(envelopes, pair.toKey);
    if (!fromEnv || !toEnv) { skipped++; continue; }
    const { data: tx } = await sb.from("transactions").insert({
      household_id: householdId,
      user_id: userId,
      tx_type: "transfer",
      amount: pair.amountMinor,
      currency: "IDR",
      amount_idr_snapshot: pair.amountMinor,
      fx_rate_snapshot: 1,
      date: pair.date,
      notes: `Goodbudget import transfer ${pair.date}`,
    }).select("id").single();
    if (!tx) { skipped++; continue; }
    await sb.from("transaction_allocations").insert([
      { transaction_id: tx.id, envelope_id: fromEnv.id, amount: pair.amountMinor },
      { transaction_id: tx.id, envelope_id: toEnv.id, amount: -pair.amountMinor },
    ]);
    transferCount++;
  }

  console.log(`\nDone: ${imported} expenses, ${transferCount} transfers, ${budgetUpdates} budgets updated, ${skipped} skipped`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
