import type { Envelope } from "@/lib/types";
import type { FxRates } from "@/lib/types";
import { format, convert } from "@/lib/currency";

interface Props {
  envelope: Envelope;
  spentIdr: number;
  availableIdr?: number;
  paceMarkerPct?: number;
  displayCurrency: string;
  fxRates: FxRates;
  onClick: () => void;
}

export default function EnvelopeCard({
  envelope,
  spentIdr,
  availableIdr,
  paceMarkerPct = 0,
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

  const remainingPct = totalAvailableIdr > 0
    ? Math.max(0, Math.min(100, Math.round((balanceIdr / totalAvailableIdr) * 100)))
    : 0;
  const over = balanceIdr < 0;

  return (
    <button
      onClick={onClick}
      className="w-full text-left border-b border-brand-border pb-2 active:opacity-80"
    >
      <div className="mb-0.5 flex items-start justify-between gap-3">
        <span className="font-mono text-[18px] font-normal leading-tight text-brand-text">{envelope.name}</span>
        <span className={`font-mono text-[18px] font-normal leading-none ${over ? "text-red-500" : "text-brand-text"}`}>
          {format(balanceDisplay, dc)}
        </span>
      </div>
      <div className="mb-1 flex justify-end">
        <span className="font-mono text-[13px] leading-none text-brand-text-muted">{format(budgetDisplay, dc)}</span>
      </div>
      <div className="relative mb-0.5 h-2 w-full overflow-hidden rounded-full bg-[#EEF1F3]">
        <div
          className="absolute bottom-0 top-0 z-10 w-[2px] bg-[#1E2733]"
          style={{ left: `${Math.max(0, Math.min(100, paceMarkerPct))}%` }}
        />
        <div
          className={`h-full rounded-full transition-all ${over ? "bg-red-500" : "bg-brand-accent"} relative z-0`}
          style={{ width: `${remainingPct}%` }}
        />
      </div>
      <div className="flex justify-end">
        <span className="font-mono text-[11px] text-brand-text-muted">
          {format(spentDisplay, dc)} spent
        </span>
      </div>
    </button>
  );
}
