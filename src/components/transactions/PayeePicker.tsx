import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";

interface Props {
  householdId: string;
  value: string;
  onSelect: (name: string) => void;
  onClose: () => void;
}

export default function PayeePicker({ householdId, value, onSelect, onClose }: Props) {
  const [query, setQuery] = useState(value);
  const [recents, setRecents] = useState<string[]>([]);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    let cancelled = false;
    async function loadRecents() {
      const { data } = await supabase
        .from("transactions")
        .select("merchant_name")
        .eq("household_id", householdId)
        .not("merchant_name", "is", null)
        .order("created_at", { ascending: false })
        .limit(100);
      if (cancelled) return;
      const seen = new Set<string>();
      const names: string[] = [];
      for (const row of data ?? []) {
        const name = (row.merchant_name ?? "").trim();
        if (!name || seen.has(name.toLowerCase())) continue;
        seen.add(name.toLowerCase());
        names.push(name);
      }
      setRecents(names);
    }
    loadRecents();
    return () => { cancelled = true; };
  }, [householdId]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return recents;
    return recents.filter((name) => name.toLowerCase().includes(q));
  }, [query, recents]);

  const bestMatch = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return null;
    const exact = recents.find((n) => n.toLowerCase() === q);
    if (exact) return exact;
    const starts = recents.find((n) => n.toLowerCase().startsWith(q));
    if (starts) return starts;
    return recents.find((n) => n.toLowerCase().includes(q)) ?? null;
  }, [query, recents]);

  function handleDone() {
    onSelect(bestMatch ?? query.trim());
    onClose();
  }

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-brand-bg sm:mx-auto sm:h-[896px] sm:max-w-[430px] sm:overflow-hidden sm:rounded-[34px]">
      <div className="flex items-center justify-between bg-brand-accent px-4 pb-4 pt-7 text-white">
        <button
          type="button"
          onClick={onClose}
          className="rounded-full bg-[#8AF4A6] px-4 py-2 text-sm font-semibold text-[#0F3C1B]"
        >
          Back
        </button>
        <h1 className="text-xl font-semibold">Payee</h1>
        <button
          type="button"
          onClick={() => onSelect(query.trim())}
          className="rounded-full bg-[#8AF4A6] px-4 py-2 text-sm font-semibold text-[#0F3C1B]"
        >
          Add
        </button>
      </div>

      <div className="border-b border-brand-border bg-brand-surface px-4 py-3">
        <div className="flex items-center gap-2 rounded-xl bg-brand-bg px-3 py-2">
          <span className="text-brand-text-muted">⌕</span>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") handleDone(); }}
            placeholder="Who received payment?"
            autoFocus
            className="w-full bg-transparent text-base text-brand-text placeholder:text-brand-text-muted focus:outline-none"
          />
        </div>
        {bestMatch && query.trim().toLowerCase() !== bestMatch.toLowerCase() && (
          <p className="mt-2 text-sm text-brand-accent">
            Match: {bestMatch}
          </p>
        )}
      </div>

      <div className="flex-1 overflow-auto">
        {filtered.map((name) => (
          <button
            key={name}
            type="button"
            onClick={() => { onSelect(name); onClose(); }}
            className="block w-full border-b border-brand-border px-4 py-3 text-left text-base text-brand-text active:bg-brand-surface"
          >
            {name}
          </button>
        ))}
        {filtered.length === 0 && query.trim() && (
          <button
            type="button"
            onClick={handleDone}
            className="block w-full px-4 py-3 text-left text-base text-brand-accent"
          >
            Use &quot;{query.trim()}&quot;
          </button>
        )}
      </div>
    </div>
  );
}
