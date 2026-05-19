"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import { convert, format, type FxRates } from "@/lib/currency";
import type { Category, Envelope, TripWithEnvelopes } from "@/lib/types";
import EnvelopeSheet from "./EnvelopeSheet";
import TripSection from "@/components/trips/TripSection";

interface Props {
  displayCurrency: string;
  fxRates: FxRates;
  categories: Category[];
  initialEnvelopes: Envelope[];
  householdId: string;
  spentIdr: Record<string, number>;
  ratesUpdatedAt: string | null;
  initialTrips: TripWithEnvelopes[];
}

function fxAgeLabel(iso: string): string {
  const diffH = (Date.now() - new Date(iso).getTime()) / 3_600_000;
  if (diffH < 24) return "today";
  if (diffH < 48) return "yesterday";
  return `${Math.floor(diffH / 24)}d ago`;
}

export default function EnvelopeDashboard({
  displayCurrency,
  fxRates,
  categories,
  initialEnvelopes,
  householdId,
  spentIdr,
  ratesUpdatedAt,
  initialTrips,
}: Props) {
  const [envelopes, setEnvelopes] = useState<Envelope[]>(initialEnvelopes);
  const envelopesRef = useRef(initialEnvelopes);
  useEffect(() => {
    if (initialEnvelopes !== envelopesRef.current) {
      envelopesRef.current = initialEnvelopes;
      setEnvelopes(initialEnvelopes);
    }
  }, [initialEnvelopes]);

  const [sheetOpen, setSheetOpen] = useState(false);
  const [editing, setEditing] = useState<Envelope | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  function openCreate() {
    setEditing(null);
    setSheetOpen(true);
  }

  function openEdit(envelope: Envelope) {
    setEditing(envelope);
    setSheetOpen(true);
  }

  function closeSheet() {
    setSheetOpen(false);
    setEditing(null);
  }

  function handleSaved(envelope: Envelope, isNew: boolean) {
    setEnvelopes((prev) =>
      isNew ? [...prev, envelope] : prev.map((e) => (e.id === envelope.id ? envelope : e))
    );
    closeSheet();
  }

  async function handleDelete(id: string) {
    const supabase = createClient();
    const { error } = await supabase.from("envelopes").delete().eq("id", id);
    if (!error) setEnvelopes((prev) => prev.filter((e) => e.id !== id));
    setDeleteConfirm(null);
  }

  const grouped = categories
    .map((cat) => ({
      category: cat,
      envelopes: envelopes.filter((e) => e.category_id === cat.id),
    }))
    .filter((g) => g.envelopes.length > 0);

  const uncategorized = envelopes.filter((e) => !e.category_id);

  const totalBudget = envelopes.reduce(
    (sum, e) => sum + convert(e.budget_amount, e.budget_currency, displayCurrency, fxRates),
    0
  );

  return (
    <div className="p-4 pb-6">
      <header className="flex items-center justify-between py-2 mb-1">
        <h1 className="text-xl font-semibold text-brand-text">Envelopes</h1>
        <div className="flex items-center gap-2">
          <Link
            href="/transactions/new"
            className="h-10 px-3 flex items-center gap-1.5 rounded-full bg-brand-accent text-white text-sm font-medium active:opacity-80"
          >
            <PlusIcon />
            Add
          </Link>
          <button
            onClick={openCreate}
            className="w-10 h-10 flex items-center justify-center rounded-full bg-brand-surface border border-brand-border text-brand-accent active:opacity-70"
            aria-label="New envelope"
          >
            <EnvelopeAddIcon />
          </button>
        </div>
      </header>

      {envelopes.length > 0 && (
        <div className="flex items-center justify-between mb-5">
          <p className="text-brand-text-muted text-sm">
            {format(totalBudget, displayCurrency)} budgeted
          </p>
          {ratesUpdatedAt && (
            <span className="text-[11px] text-brand-text-muted">
              FX: {fxAgeLabel(ratesUpdatedAt)}
            </span>
          )}
        </div>
      )}

      {envelopes.length === 0 && (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <div className="w-16 h-16 bg-brand-surface rounded-2xl flex items-center justify-center mb-4">
            <EnvelopeEmptyIcon />
          </div>
          <p className="text-brand-text font-medium mb-1">No envelopes yet</p>
          <p className="text-brand-text-muted text-sm">
            Tap the envelope icon to create your first
          </p>
        </div>
      )}

      <div className="space-y-6">
        {grouped.map(({ category, envelopes: catEnvelopes }) => (
          <section key={category.id}>
            <h2 className="text-xs font-semibold text-brand-text-muted uppercase tracking-widest mb-2">
              {category.name}
            </h2>
            <div className="space-y-3">
              {catEnvelopes.map((envelope) => (
                <EnvelopeCard
                  key={envelope.id}
                  envelope={envelope}
                  displayCurrency={displayCurrency}
                  fxRates={fxRates}
                  spentIdr={spentIdr[envelope.id] ?? 0}
                  confirmingDelete={deleteConfirm === envelope.id}
                  onEdit={() => openEdit(envelope)}
                  onDeleteRequest={() => setDeleteConfirm(envelope.id)}
                  onDeleteConfirm={() => handleDelete(envelope.id)}
                  onDeleteCancel={() => setDeleteConfirm(null)}
                />
              ))}
            </div>
          </section>
        ))}

        {uncategorized.length > 0 && (
          <section>
            <h2 className="text-xs font-semibold text-brand-text-muted uppercase tracking-widest mb-2">
              Other
            </h2>
            <div className="space-y-3">
              {uncategorized.map((envelope) => (
                <EnvelopeCard
                  key={envelope.id}
                  envelope={envelope}
                  displayCurrency={displayCurrency}
                  fxRates={fxRates}
                  spentIdr={spentIdr[envelope.id] ?? 0}
                  confirmingDelete={deleteConfirm === envelope.id}
                  onEdit={() => openEdit(envelope)}
                  onDeleteRequest={() => setDeleteConfirm(envelope.id)}
                  onDeleteConfirm={() => handleDelete(envelope.id)}
                  onDeleteCancel={() => setDeleteConfirm(null)}
                />
              ))}
            </div>
          </section>
        )}
      </div>

      {/* Trips section */}
      <div className="mt-8">
        <TripSection
          initialTrips={initialTrips}
          parentEnvelopes={envelopes}
          spentIdr={spentIdr}
          displayCurrency={displayCurrency}
          fxRates={fxRates}
          householdId={householdId}
        />
      </div>

      <EnvelopeSheet
        key={`${sheetOpen}-${editing?.id ?? "new"}`}
        open={sheetOpen}
        onClose={closeSheet}
        envelope={editing}
        categories={categories}
        householdId={householdId}
        onSaved={handleSaved}
      />
    </div>
  );
}

