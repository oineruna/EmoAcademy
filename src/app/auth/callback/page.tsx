"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export default function AuthCallbackPage() {
  const router = useRouter();
  const [message, setMessage] = useState("認証を完了しています…");

  useEffect(() => {
    async function completeConfirmation() {
      await Promise.resolve();
      const parameters = new URLSearchParams(window.location.search);
      const errorDescription = parameters.get("error_description");
      const code = parameters.get("code");
      if (errorDescription) {
        setMessage(errorDescription);
        return;
      }
      const storageMode = window.sessionStorage.getItem("emo-academy-oauth-storage") === "session" ? "session" : "local";
      window.sessionStorage.removeItem("emo-academy-oauth-storage");
      const client = getSupabaseBrowserClient(storageMode);
      if (!code || !client) {
        setMessage("確認リンクが無効か、Supabaseが未設定です。");
        return;
      }
      const { data, error } = await client.auth.exchangeCodeForSession(code);
      if (error) {
        setMessage(error.message);
        return;
      }
      const desiredRole = window.sessionStorage.getItem("emo-academy-oauth-role");
      window.sessionStorage.removeItem("emo-academy-oauth-role");
      if (data.user && (desiredRole === "student" || desiredRole === "teacher")) {
        const displayName = String(data.user.user_metadata.full_name || data.user.user_metadata.name || "");
        const { error: profileError } = await client.from("profiles").update({ role: desiredRole, display_name: displayName }).eq("id", data.user.id);
        if (profileError) {
          setMessage("Google登録は完了しましたが、ロールの保存に失敗しました。もう一度お試しください。");
          return;
        }
      }
      router.replace("/dashboard");
    }
    void completeConfirmation();
  }, [router]);

  return <main className="simple-page"><section className="simple-card"><h1>EmoAcademy</h1><p>{message}</p><Link className="simple-link" href="/">ログインへ戻る</Link></section></main>;
}
