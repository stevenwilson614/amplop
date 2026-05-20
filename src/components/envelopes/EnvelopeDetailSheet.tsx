import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import type { Envelope, Transaction } from "@/lib/types";
import type { FxRates } from "@/lib/types";
import { convert, format } from "@/lib/currency";
import WhaleMood from "@/components/ui/WhaleMood";

interface Props {
  open: boolean;
  envelope: Envelope | null;
  spentIdr: number;
  availableIdr: number;
  monthSpentIdr: number;
  paceDeltaIdr: number;
  displayCurrency: string;
  fxRates: FxRates;
  isTripEnvelope?: boolean;
  tripDaysRemaining?: number;
  onClose: () => void;
  onEdit: () => void;
  onAddTransaction: () => void;
}

export default function EnvelopeDetailSheet({
  open,
  envelope,
  spentIdr,
  availableIdr,
  paceDeltaIdr,
  displayCurrency,
  fxRates,
  isTripEnvelope = false,
  tripDaysRemaining = 30,
  onClose,
  onEdit,
  onAddTransaction,
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
        .select("*, user:users(display_name), allocations:transaction_allocations(*)")
        .eq("household_id", targetEnvelope.household_id)
        .order("date", { ascending: false })
        .order("created_at", { ascending: false });
      if (cancelled) return;
      const filtered = (data ?? []).filter((tx) =>
        tx.allocations?.some((a: { envelope_id: string }) => a.envelope_id === targetEnvelope.id)
      );
      setTxs(filtered as Transaction[]);
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
  const availableDisplay = dc === "IDR" ? availableIdr : convert(availableIdr, "IDR", dc, fxRates);
  const paceGood = paceDeltaIdr >= 0;
  const paceDeltaDisplay = dc === "IDR" ? Math.abs(paceDeltaIdr) : convert(Math.abs(paceDeltaIdr), "IDR", dc, fxRates);

  const paceMessage = useMemo(() => {
    if (!envelope) return "";
    const budgetMinor = envelope.budget_amount;
    const budgetIdr = envelope.budget_currency === "IDR"
      ? budgetMinor
      : convert(budgetMinor, envelope.budget_currency, "IDR", fxRates);
    const now = new Date();
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const dailyRateIdr = isTripEnvelope
      ? Math.max(1, Math.round(budgetIdr / Math.max(1, tripDaysRemaining)))
      : Math.max(1, Math.round(budgetIdr / daysInMonth));
    const daysToRecover = Math.max(1, Math.ceil(Math.abs(paceDeltaIdr) / dailyRateIdr));

    if (paceGood) {
      return `Great! You're ahead by ${format(paceDeltaDisplay, dc)}`;
    }
    return `You're behind by ${format(paceDeltaDisplay, dc)}, stop spending for ${daysToRecover} days!`;
  }, [envelope, paceDeltaIdr, paceDeltaDisplay, dc, fxRates, isTripEnvelope, tripDaysRemaining, paceGood]);

  const grouped = useMemo(() => {
    const map = new Map<string, Transaction[]>();
    for (const tx of txs) {
      if (!map.has(tx.date)) map.set(tx.date, []);
      map.get(tx.date)!.push(tx);
    }
    return Array.from(map.entries());
  }, [txs]);

  if (!open || !envelope) return null;

  const remainingPct = availableIdr > 0
    ? Math.max(0, Math.min(100, Math.round((Math.max(0, balanceIdr) / availableIdr) * 100)))
    : 0;

  return (
    <div className="fixed inset-0 bottom-0 z-40 flex flex-col bg-brand-surface pb-24 sm:mx-auto sm:h-[896px] sm:max-w-[430px] sm:overflow-hidden sm:rounded-[34px]">
      <div className="bg-brand-accent px-4 pb-3 pt-5 text-white">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-[#8AF4A6] px-3 py-2 text-sm font-semibold text-[#0F3C1B]"
          >
            {"<"}
          </button>
          <h2 className="text-xl font-semibold">{envelope.name}</h2>
          <button
            type="button"
            onClick={onEdit}
            className="rounded-full bg-[#8AF4A6] px-3 py-2 text-sm font-semibold text-[#0F3C1B]"
          >
            edit
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto bg-brand-surface pb-4">
        <div className="border-b border-brand-border px-4 py-3">
          <div className="flex items-center gap-3">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full bg-brand-accent shadow-sm">
              <WhaleMood happy={paceGood} className="h-16 w-16" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="relative h-[10px] w-full overflow-visible bg-[#EEF1F3]">
                <div
                  className="absolute z-10 w-[2px] bg-[#1E2733]"
                  style={{
                    left: `${remainingPct}%`,
                    top: "-2px",
                    bottom: "-2px",
                  }}
                />
                <div
                  className={`h-full ${balanceIdr >= 0 ? "bg-brand-accent" : "bg-red-500"}`}
                  style={{ width: `${remainingPct}%` }}
                />
              </div>
            </div>
            <div className="shrink-0 text-right">
              <p className={`text-lg font-semibold leading-tight ${balanceIdr < 0 ? "text-red-500" : "text-brand-text"}`}>
                {format(balanceDisplay, dc)}
              </p>
              <p className="text-xs text-brand-text-muted">{format(availableDisplay, dc)}</p>
            </div>
          </div>
          <p className={`mt-2 text-sm ${paceGood ? "text-brand-accent" : "text-red-500"}`}>
            {paceMessage}
          </p>
          <button
            type="button"
            onClick={onAddTransaction}
            className="mt-3 w-full rounded-xl bg-brand-accent py-2 text-sm font-semibold text-white"
          >
            + Add Transaction
          </button>
        </div>

        {loading && <p className="px-4 py-3 text-sm text-brand-text-muted">Loading transactions...</p>}
        {!loading && grouped.length === 0 && <p className="px-4 py-3 text-sm text-brand-text-muted">No transactions yet.</p>}
        {!loading && grouped.length > 0 && (
          <div className="space-y-2">
            {grouped.map(([date, items]) => (
              <div key={date}>
                <div className="flex items-center justify-between bg-brand-bg px-4 py-1 text-xs font-semibold text-brand-text-muted">
                  <span>{formatWeekday(date)}</span>
                  <span>{formatDateShort(date)}</span>
                </div>
                {items.map((tx) => {
                  const amountDisplay = dc === "IDR"
                    ? tx.amount_idr_snapshot
                    : convert(tx.amount_idr_snapshot, "IDR", dc, fxRates);
                  const poster = tx.user?.display_name?.trim() || "Unknown";
                  const merchant = tx.merchant_name || tx.notes || "Expense";
                  return (
                    <div key={tx.id} className="flex items-start justify-between border-b border-brand-border px-4 py-2">
                      <div className="min-w-0 pr-3">
                        <p className="truncate text-lg font-medium leading-tight text-brand-text">
                          {merchant}
                        </p>
                        <p className="text-sm leading-tight text-brand-text-muted">{poster}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className="text-base font-medium leading-tight text-brand-text">{format(amountDisplay, dc)}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function formatDateShort(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function formatWeekday(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString("en-US", {
    weekday: "short",
  });
}
