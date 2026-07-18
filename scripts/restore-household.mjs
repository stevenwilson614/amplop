#!/usr/bin/env node
/**
 * Restore household envelopes + Goodbudget transaction history.
 *
 * Usage:
 *   node scripts/restore-household.mjs [--csv /path/to/history.csv] [--owner stevenwilson614@gmail.com]
 */

import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const BASE_ENVELOPES = [
  { name: "Groceries", category: "Food", sort: 0 },
  { name: "Eating out", category: "Food", sort: 1 },
  { name: "Steven", category: "Personal", sort: 2 },
  { name: "Olivia", category: "Personal", sort: 3 },
  { name: "Private Classes", category: "Personal", sort: 4 },
  { name: "House Maintenance", category: "Other", sort: 5 },
  { name: "Rocky", category: "Other", sort: 6 },
  { name: "Vacation / fun", category: "Other", sort: 7 },
  { name: "Grab / Gas", category: "Other", sort: 8 },
  { name: "Giving", category: "Other", sort: 9 },
];

const REMAININGS = {
  Groceries: 4293414,
  "Eating Out": 1078590,
  Steven: 1996513,
  Olivia: 3844453,
  "Vacation / Fun": 36432461,
  "Grab / Gas": 5497822,
  Giving: 6799906,
  Rocky: 1322711,
  "House Mainetence": 2080874,
  "Private classes": 1741052,
};

function loadEnv() {
  const envPath = path.join(root, ".env.local");
  const env = {};
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    if (!line || line.startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx < 0) continue;
    env[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }
  return env;
}

