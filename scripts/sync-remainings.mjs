#!/usr/bin/env node
/**
 * Sync Goodbudget remaining balances into carryover snapshots (keeps monthly budget unchanged).
 * Usage: node scripts/sync-remainings.mjs
 */

import { createClient } from "@supabase/supabase-js";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");

const REMAININGS_TEXT = `Groceries: 4293414
Eating Out: 1078590
Steven: 1996513
Olivia: 3844453
Vacation / Fun: 36432461
Grab / Gas: 5497822
Giving: 6799906
Rocky: 1322711
House Mainetence: 2080874
Private classes: 1741052`;

const HOUSEHOLD_ID = "5e115301-cbf6-4410-ad54-2dd15390143d";

function loadEnv() {
  const envPath = path.join(root, ".env.local");
  const env = {};
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    if (!line || line.startsWith("#")) continue;
    const idx = line.indexOf("=");
    if (idx < 0) continue;
    env[line.slice(0, idx)] = line.slice(idx + 1);
  }
  return env;
}

function normEnv(raw) {
  const t = raw.trim().replace(/\s+/g, " ");
  if (!t) return "";
  if (t.includes(":")) return t.split(":").map((p) => p.trim()).filter(Boolean).pop();
  return t;
}

const ALIASES = {
  "house maintenance": ["house mainetence", "house maintenance"],
  "private classes": ["private classes", "private class"],
};

function parseRemainings(text) {
  const result = {};
  for (const line of text.split("\n")) {
    const idx = line.lastIndexOf(":");
    if (idx < 0) continue;
    const name = line.slice(0, idx).trim();
    const amount = Math.round(parseFloat(line.slice(idx + 1).replace(/[^\d.-]/g, "")));
    if (!name || isNaN(amount)) continue;
    result[normEnv(name)] = amount;
  }
  return result;
}

function findEnvelope(envelopes, key) {
  const q = key.toLowerCase();
  let found = envelopes.find((e) => e.name.toLowerCase() === q)
    ?? envelopes.find((e) => normEnv(e.name).toLowerCase() === q)
    ?? envelopes.find((e) => e.name.toLowerCase().includes(q) || q.includes(e.name.toLowerCase()));
  if (found) return found;
  for (const [canonical, aliases] of Object.entries(ALIASES)) {
    if (q === canonical || aliases.includes(q)) {
      return envelopes.find((e) => e.name.toLowerCase() === canonical)
        ?? envelopes.find((e) => normEnv(e.name).toLowerCase() === canonical);
    }
  }
  return undefined;
}

function carryoverFromRemaining(remaining, monthly, monthSpent) {
  return remaining + monthSpent - monthly;
}

async function main() {
  const env = loadEnv();
  const sb = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  const remainings = parseRemainings(REMAININGS_TEXT);
  const carryoverMonth = new Date().toLocaleDateString("en-CA").slice(0, 7);
  const monthStart = `${carryoverMonth}-01`;

  const { data: envelopes, error: eErr } = await sb
    .from("envelopes")
    .select("*")
    .eq("household_id", HOUSEHOLD_ID)
    .is("trip_id", null);
  if (eErr) throw eErr;

  const { data: txs, error: tErr } = await sb
    .from("transactions")
    .select("date, amount, amount_idr_snapshot, allocations:transaction_allocations(envelope_id, amount)")
    .eq("household_id", HOUSEHOLD_ID);
  if (tErr) throw tErr;

  const monthSpentMap = {};
  for (const t of txs ?? []) {
    if (t.date < monthStart) continue;
    const total = Number(t.amount) || 0;
    const totalIdr = Number(t.amount_idr_snapshot) || 0;
    if (!total || !t.allocations) continue;
    for (const a of t.allocations) {
      const idr = Math.round((Number(a.amount) / total) * totalIdr);
      monthSpentMap[a.envelope_id] = (monthSpentMap[a.envelope_id] ?? 0) + idr;
    }
  }

  console.log("Syncing Goodbudget remainings → carryover snapshots:\n");

  let updated = 0;
  const unmatched = [];

  for (const [key, remaining] of Object.entries(remainings)) {
    const envRow = findEnvelope(envelopes ?? [], key);
    if (!envRow) {
      unmatched.push(key);
      continue;
    }
    const monthly = envRow.budget_amount;
    const monthSpent = monthSpentMap[envRow.id] ?? 0;
    const carryover = carryoverFromRemaining(remaining, monthly, monthSpent);

    const { error } = await sb.from("envelopes").update({
      carryover_idr: carryover,
      carryover_month: carryoverMonth,
    }).eq("id", envRow.id);

    if (error) {
      console.error(`  FAIL ${key}:`, error.message);
      continue;
    }
    updated++;
    console.log(
      `  ${envRow.name}: remaining ${remaining.toLocaleString()} | monthly ${monthly.toLocaleString()} | ` +
      `carryover ${carryover.toLocaleString()}`
    );
  }

  if (unmatched.length) console.log("\nUnmatched:", unmatched.join(", "));
  console.log(`\nUpdated ${updated} envelope(s).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
