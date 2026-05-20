#!/usr/bin/env node
/**
 * Create or update a Supabase auth user and link to the main household.
 * Usage: node scripts/provision-user.mjs <email> <displayName> [password]
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

async function findAuthUser(sb, email) {
  let page = 1;
  const perPage = 200;
  while (true) {
    const { data, error } = await sb.auth.admin.listUsers({ page, perPage });
    if (error) throw error;
    const hit = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
    if (hit) return hit;
    if (data.users.length < perPage) return null;
    page += 1;
  }
}

async function main() {
  const email = process.argv[2];
  const displayName = process.argv[3] ?? "Olivia";
  const password = process.argv[4] ?? "Amplop2026";

  if (!email) {
    console.error("Usage: node scripts/provision-user.mjs <email> <displayName> [password]");
    process.exit(1);
  }

  const env = loadEnv();
  const sb = createClient(env.VITE_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  const { data: households, error: hErr } = await sb.from("households").select("id, name").limit(1);
  if (hErr) throw hErr;
  const household = households?.[0];
  if (!household) throw new Error("No household found");

  let authUser = await findAuthUser(sb, email);

  if (authUser) {
    const { data, error } = await sb.auth.admin.updateUserById(authUser.id, {
      password,
      email_confirm: true,
    });
    if (error) throw error;
    authUser = data.user;
    console.log("Updated existing auth user:", authUser.id);
  } else {
    const { data, error } = await sb.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { display_name: displayName },
    });
    if (error) throw error;
    authUser = data.user;
    console.log("Created auth user:", authUser.id);
  }

  const { data: existingRow } = await sb.from("users").select("id").eq("id", authUser.id).maybeSingle();

  if (existingRow) {
    const { error } = await sb
      .from("users")
      .update({
        display_name: displayName,
        household_id: household.id,
        email,
        display_currency: "IDR",
      })
      .eq("id", authUser.id);
    if (error) throw error;
    console.log("Updated users row for household:", household.name);
  } else {
    const { error } = await sb.from("users").insert({
      id: authUser.id,
      household_id: household.id,
      email,
      display_name: displayName,
      display_currency: "IDR",
    });
    if (error) throw error;
    console.log("Linked to household:", household.name, household.id);
  }

  console.log("\nDone.");
  console.log("  email:", email);
  console.log("  password:", password);
  console.log("  sign in at: https://stevenwilson614.github.io/amplop/#/login");
}

main().catch((e) => {
  console.error(e.message ?? e);
  process.exit(1);
});
