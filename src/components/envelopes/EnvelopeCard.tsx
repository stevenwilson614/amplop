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
  isTrip?: boolean;
  onClick: () => void;
}

export default function EnvelopeCard({
  envelope,
  spentIdr,
  availableIdr,
  paceMarkerPct = 0,
  displayCurrency,
  fxRates,
  isTrip = false,
  onClick,
}: Props) {
  const dc = displayCurrency;

  const monthlyBudgetIdr = envelope.budget_currency === "IDR"
    ? envelope.budget_amount
    : convert(envelope.budget_amount, envelope.budget_currency, "IDR", fxRates);

  const totalAvailableIdr = availableIdr ?? monthlyBudgetIdr;
  const balanceIdr = totalAvailableIdr - spentIdr;

  const monthlyDisplay = dc === "IDR"
    ? monthlyBudgetIdr
    : convert(monthlyBudgetIdr, "IDR", dc, fxRates);
  const balanceDisplay = dc === "IDR" ? balanceIdr : convert(balanceIdr, "IDR", dc, fxRates);

  const remainingPct = totalAvailableIdr > 0
    ? Math.max(0, Math.min(100, Math.round((balanceIdr / totalAvailableIdr) * 100)))
    : 0;
  const over = balanceIdr < 0;

  return (
    <button
      onClick={onClick}
      className="w-full text-left border-b border-brand-border pb-1.5 active:opacity-80"
    >
      <div className="mb-0.5 flex items-center justify-between gap-3">
        <span className="font-mono text-[15px] font-normal leading-tight text-brand-text">
          {isTrip && <span className="mr-1" aria-hidden>✈</span>}
          {envelope.name}
        </span>
        <span className={`font-mono text-[15px] font-normal leading-none ${over ? "text-red-500" : "text-brand-text"}`}>
          {format(balanceDisplay, dc)}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <div className="relative h-[10px] w-[75%] overflow-visible bg-[#EEF1F3]">
          <div
            className="absolute z-10 w-[2px] bg-[#1E2733]"
            style={{
              left: `${Math.max(0, Math.min(100, paceMarkerPct))}%`,
              top: "-2px",
              bottom: "-2px",
            }}
          />
          <div
            className={`h-full transition-all ${over ? "bg-red-500" : "bg-brand-accent"} relative z-0`}
            style={{ width: `${remainingPct}%` }}
          />
        </div>
        <span className="flex-1 text-right font-mono text-[12px] leading-none text-brand-text-muted">
          {format(monthlyDisplay, dc)}
        </span>
      </div>
    </button>
  );
}
