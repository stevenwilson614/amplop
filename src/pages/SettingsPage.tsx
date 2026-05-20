import { supabase } from "@/lib/supabase";
import { useNavigate } from "react-router-dom";

export default function SettingsPage() {
  const navigate = useNavigate();

  async function handleSignOut() {
    await supabase.auth.signOut();
    navigate("/login");
  }

  return (
    <div className="p-4">
      <h1 className="mb-6 font-mono text-lg font-bold text-brand-text">settings</h1>
      <button
        onClick={handleSignOut}
        className="w-full rounded-lg border border-brand-border bg-brand-surface py-3 font-mono text-sm text-brand-text"
      >
        sign out
      </button>
    </div>
  );
}
