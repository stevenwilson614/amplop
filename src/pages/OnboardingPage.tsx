import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";
import { useHousehold } from "@/context/HouseholdContext";

type Mode = "choose" | "create" | "join";

function errMsg(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "object" && err !== null && "message" in err)
    return String((err as { message: unknown }).message);
  return "Something went wrong";
}

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

  async function withUser(fn: (userId: string, email: string) => Promise<void>) {
    setLoading(true);
    setError("");
    try {
      const { data: { user }, error: uErr } = await supabase.auth.getUser();
      if (uErr) throw uErr;
      if (!user) throw new Error("Not signed in — please sign in first");
      await fn(user.id, user.email ?? "");
      await refetch();
      navigate("/envelopes", { replace: true });
    } catch (err: unknown) {
      setError(errMsg(err));
    } finally {
      setLoading(false);
    }
  }

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    withUser(async (userId, email) => {
      const { data: hh, error: hhErr } = await supabase
        .from("households")
        .insert({ name: householdName.trim() })
        .select()
        .single();
      if (hhErr) throw hhErr;

      const { error: uErr } = await supabase.from("users").insert({
        id: userId,
        household_id: hh.id,
        email,
        display_name: displayName.trim(),
        display_currency: currency,
      });
      if (uErr) throw uErr;
    });
  }

  function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    withUser(async (userId, email) => {
      const { error: uErr } = await supabase.from("users").insert({
        id: userId,
        household_id: joinCode.trim(),
        email,
        display_name: displayName.trim(),
        display_currency: currency,
      });
      if (uErr) throw uErr;
    });
  }

  const currencies = ["IDR", "USD", "EUR", "SGD", "JPY", "AUD"];

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

  return (
    <div className="flex h-screen flex-col bg-brand-bg">
      <div className="flex items-center gap-3 border-b border-brand-border p-4">
        <button onClick={() => { setMode("choose"); setError(""); }} className="font-mono text-sm text-brand-text-muted">← back</button>
        <h1 className="font-mono font-bold text-brand-text">
          {mode === "create" ? "create household" : "join household"}
        </h1>
      </div>
      <form
        onSubmit={mode === "create" ? handleCreate : handleJoin}
        className="flex-1 overflow-auto p-4 space-y-4"
      >
        <Field label="your name">
          <input
            type="text" required value={displayName}
            onChange={e => setDisplayName(e.target.value)}
            placeholder={mode === "create" ? "Steven" : "Olivia"}
            className={inputCls}
          />
        </Field>

        {mode === "create" ? (
          <Field label="household name">
            <input
              type="text" required value={householdName}
              onChange={e => setHouseholdName(e.target.value)}
              placeholder="Wilson Household"
              className={inputCls}
            />
          </Field>
        ) : (
          <Field label="household code (from your partner)">
            <input
              type="text" required value={joinCode}
              onChange={e => setJoinCode(e.target.value)}
              placeholder="paste the code here"
              className={inputCls}
            />
          </Field>
        )}

        <Field label="your display currency">
          <select value={currency} onChange={e => setCurrency(e.target.value)} className={inputCls}>
            {currencies.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </Field>

        {error && (
          <div className="rounded-lg border border-red-900/50 bg-red-950/30 p-3">
            <p className="font-mono text-xs text-red-400">{error}</p>
          </div>
        )}

        <button
          type="submit" disabled={loading}
          className="w-full rounded-lg bg-brand-accent py-4 font-mono text-sm font-semibold text-brand-text disabled:opacity-50"
        >
          {loading ? (mode === "create" ? "creating..." : "joining...") : (mode === "create" ? "create" : "join")}
        </button>
      </form>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <label className="font-mono text-xs uppercase tracking-wider text-brand-text-muted">{label}</label>
      {children}
    </div>
  );
}

const inputCls = "w-full rounded-lg border border-brand-border bg-brand-surface px-4 py-3 font-mono text-sm text-brand-text placeholder-brand-text-muted focus:outline-none focus:ring-2 focus:ring-brand-accent";
