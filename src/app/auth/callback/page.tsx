"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export default function AuthCallbackPage() {
  const router = useRouter();
  const [message, setMessage] = useState("メール確認を完了しています…");

  useEffect(() => {
    async function completeConfirmation() {
      await Promise.resolve();
      const code = new URLSearchParams(window.location.search).get("code");
      const client = getSupabaseBrowserClient("local");
      if (!code || !client) {
        setMessage("確認リンクが無効か、Supabaseが未設定です。");
        return;
      }
      const { error } = await client.auth.exchangeCodeForSession(code);
      if (error) setMessage(error.message);
      else router.replace("/dashboard");
    }
    void completeConfirmation();
  }, [router]);

  return <main className="simple-page"><section className="simple-card"><h1>EmoAcademy</h1><p>{message}</p><Link className="simple-link" href="/">ログインへ戻る</Link></section></main>;
}
