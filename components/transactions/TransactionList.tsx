"use client";

import { useState } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { format, convert, type FxRates } from "@/lib/currency";

interface EnvelopeRef {
  id: string;
  name: string;
  budget_currency: string;
}

interface AllocationRow {
  id: string;
  amount: number;
  envelope_id: string;
  envelopes: EnvelopeRef | null;
}

interface Transaction {
  id: string;
  amount: number;
  currency: string;
  amount_idr_snapshot: number;
  date: string;
  merchant_name: string | null;
  notes: string | null;
  location_name: string | null;
  created_at: string;
  transaction_allocations: AllocationRow[];
  users: { display_name: string } | null;
}

interface Props {
  initialTransactions: Transaction[];
  displayCurrency: string;
  fxRates: FxRates;
}

function groupByDate(txns: Transaction[]): Array<{ label: string; items: Transaction[] }> {
  const todayStr = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterdayStr = yesterdayDate.toLocaleDateString("en-CA", { timeZone: "Asia/Jakarta" });

  const map = new Map<string, Transaction[]>();
  for (const txn of txns) {
    const d = txn.date;
    if (!map.has(d)) map.set(d, []);
    map.get(d)!.push(txn);
  }

  return Array.from(map.entries()).map(([date, items]) => ({
    label:
      date === todayStr ? "Today" : date === yesterdayStr ? "Yesterday" : formatDateLabel(date),
    items,
  }));
}

function formatDateLabel(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { weekday: "short", day: "numeric", month: "short" });
}

export default function TransactionList({ initialTransactions, displayCurrency, fxRates }: Props) {
  const [transactions, setTransactions] = useState(initialTransactions);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  async function handleDelete(id: string) {
    const supabase = createClient();
    // transaction_allocations cascade deletes automatically
    const { error } = await supabase.from("transactions").delete().eq("id", id);
    if (!error) setTransactions((prev) => prev.filter((t) => t.id !== id));
    setDeleteConfirm(null);
  }

  const grouped = groupByDate(transactions);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <header className="flex items-center justify-between p-4 shrink-0">
        <h1 className="text-xl font-semibold text-brand-text">Transactions</h1>
        <Link
          href="/transactions/new"
          className="h-10 px-3 flex items-center gap-1.5 rounded-full bg-brand-accent text-white text-sm font-medium active:opacity-80"
        >
          <PlusIcon />
          Add
        </Link>
      </header>

      {/* Empty state */}
      {transactions.length === 0 && (
        <div className="flex flex-col items-center justify-center flex-1 text-center px-8">
          <div className="w-14 h-14 bg-brand-surface rounded-2xl flex items-center justify-center mb-4">
            <ReceiptIcon />
          </div>
          <p className="text-brand-text font-medium mb-1">No transactions yet</p>
          <p className="text-brand-text-muted text-sm">Tap Add to record your first spend</p>
        </div>
      )}

      {/* List */}
      <div className="flex-1 overflow-y-auto px-4 pb-6">
        {grouped.map(({ label, items }) => (
          <div key={label} className="mb-6">
            <h2 className="text-xs font-semibold text-brand-text-muted uppercase tracking-widest mb-2">
              {label}
            </h2>
            <div className="space-y-2">
              {items.map((txn) => {
                const amountDisplay = format(txn.amount, txn.currency);
                const inDisplayCurrency =
                  txn.currency !== displayCurrency
                    ? format(
                        convert(txn.amount_idr_snapshot, "IDR", displayCurrency, fxRates),
                        displayCurrency
                      )
                    : null;

                const envelopeNames = txn.transaction_allocations
                  .map((a) => a.envelopes?.name ?? "")
                  .filter(Boolean)
                  .join(", ");

                const isExpanded = expanded === txn.id;
                const isConfirming = deleteConfirm === txn.id;

                return (
                  <div
                    key={txn.id}
                    className="bg-brand-surface border border-brand-border rounded-xl overflow-hidden"
                  >
                    {/* Main row */}
                    <button
                      onClick={() => setExpanded(isExpanded ? null : txn.id)}
                      className="w-full flex items-center gap-3 px-4 py-3.5 text-left"
                    >
                      <div className="flex-1 min-w-0">
                        <p className="text-brand-text font-medium truncate">
                          {txn.merchant_name || "Transaction"}
                        </p>
                        <p className="text-brand-text-muted text-xs truncate">{envelopeNames}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-brand-text font-mono">{amountDisplay}</p>
                        {inDisplayCurrency && (
                          <p className="text-brand-text-muted text-xs">{inDisplayCurrency}</p>
                        )}
                      </div>
                    </button>

                    {/* Expanded details */}
                    {isExpanded && (
                      <div className="border-t border-brand-border px-4 py-3 space-y-2">
                        {txn.notes && (
                          <p className="text-brand-text-muted text-sm">{txn.notes}</p>
                        )}
                        {txn.location_name && (
                          <p className="text-brand-text-muted text-xs flex items-center gap-1">
                            <LocationIcon />
                            {txn.location_name}
                          </p>
                        )}
                        {/* Allocations breakdown */}
                        {txn.transaction_allocations.length > 1 && (
                          <div className="space-y-1">
                            {txn.transaction_allocations.map((a) => (
                              <div key={a.id} className="flex justify-between text-xs text-brand-text-muted">
                                <span>{a.envelopes?.name}</span>
                                <span className="font-mono">{format(a.amount, txn.currency)}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        <p className="text-brand-text-muted text-xs">
                          Added by {txn.users?.display_name ?? "you"}
                        </p>

                        {/* Delete */}
                        <div className="pt-1">
                          {isConfirming ? (
                            <div className="flex gap-4">
                              <button
                                onClick={() => handleDelete(txn.id)}
                                className="text-red-400 text-sm font-medium"
                              >
                                Confirm delete
                              </button>
                              <button
                                onClick={() => setDeleteConfirm(null)}
                                className="text-brand-text-muted text-sm"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setDeleteConfirm(txn.id)}
                              className="text-brand-text-muted text-sm"
                            >
                              Delete transaction
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  );
}

function ReceiptIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-7 h-7 text-brand-muted">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25z" />
    </svg>
  );
}

function LocationIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-3 h-3 shrink-0">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 10.5a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 10.5c0 7.142-7.5 11.25-7.5 11.25S4.5 17.642 4.5 10.5a7.5 7.5 0 1115 0z" />
    </svg>
  );
}
