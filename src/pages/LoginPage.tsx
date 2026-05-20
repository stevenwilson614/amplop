import { useState } from "react";
import { supabase } from "@/lib/supabase";

type Method = "password" | "otp";
type Step = "email" | "code";

export default function LoginPage() {
  const [method, setMethod] = useState<Method>("password");
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [token, setToken] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

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
    if (error) setError(error.message);
    setLoading(false);
  }

  function switchMethod(m: Method) {
    setMethod(m);
    setStep("email");
    setError("");
    setToken("");
  }

  return (
    <div className="flex h-screen flex-col items-center justify-center bg-brand-bg px-6">
      <h1 className="mb-2 font-mono text-4xl font-bold text-brand-text">amplop</h1>
      <p className="mb-8 font-mono text-xs text-brand-text-muted">household budgeting</p>

      {/* method toggle */}
      <div className="mb-6 flex w-full max-w-sm rounded-lg border border-brand-border bg-brand-surface p-1">
        {(["password", "otp"] as Method[]).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => switchMethod(m)}
            className={`flex-1 rounded-md py-2 font-mono text-xs transition-colors ${
              method === m ? "bg-brand-accent text-brand-text" : "text-brand-text-muted"
            }`}
          >
            {m === "password" ? "password" : "email code"}
          </button>
        ))}
      </div>

      {method === "password" ? (
        <form onSubmit={handlePassword} className="w-full max-w-sm space-y-3">
          <input
            type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com" required autoFocus className={inputCls}
          />
          <input
            type="password" value={password} onChange={(e) => setPassword(e.target.value)}
            placeholder="password" required className={inputCls}
          />
          {error && <p className="font-mono text-xs text-red-400">{error}</p>}
          <button
            type="submit" disabled={loading}
            className="w-full rounded-lg bg-brand-accent py-3 font-mono text-sm font-semibold text-brand-text disabled:opacity-50"
          >
            {loading ? "signing in..." : "sign in"}
          </button>
        </form>
      ) : step === "email" ? (
        <form onSubmit={handleSendOtp} className="w-full max-w-sm space-y-3">
          <input
            type="email" value={email} onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com" required autoFocus className={inputCls}
          />
          {error && <p className="font-mono text-xs text-red-400">{error}</p>}
          <button
            type="submit" disabled={loading}
            className="w-full rounded-lg bg-brand-accent py-3 font-mono text-sm font-semibold text-brand-text disabled:opacity-50"
          >
            {loading ? "sending..." : "send code"}
          </button>
        </form>
      ) : (
        <form onSubmit={handleVerify} className="w-full max-w-sm space-y-3">
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
          <button type="button" onClick={() => { setStep("email"); setToken(""); setError(""); }}
            className="w-full py-2 font-mono text-xs text-brand-text-muted">
            ← use a different email
          </button>
        </form>
      )}
    </div>
  );
}

const inputCls = "w-full rounded-lg border border-brand-border bg-brand-surface px-4 py-3 font-mono text-sm text-brand-text placeholder-brand-text-muted focus:outline-none focus:ring-2 focus:ring-brand-accent";
