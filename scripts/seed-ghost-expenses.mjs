#!/usr/bin/env node
/** Seed save-for / ghost expense envelopes for the household. Idempotent by name. */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "fs";
import { fileURLToPath } from "url";
import { dirname, join } from "path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, "..", ".env.local");
const env = Object.fromEntries(
  readFileSync(envPath, "utf8")
    .split("\n")
    .filter((l) => l.includes("="))
    .map((l) => {
      const i = l.indexOf("=");
      return [l.slice(0, i), l.slice(i + 1)];
    })
);

const supabase = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);
const HOUSEHOLD_ID = process.env.HOUSEHOLD_ID ?? "5e115301-cbf6-4410-ad54-2dd15390143d";

const PRESETS = [
  { name: "Pulang Amerika", budget_amount: 25000, budget_currency: "USD", target_amount: 300000, target_currency: "USD", due_date: "2027-07-01" },
  { name: "Conferences", budget_amount: 20000, budget_currency: "USD", target_amount: 60000, target_currency: "USD", due_date: "2026-10-01" },
  { name: "Visa", budget_amount: 15300, budget_currency: "USD", target_amount: 45900, target_currency: "USD", due_date: "2026-10-01" },
  { name: "Rent", budget_amount: Math.ceil(110_000_000 / 12), budget_currency: "IDR", target_amount: 110_000_000, target_currency: "IDR", due_date: "2027-01-01" },
  { name: "Tax CPA", budget_amount: 19200, budget_currency: "USD", target_amount: 172800, target_currency: "USD", due_date: "2027-04-01" },
  { name: "Health Insurance", budget_amount: 18100, budget_currency: "USD", target_amount: 181000, target_currency: "USD", due_date: "2027-05-01" },
  { name: "Car Taxes", budget_amount: Math.ceil(2_500_000 / 12), budget_currency: "IDR", target_amount: 2_500_000, target_currency: "IDR", due_date: "2027-05-01" },
  { name: "Visa Run", budget_amount: 15800, budget_currency: "USD", target_amount: 47400, target_currency: "USD", due_date: "2026-10-01" },
  { name: "Gym", budget_amount: Math.ceil(11_000_000 / 12), budget_currency: "IDR", target_amount: 11_000_000, target_currency: "IDR", due_date: "2026-10-01" },
];

async function main() {
  const { data: existing } = await supabase
    .from("envelopes")
    .select("id,name,sort_order")
    .eq("household_id", HOUSEHOLD_ID)
    .is("trip_id", null);

  const byName = new Map((existing ?? []).map((e) => [e.name.toLowerCase(), e]));
  let sort = Math.max(0, ...(existing ?? []).map((e) => e.sort_order ?? 0)) + 1;

  for (const preset of PRESETS) {
    const hit = byName.get(preset.name.toLowerCase());
    const payload = {
      ...preset,
      kind: "sinking",
      household_id: HOUSEHOLD_ID,
      category_id: null,
    };

    if (hit) {
      const { error } = await supabase.from("envelopes").update(payload).eq("id", hit.id);
      if (error) throw error;
      console.log(`updated: ${preset.name}`);
    } else {
      const { error } = await supabase.from("envelopes").insert({ ...payload, sort_order: sort++ });
      if (error) throw error;
      console.log(`created: ${preset.name}`);
    }
  }

  console.log("\nDone.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
