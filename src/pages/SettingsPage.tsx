import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useNavigate } from "react-router-dom";
import { useHousehold } from "@/context/HouseholdContext";
import { CURRENCY_DECIMALS } from "@/lib/currency";

const CURRENCIES = Object.keys(CURRENCY_DECIMALS);

export default function SettingsPage() {
  const navigate = useNavigate();
  const { dbUser, household, refetch } = useHousehold();
  const [displayName, setDisplayName] = useState(dbUser?.display_name ?? "");
  const [displayCurrency, setDisplayCurrency] = useState(dbUser?.display_currency ?? "IDR");
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState("");

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!dbUser) return;
    setSaving(true);
    await supabase
      .from("users")
      .update({ display_name: displayName, display_currency: displayCurrency })
      .eq("id", dbUser.id);
    await refetch();
    setSaving(false);
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    navigate("/login");
  }

  function copyHouseholdCode() {
    if (!household) return;
    navigator.clipboard.writeText(household.id).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  async function handleChangePassword(e: React.FormEvent) {
    e.preventDefault();
    setPwSaving(true);
    setPwMsg("");
    const { error } = await supabase.auth.updateUser({ password: newPassword });
    setPwMsg(error ? error.message : "password updated");
    setNewPassword("");
    setPwSaving(false);
  }

  async function syncFxRates() {
    await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/fx-rate-sync`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
      }
    );
    await refetch();
  }

  return (
    <div className="flex flex-col min-h-full">
      <div className="sticky top-0 z-10 px-4 py-3 bg-brand-bg border-b border-brand-border">
        <h1 className="font-mono font-bold text-brand-text">settings</h1>
      </div>

      <div className="flex-1 overflow-auto p-4 pb-24 space-y-6">
        {/* Profile */}
        <section>
          <p className="font-mono text-xs text-brand-text-muted uppercase tracking-widest mb-3">profile</p>
          <form onSubmit={handleSaveProfile} className="space-y-3">
            <div className="space-y-1">
              <label className="font-mono text-xs text-brand-text-muted">display name</label>
              <input
                type="text" value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                className={inputCls}
              />
            </div>
            <div className="space-y-1">
              <label className="font-mono text-xs text-brand-text-muted">display currency</label>
              <select value={displayCurrency} onChange={e => setDisplayCurrency(e.target.value)} className={inputCls}>
                {CURRENCIES.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <button
              type="submit" disabled={saving}
              className="w-full rounded-lg bg-brand-accent py-3 font-mono text-sm font-semibold text-brand-text disabled:opacity-50"
            >
              {saving ? "saving..." : "save profile"}
            </button>
          </form>
        </section>

        {/* Household */}
        <section>
          <p className="font-mono text-xs text-brand-text-muted uppercase tracking-widest mb-3">household</p>
          <div className="rounded-xl bg-brand-primary border border-brand-border p-4 space-y-3">
            <div>
              <p className="font-mono text-xs text-brand-text-muted">name</p>
              <p className="font-mono text-sm text-brand-text">{household?.name}</p>
            </div>
            <div>
              <p className="font-mono text-xs text-brand-text-muted mb-1">invite code (share with partner)</p>
              <button
                onClick={copyHouseholdCode}
                className="w-full rounded-lg border border-brand-border bg-brand-surface p-3 font-mono text-xs text-brand-accent text-left break-all"
              >
                {copied ? "copied!" : household?.id}
              </button>
            </div>
          </div>
        </section>

        {/* Change password */}
        <section>
          <p className="font-mono text-xs text-brand-text-muted uppercase tracking-widest mb-3">password</p>
          <form onSubmit={handleChangePassword} className="space-y-3">
            <input
              type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)}
              placeholder="new password" minLength={6} required className={inputCls}
            />
            {pwMsg && <p className={`font-mono text-xs ${pwMsg === "password updated" ? "text-brand-accent" : "text-red-400"}`}>{pwMsg}</p>}
            <button
              type="submit" disabled={pwSaving || newPassword.length < 6}
              className="w-full rounded-lg border border-brand-border bg-brand-surface py-3 font-mono text-sm text-brand-text disabled:opacity-50"
            >
              {pwSaving ? "saving..." : "change password"}
            </button>
          </form>
        </section>

        {/* FX Rates */}
        <section>
          <p className="font-mono text-xs text-brand-text-muted uppercase tracking-widest mb-3">fx rates</p>
          <button
            onClick={syncFxRates}
            className="w-full rounded-lg border border-brand-border bg-brand-surface py-3 font-mono text-sm text-brand-text"
          >
            sync rates now
          </button>
        </section>

        {/* Sign out */}
        <button
          onClick={handleSignOut}
          className="w-full rounded-lg border border-red-900/50 py-3 font-mono text-sm text-red-400"
        >
          sign out
        </button>
      </div>
    </div>
  );
}

const inputCls = "w-full rounded-lg border border-brand-border bg-brand-surface px-4 py-3 font-mono text-sm text-brand-text focus:outline-none focus:ring-2 focus:ring-brand-accent";
