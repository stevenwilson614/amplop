#!/usr/bin/env node
/**
 * Sync envelope remaining balances from pasted Goodbudget amounts.
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

function monthsElapsed(createdAt) {
  const created = new Date(createdAt);
  const now = new Date();
  return Math.max(
    1,
    (now.getFullYear() - created.getFullYear()) * 12 +
      (now.getMonth() - created.getMonth()) +
      1
  );
}

async function main() {
  const env = loadEnv();
  const sb = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
  const remainings = parseRemainings(REMAININGS_TEXT);

  const { data: households, error: hErr } = await sb.from("households").select("id").limit(1);
  if (hErr) throw hErr;
  const householdId = households?.[0]?.id;
  if (!householdId) throw new Error("No household found");

  const { data: envelopes } = await sb.from("envelopes").select("*").eq("household_id", householdId);

  const { data: txs } = await sb
    .from("transactions")
    .select("id, amount, amount_idr_snapshot, allocations:transaction_allocations(envelope_id, amount)")
    .eq("household_id", householdId);

  const spentMap = {};
  for (const t of txs ?? []) {
    const total = Number(t.amount) || 0;
    const totalIdr = Number(t.amount_idr_snapshot) || 0;
    if (!total || !t.allocations) continue;
    for (const a of t.allocations) {
      const idr = Math.round((Number(a.amount) / total) * totalIdr);
      spentMap[a.envelope_id] = (spentMap[a.envelope_id] ?? 0) + idr;
    }
  }

  console.log("Envelopes in Amplop:", envelopes?.map((e) => e.name).join(", "));
  console.log("\nSyncing remainings:\n");

  let updated = 0;
  const unmatched = [];

  for (const [key, remaining] of Object.entries(remainings)) {
    const env = findEnvelope(envelopes ?? [], key);
    if (!env) {
      unmatched.push(key);
      continue;
    }
    const spent = spentMap[env.id] ?? 0;
    const months = monthsElapsed(env.created_at);
    const monthlyBudget = Math.max(0, Math.ceil((remaining + spent) / months));

    const { error } = await sb.from("envelopes").update({
      budget_amount: monthlyBudget,
      budget_currency: "IDR",
    }).eq("id", env.id);

    if (error) {
      console.error(`  FAIL ${key}:`, error.message);
      continue;
    }
    updated++;
    console.log(
      `  ${env.name}: remaining ${remaining.toLocaleString()} | spent ${spent.toLocaleString()} | ` +
      `months ${months} → monthly budget ${monthlyBudget.toLocaleString()} IDR`
    );
  }

  if (unmatched.length) console.log("\nUnmatched:", unmatched.join(", "));
  console.log(`\nUpdated ${updated} envelope(s).`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
