import { useState, useEffect } from "react";
import { HashRouter, Routes, Route, Navigate, Outlet, useNavigate } from "react-router-dom";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { HouseholdProvider, useHousehold } from "@/context/HouseholdContext";
import { TransactionModalProvider } from "@/context/TransactionModalContext";
import LoginPage from "@/pages/LoginPage";
import OnboardingPage from "@/pages/OnboardingPage";
import EnvelopesPage from "@/pages/EnvelopesPage";
import TransactionsPage from "@/pages/TransactionsPage";
import InsightsPage from "@/pages/InsightsPage";
import VoicePage from "@/pages/VoicePage";
import SettingsPage from "@/pages/SettingsPage";
import WhaleFactsPreviewPage from "@/pages/WhaleFactsPreviewPage";
import BottomNav from "@/components/BottomNav";
import WhaleBuddy from "@/components/whale/WhaleBuddy";

/** After login, send new users to onboarding (household code), not straight to envelopes. */
function PostLoginRedirect() {
  const [target, setTarget] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        if (!cancelled) setTarget("/login");
        return;
      }
      const { data: row } = await supabase
        .from("users")
        .select("id")
        .eq("id", user.id)
        .maybeSingle();
      if (!cancelled) setTarget(row ? "/envelopes" : "/onboard");
    })();
    return () => { cancelled = true; };
  }, []);

  if (!target) return <Spinner />;
  return <Navigate to={target} replace />;
}

function AppShell() {
  const { needsOnboarding, loading } = useHousehold();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && needsOnboarding) navigate("/onboard", { replace: true });
  }, [loading, needsOnboarding, navigate]);

  if (loading) return <Spinner />;

  return (
    <div className="min-h-screen bg-brand-bg px-0 sm:px-4 sm:py-6">
      <div className="relative mx-auto flex h-screen w-full max-w-[430px] flex-col overflow-hidden bg-brand-surface sm:h-[896px] sm:rounded-[34px] sm:shadow-2xl">
        <main className="flex-1 overflow-auto pb-28">
          <Outlet />
        </main>
        <WhaleBuddy />
        <BottomNav />
      </div>
    </div>
  );
}

function AuthGuard({ session }: { session: Session | null }) {
  if (!session) return <Navigate to="/login" replace />;
  return (
    <HouseholdProvider>
      <TransactionModalProvider>
        <AppShell />
      </TransactionModalProvider>
    </HouseholdProvider>
  );
}

function Spinner() {
  return (
    <div className="flex h-screen items-center justify-center bg-brand-bg">
      <span className="font-mono text-sm font-semibold text-brand-text-muted">loading...</span>
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // PKCE fallback: if magic link was clicked in the right browser context
    const code = new URLSearchParams(window.location.search).get("code");
    if (code) {
      supabase.auth.exchangeCodeForSession(code)
        .catch(() => {})
        .finally(() => window.history.replaceState({}, "", window.location.pathname));
    }

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_, s) => {
      setSession(s);
      setLoading(false);
    });
    return () => subscription.unsubscribe();
  }, []);

  if (loading) return <Spinner />;

  return (
    <HashRouter>
      <Routes>
        <Route path="/login" element={session ? <PostLoginRedirect /> : <LoginPage />} />
        <Route path="/whale-preview" element={<WhaleFactsPreviewPage />} />
        <Route element={<AuthGuard session={session} />}>
          <Route path="/onboard" element={<OnboardingPage />} />
          <Route index element={<Navigate to="/envelopes" replace />} />
          <Route path="/envelopes" element={<EnvelopesPage />} />
          <Route path="/transactions" element={<TransactionsPage />} />
          <Route path="/insights" element={<InsightsPage />} />
          <Route path="/voice" element={<VoicePage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}