// ── Envelope card ────────────────────────────────────────────────────────────

interface CardProps {
  envelope: Envelope;
  displayCurrency: string;
  fxRates: FxRates;
  spentIdr: number;
  confirmingDelete: boolean;
  onEdit: () => void;
  onDeleteRequest: () => void;
  onDeleteConfirm: () => void;
  onDeleteCancel: () => void;
}

function EnvelopeCard({
  envelope,
  displayCurrency,
  fxRates,
  spentIdr,
  confirmingDelete,
  onEdit,
  onDeleteRequest,
  onDeleteConfirm,
  onDeleteCancel,
}: CardProps) {
  const budgetDisplay = convert(envelope.budget_amount, envelope.budget_currency, displayCurrency, fxRates);
  // Historical spend in IDR → converted to display_currency at current rate
  const spentDisplay = convert(spentIdr, "IDR", displayCurrency, fxRates);
  const remainingDisplay = budgetDisplay - spentDisplay;
  const pct = budgetDisplay > 0 ? (spentDisplay / budgetDisplay) * 100 : 0;
  const overBudget = spentDisplay > budgetDisplay;

  return (
    <div className="bg-brand-surface rounded-xl p-4 border border-brand-border">
      <div className="flex items-start justify-between mb-3">
        <div className="min-w-0 flex-1 pr-3">
          <h3 className="text-brand-text font-medium truncate">{envelope.name}</h3>
          {envelope.budget_currency !== displayCurrency && (
            <span className="text-[11px] text-brand-muted">
              anchored {envelope.budget_currency}
            </span>
          )}
        </div>

        {confirmingDelete ? (
          <div className="flex items-center gap-3 shrink-0">
            <button onClick={onDeleteConfirm} className="text-red-400 text-sm font-medium">
              Delete
            </button>
            <button onClick={onDeleteCancel} className="text-brand-text-muted text-sm">
              Cancel
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-1 shrink-0">
            <button
              onClick={onEdit}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-brand-muted active:text-brand-accent"
            >
              <EditIcon />
            </button>
            <button
              onClick={onDeleteRequest}
              className="w-8 h-8 flex items-center justify-center rounded-lg text-brand-muted active:text-red-400"
            >
              <TrashIcon />
            </button>
          </div>
        )}
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-brand-primary rounded-full overflow-hidden mb-2">
        <div
          className={`h-full rounded-full transition-all duration-300 ${
            overBudget ? "bg-red-500" : "bg-brand-accent"
          }`}
          style={{ width: `${Math.min(Math.max(pct, 0), 100)}%` }}
        />
      </div>

      <div className="flex items-baseline justify-between">
        <span className="text-xs text-brand-text-muted">
          {format(spentDisplay, displayCurrency)} spent
        </span>
        <div className="text-right">
          <span className={`text-sm font-mono ${overBudget ? "text-red-400" : "text-brand-text"}`}>
            {format(remainingDisplay, displayCurrency)}
          </span>
          <span className="text-xs text-brand-text-muted ml-1">left</span>
        </div>
      </div>
      <p className="text-[11px] text-brand-text-muted text-right mt-0.5">
        of {format(budgetDisplay, displayCurrency)}
      </p>
    </div>
  );
}

// ── Icons ────────────────────────────────────────────────────────────────────

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  );
}

function EnvelopeAddIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
    </svg>
  );
}

function EnvelopeEmptyIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-8 h-8 text-brand-muted">
      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
    </svg>
  );
}

function EditIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />
    </svg>
  );
}

function TrashIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="w-4 h-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
    </svg>
  );
}
