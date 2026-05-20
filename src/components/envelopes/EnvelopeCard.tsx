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
      className="w-full text-left rounded-xl bg-brand-primary border border-brand-border p-4 active:opacity-80"
    >
      <div className="flex items-start justify-between mb-2">
        <span className="font-mono text-sm text-brand-text font-semibold">{envelope.name}</span>
        <span className={`font-mono text-xs ${over ? "text-red-400" : "text-brand-text-muted"}`}>
          {pct}%
        </span>
      </div>
      <div className={`font-mono text-xl font-bold mb-2 ${over ? "text-red-400" : "text-brand-text"}`}>
        {format(balanceDisplay, dc)}
      </div>
      <div className="w-full h-1.5 rounded-full bg-brand-border mb-2 overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${over ? "bg-red-400" : "bg-brand-accent"}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <div className="flex justify-between">
        <span className="font-mono text-xs text-brand-text-muted">{format(spentDisplay, dc)} spent</span>
        <span className="font-mono text-xs text-brand-text-muted">of {format(budgetDisplay, dc)}</span>
      </div>
    </button>
  );
}
