export const CURRENCY_DECIMALS: Record<string, number> = {
  IDR: 0,
  USD: 2,
  EUR: 2,
  GBP: 2,
  JPY: 0,
  SGD: 2,
  AUD: 2,
  CAD: 2,
  CHF: 2,
  CNY: 2,
  HKD: 2,
  MYR: 2,
  THB: 2,
};

export type FxRates = Record<string, number>;

// Returns the major-unit rate: how many units of `to` per 1 major unit of `from`.
// Rates object has keys like 'USD_IDR' = 16000 (1 USD = 16000 IDR).
export function getRate(rates: FxRates, from: string, to: string): number {
  if (from === to) return 1;
  const key = `${from}_${to}`;
  const inv = `${to}_${from}`;
  if (rates[key]) return rates[key];
  if (rates[inv]) return 1 / rates[inv];
  // Bridge via IDR
  const fromIdr = rates[`${from}_IDR`] ?? (from === "IDR" ? 1 : null);
  const toIdr = rates[`${to}_IDR`] ?? (to === "IDR" ? 1 : null);
  if (fromIdr && toIdr) return fromIdr / toIdr;
  return 1;
}

// Convert minor units of `from` → minor units of `to`.
export function convert(amountMinor: number, from: string, to: string, rates: FxRates): number {
  if (from === to) return amountMinor;
  const rate = getRate(rates, from, to);
  const decimalsFrom = CURRENCY_DECIMALS[from] ?? 2;
  const decimalsTo = CURRENCY_DECIMALS[to] ?? 2;
  return Math.round(amountMinor * rate * Math.pow(10, decimalsTo - decimalsFrom));
}

// Format minor units as a locale string.
export function format(amountMinor: number, currency: string): string {
  const decimals = CURRENCY_DECIMALS[currency] ?? 2;
  const major = amountMinor / Math.pow(10, decimals);
  return new Intl.NumberFormat("id-ID", {
    style: "currency",
    currency,
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(major);
}

// Parse a human-entered string ("5.50", "80000") into minor units.
export function parseToMinorUnits(value: string, currency: string): number {
  const decimals = CURRENCY_DECIMALS[currency] ?? 2;
  const num = parseFloat(value.replace(/[^0-9.]/g, ""));
  if (isNaN(num)) return 0;
  return Math.round(num * Math.pow(10, decimals));
}

// Convert minor units to a decimal string for <input type="number">.
export function toInputValue(minorUnits: number, currency: string): string {
  const decimals = CURRENCY_DECIMALS[currency] ?? 2;
  return (minorUnits / Math.pow(10, decimals)).toFixed(decimals);
}

// Build FxRates map from DB rows (currency_pair = 'USD/IDR').
export function buildRates(rows: { currency_pair: string; rate: number }[]): FxRates {
  const rates: FxRates = {};
  for (const row of rows) {
    const [base, quote] = row.currency_pair.split("/");
    rates[`${base}_${quote}`] = Number(row.rate);
  }
  return rates;
}
