import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/lib/supabase";

type Screen = "landing" | "signin" | "signup";
type Method = "password" | "otp";
type Step = "email" | "code";

export default function LoginPage() {
  const navigate = useNavigate();
  const [screen, setScreen] = useState<Screen>("landing");
  const [method, setMethod] = useState<Method>("password");
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [householdCode, setHouseholdCode] = useState("");
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }
    if (data.session) {
      navigate("/onboard", {
        replace: true,
        state: {
          joinCode: householdCode.trim(),
          displayName: displayName.trim(),
          mode: "join" as const,
        },
      });
    } else {
      setError(
        "Account created — check your email to confirm, then sign in. Your household code is saved for the next screen."
      );
      try {
        sessionStorage.setItem(
          "amplop_pending_join",
          JSON.stringify({ joinCode: householdCode.trim(), displayName: displayName.trim() }),
        );
      } catch { /* ignore */ }
    }
    setLoading(false);
  }

  async function handlePassword(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) setError(error.message);
    setLoading(false);
  }

  async function handleSendOtp(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const { error } = await supabase.auth.signInWithOtp({ email });
    if (error) setError(error.message);
    else setStep("code");
    setLoading(false);
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const { error } = await supabase.auth.verifyOtp({ email, token: token.trim(), type: "email" });
    if (!error && householdCode.trim()) {
      try {
        sessionStorage.setItem(
          "amplop_pending_join",
          JSON.stringify({ joinCode: householdCode.trim(), displayName: displayName.trim() }),
        );
      } catch { /* ignore */ }
    }
    if (error) setError(error.message);
    setLoading(false);
  }

  function goLanding() {
    setScreen("landing");
    setStep("email");
    setError("");
    setToken("");
  }

  function InviteCodeField({ hint }: { hint: string }) {
    return (
      <div className="space-y-1 pt-1">
        <p className="font-mono text-[10px] text-brand-text-muted">{hint}</p>
        <input
          type="text"
          value={householdCode}
          onChange={(e) => setHouseholdCode(e.target.value)}
          placeholder="paste household invite code"
          className={inputCls}
        />
      </div>
    );
  }

  if (screen === "landing") {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-brand-bg px-6 py-10">
        <h1 className="mb-2 font-mono text-4xl font-bold text-brand-text">amplop</h1>
        <p className="mb-10 font-mono text-xs text-brand-text-muted text-center">household budgeting</p>

        <div className="w-full max-w-sm space-y-4">
          <button
            type="button"
            onClick={() => setScreen("signup")}
            className="w-full rounded-xl bg-brand-accent py-5 px-4 text-left shadow-lg"
          >
            <p className="font-mono text-base font-bold text-brand-text">join household</p>
            <p className="mt-1 font-mono text-xs text-brand-text/80 leading-relaxed">
              New here? Sign up with your partner&apos;s invite code
            </p>
          </button>

          <button
            type="button"
            onClick={() => setScreen("signin")}
            className="w-full rounded-xl border-2 border-brand-border bg-brand-surface py-5 px-4 text-left"
          >
            <p className="font-mono text-base font-bold text-brand-text">sign in</p>
            <p className="mt-1 font-mono text-xs text-brand-text-muted leading-relaxed">
              Password or email code — already have an account
            </p>
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col bg-brand-bg px-6 py-6">
      <button
        type="button"
        onClick={goLanding}
        className="mb-4 self-start font-mono text-sm text-brand-text-muted"
      >
        ← back
      </button>

      <h1 className="mb-1 font-mono text-2xl font-bold text-brand-text">
        {screen === "signup" ? "join household" : "sign in"}
      </h1>
      <p className="mb-6 font-mono text-xs text-brand-text-muted">
        {screen === "signup"
          ? "Paste the invite code from your partner's app (Settings → Household)"
          : "Use password or a one-time email code"}
      </p>

      {screen === "signup" ? (
        <form onSubmit={handleSignUp} className="w-full max-w-sm space-y-3 mx-auto">
          <Field label="your name">
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Olivia"
              required
              className={inputCls}
            />
          </Field>
          <Field label="household invite code">
            <input
              type="text"
              value={householdCode}
              onChange={(e) => setHouseholdCode(e.target.value)}
              placeholder="paste code from partner"
              required
              className={inputCls}
            />
          </Field>
          <Field label="email">
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="your@email.com"
              required
              className={inputCls}
            />
          </Field>
          <Field label="password">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="min 6 characters"
              required
              minLength={6}
              className={inputCls}
            />
          </Field>
          {error && <p className="font-mono text-xs text-red-400">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-brand-accent py-4 font-mono text-sm font-semibold text-brand-text disabled:opacity-50"
          >
            {loading ? "creating account..." : "create account & join"}
          </button>
        </form>
      ) : (
        <div className="w-full max-w-sm mx-auto space-y-4">
          <div className="flex rounded-lg border border-brand-border bg-brand-surface p-1">
            {(["password", "otp"] as Method[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => { setMethod(m); setStep("email"); setError(""); setToken(""); }}
                className={`flex-1 rounded-md py-2 font-mono text-xs transition-colors ${
                  method === m ? "bg-brand-accent text-brand-text" : "text-brand-text-muted"
                }`}
              >
                {m === "password" ? "password" : "email code"}
              </button>
            ))}
          </div>

          {method === "password" ? (
            <form onSubmit={handlePassword} className="space-y-3">
              <input
                type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com" required className={inputCls}
              />
              <input
                type="password" value={password} onChange={(e) => setPassword(e.target.value)}
                placeholder="password" required className={inputCls}
              />
              <InviteCodeField hint="Joining a household? Paste invite code (optional)" />
              {error && <p className="font-mono text-xs text-red-400">{error}</p>}
              <button
                type="submit" disabled={loading}
                className="w-full rounded-lg bg-brand-accent py-3 font-mono text-sm font-semibold text-brand-text disabled:opacity-50"
              >
                {loading ? "signing in..." : "sign in"}
              </button>
            </form>
          ) : step === "email" ? (
            <form onSubmit={handleSendOtp} className="space-y-3">
              <input
                type="email" value={email} onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com" required className={inputCls}
              />
              <InviteCodeField hint="New user? Paste invite code before sending code" />
              {error && <p className="font-mono text-xs text-red-400">{error}</p>}
              <button
                type="submit" disabled={loading}
                className="w-full rounded-lg bg-brand-accent py-3 font-mono text-sm font-semibold text-brand-text disabled:opacity-50"
              >
                {loading ? "sending..." : "send code"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleVerify} className="space-y-3">
              <p className="font-mono text-xs text-brand-text-muted text-center">
                check your email for a 6-digit code
              </p>
              <input
                type="text" inputMode="numeric" pattern="[0-9]*" maxLength={6}
                value={token} onChange={(e) => setToken(e.target.value.replace(/\D/g, ""))}
                placeholder="123456" required autoFocus
                className={`${inputCls} text-center text-2xl tracking-widest`}
              />
              {error && <p className="font-mono text-xs text-red-400">{error}</p>}
              <button
                type="submit" disabled={loading || token.length < 6}
                className="w-full rounded-lg bg-brand-accent py-3 font-mono text-sm font-semibold text-brand-text disabled:opacity-50"
              >
                {loading ? "verifying..." : "sign in"}
              </button>
              <button
                type="button"
                onClick={() => { setStep("email"); setToken(""); setError(""); }}
                className="w-full py-2 font-mono text-xs text-brand-text-muted"
              >
                ← use a different email
              </button>
            </form>
          )}
        </div>
      )}
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

const inputCls =
  "w-full rounded-lg border border-brand-border bg-brand-surface px-4 py-3 font-mono text-sm text-brand-text placeholder-brand-text-muted focus:outline-none focus:ring-2 focus:ring-brand-accent";
