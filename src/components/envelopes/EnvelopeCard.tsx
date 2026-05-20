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
      className="w-full text-left border-b border-brand-border pb-2 active:opacity-80"
    >
      <div className="mb-1 flex items-start justify-between gap-3">
        <span className="font-mono text-[18px] font-normal leading-tight text-brand-text">{envelope.name}</span>
        <div className="text-right">
          <p className={`font-mono text-[18px] font-normal leading-none ${over ? "text-red-500" : "text-brand-text"}`}>
            {format(balanceDisplay, dc)}
          </p>
          <p className="mt-0.5 font-mono text-[13px] leading-none text-brand-text-muted">
            {format(monthlyDisplay, dc)}
          </p>
        </div>
      </div>
      <div className="relative mb-0.5 h-[10px] w-[75%] overflow-visible bg-[#EEF1F3]">
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
    </button>
  );
}
