import { useMemo } from "react";
import type { Category, Envelope } from "@/lib/types";
import type { FxRates } from "@/lib/types";
import { convert, format } from "@/lib/currency";

interface Props {
  envelopes: Envelope[];
  categories: Category[];
  selectedId: string;
  displayCurrency: string;
  fxRates: FxRates;
  spentMap?: Record<string, number>;
  availableMap?: Record<string, number>;
  allowSplit?: boolean;
  onSelect: (id: string) => void;
  onSplitSelect?: () => void;
  onClose: () => void;
}

export default function EnvelopePicker({
  envelopes,
  categories,
  selectedId,
  displayCurrency,
  fxRates,
  spentMap = {},
  availableMap = {},
  allowSplit = true,
  onSelect,
  onSplitSelect,
  onClose,
}: Props) {
  const grouped = useMemo(() => groupByCategory(envelopes, categories), [envelopes, categories]);

  return (
    <div className="fixed inset-0 z-[85] flex flex-col bg-brand-bg sm:mx-auto sm:h-[896px] sm:max-w-[430px] sm:overflow-hidden sm:rounded-[34px]">
      <div className="flex items-center justify-between bg-brand-accent px-4 pb-3 pt-5 text-white">
        <button
          type="button"
          onClick={onClose}
          className="rounded-full bg-[#8AF4A6] px-4 py-2 text-sm font-semibold text-[#0F3C1B]"
        >
          Back
        </button>
        <h1 className="text-xl font-semibold">Envelope</h1>
        <div className="w-16" />
      </div>

      <div className="flex-1 overflow-auto bg-brand-bg">
        {allowSplit && onSplitSelect && (
          <button
            type="button"
            onClick={onSplitSelect}
            className="w-full border-b border-brand-border px-4 py-3 text-left text-sm italic text-brand-text-muted"
          >
            --Split to Multiple--
          </button>
        )}
        {grouped.map(({ category, items }) => (
          <div key={category?.id ?? "__none__"}>
            {category && (
              <p className="border-b border-brand-border bg-brand-surface px-4 py-2 text-lg font-bold text-brand-text">
                {category.name}
              </p>
            )}
            {items.map((env) => {
              const budgetIdr = env.budget_currency === "IDR"
                ? env.budget_amount
                : convert(env.budget_amount, env.budget_currency, "IDR", fxRates);
              const availableIdr = availableMap[env.id] ?? budgetIdr;
              const balanceIdr = availableIdr - (spentMap[env.id] ?? 0);
              const dc = displayCurrency;
              const balanceDisplay = dc === "IDR" ? balanceIdr : convert(balanceIdr, "IDR", dc, fxRates);
              const selected = env.id === selectedId;
              return (
                <button
                  key={env.id}
                  type="button"
                  onClick={() => onSelect(env.id)}
                  className="flex w-full items-center justify-between border-b border-brand-border px-4 py-3 text-left active:bg-brand-surface"
                >
                  <span className="text-base text-brand-text">
                    {env.trip_id ? `✈ ${env.name}` : env.name}
                    <span className="text-brand-text-muted"> [{formatPlain(balanceDisplay, dc)}]</span>
                  </span>
                  {selected && <span className="text-brand-accent">✓</span>}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}

function formatPlain(amountMinor: number, currency: string): string {
  const formatted = format(amountMinor, currency);
  return formatted.replace(/^Rp\s?/, "").replace(/[^\d.,-]/g, "").trim() || formatted;
}

interface Group {
  category: Category | null;
  items: Envelope[];
}

function groupByCategory(envelopes: Envelope[], categories: Category[]): Group[] {
  const catMap = new Map(categories.map((c) => [c.id, c]));
  const groups = new Map<string, Group>();
  for (const env of envelopes) {
    const category = env.category_id ? (catMap.get(env.category_id) ?? null) : null;
    const key = category?.name?.trim().toLowerCase() || "__none__";
    if (!groups.has(key)) groups.set(key, { category, items: [] });
    groups.get(key)!.items.push(env);
  }
  return Array.from(groups.values());
}
