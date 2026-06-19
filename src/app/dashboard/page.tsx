"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { getActiveSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/client";

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [message, setMessage] = useState("確認中…");

  useEffect(() => {
    let active = true;
    getActiveSupabaseClient().then((result) => {
      if (!active) return;
      if (!result) {
        setMessage(isSupabaseConfigured() ? "ログインが必要です。" : "Supabaseが未設定です。");
        return;
      }
      setUser(result.session.user);
      setMessage("");
    });
    return () => { active = false; };
  }, []);

  async function logout() {
    const result = await getActiveSupabaseClient();
    await result?.client.auth.signOut();
    router.push("/");
  }

  async function deleteAccount() {
    if (!window.confirm("アカウントとプロフィールを削除します。元に戻せません。")) return;
    const result = await getActiveSupabaseClient();
    if (!result) return;
    const { error } = await result.client.functions.invoke("delete-account");
    if (error) {
      setMessage(`削除できませんでした: ${error.message}`);
      return;
    }
    await result.client.auth.signOut();
    router.push("/");
  }

  return (
    <main className="simple-page"><section className="simple-card">
      <p className="eyebrow">EMOACADEMY</p><h1>ログインできました</h1>
      {message && <p>{message}</p>}
      {user && <><p><strong>{String(user.user_metadata?.display_name || "ユーザー")}</strong><br />{user.email}<br />ロール: {String(user.user_metadata?.role || "未設定")}</p><div className="simple-actions"><button className="submit-button" type="button" onClick={logout}>ログアウト</button><button className="submit-button danger-button" type="button" onClick={deleteAccount}>アカウント削除</button></div></>}
    </section></main>
  );
}
