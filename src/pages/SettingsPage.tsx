import { useState, useCallback } from "react";
import { supabase } from "@/lib/supabase";
import { useNavigate, Link } from "react-router-dom";
import { useHousehold } from "@/context/HouseholdContext";
import { CURRENCY_DECIMALS } from "@/lib/currency";
import { parseImportCsv, importTransactionHistory, IMPORT_CSV_TEMPLATE } from "@/lib/importHistory";
import {
  isGoodbudgetCsv,
  importGoodbudgetHistory,
  previewGoodbudgetImport,
  parseGoodbudgetCsv,
  parseRemainingBalances,
  syncEnvelopeRemainings,
  REMAINING_BALANCES_TEMPLATE,
} from "@/lib/goodbudgetImport";
import type { Envelope, EnvelopeSpent } from "@/lib/types";

const CURRENCIES = Object.keys(CURRENCY_DECIMALS);

export default function SettingsPage() {
  const navigate = useNavigate();
  const { dbUser, household, fxRates, refetch } = useHousehold();
  const [displayName, setDisplayName] = useState(dbUser?.display_name ?? "");
  const [displayCurrency, setDisplayCurrency] = useState(dbUser?.display_currency ?? "IDR");
  const [saving, setSaving] = useState(false);
  const [copied, setCopied] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [pwSaving, setPwSaving] = useState(false);
  const [pwMsg, setPwMsg] = useState("");
  const [importText, setImportText] = useState("");
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState("");
  const [importProgress, setImportProgress] = useState("");
  const [syncBudgets, setSyncBudgets] = useState(true);
  const [remainingText, setRemainingText] = useState("");
  const [syncingRemainings, setSyncingRemainings] = useState(false);
  const [remainingMsg, setRemainingMsg] = useState("");

  const loadEnvelopes = useCallback(async (): Promise<Envelope[]> => {
    if (!household) return [];
    const { data } = await supabase
      .from("envelopes")
      .select("*")
      .eq("household_id", household.id)
      .order("sort_order");
    return data ?? [];
  }, [household]);

  async function handleImportHistory() {
    if (!household || !dbUser) return;
    setImporting(true);
    setImportMsg("");
    setImportProgress("");
    try {
      const envelopes = await loadEnvelopes();
      const text = importText.trim();
      if (!text) {
        setImportMsg("No CSV data to import.");
        return;
      }

      if (isGoodbudgetCsv(text)) {
        const rows = parseGoodbudgetCsv(text);
        const preview = previewGoodbudgetImport(rows, envelopes);
        if (preview.unmapped.length > 0) {
          setImportMsg(`Warning: ${preview.unmapped.length} envelope(s) not matched: ${preview.unmapped.slice(0, 5).join(", ")}${preview.unmapped.length > 5 ? "…" : ""}`);
        }

        const result = await importGoodbudgetHistory({
          csvText: text,
          envelopes,
          householdId: household.id,
          userId: dbUser.id,
          syncBudgets,
          replaceExisting: true,
          onProgress: (done, total) => setImportProgress(`${done} / ${total}`),
        });

        await refetch();
        window.dispatchEvent(new CustomEvent("amplop:data-changed"));
        setImportMsg(
          `Imported ${result.imported} expenses, ${result.transfers} transfers. ` +
          `Updated ${result.budgetsUpdated} envelope budgets. Skipped ${result.skipped}.` +
          (result.errors.length ? ` First issues: ${result.errors.slice(0, 3).join("; ")}` : "")
        );
        if (result.imported > 0) setImportText("");
        return;
      }

      const rows = parseImportCsv(text);
      if (rows.length === 0) {
        setImportMsg("No valid rows found. Check CSV format.");
        return;
      }
      const result = await importTransactionHistory({
        rows,
        envelopes,
        householdId: household.id,
        userId: dbUser.id,
        fxRates,
      });
      await refetch();
      window.dispatchEvent(new CustomEvent("amplop:data-changed"));
      const errNote = result.errors.length > 0 ? ` (${result.errors.length} issues)` : "";
      setImportMsg(`Imported ${result.imported} transactions, skipped ${result.skipped}${errNote}.`);
      if (result.imported > 0) setImportText("");
    } catch (err) {
      setImportMsg(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
      setImportProgress("");
    }
  }

  async function handleSyncRemainings() {
    if (!household) return;
    setSyncingRemainings(true);
    setRemainingMsg("");
    try {
      const remainings = parseRemainingBalances(remainingText);
      const keys = Object.keys(remainings);
      if (keys.length === 0) {
        setRemainingMsg("No balances parsed. Use format: Groceries: 2500000");
        return;
      }

      const envelopes = await loadEnvelopes();
      const { data: spentRows } = await supabase.rpc("get_envelope_spent");
      const spentMap: Record<string, number> = {};
      for (const row of (spentRows as EnvelopeSpent[] ?? [])) {
        spentMap[row.envelope_id] = Number(row.spent_idr);
      }

      const result = await syncEnvelopeRemainings({ remainings, envelopes, spentMap });
      await refetch();
      window.dispatchEvent(new CustomEvent("amplop:data-changed"));

      let msg = `Updated ${result.updated} envelope balance(s).`;
      if (result.unmatched.length > 0) {
        msg += ` Not matched: ${result.unmatched.join(", ")}`;
      }
      setRemainingMsg(msg);
    } catch (err) {
      setRemainingMsg(err instanceof Error ? err.message : "Sync failed");
    } finally {
      setSyncingRemainings(false);
    }
  }

  async function handleImportFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setImportText(text);
    e.target.value = "";
  }

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

        {/* AI Coach */}
        <section>
          <p className="font-mono text-xs text-brand-text-muted uppercase tracking-widest mb-3">ai coach</p>
          <Link
            to="/insights"
            className="block w-full rounded-lg border border-brand-border bg-brand-surface py-3 text-center font-mono text-sm text-brand-accent"
          >
            open budget coach →
          </Link>
          <p className="mt-2 font-mono text-[10px] leading-relaxed text-brand-text-muted">
            Requires ANTHROPIC_API_KEY in Supabase secrets. Deploy: budget-insights edge function.
          </p>
        </section>

        {/* Import history */}
        <section>
          <p className="font-mono text-xs text-brand-text-muted uppercase tracking-widest mb-3">import history</p>
          <div className="space-y-3">
            <p className="font-mono text-[11px] leading-relaxed text-brand-text-muted">
              Upload a Goodbudget export (Date, Envelope, Name, Amount) or paste a simple CSV.
              Goodbudget imports also sync monthly envelope budgets from your spending patterns.
            </p>
            <label className="block w-full rounded-lg border border-dashed border-brand-border bg-brand-surface px-4 py-3 text-center font-mono text-sm text-brand-accent cursor-pointer">
              choose CSV file
              <input type="file" accept=".csv,text/csv" onChange={handleImportFile} className="hidden" />
            </label>
            <label className="flex items-center gap-2 font-mono text-xs text-brand-text-muted">
              <input
                type="checkbox"
                checked={syncBudgets}
                onChange={(e) => setSyncBudgets(e.target.checked)}
                className="rounded border-brand-border"
              />
              sync envelope budgets from Goodbudget spending
            </label>
            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder={IMPORT_CSV_TEMPLATE}
              rows={6}
              className={`${inputCls} resize-y font-mono text-xs leading-relaxed`}
            />
            {importProgress && (
              <p className="font-mono text-xs text-brand-text-muted">Importing… {importProgress}</p>
            )}
            {importMsg && (
              <p className={`font-mono text-xs ${importMsg.startsWith("Imported") || importMsg.includes("Updated") ? "text-brand-accent" : importMsg.startsWith("Warning") ? "text-amber-600" : "text-red-400"}`}>
                {importMsg}
              </p>
            )}
            <button
              type="button"
              onClick={handleImportHistory}
              disabled={importing || !importText.trim()}
              className="w-full rounded-lg border border-brand-border bg-brand-surface py-3 font-mono text-sm text-brand-text disabled:opacity-50"
            >
              {importing ? "importing..." : "import transactions"}
            </button>
          </div>
        </section>

        {/* Sync remaining balances */}
        <section>
          <p className="font-mono text-xs text-brand-text-muted uppercase tracking-widest mb-3">sync balances</p>
          <div className="space-y-3">
            <p className="font-mono text-[11px] leading-relaxed text-brand-text-muted">
              Paste how much is left in each envelope from Goodbudget (IDR). Import history first, then sync balances here.
            </p>
            <textarea
              value={remainingText}
              onChange={(e) => setRemainingText(e.target.value)}
              placeholder={REMAINING_BALANCES_TEMPLATE}
              rows={8}
              className={`${inputCls} resize-y font-mono text-xs leading-relaxed`}
            />
            {remainingMsg && (
              <p className={`font-mono text-xs ${remainingMsg.startsWith("Updated") ? "text-brand-accent" : "text-red-400"}`}>
                {remainingMsg}
              </p>
            )}
            <button
              type="button"
              onClick={handleSyncRemainings}
              disabled={syncingRemainings || !remainingText.trim()}
              className="w-full rounded-lg bg-brand-accent py-3 font-mono text-sm font-semibold text-brand-text disabled:opacity-50"
            >
              {syncingRemainings ? "syncing..." : "sync envelope balances"}
            </button>
          </div>
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
