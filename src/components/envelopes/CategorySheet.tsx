import { useState } from "react";
import Sheet from "@/components/ui/Sheet";
import { supabase } from "@/lib/supabase";

interface Props {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  householdId: string;
  categoryCount: number;
}

export default function CategorySheet({ open, onClose, onSaved, householdId, categoryCount }: Props) {
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const { error: err } = await supabase.from("categories").insert({
        household_id: householdId,
        name: name.trim(),
        sort_order: categoryCount,
      });
      if (err) throw err;
      setName("");
      onSaved();
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="new category">
      <form onSubmit={handleSave} className="space-y-4">
        <input
          type="text"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Food"
          className="w-full rounded-xl border border-brand-border bg-brand-bg px-3 py-2 text-sm"
        />
        {error && <p className="text-sm text-red-500">{error}</p>}
        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-xl bg-brand-accent py-3 text-sm font-semibold text-white disabled:opacity-50"
        >
          {loading ? "saving..." : "create category"}
        </button>
      </form>
    </Sheet>
  );
}
