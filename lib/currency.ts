// All amounts throughout the app are stored as integers in the currency's minor unit.
// IDR has no minor unit (decimals = 0), so Rp 1,000,000 is stored as 1000000.
// USD has 2 decimal places, so $250.00 is stored as 25000 (cents).

export const CURRENCY_DECIMALS: Record<string, number> = {
  IDR: 0,
  USD: 2,
  EUR: 2,
  SGD: 2,
  AUD: 2,
  GBP: 2,
  JPY: 0,
  MYR: 2,
  THB: 2,
  PHP: 2,
  KRW: 0,
  CNY: 2,
  HKD: 2,
};

const CURRENCY_SYMBOLS: Record<string, string> = {
  IDR: "Rp",
  USD: "$",
  EUR: "€",
  SGD: "S$",
  AUD: "A$",
  GBP: "£",
  JPY: "¥",
  MYR: "RM",
  THB: "฿",
  PHP: "₱",
  KRW: "₩",
  CNY: "¥",
  HKD: "HK$",
};

// Keyed as "FROM/TO" e.g. "USD/IDR" → 16500 means 1 USD = 16500 IDR
export type FxRates = Record<string, number>;

// Returns the exchange rate to convert 1 unit of `from` into `to`.
// Falls back to IDR as a bridge currency if no direct rate exists.
export function getRate(from: string, to: string, fxRates: FxRates): number {
  if (from === to) return 1;

  const direct = fxRates[`${from}/${to}`];
  if (direct) return direct;

  const inverse = fxRates[`${to}/${from}`];
  if (inverse) return 1 / inverse;

  // Bridge via IDR
  const fromToIDR = from === "IDR" ? 1 : fxRates[`${from}/IDR`];
  const toToIDR = to === "IDR" ? 1 : fxRates[`${to}/IDR`];
  if (fromToIDR && toToIDR) return fromToIDR / toToIDR;

  console.warn(`No FX rate for ${from}/${to}, returning 1`);
  return 1;
}

// Converts `amount` (in minor units of `from`) to minor units of `to`.
// Example: convert(25000, "USD", "IDR", {"USD/IDR": 16500})
//   → 25000 cents = $250 × 16500 = 4,125,000 IDR
export function convert(
  amount: number,
  from: string,
  to: string,
  fxRates: FxRates
): number {
  if (from === to) return amount;

  const rate = getRate(from, to, fxRates);
  const fromDecimals = CURRENCY_DECIMALS[from] ?? 2;
  const toDecimals = CURRENCY_DECIMALS[to] ?? 2;

  const majorUnits = amount / Math.pow(10, fromDecimals);
  return Math.round(majorUnits * rate * Math.pow(10, toDecimals));
}

// Formats minor-unit amount as a human-readable string.
// format(1000000, "IDR") → "Rp 1.000.000"
// format(25000, "USD")   → "$250.00"
export function format(amount: number, currency: string): string {
  const decimals = CURRENCY_DECIMALS[currency] ?? 2;
  const symbol = CURRENCY_SYMBOLS[currency] ?? currency;
  const major = amount / Math.pow(10, decimals);

  if (currency === "IDR") {
    const formatted = new Intl.NumberFormat("id-ID", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(major);
    return `${symbol} ${formatted}`;
  }

  const formatted = new Intl.NumberFormat("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(major);
  return `${symbol}${formatted}`;
}

// Converts a user-typed major-unit string to stored minor units.
// parseToMinorUnits("250", "USD") → 25000
// parseToMinorUnits("1000000", "IDR") → 1000000
export function parseToMinorUnits(input: string, currency: string): number {
  const decimals = CURRENCY_DECIMALS[currency] ?? 2;
  const raw = parseFloat(input.replace(/[^0-9.]/g, ""));
  if (isNaN(raw) || raw < 0) return 0;
  return Math.round(raw * Math.pow(10, decimals));
}

// Converts stored minor units to a plain numeric string for display in an input.
// toInputValue(25000, "USD") → "250.00"
// toInputValue(1000000, "IDR") → "1000000"
export function toInputValue(minorUnits: number, currency: string): string {
  const decimals = CURRENCY_DECIMALS[currency] ?? 2;
  const major = minorUnits / Math.pow(10, decimals);
  return decimals === 0 ? major.toFixed(0) : major.toFixed(decimals);
}
