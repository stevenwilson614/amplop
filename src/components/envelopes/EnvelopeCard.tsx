import type { Envelope } from "@/lib/types";
import type { FxRates } from "@/lib/types";
import { format, convert } from "@/lib/currency";
import { budgetBarPct } from "@/lib/budgetProgress";
import { monthlyBudgetIdr, resolveEnvelopeBalanceIdr } from "@/lib/envelopeBudget";

interface Props {
  envelope: Envelope;
  spentIdr: number;
  availableIdr?: number;
  monthSpentIdr?: number;
  budgetMonths?: number;
  monthSpentByMonth?: Record<string, number>;
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
  monthSpentIdr = 0,
  budgetMonths,
  monthSpentByMonth = {},
  paceMarkerPct = 0,
  displayCurrency,
  fxRates,
  isTrip = false,
  onClick,
}: Props) {
  const dc = displayCurrency;

  const monthlyIdr = monthlyBudgetIdr(envelope, fxRates);
  const totalAvailableIdr = availableIdr ?? monthlyIdr;
  const balanceIdr = resolveEnvelopeBalanceIdr({
    envelope,
    isTrip,
    monthlyBudgetIdr: monthlyIdr,
    spentIdr,
    monthSpentIdr,
    budgetMonths: budgetMonths ?? 1,
    availableIdr: totalAvailableIdr,
    monthSpentByMonth,
  });

  const monthlyDisplay = dc === "IDR"
    ? monthlyIdr
    : convert(monthlyIdr, "IDR", dc, fxRates);
  const balanceDisplay = dc === "IDR" ? balanceIdr : convert(balanceIdr, "IDR", dc, fxRates);

  const barPct = isTrip
    ? budgetBarPct(spentIdr, totalAvailableIdr, "remaining")
    : budgetBarPct(monthSpentIdr, monthlyIdr, "remaining");
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
            className="h-full transition-all bg-brand-accent relative z-0"
            style={{ width: `${barPct}%` }}
          />
        </div>
        <span className="flex-1 text-right font-mono text-[12px] leading-none text-brand-text-muted">
          {format(monthlyDisplay, dc)}
        </span>
      </div>
    </button>
  );
}
