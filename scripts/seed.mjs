// One-time seed script for development data.
// Run from the amplop directory: node scripts/seed.mjs
//
// Creates: Wilson household, Steven + Olivia auth users and profiles,
// one category (Monthly Budget), 5 envelopes, and fx_rates seed rows.

import { readFileSync } from "fs";
import { resolve } from "path";
import { createClient } from "@supabase/supabase-js";

// Load .env.local without requiring dotenv
const envPath = resolve(process.cwd(), ".env.local");
const envFile = readFileSync(envPath, "utf8");
const env = Object.fromEntries(
  envFile
    .split("\n")
    .filter((line) => line && !line.startsWith("#") && line.includes("="))
    .map((line) => {
      const idx = line.indexOf("=");
      return [line.slice(0, idx).trim(), line.slice(idx + 1).trim()];
    })
);

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
  console.error("Missing SUPABASE_URL or SERVICE_ROLE_KEY in .env.local");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function seed() {
  console.log("Seeding Amplop...");

  // ── 1. Auth users ───────────────────────────────────────────────────────────
  console.log("  Creating auth users...");

  const { data: stevenData, error: stevenErr } =
    await supabase.auth.admin.createUser({
      email: "steven@amplop.test",
      email_confirm: true,
    });
  if (stevenErr && !stevenErr.message.includes("already been registered")) {
    throw new Error(`Steven auth: ${stevenErr.message}`);
  }
  // If user already exists, fetch them
  let stevenId = stevenData?.user?.id;
  if (!stevenId) {
    const { data } = await supabase.auth.admin.listUsers();
    stevenId = data?.users?.find((u) => u.email === "steven@amplop.test")?.id;
  }

  const { data: oliviaData, error: oliviaErr } =
    await supabase.auth.admin.createUser({
      email: "olivia@amplop.test",
      email_confirm: true,
    });
  if (oliviaErr && !oliviaErr.message.includes("already been registered")) {
    throw new Error(`Olivia auth: ${oliviaErr.message}`);
  }
  let oliviaId = oliviaData?.user?.id;
  if (!oliviaId) {
    const { data } = await supabase.auth.admin.listUsers();
    oliviaId = data?.users?.find((u) => u.email === "olivia@amplop.test")?.id;
  }

  if (!stevenId || !oliviaId) throw new Error("Could not resolve user IDs");
  console.log(`  Steven: ${stevenId}`);
  console.log(`  Olivia: ${oliviaId}`);

  // ── 2. Household ────────────────────────────────────────────────────────────
  console.log("  Creating household...");
  const { data: household, error: hhErr } = await supabase
    .from("households")
    .insert({ name: "Wilson Household" })
    .select()
    .single();
  if (hhErr) throw new Error(`Household: ${hhErr.message}`);
  console.log(`  Household: ${household.id}`);

  // ── 3. User profiles ────────────────────────────────────────────────────────
  console.log("  Creating user profiles...");
  const { error: usersErr } = await supabase.from("users").insert([
    {
      id: stevenId,
      household_id: household.id,
      email: "steven@amplop.test",
      display_name: "Steven",
      display_currency: "IDR",
    },
    {
      id: oliviaId,
      household_id: household.id,
      email: "olivia@amplop.test",
      display_name: "Olivia",
      display_currency: "IDR",
    },
  ]);
  if (usersErr) throw new Error(`Users: ${usersErr.message}`);

  // ── 4. Category ─────────────────────────────────────────────────────────────
  console.log("  Creating category...");
  const { data: category, error: catErr } = await supabase
    .from("categories")
    .insert({ household_id: household.id, name: "Monthly Budget", sort_order: 0 })
    .select()
    .single();
  if (catErr) throw new Error(`Category: ${catErr.message}`);

  // ── 5. Envelopes ────────────────────────────────────────────────────────────
  // Amounts are in minor units:
  //   IDR has 0 decimal places → Rp 7,832,000 stored as 7832000
  //   USD has 2 decimal places → $250.00 stored as 25000 (cents)
  console.log("  Creating envelopes...");
  const { error: envErr } = await supabase.from("envelopes").insert([
    {
      household_id: household.id,
      category_id: category.id,
      name: "Groceries",
      budget_amount: 7832000,
      budget_currency: "IDR",
      sort_order: 0,
    },
    {
      household_id: household.id,
      category_id: category.id,
      name: "Eating Out",
      budget_amount: 4675000,
      budget_currency: "IDR",
      sort_order: 1,
    },
    {
      household_id: household.id,
      category_id: category.id,
      name: "Vacation/Fun",
      budget_amount: 25000,   // $250.00 in cents
      budget_currency: "USD",
      sort_order: 2,
    },
    {
      household_id: household.id,
      category_id: category.id,
      name: "Grab/Gas",
      budget_amount: 3138000,
      budget_currency: "IDR",
      sort_order: 3,
    },
    {
      household_id: household.id,
      category_id: category.id,
      name: "Giving",
      budget_amount: 5703000,
      budget_currency: "IDR",
      sort_order: 4,
    },
  ]);
  if (envErr) throw new Error(`Envelopes: ${envErr.message}`);

  // ── 6. FX rates ─────────────────────────────────────────────────────────────
  // Placeholder rates; the real cron Edge Function overwrites these in Phase 4.
  // Rate format: "FROM/TO" → how many TO units equal 1 FROM unit.
  console.log("  Seeding fx_rates...");
  const { error: fxErr } = await supabase.from("fx_rates").insert([
    { currency_pair: "USD/IDR", rate: 16500 },
    { currency_pair: "EUR/IDR", rate: 18200 },
    { currency_pair: "SGD/IDR", rate: 12400 },
    { currency_pair: "AUD/IDR", rate: 10800 },
    { currency_pair: "GBP/IDR", rate: 21000 },
    { currency_pair: "JPY/IDR", rate: 107 },
    { currency_pair: "MYR/IDR", rate: 3700 },
  ]);
  if (fxErr) throw new Error(`FX rates: ${fxErr.message}`);

  console.log("\nSeed complete!");
  console.log(`  Household ID: ${household.id}`);
  console.log("  Test login:   steven@amplop.test  (magic link)");
  console.log("  Test login:   olivia@amplop.test  (magic link)");
}

seed().catch((err) => {
  console.error("Seed failed:", err.message);
  process.exit(1);
});
