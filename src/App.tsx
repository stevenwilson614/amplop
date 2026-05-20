import { useState, useEffect } from "react";
import { HashRouter, Routes, Route, Navigate, Outlet, useNavigate } from "react-router-dom";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { HouseholdProvider, useHousehold } from "@/context/HouseholdContext";
import LoginPage from "@/pages/LoginPage";
import OnboardingPage from "@/pages/OnboardingPage";
import EnvelopesPage from "@/pages/EnvelopesPage";
import TransactionsPage from "@/pages/TransactionsPage";
import InsightsPage from "@/pages/InsightsPage";
import VoicePage from "@/pages/VoicePage";
import SettingsPage from "@/pages/SettingsPage";
import BottomNav from "@/components/BottomNav";

function AppShell() {
  const { needsOnboarding, loading } = useHousehold();
  const navigate = useNavigate();

  useEffect(() => {
    if (!loading && needsOnboarding) navigate("/onboard", { replace: true });
  }, [loading, needsOnboarding, navigate]);

  if (loading) return <Spinner />;

  return (
    <div className="flex flex-col h-screen bg-brand-bg">
      <main className="flex-1 overflow-auto">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}

function AuthGuard({ session }: { session: Session | null }) {
  if (!session) return <Navigate to="/login" replace />;
  return (
    <HouseholdProvider>
      <AppShell />
    </HouseholdProvider>
  );
}

function Spinner() {
  return (
    <div className="flex h-screen items-center justify-center bg-brand-bg">
      <span className="font-mono text-sm text-brand-text-muted">loading...</span>
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
        <Route path="/login" element={<LoginPage />} />
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
