import BottomNav from "@/components/BottomNav";
import RealtimeSync from "@/components/RealtimeSync";
import { createClient } from "@/lib/supabase/server";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  let syncProps: { householdId: string; userId: string } | null = null;
  if (user) {
    const { data: profile } = await supabase
      .from("users")
      .select("household_id")
      .eq("id", user.id)
      .single();
    if (profile?.household_id) {
      syncProps = { householdId: profile.household_id, userId: user.id };
    }
  }

  return (
    <div className="flex flex-col h-screen overflow-hidden bg-brand-bg">
      <main className="flex-1 overflow-y-auto">{children}</main>
      <BottomNav />
      {syncProps && <RealtimeSync {...syncProps} />}
    </div>
  );
}
