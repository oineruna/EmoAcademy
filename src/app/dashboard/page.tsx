"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { LearningDashboard } from "@/components/learning-dashboard";
import { getActiveSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/client";

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<{ display_name: string | null; role: string | null } | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    let active = true;
    getActiveSupabaseClient().then(async (result) => {
      if (!active) return;
      if (!result) {
        if (isSupabaseConfigured()) {
          router.replace("/");
          return;
        }
        setLoading(false);
        return;
      }
      setUser(result.session.user);
      const { data } = await result.client
        .from("profiles")
        .select("display_name, role")
        .eq("id", result.session.user.id)
        .maybeSingle();
      if (!active) return;
      if (data) setProfile(data);
      setLoading(false);
    });
    return () => { active = false; };
  }, [router]);

  async function logout() {
    const result = await getActiveSupabaseClient();
    await result?.client.auth.signOut();
    router.push("/");
  }

  async function deleteAccount() {
    if (!window.confirm("アカウントとプロフィールを削除します。元に戻せません。")) return;
    const result = await getActiveSupabaseClient();
    if (!result) {
      setMessage("プレビューモードでは削除できません。");
      return;
    }
    const { error } = await result.client.functions.invoke("delete-account");
    if (error) {
      setMessage(`削除できませんでした: ${error.message}`);
      return;
    }
    await result.client.auth.signOut();
    router.push("/");
  }

  if (loading) return <main className="dashboard-loading">学習スペースを準備中…</main>;

  return (
    <LearningDashboard
      displayName={String(profile?.display_name || user?.user_metadata?.display_name || user?.user_metadata?.full_name || "Alex")}
      email={user?.email || "preview@emoacademy.local"}
      role={String(profile?.role || user?.user_metadata?.role || "student")}
      preview={!user}
      message={message}
      onLogout={logout}
      onDeleteAccount={deleteAccount}
    />
  );
}
