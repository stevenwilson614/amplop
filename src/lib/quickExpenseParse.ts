import { CURRENCY_DECIMALS } from "@/lib/currency";

export interface ParsedQuickExpense {
  amountMinor: number;
  currency: string;
  merchant: string;
  raw: string;
}

/**
 * Parse strings like:
 * - "45.000rp ambrogio"
 * - "500.000 rp doctors visit"
 * - "$12 coffee"
 * - "12 usd grab"
 */
export function parseQuickExpense(input: string): ParsedQuickExpense | null {
  const raw = input.trim();
  if (!raw) return null;

  // $12.50 coffee / $12 coffee
  const dollar = raw.match(/^\$\s*([\d.,]+)\s+(.+)$/i);
  if (dollar) {
    const amountMinor = parseAmountToMinor(dollar[1], "USD");
    if (amountMinor <= 0) return null;
    return { amountMinor, currency: "USD", merchant: dollar[2].trim(), raw };
  }

  // 45.000rp ambrogio / 500.000 rp doctors / 12 usd grab / 12.50 EUR lunch
  const general = raw.match(
    /^([\d.,]+)\s*(rp|idr|usd|eur|sgd|gbp|aud|jpy|\$)?\s+(.+)$/i
  );
  if (!general) return null;

  const amountStr = general[1];
  const currToken = (general[2] || "IDR").toUpperCase().replace("$", "USD");
  const currency =
    currToken === "RP" ? "IDR" : currToken in CURRENCY_DECIMALS ? currToken : "IDR";
  const merchant = general[3].trim();
  if (!merchant) return null;

  const amountMinor = parseAmountToMinor(amountStr, currency);
  if (amountMinor <= 0) return null;

  return { amountMinor, currency, merchant, raw };
}

/** IDR often uses dots as thousands separators (45.000 = 45000). */
function parseAmountToMinor(value: string, currency: string): number {
  const decimals = CURRENCY_DECIMALS[currency] ?? 2;
  let cleaned = value.trim();

  if (currency === "IDR" || currency === "JPY") {
    // Treat dots as thousands; ignore commas
    cleaned = cleaned.replace(/\./g, "").replace(/,/g, "");
    const num = parseFloat(cleaned);
    if (isNaN(num)) return 0;
    return Math.round(num * Math.pow(10, decimals));
  }

  // Western: 1,234.56 or 12.50
  if (cleaned.includes(",") && cleaned.includes(".")) {
    cleaned = cleaned.replace(/,/g, "");
  } else if (cleaned.includes(",") && !cleaned.includes(".")) {
    // Could be EU decimal comma
    cleaned = cleaned.replace(",", ".");
  }

  const num = parseFloat(cleaned.replace(/[^0-9.]/g, ""));
  if (isNaN(num)) return 0;
  return Math.round(num * Math.pow(10, decimals));
}

export function amountMinorToInput(amountMinor: number, currency: string): string {
  const decimals = CURRENCY_DECIMALS[currency] ?? 2;
  return (amountMinor / Math.pow(10, decimals)).toFixed(decimals);
}
