"use client";

import { useState } from "react";
import { convert, format, type FxRates } from "@/lib/currency";
import type { Envelope, TripWithEnvelopes } from "@/lib/types";
import TripEnvelopeSheet from "./TripEnvelopeSheet";

interface Props {
  trip: TripWithEnvelopes;
  parentEnvelopes: Envelope[];
  spentIdr: Record<string, number>;
  displayCurrency: string;
  fxRates: FxRates;
  onTripUpdated: (trip: TripWithEnvelopes) => void;
  onEndTrip: (tripId: string) => void;
}

export default function TripCard({
  trip,
  parentEnvelopes,
  spentIdr,
  displayCurrency,
  fxRates,
  onTripUpdated,
  onEndTrip,
}: Props) {
  const [envSheetOpen, setEnvSheetOpen] = useState(false);
  const [editingEnv, setEditingEnv] = useState<Envelope | null>(null);
  const [confirmEnd, setConfirmEnd] = useState(false);
  const [expanded, setExpanded] = useState(trip.status === "active");

  const isActive = trip.status === "active";
  const envelopes = trip.envelopes ?? [];

  const totalBudgetDisplay = envelopes.reduce(
    (sum, e) => sum + convert(e.budget_amount, e.budget_currency, displayCurrency, fxRates),
    0
  );
  const totalSpentDisplay = envelopes.reduce((sum, e) => {
    const idr = spentIdr[e.id] ?? 0;
    return sum + convert(idr, "IDR", displayCurrency, fxRates);
  }, 0);

  const dayLabel = formatDateRange(trip.start_date, trip.end_date);

  function openAddEnvelope() {
    setEditingEnv(null);
    setEnvSheetOpen(true);
  }

  function handleEnvSaved(envelope: Envelope, isNew: boolean) {
    const updated = isNew
      ? { ...trip, envelopes: [...envelopes, envelope] }
      : { ...trip, envelopes: envelopes.map((e) => (e.id === envelope.id ? envelope : e)) };
    onTripUpdated(updated);
    setEnvSheetOpen(false);
    setEditingEnv(null);
  }

  function handleEnvDeleted(id: string) {
    onTripUpdated({ ...trip, envelopes: envelopes.filter((e) => e.id !== id) });
    setEnvSheetOpen(false);
    setEditingEnv(null);
  }

  return (
    <div className={`rounded-xl border overflow-hidden ${isActive ? "border-brand-accent/40 bg-brand-surface" : "border-brand-border bg-brand-surface/60"}`}>
      {/* Trip header */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full px-4 py-3.5 flex items-start justify-between text-left"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-0.5">
            <span className="text-brand-text font-semibold truncate">{trip.name}</span>
            <span className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full shrink-0 ${
              isActive ? "bg-brand-accent/20 text-brand-accent" : "bg-brand-border text-brand-text-muted"
            }`}>
              {isActive ? "active" : "ended"}
            </span>
          </div>
          <p className="text-brand-text-muted text-xs">{dayLabel} · {trip.currency}</p>
        </div>

        <div className="text-right shrink-0 ml-3">
          {totalBudgetDisplay > 0 && (
            <>
              <p className="text-brand-text font-mono text-sm">
                {format(totalBudgetDisplay - totalSpentDisplay, displayCurrency)}
              </p>
              <p className="text-brand-text-muted text-[11px]">remaining</p>
            </>
          )}
        </div>
      </button>

      {/* Expanded body */}
      {expanded && (
        <div className="border-t border-brand-border/60">
          {/* Envelope rows */}
          {envelopes.length === 0 ? (
            <p className="px-4 py-4 text-brand-text-muted text-sm text-center">
              No envelopes yet
            </p>
          ) : (
            <div className="divide-y divide-brand-border/40">
              {envelopes.map((env) => {
                const budgetDisplay = convert(env.budget_amount, env.budget_currency, displayCurrency, fxRates);
                const spentDisplay = convert(spentIdr[env.id] ?? 0, "IDR", displayCurrency, fxRates);
                const remaining = budgetDisplay - spentDisplay;
                const pct = budgetDisplay > 0 ? (spentDisplay / budgetDisplay) * 100 : 0;
                const over = spentDisplay > budgetDisplay;

                const parentName = parentEnvelopes.find((p) => p.id === env.parent_envelope_id)?.name;

                return (
                  <button
                    key={env.id}
                    onClick={() => { if (isActive) { setEditingEnv(env); setEnvSheetOpen(true); } }}
                    className="w-full px-4 py-3 text-left"
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <div>
                        <span className="text-brand-text text-sm">{env.name}</span>
                        {parentName && (
                          <span className="text-brand-text-muted text-[11px] ml-1.5">
                            ← {parentName}
                          </span>
                        )}
                        {env.budget_currency !== displayCurrency && (
                          <span className="text-brand-muted text-[10px] ml-1">
                            {env.budget_currency}
                          </span>
                        )}
                      </div>
                      <span className={`text-sm font-mono ${over ? "text-red-400" : "text-brand-text"}`}>
                        {format(remaining, displayCurrency)}
                      </span>
                    </div>
                    <div className="h-1.5 bg-brand-primary rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${over ? "bg-red-500" : "bg-brand-accent"}`}
                        style={{ width: `${Math.min(Math.max(pct, 0), 100)}%` }}
                      />
                    </div>
                    <p className="text-[11px] text-brand-text-muted mt-1 text-right">
                      {format(spentDisplay, displayCurrency)} spent of {format(budgetDisplay, displayCurrency)}
                    </p>
                  </button>
                );
              })}
            </div>
          )}

          {/* Actions */}
          {isActive && (
            <div className="px-4 py-3 flex items-center justify-between border-t border-brand-border/60">
              <button
                onClick={openAddEnvelope}
                className="flex items-center gap-1.5 text-brand-accent text-sm font-medium"
              >
                <PlusIcon />
                Add envelope
              </button>

              {confirmEnd ? (
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => onEndTrip(trip.id)}
                    className="text-red-400 text-sm font-medium"
                  >
                    End trip
                  </button>
                  <button
                    onClick={() => setConfirmEnd(false)}
                    className="text-brand-text-muted text-sm"
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setConfirmEnd(true)}
                  className="text-brand-text-muted text-sm"
                >
                  End trip
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Trip envelope sheet */}
      <TripEnvelopeSheet
        key={`${envSheetOpen}-${editingEnv?.id ?? "new"}`}
        open={envSheetOpen}
        onClose={() => { setEnvSheetOpen(false); setEditingEnv(null); }}
        envelope={editingEnv}
        trip={trip}
        parentEnvelopes={parentEnvelopes}
        fxRates={fxRates}
        onSaved={handleEnvSaved}
        onDeleted={handleEnvDeleted}
      />
    </div>
  );
}

function formatDateRange(start: string, end: string): string {
  const s = new Date(start + "T00:00:00");
  const e = new Date(end + "T00:00:00");
  const opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" };
  if (s.getFullYear() !== e.getFullYear()) opts.year = "numeric";
  return `${s.toLocaleDateString("en-US", opts)} – ${e.toLocaleDateString("en-US", { ...opts, year: "numeric" })}`;
}

function PlusIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="w-4 h-4">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
    </svg>
  );
}
