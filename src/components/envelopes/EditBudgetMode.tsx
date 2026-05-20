import { useEffect, useMemo, useState } from "react";
import type { Category, Envelope } from "@/lib/types";
import { format, convert } from "@/lib/currency";
import type { FxRates } from "@/lib/types";
import { supabase } from "@/lib/supabase";

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  onAddEnvelope?: () => void;
  envelopes: Envelope[];
  categories: Category[];
  displayCurrency: string;
  fxRates: FxRates;
}

interface Group {
  category: Category | null;
  items: Envelope[];
}

export default function EditBudgetMode({
  open,
  onClose,
  onSaved,
  onAddEnvelope,
  envelopes,
  categories,
  displayCurrency,
  fxRates,
}: Props) {
  const [rows, setRows] = useState<Envelope[]>([]);
  const [dragId, setDragId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (open) setRows([...envelopes].sort((a, b) => a.sort_order - b.sort_order));
  }, [open, envelopes]);

  const grouped = useMemo(() => groupByCategory(rows, categories), [rows, categories]);

  if (!open) return null;

  async function handleDone() {
    setSaving(true);
    try {
      await Promise.all(
        rows.map((env, idx) =>
          supabase.from("envelopes").update({ sort_order: idx }).eq("id", env.id)
        )
      );
      onSaved();
      onClose();
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this envelope?")) return;
    await supabase.from("envelopes").delete().eq("id", id);
    setRows((prev) => prev.filter((e) => e.id !== id));
    onSaved();
  }

  function onDragStart(id: string) {
    setDragId(id);
  }

  function onDrop(targetId: string) {
    if (!dragId || dragId === targetId) return;
    setRows((prev) => {
      const from = prev.findIndex((e) => e.id === dragId);
      const to = prev.findIndex((e) => e.id === targetId);
      if (from < 0 || to < 0) return prev;
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      return next;
    });
    setDragId(null);
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-brand-surface sm:mx-auto sm:h-[896px] sm:max-w-[430px] sm:overflow-hidden sm:rounded-[34px]">
      <div className="bg-brand-accent px-4 pb-3 pt-5 text-white">
        <div className="flex items-center justify-between">
          <div className="w-16" />
          <h2 className="text-xl font-semibold">Edit Budget</h2>
          <button
            type="button"
            onClick={handleDone}
            disabled={saving}
            className="rounded-full bg-[#8AF4A6] px-4 py-2 text-sm font-semibold text-[#0F3C1B]"
          >
            {saving ? "..." : "Done"}
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-auto pb-24">
        {grouped.map(({ category, items }) => (
          <div key={category?.id ?? "__none__"}>
            {category && (
              <p className="border-b border-brand-border bg-brand-bg px-4 py-2 text-lg font-semibold text-brand-text">
                {category.name}
              </p>
            )}
            {items.map((env) => {
              const budgetIdr = env.budget_currency === "IDR"
                ? env.budget_amount
                : convert(env.budget_amount, env.budget_currency, "IDR", fxRates);
              const budgetDisplay = displayCurrency === "IDR"
                ? budgetIdr
                : convert(budgetIdr, "IDR", displayCurrency, fxRates);
              return (
                <div
                  key={env.id}
                  draggable
                  onDragStart={() => onDragStart(env.id)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => onDrop(env.id)}
                  className="flex items-center gap-3 border-b border-brand-border px-3 py-3"
                >
                  <button
                    type="button"
                    onClick={() => handleDelete(env.id)}
                    className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-red-500 text-sm font-bold text-white"
                  >
                    −
                  </button>
                  <span className="flex-1 text-base text-brand-text">{env.name}</span>
                  <span className="text-base text-brand-text-muted">{format(budgetDisplay, displayCurrency)}</span>
                  <span className="cursor-grab px-1 text-brand-text-muted">≡</span>
                </div>
              );
            })}
          </div>
        ))}
        {onAddEnvelope && (
          <button
            type="button"
            onClick={() => { onClose(); onAddEnvelope(); }}
            className="px-4 py-4 text-sm font-semibold text-blue-500"
          >
            + Add Envelope
          </button>
        )}
      </div>
    </div>
  );
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
