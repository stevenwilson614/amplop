#!/usr/bin/env node
/**
 * Link a user to the same household as the primary account.
 *
 * Usage:
 *   node scripts/fix-household-member.mjs --list
 *   node scripts/fix-household-member.mjs --member olivia@example.com --owner steven@example.com
 *   node scripts/fix-household-member.mjs --member olivia@example.com --household <uuid>
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
    env[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
  }
  return env;
}

function parseArgs(argv) {
  const out = { list: false, member: "", owner: "", household: "" };
  for (let i = 2; i < argv.length; i++) {
    if (argv[i] === "--list") out.list = true;
    else if (argv[i] === "--member") out.member = argv[++i] ?? "";
    else if (argv[i] === "--owner") out.owner = argv[++i] ?? "";
    else if (argv[i] === "--household") out.household = argv[++i] ?? "";
  }
  return out;
}

async function main() {
  const args = parseArgs(process.argv);
  const env = loadEnv();
  const sb = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: households, error: hErr } = await sb
    .from("households")
    .select("id, name, created_at")
    .order("created_at");
  if (hErr) throw hErr;

  const { data: users, error: uErr } = await sb
    .from("users")
    .select("id, email, display_name, household_id, created_at")
    .order("created_at");
  if (uErr) throw uErr;

  if (args.list) {
    console.log("\n=== Households ===");
    for (const h of households ?? []) {
      const members = (users ?? []).filter((u) => u.household_id === h.id);
      const { count } = await sb
        .from("envelopes")
        .select("id", { count: "exact", head: true })
        .eq("household_id", h.id);
      console.log(`\n${h.name} (${h.id})`);
      console.log(`  envelopes: ${count ?? 0}`);
      for (const m of members) {
        console.log(`  - ${m.display_name} <${m.email}>`);
      }
    }
    return;
  }

  if (!args.member) {
    console.error("Provide --member <email> and --owner <email> or --household <uuid>");
    console.error("Run with --list to see current state.");
    process.exit(1);
  }

  const member = (users ?? []).find(
    (u) => u.email?.toLowerCase() === args.member.toLowerCase(),
  );
  if (!member) throw new Error(`No users row for member email: ${args.member}`);

  let targetHouseholdId = args.household;
  if (!targetHouseholdId && args.owner) {
    const owner = (users ?? []).find(
      (u) => u.email?.toLowerCase() === args.owner.toLowerCase(),
    );
    if (!owner) throw new Error(`No users row for owner email: ${args.owner}`);
    targetHouseholdId = owner.household_id;
  }

  if (!targetHouseholdId) {
    const ranked = await Promise.all(
      (households ?? []).map(async (h) => {
        const { count } = await sb
          .from("envelopes")
          .select("id", { count: "exact", head: true })
          .eq("household_id", h.id);
        return { h, count: count ?? 0 };
      }),
    );
    ranked.sort((a, b) => b.count - a.count);
    targetHouseholdId = ranked[0]?.h?.id;
    console.log(`Using household with most envelopes: ${ranked[0]?.h?.name} (${targetHouseholdId})`);
  }

  const targetHousehold = households?.find((h) => h.id === targetHouseholdId);
  if (!targetHousehold) throw new Error("Target household not found");

  if (member.household_id === targetHouseholdId) {
    console.log(`${member.display_name} is already in ${targetHousehold.name}`);
    return;
  }

  console.log(`Moving ${member.display_name} <${member.email}>`);
  console.log(`  from household ${member.household_id}`);
  console.log(`  to   ${targetHousehold.name} (${targetHouseholdId})`);

  const { error } = await sb
    .from("users")
    .update({ household_id: targetHouseholdId })
    .eq("id", member.id);
  if (error) throw error;

  console.log("\nDone. Ask Olivia to sign out and sign back in (or refresh the app).");
}

main().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
