import type { Envelope } from "@/lib/types";

export interface PayeeHistoryRow {
  merchant: string;
  envelopeId: string;
  count: number;
}

/** Common payee keywords → envelope name pattern (case-insensitive). */
const KEYWORD_ENVELOPE_RULES: Array<{ payee: RegExp; envelope: RegExp }> = [
  { payee: /mcdonald|burger|kfc|pizza|restaurant|starbucks|coffee|cafe|padang|korean|indian|gummnut|tinyseed|farm girl|german haus|lamnasu|wheels|chocolate|eating/i, envelope: /eating out/i },
  { payee: /indomaret|hero|yogya|grocer|sayur|supermarket|carrefour|hypermart|bertam|bread|kopi|oat milk|meat|daging|beras/i, envelope: /grocer/i },
  { payee: /grab|gojek|gas|petrol|shell|pertamina|motor/i, envelope: /grab|gas/i },
  { payee: /gift|wedding|donation|charity|giving/i, envelope: /giving/i },
  { payee: /golf|golfing/i, envelope: /steven|golf|personal.*steven/i },
  { payee: /salon|hair|olivia|spa|cosmetic|cream|vitamin/i, envelope: /olivia|personal.*olivia/i },
  { payee: /vet|roky|rocky|cat|pet|litter|vaccine/i, envelope: /rocky/i },
  { payee: /class|ferry|language|art class|private/i, envelope: /private class/i },
  { payee: /maintenance|repair|plumber|electric/i, envelope: /house maintenance/i },
  { payee: /hotel|flight|airport|vacation|sheraton|well|island/i, envelope: /vacation|fun/i },
];

function normPayee(s: string): string {
  return s.trim().toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ");
}

function findEnvelopeByPattern(envelopes: Envelope[], pattern: RegExp): Envelope | undefined {
  return envelopes.find((e) => pattern.test(e.name));
}

export function buildPayeeHistoryMap(rows: PayeeHistoryRow[]): Map<string, string> {
  const counts = new Map<string, Map<string, number>>();
  for (const row of rows) {
    const key = normPayee(row.merchant);
    if (!key) continue;
    if (!counts.has(key)) counts.set(key, new Map());
    const inner = counts.get(key)!;
    inner.set(row.envelopeId, (inner.get(row.envelopeId) ?? 0) + row.count);
  }

  const result = new Map<string, string>();
  for (const [payee, envCounts] of counts) {
    let bestId = "";
    let best = 0;
    for (const [envId, c] of envCounts) {
      if (c > best) { best = c; bestId = envId; }
    }
    if (bestId) result.set(payee, bestId);
  }
  return result;
}

export function resolveEnvelopeForPayee(
  payee: string,
  envelopes: Envelope[],
  historyMap: Map<string, string>,
): Envelope | undefined {
  const q = normPayee(payee);
  if (!q) return undefined;

  // Exact history match
  const exact = historyMap.get(q);
  if (exact) return envelopes.find((e) => e.id === exact);

  // Partial history match (e.g. "mcdonalds jakarta" → prior "mcdonalds")
  for (const [histPayee, envId] of historyMap) {
    if (q.includes(histPayee) || histPayee.includes(q)) {
      const env = envelopes.find((e) => e.id === envId);
      if (env) return env;
    }
  }

  // Keyword rules
  for (const rule of KEYWORD_ENVELOPE_RULES) {
    if (rule.payee.test(q)) {
      const env = findEnvelopeByPattern(envelopes, rule.envelope);
      if (env) return env;
    }
  }

  return undefined;
}

export function aggregatePayeeHistoryFromTxs(
  txs: Array<{
    merchant_name: string | null;
    allocations?: Array<{ envelope_id: string }>;
  }>,
): PayeeHistoryRow[] {
  const acc = new Map<string, Map<string, number>>();
  for (const tx of txs) {
    const merchant = (tx.merchant_name ?? "").trim();
    const envelopeId = tx.allocations?.[0]?.envelope_id;
    if (!merchant || !envelopeId) continue;
    const key = normPayee(merchant);
    if (!acc.has(key)) acc.set(key, new Map());
    const inner = acc.get(key)!;
    inner.set(envelopeId, (inner.get(envelopeId) ?? 0) + 1);
  }

  const rows: PayeeHistoryRow[] = [];
  for (const [merchant, envCounts] of acc) {
    for (const [envelopeId, count] of envCounts) {
      rows.push({ merchant, envelopeId, count });
    }
  }
  return rows;
}
