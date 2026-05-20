import { useState, useEffect } from "react";
import { HashRouter, Routes, Route, Navigate, Outlet } from "react-router-dom";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import LoginPage from "@/pages/LoginPage";
import EnvelopesPage from "@/pages/EnvelopesPage";
import TransactionsPage from "@/pages/TransactionsPage";
import InsightsPage from "@/pages/InsightsPage";
import VoicePage from "@/pages/VoicePage";
import SettingsPage from "@/pages/SettingsPage";
import BottomNav from "@/components/BottomNav";

function AuthGuard({ session }: { session: Session | null }) {
  if (!session) return <Navigate to="/login" replace />;
  return (
    <div className="flex flex-col h-screen bg-brand-bg">
      <main className="flex-1 overflow-auto pb-safe">
        <Outlet />
      </main>
      <BottomNav />
    </div>
  );
}

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function init() {
      const params = new URLSearchParams(window.location.search);
      const code = params.get("code");
      if (code) {
        await supabase.auth.exchangeCodeForSession(code).catch(() => {});
        window.history.replaceState({}, "", window.location.pathname);
      }
      const {
        data: { session },
      } = await supabase.auth.getSession();
      setSession(session);
      setLoading(false);
    }
    init();
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_, s) => {
      setSession(s);
    });
    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-brand-bg">
        <div className="text-brand-text-muted font-mono text-sm">loading...</div>
      </div>
    );
  }

  return (
    <HashRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route element={<AuthGuard session={session} />}>
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
