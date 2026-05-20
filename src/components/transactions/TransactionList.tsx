import type { Transaction, Envelope, FxRates } from "@/lib/types";
import { format, convert } from "@/lib/currency";

interface Props {
  transactions: Transaction[];
  envelopes: Envelope[];
  displayCurrency: string;
  fxRates: FxRates;
}

export default function TransactionList({ transactions, envelopes, displayCurrency, fxRates }: Props) {
  const dc = displayCurrency;
  const envMap = new Map(envelopes.map(e => [e.id, e]));

  // Group by date
  const grouped = groupByDate(transactions);

  if (transactions.length === 0) {
    return <p className="text-center py-12 font-mono text-sm text-brand-text-muted">no transactions yet</p>;
  }

  return (
    <div className="space-y-4">
      {grouped.map(({ date, items }) => (
        <div key={date}>
          <p className="font-mono text-xs text-brand-text-muted uppercase tracking-widest mb-2">{formatDate(date)}</p>
          <div className="space-y-2">
            {items.map(tx => {
              const amountDisplay = dc === "IDR"
                ? tx.amount_idr_snapshot
                : convert(tx.amount_idr_snapshot, "IDR", dc, fxRates);

              const envNames = tx.allocations
                ?.map(a => envMap.get(a.envelope_id)?.name)
                .filter(Boolean)
                .join(", ") ?? "";

              return (
                <div key={tx.id} className="flex items-center justify-between rounded-xl bg-brand-primary border border-brand-border p-3">
                  <div className="min-w-0">
                    <p className="font-mono text-sm text-brand-text font-semibold truncate">
                      {tx.merchant_name || tx.notes || "—"}
                    </p>
                    <p className="font-mono text-xs text-brand-text-muted truncate">{envNames}</p>
                  </div>
                  <span className="ml-3 font-mono text-sm font-semibold text-brand-text whitespace-nowrap">
                    -{format(amountDisplay, dc)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function groupByDate(txs: Transaction[]) {
  const map = new Map<string, Transaction[]>();
  for (const tx of txs) {
    if (!map.has(tx.date)) map.set(tx.date, []);
    map.get(tx.date)!.push(tx);
  }
  return Array.from(map.entries()).map(([date, items]) => ({ date, items }));
}

function formatDate(iso: string) {
  const d = new Date(iso + "T00:00:00");
  return d.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric" });
}