function parseArgs(argv) {
  let csv = path.join(process.env.HOME ?? "", "Downloads/history.csv");
  let owner = "stevenwilson614@gmail.com";
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === "--csv") csv = argv[++i] ?? csv;
    else if (argv[i] === "--owner") owner = argv[++i] ?? owner;
  }
  return { csv, owner };
}

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
  const m = raw.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[1].padStart(2, "0")}-${m[2].padStart(2, "0")}`;
  const d = new Date(raw);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-CA");
}

function normEnv(raw) {
  const t = raw.trim().replace(/\s+/g, " ");
  if (!t) return "";
  if (t.includes(":")) return t.split(":").map((p) => p.trim()).filter(Boolean).pop();
  return t;
}

function parseAmt(raw) {
  const cleaned = raw.trim().replace(/[^\d.,-]/g, "");
  if (!cleaned) return 0;
  const neg = cleaned.startsWith("-");
  const digits = cleaned.replace(/-/g, "").replace(/,/g, "");
  const v = Math.round(parseFloat(digits));
  return neg ? -v : v;
}

function parseGoodbudget(csvText) {
  const lines = csvText.trim().split(/\r?\n/).filter(Boolean);
  const header = splitCsvLine(lines[0]).map((h) => h.trim().toLowerCase());
  const dateIdx = header.indexOf("date");
  const envIdx = header.indexOf("envelope");
  const nameIdx = header.indexOf("name");
  const amtIdx = header.indexOf("amount");
  if (dateIdx < 0 || envIdx < 0 || nameIdx < 0 || amtIdx < 0) {
    throw new Error("Not a Goodbudget CSV");
  }

  const skip = new Set(["Fill Envelopes", "Fill from Available", "Fill from Unallocated"]);
  const rows = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i]);
    const date = normalizeDate(cols[dateIdx]?.trim() ?? "");
    const envelopeRaw = cols[envIdx]?.trim() ?? "";
    const name = cols[nameIdx]?.trim() ?? "";
    const amountMinor = parseAmt(cols[amtIdx] ?? "");
    if (!date) continue;

    if (name === "Income") {
      rows.push({ date, envelopeKey: "", name, amountMinor: Math.abs(amountMinor), kind: "income" });
      continue;
    }
    if (skip.has(name)) {
      rows.push({ date, envelopeKey: "", name, amountMinor, kind: "skip" });
      continue;
    }

    const envelopeKey = normEnv(envelopeRaw);
    if (amountMinor < 0) {
      rows.push({ date, envelopeKey, name, amountMinor: Math.abs(amountMinor), kind: "expense" });
    } else if (amountMinor > 0 && envelopeKey) {
      rows.push({ date, envelopeKey, name, amountMinor, kind: "transfer" });
    }
  }
  return rows;
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

function findEnvelope(envelopes, key) {
  const q = key.toLowerCase();
  return envelopes.find((e) => e.name.toLowerCase() === q)
    ?? envelopes.find((e) => normEnv(e.name).toLowerCase() === q)
    ?? envelopes.find((e) => e.name.toLowerCase().includes(q) || q.includes(e.name.toLowerCase()));
}

function monthsElapsed(createdAt) {
  const created = new Date(createdAt);
  const now = new Date();
  return Math.max(1, (now.getFullYear() - created.getFullYear()) * 12 + (now.getMonth() - created.getMonth()) + 1);
}

async function deleteTransactions(sb, householdId) {
  const { data: txs } = await sb
    .from("transactions")
    .select("id, notes")
    .eq("household_id", householdId);

  const ids = (txs ?? [])
    .filter((t) => !(t.notes ?? "").startsWith("trip-draw:"))
    .map((t) => t.id);

  for (let i = 0; i < ids.length; i += 50) {
    const chunk = ids.slice(i, i + 50);
    await sb.from("transaction_allocations").delete().in("transaction_id", chunk);
    await sb.from("transactions").delete().in("id", chunk);
  }
  return ids.length;
}

async function main() {
  const { csv, owner } = parseArgs(process.argv);
  if (!fs.existsSync(csv)) throw new Error(`CSV not found: ${csv}`);

  const env = loadEnv();
  const sb = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: ownerRow, error: ownerErr } = await sb
    .from("users")
    .select("id, household_id, email")
    .ilike("email", owner)
    .maybeSingle();
  if (ownerErr) throw ownerErr;
  if (!ownerRow) throw new Error(`No user row for ${owner}`);

  const householdId = ownerRow.household_id;
  const userId = ownerRow.id;
  console.log(`Household ${householdId} (owner ${ownerRow.email})`);

  // Ensure categories
  const categoryNames = ["Food", "Personal", "Other"];
  const categoryIds = {};
  for (const name of categoryNames) {
    const { data: existing } = await sb
      .from("categories")
      .select("id")
      .eq("household_id", householdId)
      .ilike("name", name)
      .limit(1)
      .maybeSingle();
    if (existing) {
      categoryIds[name] = existing.id;
      continue;
    }
    const { data: created, error } = await sb
      .from("categories")
      .insert({ household_id: householdId, name, sort_order: Object.keys(categoryIds).length })
      .select("id")
      .single();
    if (error) throw error;
    categoryIds[name] = created.id;
  }

  // Ensure base envelopes (household only)
  const { data: existingEnvs } = await sb
    .from("envelopes")
    .select("*")
    .eq("household_id", householdId)
    .is("trip_id", null);

  const householdEnvs = [...(existingEnvs ?? [])];
  for (const spec of BASE_ENVELOPES) {
    let env = findEnvelope(householdEnvs, spec.name);
    if (!env) {
      const { data: created, error } = await sb
        .from("envelopes")
        .insert({
          household_id: householdId,
          name: spec.name,
          category_id: categoryIds[spec.category],
          budget_amount: 0,
          budget_currency: "IDR",
          sort_order: spec.sort,
        })
        .select("*")
        .single();
      if (error) throw error;
      env = created;
      householdEnvs.push(created);
      console.log(`Created envelope: ${spec.name}`);
    } else {
      await sb.from("envelopes").update({
        category_id: categoryIds[spec.category],
        sort_order: spec.sort,
      }).eq("id", env.id);
    }
  }

  const deleted = await deleteTransactions(sb, householdId);
  console.log(`Deleted ${deleted} non-trip transactions`);

  const csvText = fs.readFileSync(csv, "utf8");
  const rows = parseGoodbudget(csvText);
  const expenses = rows.filter((r) => r.kind === "expense");
  const transfers = pairTransfers(rows);
  console.log(`Parsed ${expenses.length} expenses, ${transfers.length} transfer pairs`);

  const { data: envsForImport } = await sb
    .from("envelopes")
    .select("*")
    .eq("household_id", householdId)
    .is("trip_id", null);
  const envelopes = envsForImport ?? [];

  let imported = 0;
  let skipped = 0;
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
    await sb.from("transaction_allocations").insert({
      transaction_id: tx.id,
      envelope_id: env.id,
      amount: row.amountMinor,
    });
    imported++;
    if (imported % 500 === 0) console.log(`  ${imported} expenses...`);
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

  // Sync remainings → monthly budgets
  const { data: allTxs } = await sb
    .from("transactions")
    .select("amount, amount_idr_snapshot, allocations:transaction_allocations(envelope_id, amount)")
    .eq("household_id", householdId);

  const spentMap = {};
  for (const t of allTxs ?? []) {
    const total = Number(t.amount) || 0;
    const totalIdr = Number(t.amount_idr_snapshot) || 0;
    if (!total || !t.allocations) continue;
    for (const a of t.allocations) {
      const idr = Math.round((Number(a.amount) / total) * totalIdr);
      spentMap[a.envelope_id] = (spentMap[a.envelope_id] ?? 0) + idr;
    }
  }

  let budgetUpdates = 0;
  for (const [key, remaining] of Object.entries(REMAININGS)) {
    const env = findEnvelope(envelopes, key);
    if (!env) continue;
    const spent = spentMap[env.id] ?? 0;
    const months = monthsElapsed(env.created_at);
    const monthlyBudget = Math.max(0, Math.ceil((remaining + spent) / months));
    const { error } = await sb.from("envelopes").update({
      budget_amount: monthlyBudget,
      budget_currency: "IDR",
    }).eq("id", env.id);
    if (!error) budgetUpdates++;
  }

  const { count: txCount } = await sb
    .from("transactions")
    .select("id", { count: "exact", head: true })
    .eq("household_id", householdId);
  const { count: envCount } = await sb
    .from("envelopes")
    .select("id", { count: "exact", head: true })
    .eq("household_id", householdId);

  console.log(`\nRestore complete:`);
  console.log(`  imported ${imported} expenses, ${transferCount} transfers (${skipped} skipped)`);
  console.log(`  updated ${budgetUpdates} envelope budgets`);
  console.log(`  totals now: ${envCount} envelopes, ${txCount} transactions`);
  console.log(`\nRefresh https://stevenwilson614.github.io/amplop/#/envelopes`);
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
