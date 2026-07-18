import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useHousehold } from "@/context/HouseholdContext";
import { supabase } from "@/lib/supabase";
import type { CashSnapshot, Envelope, EnvelopeSpent } from "@/lib/types";
import { format, convert, getRate, parseToMinorUnits } from "@/lib/currency";
import { attachSnapshotDeltas, bucketPayload } from "@/lib/cashSnapshot";
import { computeInvestable, formatDualAmount } from "@/lib/investableSurplus";
import { monthlyGhostBudgetIdr, totalMonthlyGhostUsd } from "@/lib/ghostExpenses";
import { isSinking } from "@/lib/sinkingFunds";
import {
  monthlyBudgetIdr,
  resolveEnvelopeBalanceIdr,
  buildMonthSpentByEnvelope,
  buildFirstActivityMap,
  computeAvailableIdr,
  budgetMonthsElapsed,
  envelopeBudgetStartDate,
  fetchAllHouseholdTransactions,
} from "@/lib/envelopeBudget";

const inputCls =
  "w-full rounded-lg border border-brand-border bg-brand-bg px-4 py-3 font-mono text-sm text-brand-text placeholder-brand-text-muted focus:outline-none focus:ring-2 focus:ring-brand-accent";

function fmtDelta(minor: number | null, currency = "USD"): string | null {
  if (minor === null) return null;
  const sign = minor >= 0 ? "+" : "";
  return `${sign}${format(minor, currency)}`;
}

