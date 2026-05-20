import type { Envelope } from "@/lib/types";
import type { FxRates } from "@/lib/types";
import { format, convert, getRate } from "@/lib/currency";

interface Props {
  envelope: Envelope;
  spentIdr: number;
  availableIdr?: number;
  monthSpentIdr?: number;
  paceDeltaIdr?: number;
  displayCurrency: string;
  fxRates: FxRates;
  onClick: () => void;
}

export default function EnvelopeCard({
  envelope,
  spentIdr,
  availableIdr,
  monthSpentIdr = 0,
  paceDeltaIdr = 0,
  displayCurrency,
  fxRates,
  onClick,
}: Props) {
  const dc = displayCurrency;

  // budget in IDR minor units
  const budgetIdr = envelope.budget_currency === "IDR"
    ? envelope.budget_amount
    : convert(envelope.budget_amount, envelope.budget_currency, "IDR", fxRates);

  const totalAvailableIdr = availableIdr ?? budgetIdr;
  const balanceIdr = totalAvailableIdr - spentIdr;

  // Convert to display currency for showing
  const budgetDisplay = dc === "IDR" ? totalAvailableIdr : convert(totalAvailableIdr, "IDR", dc, fxRates);
  const spentDisplay = dc === "IDR" ? spentIdr : convert(spentIdr, "IDR", dc, fxRates);
  const balanceDisplay = dc === "IDR" ? balanceIdr : convert(balanceIdr, "IDR", dc, fxRates);
  const monthSpentDisplay = dc === "IDR" ? monthSpentIdr : convert(monthSpentIdr, "IDR", dc, fxRates);
  const paceDeltaDisplay = dc === "IDR" ? paceDeltaIdr : convert(paceDeltaIdr, "IDR", dc, fxRates);

  const remainingPct = totalAvailableIdr > 0
    ? Math.max(0, Math.min(100, Math.round((balanceIdr / totalAvailableIdr) * 100)))
    : 0;
  const over = balanceIdr < 0;
  const paceGood = paceDeltaIdr >= 0;

  return (
    <button
      onClick={onClick}
      className="w-full text-left border-b border-brand-border pb-3 active:opacity-80"
    >
      <div className="mb-1 flex items-start justify-between gap-3">
        <span className="font-mono text-[20px] font-semibold leading-tight text-brand-text">{envelope.name}</span>
        <span className={`font-mono text-[26px] font-semibold leading-none ${over ? "text-red-500" : "text-brand-text"}`}>
          {format(balanceDisplay, dc)}
        </span>
      </div>
      <div className="mb-1 flex justify-end">
        <span className="font-mono text-[16px] leading-none text-brand-text-muted">{format(budgetDisplay, dc)}</span>
      </div>
      <div className="mb-1 h-2 w-full overflow-hidden rounded-full bg-[#EEF1F3]">
        <div
          className={`h-full rounded-full transition-all ${over ? "bg-red-500" : "bg-brand-accent"}`}
          style={{ width: `${remainingPct}%` }}
        />
      </div>
      <div className="flex justify-between">
        <span className="font-mono text-xs text-brand-text-muted">{over ? "overspent" : "remaining"}</span>
        <span className="font-mono text-xs text-brand-text-muted">
          {format(spentDisplay, dc)} spent
        </span>
      </div>
      <div className="mt-1 flex justify-between">
        <span className={`font-mono text-xs ${paceGood ? "text-brand-accent" : "text-red-500"}`}>
          {paceGood ? "ahead of daily pace" : "behind daily pace"}
        </span>
        <span className={`font-mono text-xs ${paceGood ? "text-brand-accent" : "text-red-500"}`}>
          {paceGood ? "+" : "-"}{format(Math.abs(paceDeltaDisplay), dc)}
        </span>
      </div>
      <div className="mt-1 flex justify-end">
        <span className="font-mono text-[11px] text-brand-text-muted">this month spent {format(monthSpentDisplay, dc)}</span>
      </div>
    </button>
  );
}
