import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import SettingsForm from "@/components/settings/SettingsForm";

export default async function SettingsPage() {
  const supabase = createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("users")
    .select("display_name, display_currency")
    .eq("id", user.id)
    .single();
  if (!profile) redirect("/login");

  // Latest fx_rates entry — used to show how fresh the rates are
  const { data: latestRate } = await supabase
    .from("fx_rates")
    .select("fetched_at")
    .order("fetched_at", { ascending: false })
    .limit(1)
    .single();

  return (
    <SettingsForm
      userId={user.id}
      displayName={profile.display_name}
      displayCurrency={profile.display_currency}
      ratesUpdatedAt={latestRate?.fetched_at ?? null}
    />
  );
}
