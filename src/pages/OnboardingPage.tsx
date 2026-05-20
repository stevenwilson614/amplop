import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useHousehold } from "@/context/HouseholdContext";

type Mode = "choose" | "create" | "join";

export default function OnboardingPage() {
  const [mode, setMode] = useState<Mode>("choose");
  const [displayName, setDisplayName] = useState("");
  const [householdName, setHouseholdName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [currency, setCurrency] = useState("IDR");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const { refetch } = useHousehold();

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not logged in");

      const { data: hh, error: hhErr } = await supabase
        .from("households")
        .insert({ name: householdName })
        .select()
        .single();
      if (hhErr) throw hhErr;

      const { error: uErr } = await supabase.from("users").insert({
        id: user.id,
        household_id: hh.id,
        email: user.email,
        display_name: displayName,
        display_currency: currency,
      });
      if (uErr) throw uErr;

      await refetch();
      navigate("/envelopes", { replace: true });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not logged in");

      const { error: uErr } = await supabase.from("users").insert({
        id: user.id,
        household_id: joinCode.trim(),
        email: user.email,
        display_name: displayName,
        display_currency: currency,
      });
      if (uErr) throw uErr;

      await refetch();
      navigate("/envelopes", { replace: true });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Invalid household code");
    } finally {
      setLoading(false);
    }
  }

  const currencies = ["IDR", "USD", "EUR", "SGD", "JPY"];

  if (mode === "choose") {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-brand-bg px-6">
        <h1 className="mb-2 font-mono text-3xl font-bold text-brand-text">welcome</h1>
        <p className="mb-10 text-center font-mono text-xs text-brand-text-muted">
          set up your household to get started
        </p>
        <div className="w-full max-w-sm space-y-3">
          <button
            onClick={() => setMode("create")}
            className="w-full rounded-lg bg-brand-accent py-4 font-mono text-sm font-semibold text-brand-text"
          >
            create household
          </button>
          <button
            onClick={() => setMode("join")}
            className="w-full rounded-lg border border-brand-border bg-brand-surface py-4 font-mono text-sm text-brand-text"
          >
            join existing household
          </button>
        </div>
      </div>
    );
  }

  if (mode === "create") {
    return (
      <div className="flex h-screen flex-col bg-brand-bg">
        <div className="p-4 border-b border-brand-border flex items-center gap-3">
          <button onClick={() => setMode("choose")} className="text-brand-text-muted font-mono text-sm">← back</button>
          <h1 className="font-mono font-bold text-brand-text">create household</h1>
        </div>
        <form onSubmit={handleCreate} className="flex-1 overflow-auto p-4 space-y-4">
          <Field label="your name">
            <input
              type="text" required value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              placeholder="Steven" className={inputCls}
            />
          </Field>
          <Field label="household name">
            <input
              type="text" required value={householdName}
              onChange={e => setHouseholdName(e.target.value)}
              placeholder="Wilson Household" className={inputCls}
            />
          </Field>
          <Field label="your display currency">
            <select value={currency} onChange={e => setCurrency(e.target.value)} className={inputCls}>
              {currencies.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </Field>
          {error && <p className="font-mono text-xs text-red-400">{error}</p>}
          <button
            type="submit" disabled={loading}
            className="w-full rounded-lg bg-brand-accent py-4 font-mono text-sm font-semibold text-brand-text disabled:opacity-50"
          >
            {loading ? "creating..." : "create"}
          </button>
        </form>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-brand-bg">
      <div className="p-4 border-b border-brand-border flex items-center gap-3">
        <button onClick={() => setMode("choose")} className="text-brand-text-muted font-mono text-sm">← back</button>
        <h1 className="font-mono font-bold text-brand-text">join household</h1>
      </div>
      <form onSubmit={handleJoin} className="flex-1 overflow-auto p-4 space-y-4">
        <Field label="your name">
          <input
            type="text" required value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            placeholder="Olivia" className={inputCls}
          />
        </Field>
        <Field label="household code">
          <input
            type="text" required value={joinCode}
            onChange={e => setJoinCode(e.target.value)}
            placeholder="paste the code from your partner"
            className={inputCls}
          />
        </Field>
        <Field label="your display currency">
          <select value={currency} onChange={e => setCurrency(e.target.value)} className={inputCls}>
            {currencies.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>
        {error && <p className="font-mono text-xs text-red-400">{error}</p>}
        <button
          type="submit" disabled={loading}
          className="w-full rounded-lg bg-brand-accent py-4 font-mono text-sm font-semibold text-brand-text disabled:opacity-50"
        >
          {loading ? "joining..." : "join"}
        </button>
      </form>
    </div>
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

const inputCls = "w-full rounded-lg border border-brand-border bg-brand-surface px-4 py-3 font-mono text-sm text-brand-text placeholder-brand-text-muted focus:outline-none focus:ring-2 focus:ring-brand-accent";
