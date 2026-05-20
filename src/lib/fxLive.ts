import type { FxRates } from "@/lib/types";

/** Fetch live market rates when DB / edge sync is stale. */
export async function fetchLiveFxRates(): Promise<FxRates | null> {
  try {
    const res = await fetch("https://open.er-api.com/v6/latest/USD");
    if (!res.ok) return null;
    const body = (await res.json()) as { rates?: Record<string, number> };
    const rates = body.rates;
    if (!rates?.IDR) return null;

    const usdToIdr = rates.IDR;
    const out: FxRates = { USD_IDR: usdToIdr };
    for (const [code, usdRate] of Object.entries(rates)) {
      if (code === "IDR") continue;
      out[`${code}_IDR`] = usdToIdr / usdRate;
    }
    return out;
  } catch {
    return null;
  }
}

export function mergeFxRates(base: FxRates, live: FxRates): FxRates {
  return { ...base, ...live };
}
