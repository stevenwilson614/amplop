import { useState } from "react";
import { supabase } from "@/lib/supabase";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    const redirectTo = window.location.origin + import.meta.env.BASE_URL;
    await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo },
    });
    setSent(true);
    setLoading(false);
  }

  return (
    <div className="flex h-screen flex-col items-center justify-center bg-brand-bg px-6">
      <h1 className="mb-2 font-mono text-4xl font-bold text-brand-text">amplop</h1>
      <p className="mb-10 font-mono text-xs text-brand-text-muted">household budgeting</p>
      {sent ? (
        <p className="text-center font-mono text-sm text-brand-text-muted">
          check your email for a magic link
        </p>
      ) : (
        <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-4">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="your@email.com"
            required
            className="w-full rounded-lg border border-brand-border bg-brand-surface px-4 py-3 font-mono text-sm text-brand-text placeholder-brand-text-muted focus:outline-none focus:ring-2 focus:ring-brand-accent"
          />
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-brand-accent py-3 font-mono text-sm font-semibold text-brand-text disabled:opacity-50"
          >
            {loading ? "sending..." : "send magic link"}
          </button>
        </form>
      )}
    </div>
  );
}
