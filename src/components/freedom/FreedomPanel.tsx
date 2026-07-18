import type { InvestableSnapshot } from "@/lib/investableSurplus";
import { formatDualAmount } from "@/lib/investableSurplus";
import type { FxRates } from "@/lib/types";

interface Props {
  snapshot: InvestableSnapshot;
  displayCurrency: string;
  fxRates: FxRates;
  avgIncomeIdr: number | null;
  onLogCash: () => void;
}

export default function FreedomPanel({
  snapshot, displayCurrency, fxRates, avgIncomeIdr, onLogCash,
}: Props) {
  const cash = formatDualAmount(snapshot.cashIdr, displayCurrency, fxRates);
  const investable = formatDualAmount(snapshot.investableIdr, displayCurrency, fxRates);
  const earmarked = formatDualAmount(snapshot.earmarkedTotalIdr, displayCurrency, fxRates);
  const delta =
    snapshot.cashDeltaIdr === null
      ? null
      : formatDualAmount(snapshot.cashDeltaIdr, displayCurrency, fxRates);
  const income =
    avgIncomeIdr === null ? null : formatDualAmount(avgIncomeIdr, displayCurrency, fxRates);

  return (
    <div className="mx-4 mt-3 rounded-2xl border border-brand-border bg-brand-bg p-4">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div>
          <p className="font-mono text-[10px] uppercase tracking-wider text-brand-text-muted">freedom</p>
          <p className="font-mono text-lg font-semibold text-brand-text">
            {snapshot.latestSnapshot ? cash.primary : "log cash to start"}
          </p>
          {snapshot.latestSnapshot && cash.secondary && (
            <p className="font-mono text-xs text-brand-text-muted">{cash.secondary}</p>
          )}
        </div>
        <button
          type="button"
          onClick={onLogCash}
          className="rounded-full bg-brand-accent px-3 py-1.5 font-mono text-xs font-semibold text-white"
        >
          {snapshot.latestSnapshot ? "update" : "log cash"}
        </button>
      </div>

      {snapshot.latestSnapshot && (
        <div className="space-y-2 font-mono text-xs">
          {delta && (
            <Row
              label="since last"
              value={`${snapshot.cashDeltaIdr! >= 0 ? "+" : ""}${delta.primary}`}
              muted={delta.secondary ?? undefined}
            />
          )}
          <Row label="earmarked" value={earmarked.primary} muted={earmarked.secondary ?? undefined} />
          <Row
            label="  monthly leftover"
            value={formatDualAmount(snapshot.earmarkedMonthlyIdr, displayCurrency, fxRates).primary}
          />
          <Row
            label="  save-for"
            value={formatDualAmount(snapshot.earmarkedSinkingIdr, displayCurrency, fxRates).primary}
          />
          <div className={`rounded-xl px-3 py-2 ${snapshot.overcommitted ? "bg-red-50" : "bg-[#E8F8EC]"}`}>
            <p className="text-[10px] uppercase tracking-wider text-brand-text-muted">investable now</p>
            <p className={`text-base font-semibold ${snapshot.overcommitted ? "text-red-600" : "text-[#0F3C1B]"}`}>
              {investable.primary}
            </p>
            {investable.secondary && (
              <p className="text-brand-text-muted">{investable.secondary}</p>
            )}
            <p className="mt-1 text-[10px] text-brand-text-muted">
              {snapshot.overcommitted
                ? "Cash is less than envelope leftovers — overcommitted."
                : "Cash minus what’s already in envelopes. Free to invest or enjoy."}
            </p>
          </div>
          {income && (
            <p className="text-brand-text-muted">
              avg income (3 mo): {income.primary}
              {income.secondary ? ` · ${income.secondary}` : ""}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function Row({ label, value, muted }: { label: string; value: string; muted?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-brand-text-muted">{label}</span>
      <span className="text-right text-brand-text">
        {value}
        {muted && <span className="ml-1 text-brand-text-muted">({muted})</span>}
      </span>
    </div>
  );
}