export default function CashPage() {
  const { household, dbUser, fxRates, fxRatesAvg30d } = useHousehold();
  const planningFx = Object.keys(fxRatesAvg30d).length ? fxRatesAvg30d : fxRates;
  const dc = dbUser?.display_currency ?? "IDR";

  const [snapshots, setSnapshots] = useState<CashSnapshot[]>([]);
  const [allEnvelopes, setAllEnvelopes] = useState<Envelope[]>([]);
  const [balanceIdrById, setBalanceIdrById] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [business, setBusiness] = useState("");
  const [personal, setPersonal] = useState("");
  const [savings, setSavings] = useState("");
  const [showOther, setShowOther] = useState(false);
  const [other, setOther] = useState("");
  const [otherLabel, setOtherLabel] = useState("");
  const [date, setDate] = useState(new Date().toLocaleDateString("en-CA"));
  const [notes, setNotes] = useState("");

  const load = useCallback(async () => {
    if (!household) return;
    setLoading(true);
    const [{ data: cash }, { data: envs }, { data: spent }, historyTxs] = await Promise.all([
      supabase
        .from("cash_snapshots")
        .select("*")
        .eq("household_id", household.id)
        .order("as_of_date", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(48),
      supabase.from("envelopes").select("*").eq("household_id", household.id).is("trip_id", null),
      supabase.rpc("get_envelope_spent"),
      fetchAllHouseholdTransactions(household.id),
    ]);

    const envelopes = (envs ?? []) as Envelope[];
    const spentMap: Record<string, number> = {};
    for (const row of (spent as EnvelopeSpent[] ?? [])) spentMap[row.envelope_id] = Number(row.spent_idr);

    const monthSpentByEnvelope = buildMonthSpentByEnvelope(historyTxs);
    const firstActivityMap = buildFirstActivityMap(historyTxs);
    const now = new Date();
    const balances: Record<string, number> = {};

    for (const env of envelopes) {
      const monthly = monthlyBudgetIdr(env, fxRates);
      const monthSpentIdr = monthSpentByEnvelope[env.id]?.[now.toLocaleDateString("en-CA").slice(0, 7)] ?? 0;
      const start = envelopeBudgetStartDate(env, firstActivityMap[env.id]);
      const budgetMonths = budgetMonthsElapsed(start, now);
      balances[env.id] = resolveEnvelopeBalanceIdr({
        envelope: env,
        isTrip: false,
        monthlyBudgetIdr: monthly,
        spentIdr: spentMap[env.id] ?? 0,
        monthSpentIdr,
        budgetMonths,
        availableIdr: computeAvailableIdr(env, fxRates, firstActivityMap[env.id], now),
        monthSpentByMonth: monthSpentByEnvelope[env.id] ?? {},
      });
    }

    setSnapshots((cash as CashSnapshot[]) ?? []);
    setAllEnvelopes(envelopes);
    setBalanceIdrById(balances);
    setLoading(false);
  }, [household, fxRates]);

  useEffect(() => {
    load();
  }, [load]);

  const withDeltas = useMemo(() => attachSnapshotDeltas(snapshots), [snapshots]);
  const latest = withDeltas[0] ?? null;
  const sinkingEnvelopes = useMemo(() => allEnvelopes.filter(isSinking), [allEnvelopes]);

  const investableSnapshot = useMemo(
    () =>
      computeInvestable({
        snapshots,
        balances: allEnvelopes.map((envelope) => ({
          envelope,
          balanceIdr: balanceIdrById[envelope.id] ?? 0,
        })),
        fxRates: planningFx,
      }),
    [snapshots, allEnvelopes, balanceIdrById, planningFx]
  );

  const monthlyGhostUsd = useMemo(
    () => totalMonthlyGhostUsd(sinkingEnvelopes, planningFx),
    [sinkingEnvelopes, planningFx]
  );

  const liveTotalMinor = useMemo(() => {
    const b = parseToMinorUnits(business || "0", "USD");
    const p = parseToMinorUnits(personal || "0", "USD");
    const s = parseToMinorUnits(savings || "0", "USD");
    const o = showOther ? parseToMinorUnits(other || "0", "USD") : 0;
    return b + p + s + o;
  }, [business, personal, savings, other, showOther]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!household || !dbUser) return;
    setSaving(true);
    setError("");
    try {
      const businessMinor = parseToMinorUnits(business || "0", "USD");
      const personalMinor = parseToMinorUnits(personal || "0", "USD");
      const savingsMinor = parseToMinorUnits(savings || "0", "USD");
      const otherMinor = showOther ? parseToMinorUnits(other || "0", "USD") : 0;
      const payload = bucketPayload({
        business: businessMinor,
        personal: personalMinor,
        savings: savingsMinor,
        other: otherMinor,
        otherLabel: showOther ? otherLabel : undefined,
      });
      if (payload.amount <= 0) throw new Error("enter at least one bucket amount");

      const amountIdr = convert(payload.amount, "USD", "IDR", fxRates);
      const fxRate = getRate(fxRates, "USD", "IDR");

      const { error: err } = await supabase.from("cash_snapshots").insert({
        household_id: household.id,
        as_of_date: date,
        ...payload,
        amount_idr_snapshot: amountIdr,
        fx_rate_snapshot: fxRate,
        notes: notes.trim() || null,
        created_by: dbUser.id,
      });
      if (err) throw err;

      setBusiness("");
      setPersonal("");
      setSavings("");
      setOther("");
      setOtherLabel("");
      setNotes("");
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  const cashDisplay = latest
    ? formatDualAmount(investableSnapshot.cashIdr, dc, planningFx)
    : null;
  const deltaDisplay =
    latest?.deltaMinor != null ? format(latest.deltaMinor, "USD") : null;

  return (
    <div className="flex min-h-full flex-col bg-brand-surface">
      <div className="sticky top-0 z-10 border-b border-brand-border bg-brand-accent px-4 pb-3 pt-5 text-white">
        <div className="flex items-center justify-between gap-3">
          <Link to="/envelopes" className="font-mono text-sm text-white/90">
            ← envelopes
          </Link>
          <h1 className="font-mono text-xl font-semibold tracking-tight">Cash</h1>
          <div className="w-16" />
        </div>
      </div>

      <div className="flex-1 space-y-5 overflow-auto px-4 py-4">
        <section className="rounded-2xl border border-brand-border bg-brand-bg p-4">
          <p className="font-mono text-[10px] uppercase tracking-wider text-brand-text-muted">total liquid (USD)</p>
          {loading ? (
            <p className="font-mono text-sm text-brand-text-muted">loading...</p>
          ) : latest ? (
            <>
              <p className="font-mono text-3xl font-semibold text-brand-text">
                {format(latest.totalMinor, "USD")}
              </p>
              {cashDisplay?.secondary && (
                <p className="font-mono text-xs text-brand-text-muted">{cashDisplay.secondary}</p>
              )}
              {deltaDisplay && (
                <p className={`mt-2 font-mono text-sm ${latest.deltaMinor! >= 0 ? "text-[#0F3C1B]" : "text-red-600"}`}>
                  {latest.deltaMinor! >= 0 ? "+" : ""}{deltaDisplay} since last snapshot
                </p>
              )}
              <div className="mt-3 grid grid-cols-2 gap-2 font-mono text-xs">
                <Bucket label="business" amount={latest.business_amount ?? 0} delta={latest.businessDelta} />
                <Bucket label="personal" amount={latest.personal_amount ?? 0} delta={latest.personalDelta} />
                <Bucket label="savings" amount={latest.savings_amount ?? 0} delta={latest.savingsDelta} />
                {(latest.other_amount ?? 0) > 0 && (
                  <Bucket
                    label={latest.other_label || "other"}
                    amount={latest.other_amount ?? 0}
                    delta={latest.otherDelta}
                  />
                )}
              </div>
            </>
          ) : (
            <p className="font-mono text-sm text-brand-text-muted">log your first snapshot below</p>
          )}
        </section>

        <section className="rounded-2xl border border-brand-border bg-brand-bg p-4">
          <div className="mb-3 flex items-baseline justify-between gap-2">
            <div>
              <p className="font-mono text-sm font-semibold text-brand-text">Save-for (ghost expenses)</p>
              <p className="font-mono text-xs text-brand-text-muted">monthly set-asides from cash</p>
            </div>
            <p className="font-mono text-sm font-semibold text-brand-text">
              {format(monthlyGhostUsd, "USD")}/mo
            </p>
          </div>
          <div className="space-y-2">
            {sinkingEnvelopes.map((env) => {
              const monthlyIdr = monthlyGhostBudgetIdr(env, planningFx);
              const monthlyUsd = convert(monthlyIdr, "IDR", "USD", planningFx);
              return (
                <div key={env.id} className="flex items-baseline justify-between gap-2 font-mono text-xs">
                  <span className="text-brand-text">{env.name}</span>
                  <span className="text-brand-text-muted">
                    {format(monthlyUsd, "USD")}/mo
                    {env.due_date && <> · due {env.due_date.slice(0, 7)}</>}
                  </span>
                </div>
              );
            })}
            {sinkingEnvelopes.length === 0 && (
              <p className="font-mono text-xs text-brand-text-muted">no save-for envelopes yet</p>
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-brand-border bg-brand-bg p-4">
          <p className="mb-3 font-mono text-sm font-semibold text-brand-text">log snapshot (USD)</p>
          <form onSubmit={handleSave} className="space-y-3">
            <Field label="business">
              <input type="number" min="0" step="0.01" value={business} onChange={(e) => setBusiness(e.target.value)} placeholder="0.00" className={inputCls} />
            </Field>
            <Field label="personal">
              <input type="number" min="0" step="0.01" value={personal} onChange={(e) => setPersonal(e.target.value)} placeholder="0.00" className={inputCls} />
            </Field>
            <Field label="savings">
              <input type="number" min="0" step="0.01" value={savings} onChange={(e) => setSavings(e.target.value)} placeholder="0.00" className={inputCls} />
            </Field>

            {!showOther ? (
              <button type="button" onClick={() => setShowOther(true)} className="font-mono text-xs text-brand-accent">
                + add another bucket
              </button>
            ) : (
              <>
                <Field label="other label">
                  <input type="text" value={otherLabel} onChange={(e) => setOtherLabel(e.target.value)} placeholder="e.g. crypto, escrow" className={inputCls} />
                </Field>
                <Field label="other amount">
                  <input type="number" min="0" step="0.01" value={other} onChange={(e) => setOther(e.target.value)} placeholder="0.00" className={inputCls} />
                </Field>
              </>
            )}

            <Field label="as of">
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputCls} />
            </Field>
            <Field label="notes">
              <input type="text" value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="optional" className={inputCls} />
            </Field>

            <p className="font-mono text-xs text-brand-text-muted">
              total: {format(liveTotalMinor, "USD")}
            </p>

            {error && <p className="font-mono text-xs text-red-400">{error}</p>}

            <button
              type="submit"
              disabled={saving}
              className="w-full rounded-lg bg-brand-accent py-3 font-mono text-sm font-semibold text-white disabled:opacity-50"
            >
              {saving ? "saving..." : "save snapshot"}
            </button>
          </form>
        </section>

        {withDeltas.length > 0 && (
          <section>
            <p className="mb-2 font-mono text-sm font-semibold text-brand-text">history</p>
            <div className="space-y-2">
              {withDeltas.map((row) => (
                <div key={row.id} className="rounded-xl border border-brand-border bg-brand-bg px-3 py-2 font-mono text-xs">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="text-brand-text">{row.as_of_date}</span>
                    <span className="font-semibold text-brand-text">{format(row.totalMinor, "USD")}</span>
                  </div>
                  {row.deltaMinor !== null && (
                    <p className={row.deltaMinor >= 0 ? "text-[#0F3C1B]" : "text-red-600"}>
                      {fmtDelta(row.deltaMinor)}
                    </p>
                  )}
                  <p className="text-brand-text-muted">
                    biz {format(row.business_amount ?? 0, "USD")} · pers {format(row.personal_amount ?? 0, "USD")} · save {format(row.savings_amount ?? 0, "USD")}
                    {(row.other_amount ?? 0) > 0 && <> · {row.other_label || "other"} {format(row.other_amount ?? 0, "USD")}</>}
                  </p>
                  {row.notes && <p className="text-brand-text-muted">{row.notes}</p>}
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
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

function Bucket({ label, amount, delta }: { label: string; amount: number; delta: number | null }) {
  return (
    <div className="rounded-lg bg-brand-surface px-2 py-1.5">
      <p className="text-brand-text-muted">{label}</p>
      <p className="text-brand-text">{format(amount, "USD")}</p>
      {delta !== null && delta !== 0 && (
        <p className={delta >= 0 ? "text-[#0F3C1B]" : "text-red-600"}>{fmtDelta(delta)}</p>
      )}
    </div>
  );
}
