import { useState, useEffect } from "react";
import Sheet from "@/components/ui/Sheet";
import { supabase } from "@/lib/supabase";
import type { Envelope, Category, EnvelopeKind } from "@/lib/types";
import { parseToMinorUnits, toInputValue, CURRENCY_DECIMALS } from "@/lib/currency";

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  householdId: string;
  categories: Category[];
  envelope?: Envelope;
  defaultKind?: EnvelopeKind;
}

const CURRENCIES = Object.keys(CURRENCY_DECIMALS);

export default function EnvelopeSheet({
  open, onClose, onSaved, householdId, categories, envelope, defaultKind = "monthly",
}: Props) {
  const [name, setName] = useState("");
  const [budgetValue, setBudgetValue] = useState("");
  const [budgetCurrency, setBudgetCurrency] = useState("IDR");
  const [kind, setKind] = useState<EnvelopeKind>("monthly");
  const [targetValue, setTargetValue] = useState("");
  const [targetCurrency, setTargetCurrency] = useState("IDR");
  const [dueDate, setDueDate] = useState("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [newCategoryName, setNewCategoryName] = useState("");
  const [showNewCat, setShowNewCat] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (envelope) {
      setName(envelope.name);
      setBudgetValue(toInputValue(envelope.budget_amount, envelope.budget_currency));
      setBudgetCurrency(envelope.budget_currency);
      setKind(envelope.kind ?? "monthly");
      setTargetValue(
        envelope.target_amount
          ? toInputValue(envelope.target_amount, envelope.target_currency || envelope.budget_currency)
          : ""
      );
      setTargetCurrency(envelope.target_currency || envelope.budget_currency || "IDR");
      setDueDate(envelope.due_date ?? "");
      setCategoryId(envelope.category_id ?? "");
    } else {
      setName("");
      setBudgetValue("");
      setBudgetCurrency("IDR");
      setKind(defaultKind);
      setTargetValue("");
      setTargetCurrency("IDR");
      setDueDate("");
      setCategoryId(categories[0]?.id ?? "");
    }
    setError("");
  }, [open, envelope, categories, defaultKind]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      let catId = categoryId;

      if (showNewCat && newCategoryName.trim()) {
        const { data, error: cErr } = await supabase
          .from("categories")
          .insert({ household_id: householdId, name: newCategoryName.trim(), sort_order: categories.length })
          .select()
          .single();
        if (cErr) throw cErr;
        catId = data.id;
      }

      const payload = {
        household_id: householdId,
        name: name.trim(),
        budget_amount: parseToMinorUnits(budgetValue, budgetCurrency),
        budget_currency: budgetCurrency,
        kind,
        target_amount:
          kind === "sinking" && targetValue
            ? parseToMinorUnits(targetValue, targetCurrency)
            : null,
        target_currency: kind === "sinking" ? targetCurrency : null,
        due_date: kind === "sinking" && dueDate ? dueDate : null,
        category_id: kind === "sinking" ? null : (catId || null),
        sort_order: envelope?.sort_order ?? 0,
      };

      if (envelope) {
        const { error: e } = await supabase.from("envelopes").update(payload).eq("id", envelope.id);
        if (e) throw e;
      } else {
        const { error: e } = await supabase.from("envelopes").insert(payload);
        if (e) throw e;
      }
      onSaved();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setLoading(false);
    }
  }

  async function handleArchive() {
    if (!envelope || !confirm("Archive this envelope?")) return;
    await supabase.from("envelopes").delete().eq("id", envelope.id);
    onSaved();
    onClose();
  }

  const isSinking = kind === "sinking";

  return (
    <Sheet open={open} onClose={onClose} title={envelope ? "edit envelope" : "new envelope"}>
      <form onSubmit={handleSave} className="space-y-4">
        <Field label="type">
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setKind("monthly")}
              className={`flex-1 rounded-lg py-2 font-mono text-xs ${
                !isSinking ? "bg-brand-accent text-white" : "border border-brand-border text-brand-text-muted"
              }`}
            >
              monthly
            </button>
            <button
              type="button"
              onClick={() => setKind("sinking")}
              className={`flex-1 rounded-lg py-2 font-mono text-xs ${
                isSinking ? "bg-brand-accent text-white" : "border border-brand-border text-brand-text-muted"
              }`}
            >
              save for
            </button>
          </div>
        </Field>

        <Field label="name">
          <input
            type="text" required value={name}
            onChange={e => setName(e.target.value)}
            placeholder={isSinking ? "Rumah / Amerika trip" : "Groceries"}
            className={inputCls}
          />
        </Field>

        <Field label={isSinking ? "monthly set-aside" : "monthly budget"}>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              type="number" required min="0" step="any"
              value={budgetValue} onChange={e => setBudgetValue(e.target.value)}
              placeholder="0"
              className={`${inputCls} flex-1 text-2xl py-4`}
            />
            <select value={budgetCurrency} onChange={e => setBudgetCurrency(e.target.value)} className={`${inputCls} w-full sm:w-28 text-lg`}>
              {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </Field>

        {isSinking && (
          <>
            <Field label="goal / target">
              <div className="flex flex-col gap-2 sm:flex-row">
                <input
                  type="number" min="0" step="any"
                  value={targetValue} onChange={e => setTargetValue(e.target.value)}
                  placeholder="0"
                  className={`${inputCls} flex-1`}
                />
                <select
                  value={targetCurrency}
                  onChange={e => setTargetCurrency(e.target.value)}
                  className={`${inputCls} w-full sm:w-28`}
                >
                  {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
            </Field>
            <Field label="due date">
              <input
                type="date"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                className={inputCls}
              />
            </Field>
          </>
        )}

        {!isSinking && (
          <Field label="category">
            {!showNewCat ? (
              <div className="flex gap-2">
                <select value={categoryId} onChange={e => setCategoryId(e.target.value)} className={`${inputCls} flex-1`}>
                  <option value="">no category</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
                <button
                  type="button"
                  onClick={() => setShowNewCat(true)}
                  className="px-3 rounded-lg border border-brand-border bg-brand-surface font-mono text-xs text-brand-accent"
                >+ new</button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  type="text" value={newCategoryName}
                  onChange={e => setNewCategoryName(e.target.value)}
                  placeholder="Category name" className={`${inputCls} flex-1`}
                />
                <button
                  type="button"
                  onClick={() => setShowNewCat(false)}
                  className="px-3 rounded-lg border border-brand-border bg-brand-surface font-mono text-xs text-brand-text-muted"
                >cancel</button>
              </div>
            )}
          </Field>
        )}

        {error && <p className="font-mono text-xs text-red-400">{error}</p>}

        <button
          type="submit" disabled={loading}
          className="w-full rounded-lg bg-brand-accent py-3 font-mono text-sm font-semibold text-brand-text disabled:opacity-50"
        >
          {loading ? "saving..." : "save"}
        </button>

        {envelope && (
          <button
            type="button" onClick={handleArchive}
            className="w-full rounded-lg border border-red-900/50 py-3 font-mono text-sm text-red-400"
          >
            delete envelope
          </button>
        )}
      </form>
    </Sheet>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="font-mono text-xs text-brand-text-muted uppercase tracking-wider">{label}</label>
      {children}
    </div>
  );
}

const inputCls = "w-full rounded-lg border border-brand-border bg-brand-bg px-4 py-3 font-mono text-sm text-brand-text placeholder-brand-text-muted focus:outline-none focus:ring-2 focus:ring-brand-accent";
