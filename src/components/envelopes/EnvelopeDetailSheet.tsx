import { useEffect, useMemo, useState } from "react";
import Sheet from "@/components/ui/Sheet";
import { supabase } from "@/lib/supabase";
import type { Envelope, Transaction } from "@/lib/types";
import type { FxRates } from "@/lib/types";
import { convert, format } from "@/lib/currency";

interface Props {
  open: boolean;
  envelope: Envelope | null;
  spentIdr: number;
  availableIdr: number;
  monthSpentIdr: number;
  paceDeltaIdr: number;
  displayCurrency: string;
  fxRates: FxRates;
  onClose: () => void;
  onEdit: () => void;
}

export default function EnvelopeDetailSheet({
  open,
  envelope,
  spentIdr,
  availableIdr,
  monthSpentIdr,
  paceDeltaIdr,
  displayCurrency,
  fxRates,
  onClose,
  onEdit,
}: Props) {
  const [txs, setTxs] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !envelope) return;
    const targetEnvelope = envelope;
    let cancelled = false;
    async function loadTxs() {
      setLoading(true);
      const { data } = await supabase
        .from("transactions")
        .select("*, allocations:transaction_allocations(*)")
        .eq("household_id", targetEnvelope.household_id)
        .order("date", { ascending: false })
        .order("created_at", { ascending: false });
      if (cancelled) return;
      const filtered = (data ?? []).filter((tx) =>
        tx.allocations?.some((a: { envelope_id: string }) => a.envelope_id === targetEnvelope.id)
      );
      setTxs(filtered);
      setLoading(false);
    }
    loadTxs();
    return () => {
      cancelled = true;
    };
  }, [open, envelope]);

  const dc = displayCurrency;
  const balanceIdr = availableIdr - spentIdr;
  const balanceDisplay = dc === "IDR" ? balanceIdr : convert(balanceIdr, "IDR", dc, fxRates);
  const spentDisplay = dc === "IDR" ? spentIdr : convert(spentIdr, "IDR", dc, fxRates);
  const availableDisplay = dc === "IDR" ? availableIdr : convert(availableIdr, "IDR", dc, fxRates);
  const paceGood = paceDeltaIdr >= 0;
  const paceDeltaDisplay = dc === "IDR" ? paceDeltaIdr : convert(paceDeltaIdr, "IDR", dc, fxRates);
  const monthSpentDisplay = dc === "IDR" ? monthSpentIdr : convert(monthSpentIdr, "IDR", dc, fxRates);
  const mood = paceGood ? ":-)" : ":-(";

  const grouped = useMemo(() => {
    const map = new Map<string, Transaction[]>();
    for (const tx of txs) {
      if (!map.has(tx.date)) map.set(tx.date, []);
      map.get(tx.date)!.push(tx);
    }
    return Array.from(map.entries());
  }, [txs]);

  return (
    <Sheet open={open} onClose={onClose} title={envelope?.name ?? "envelope details"}>
      {envelope && (
        <div className="space-y-4">
          <div className="rounded-xl border border-brand-border bg-brand-bg p-3">
            <div className="mb-1 flex items-start justify-between">
              <div>
                <p className="text-lg font-semibold text-brand-text">{envelope.name}</p>
                <p className={`text-xs ${paceGood ? "text-brand-accent" : "text-red-500"}`}>
                  {paceGood ? "Great! You are ahead of daily budget" : "You are over daily budget pace"}
                </p>
              </div>
              <div className="text-2xl">{mood}</div>
            </div>
            <div className="mb-2 h-2 w-full rounded-full bg-[#EEF1F3]">
              <div
                className={`h-full rounded-full ${balanceIdr >= 0 ? "bg-brand-accent" : "bg-red-500"}`}
                style={{ width: `${Math.max(0, Math.min(100, Math.round((Math.max(0, balanceIdr) / Math.max(1, availableIdr)) * 100)))}%` }}
              />
            </div>
            <div className="grid grid-cols-2 gap-2 text-xs text-brand-text-muted">
              <p>left: {format(balanceDisplay, dc)}</p>
              <p className="text-right">available: {format(availableDisplay, dc)}</p>
              <p>spent total: {format(spentDisplay, dc)}</p>
              <p className="text-right">month: {format(monthSpentDisplay, dc)}</p>
              <p className={paceGood ? "text-brand-accent" : "text-red-500"}>
                {paceGood ? "ahead" : "behind"} by {format(Math.abs(paceDeltaDisplay), dc)}
              </p>
            </div>
            <button
              type="button"
              onClick={onEdit}
              className="mt-3 rounded-lg border border-brand-border px-3 py-1 text-xs font-semibold text-brand-text-muted"
            >
              edit envelope
            </button>
          </div>

          {loading && <p className="text-sm text-brand-text-muted">Loading transactions...</p>}
          {!loading && grouped.length === 0 && <p className="text-sm text-brand-text-muted">No transactions yet.</p>}
          {!loading && grouped.length > 0 && (
            <div className="space-y-3">
              {grouped.map(([date, items]) => (
                <div key={date}>
                  <p className="mb-1 text-xs font-semibold text-brand-text-muted">{formatDateHeader(date)}</p>
                  <div className="space-y-2">
                    {items.map((tx) => {
                      const amountDisplay = dc === "IDR"
                        ? tx.amount_idr_snapshot
                        : convert(tx.amount_idr_snapshot, "IDR", dc, fxRates);
                      return (
                        <div key={tx.id} className="flex items-start justify-between border-b border-brand-border pb-2">
                          <div className="min-w-0">
                            <p className="truncate text-base font-medium text-brand-text">
                              {tx.merchant_name || tx.notes || "Expense"}
                            </p>
                            <p className="text-sm text-brand-text-muted">My Account</p>
                          </div>
                          <div className="text-right">
                            <p className="text-base font-semibold text-brand-text">{format(amountDisplay, dc)}</p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </Sheet>
  );
}

function formatDateHeader(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}
