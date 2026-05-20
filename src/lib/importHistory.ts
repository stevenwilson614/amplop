import { supabase } from "@/lib/supabase";
import type { Envelope } from "@/lib/types";
import { convert, getRate, parseToMinorUnits, CURRENCY_DECIMALS } from "@/lib/currency";
import type { FxRates } from "@/lib/types";

export interface ImportRow {
  date: string;
  envelope: string;
  amountMinor: number;
  currency: string;
  merchant?: string;
}

export function parseImportCsv(text: string): ImportRow[] {
  const lines = text.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];

  const header = lines[0].toLowerCase().split(",").map((h) => h.trim());
  const dateIdx = header.findIndex((h) => h.includes("date"));
  const envIdx = header.findIndex((h) => h.includes("envelope") || h.includes("category"));
  const amtIdx = header.findIndex((h) => h.includes("amount"));
  const merchIdx = header.findIndex((h) => h.includes("merchant") || h.includes("payee") || h.includes("place"));
  const curIdx = header.findIndex((h) => h.includes("currency") || h === "cur");

  if (dateIdx < 0 || envIdx < 0 || amtIdx < 0) {
    throw new Error("CSV needs columns: date, envelope, amount (optional: merchant, currency)");
  }

  const rows: ImportRow[] = [];
  for (let i = 1; i < lines.length; i++) {
    const cols = splitCsvLine(lines[i]);
    const dateRaw = cols[dateIdx]?.trim();
    const envelope = cols[envIdx]?.trim();
    const amountRaw = cols[amtIdx]?.trim();
    const currency = ((curIdx >= 0 ? cols[curIdx]?.trim() : "IDR") || "IDR").toUpperCase();
    const merchant = merchIdx >= 0 ? cols[merchIdx]?.trim() : undefined;
    if (!dateRaw || !envelope || !amountRaw) continue;

    const date = normalizeDate(dateRaw);
    const amountMinor = parseCsvAmount(amountRaw, currency);
    if (!date || amountMinor <= 0) continue;

    rows.push({
      date,
      envelope,
      amountMinor,
      currency,
      merchant,
    });
  }
  return rows;
}

export function splitCsvLine(line: string): string[] {
  const out: string[] = [];
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

function parseCsvAmount(raw: string, currency: string): number {
  const cleaned = raw.trim().replace(/[^\d.,-]/g, "");
  if (!cleaned) return 0;
  const decimals = CURRENCY_DECIMALS[currency] ?? 2;
  if (decimals === 0) {
    const digits = cleaned.replace(/[.,]/g, "");
    return parseToMinorUnits(digits, currency);
  }
  return parseToMinorUnits(cleaned.replace(/,/g, ""), currency);
}
export function normalizeDate(raw: string): string | null {
  if (/^\d{4}-\d{2}-\d{2}$/.test(raw)) return raw;
  const d = new Date(raw);
  if (isNaN(d.getTime())) return null;
  return d.toLocaleDateString("en-CA");
}

function findEnvelope(envelopes: Envelope[], name: string): Envelope | undefined {
  const q = name.trim().toLowerCase();
  return envelopes.find((e) => e.name.toLowerCase() === q)
    ?? envelopes.find((e) => e.name.toLowerCase().includes(q));
}

export async function importTransactionHistory(args: {
  rows: ImportRow[];
  envelopes: Envelope[];
  householdId: string;
  userId: string;
  fxRates: FxRates;
}): Promise<{ imported: number; skipped: number; errors: string[] }> {
  const { rows, envelopes, householdId, userId, fxRates } = args;
  let imported = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const row of rows) {
    const env = findEnvelope(envelopes, row.envelope);
    if (!env) {
      skipped++;
      errors.push(`No envelope match: ${row.envelope}`);
      continue;
    }

    const currency = row.currency || env.budget_currency || "IDR";
    const amountMinor = row.amountMinor;
    if (amountMinor <= 0) { skipped++; continue; }

    const amountIdr = convert(amountMinor, currency, "IDR", fxRates);
    const fxRate = currency === "IDR" ? 1 : getRate(fxRates, currency, "IDR");

    const { data: tx, error: txErr } = await supabase
      .from("transactions")
      .insert({
        household_id: householdId,
        user_id: userId,
        tx_type: "expense",
        amount: amountMinor,
        currency,
        amount_idr_snapshot: amountIdr,
        fx_rate_snapshot: fxRate,
        date: row.date,
        merchant_name: row.merchant || null,
        notes: "Imported",
      })
      .select()
      .single();

    if (txErr || !tx) {
      skipped++;
      errors.push(txErr?.message ?? `Failed: ${row.envelope} ${row.date}`);
      continue;
    }

    const { error: allocErr } = await supabase.from("transaction_allocations").insert({
      transaction_id: tx.id,
      envelope_id: env.id,
      amount: amountMinor,
    });

    if (allocErr) {
      skipped++;
      errors.push(allocErr.message);
      continue;
    }
    imported++;
  }

  return { imported, skipped, errors };
}

export const IMPORT_CSV_TEMPLATE = `date,envelope,amount,merchant,currency
2026-01-05,Groceries,350000,Indomaret,IDR
2026-01-08,Eating Out,85000,McDonald's,IDR
2026-01-12,Groceries,120000,Hero,IDR`;
