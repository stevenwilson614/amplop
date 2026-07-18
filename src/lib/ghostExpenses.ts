import type { Envelope, FxRates } from "@/lib/types";
import { convert } from "@/lib/currency";

/** Preset save-for / ghost expenses (monthly set-aside + goal). */
export const GHOST_EXPENSE_PRESETS = [
  {
    name: "Pulang Amerika",
    budget_amount: 25000,
    budget_currency: "USD",
    target_amount: 300000,
    target_currency: "USD",
    due_date: "2027-07-01",
  },
  {
    name: "Conferences",
    budget_amount: 20000,
    budget_currency: "USD",
    target_amount: 60000,
    target_currency: "USD",
    due_date: "2026-10-01",
  },
  {
    name: "Visa",
    budget_amount: 15300,
    budget_currency: "USD",
    target_amount: 45900,
    target_currency: "USD",
    due_date: "2026-10-01",
  },
  {
    name: "Rent",
    budget_amount: Math.ceil(110_000_000 / 12),
    budget_currency: "IDR",
    target_amount: 110_000_000,
    target_currency: "IDR",
    due_date: "2027-01-01",
  },
  {
    name: "Tax CPA",
    budget_amount: 19200,
    budget_currency: "USD",
    target_amount: 172800,
    target_currency: "USD",
    due_date: "2027-04-01",
  },
  {
    name: "Health Insurance",
    budget_amount: 18100,
    budget_currency: "USD",
    target_amount: 181000,
    target_currency: "USD",
    due_date: "2027-05-01",
  },
  {
    name: "Car Taxes",
    budget_amount: Math.ceil(2_500_000 / 12),
    budget_currency: "IDR",
    target_amount: 2_500_000,
    target_currency: "IDR",
    due_date: "2027-05-01",
  },
  {
    name: "Visa Run",
    budget_amount: 15800,
    budget_currency: "USD",
    target_amount: 47400,
    target_currency: "USD",
    due_date: "2026-10-01",
  },
  {
    name: "Gym",
    budget_amount: Math.ceil(11_000_000 / 12),
    budget_currency: "IDR",
    target_amount: 11_000_000,
    target_currency: "IDR",
    due_date: "2026-10-01",
  },
] as const;

export function monthlyGhostBudgetIdr(envelope: Envelope, fxRates: FxRates): number {
  const currency = envelope.budget_currency || "IDR";
  return currency === "IDR"
    ? envelope.budget_amount
    : convert(envelope.budget_amount, currency, "IDR", fxRates);
}

export function totalMonthlyGhostIdr(envelopes: Envelope[], fxRates: FxRates): number {
  return envelopes.reduce((sum, env) => sum + monthlyGhostBudgetIdr(env, fxRates), 0);
}

export function totalMonthlyGhostUsd(envelopes: Envelope[], fxRates: FxRates): number {
  const idr = totalMonthlyGhostIdr(envelopes, fxRates);
  return convert(idr, "IDR", "USD", fxRates);
}
