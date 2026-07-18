import type { Envelope, FxRates } from "@/lib/types";
import { format, convert } from "@/lib/currency";
import {
  monthsUntilDue,
  sinkingLeftToFundIdr,
  suggestedMonthlyFillIdr,
  targetAmountIdr,
} from "@/lib/sinkingFunds";
import EnvelopeCard from "@/components/envelopes/EnvelopeCard";

interface Perf {
  availableIdr?: number;
  monthSpentIdr?: number;
  budgetMonths?: number;
  monthSpentByMonth?: Record<string, number>;
  paceMarkerPct?: number;
}

interface Props {
  envelopes: Envelope[];
  balanceIdrById: Record<string, number>;
  spentMap: Record<string, number>;
  perfMap: Record<string, Perf>;
  displayCurrency: string;
  fxRates: FxRates;
  budgetYearStartMonth?: number;
  onOpen: (env: Envelope) => void;
  onAdd: () => void;
}

const MONTH_SHORT = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function SinkingFundsSection({
  envelopes, balanceIdrById, spentMap, perfMap, displayCurrency, fxRates,
  budgetYearStartMonth = 1, onOpen, onAdd,
}: Props) {
  const yearLabel = `${MONTH_SHORT[budgetYearStartMonth - 1]}–${MONTH_SHORT[(budgetYearStartMonth + 10) % 12]} year`;
  if (envelopes.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-brand-border px-4 py-5">
        <p className="font-mono text-sm font-semibold text-brand-text">Save for</p>
        <p className="mt-1 font-mono text-xs text-brand-text-muted">
          Rent, visa, Amerika trip, insurance — set money aside without mixing it into daily life.
        </p>
        <button
          type="button"
          onClick={onAdd}
          className="mt-3 font-mono text-sm text-brand-accent"
        >
          + add save-for envelope
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between gap-2">
        <div>
          <p className="font-mono text-[26px] font-semibold tracking-tight text-brand-text">Save for</p>
          <p className="font-mono text-xs text-brand-text-muted">annual &amp; big goals · {yearLabel}</p>
        </div>
        <button
          type="button"
          onClick={onAdd}
          className="rounded-lg border border-brand-border px-2 py-1 font-mono text-xs text-brand-text-muted"
        >
          + add
        </button>
      </div>
      <div className="space-y-3">
        {envelopes.map((env) => {
          const funded = Math.max(0, balanceIdrById[env.id] ?? 0);
          const target = targetAmountIdr(env, fxRates);
          const left = sinkingLeftToFundIdr(env, funded, fxRates);
          const months = monthsUntilDue(env.due_date);
          const suggested = suggestedMonthlyFillIdr(env, funded, fxRates);
          const pct = target > 0 ? Math.min(100, Math.round((funded / target) * 100)) : 0;
          const fundedDisplay =
            displayCurrency === "IDR" ? funded : convert(funded, "IDR", displayCurrency, fxRates);
          const leftDisplay =
            displayCurrency === "IDR" ? left : convert(left, "IDR", displayCurrency, fxRates);
          const suggestedDisplay =
            displayCurrency === "IDR" ? suggested : convert(suggested, "IDR", displayCurrency, fxRates);

          return (
            <div key={env.id} className="space-y-1">
              <EnvelopeCard
                envelope={env}
                spentIdr={spentMap[env.id] ?? 0}
                availableIdr={perfMap[env.id]?.availableIdr}
                monthSpentIdr={perfMap[env.id]?.monthSpentIdr}
                budgetMonths={perfMap[env.id]?.budgetMonths}
                monthSpentByMonth={perfMap[env.id]?.monthSpentByMonth}
                paceMarkerPct={perfMap[env.id]?.paceMarkerPct ?? 0}
                displayCurrency={displayCurrency}
                fxRates={fxRates}
                onClick={() => onOpen(env)}
              />
              {(target > 0 || env.due_date) && (
                <div className="rounded-xl bg-brand-bg px-3 py-2 font-mono text-[11px] text-brand-text-muted">
                  <div className="mb-1 h-1.5 overflow-hidden rounded-full bg-brand-border">
                    <div className="h-full bg-brand-accent" style={{ width: `${pct}%` }} />
                  </div>
                  <p>
                    funded {format(fundedDisplay, displayCurrency)}
                    {target > 0 && <> · left {format(leftDisplay, displayCurrency)}</>}
                    {months !== null && <> · {months} mo left</>}
                  </p>
                  {suggested > 0 && (
                    <p>suggested set-aside {format(suggestedDisplay, displayCurrency)}/mo</p>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
