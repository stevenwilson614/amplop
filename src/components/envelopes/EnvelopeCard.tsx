import type { Envelope } from "@/lib/types";
import type { FxRates } from "@/lib/types";
import { format, convert, getRate } from "@/lib/currency";

interface Props {
  envelope: Envelope;
  spentIdr: number;
  displayCurrency: string;
  fxRates: FxRates;
  onClick: () => void;
}

export default function EnvelopeCard({ envelope, spentIdr, displayCurrency, fxRates, onClick }: Props) {
  const dc = displayCurrency;

  // budget in IDR minor units
  const budgetIdr = envelope.budget_currency === "IDR"
    ? envelope.budget_amount
    : convert(envelope.budget_amount, envelope.budget_currency, "IDR", fxRates);

  const balanceIdr = budgetIdr - spentIdr;

  // Convert to display currency for showing
  const budgetDisplay = dc === "IDR" ? budgetIdr : convert(budgetIdr, "IDR", dc, fxRates);
  const spentDisplay = dc === "IDR" ? spentIdr : convert(spentIdr, "IDR", dc, fxRates);
  const balanceDisplay = dc === "IDR" ? balanceIdr : convert(balanceIdr, "IDR", dc, fxRates);

  const pct = budgetIdr > 0 ? Math.min(100, Math.round((spentIdr / budgetIdr) * 100)) : 0;
  const over = balanceIdr < 0;

  return (
    <button
      onClick={onClick}
      className="w-full text-left border-b border-brand-border pb-3 active:opacity-80"
    >
      <div className="mb-1 flex items-start justify-between gap-3">
        <span className="font-mono text-3xl font-semibold leading-none text-brand-text">{envelope.name}</span>
        <span className={`font-mono text-[38px] font-semibold leading-none ${over ? "text-red-500" : "text-brand-text"}`}>
          {format(balanceDisplay, dc)}
        </span>
      </div>
      <div className="mb-1 flex justify-end">
        <span className="font-mono text-2xl leading-none text-brand-text-muted">{format(budgetDisplay, dc)}</span>
      </div>
      <div className="mb-1 h-2 w-full overflow-hidden rounded-full bg-[#EEF1F3]">
        <div
          className={`h-full rounded-full transition-all ${over ? "bg-red-500" : "bg-brand-accent"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex justify-between">
        <span className="font-mono text-xs text-brand-text-muted">{over ? "overspent" : "remaining"}</span>
        <span className="font-mono text-xs text-brand-text-muted">{format(spentDisplay, dc)} spent</span>
      </div>
    </button>
  );
}
