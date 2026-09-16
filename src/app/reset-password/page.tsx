"use client";

import { FormEvent, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const exchangeStarted = useRef(false);
  const [ready, setReady] = useState(false);
  const [message, setMessage] = useState("復旧リンクを確認しています…");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (exchangeStarted.current) return;
    exchangeStarted.current = true;

    async function prepareRecoverySession() {
      const client = getSupabaseBrowserClient("local");
      if (!client) {
        setMessage("Supabaseが未設定です。");
        return;
      }
      const parameters = new URLSearchParams(window.location.search);
      const errorDescription = parameters.get("error_description");
      const code = parameters.get("code");
      if (errorDescription) {
        setMessage(errorDescription);
        return;
      }
      if (code) {
        const { error } = await client.auth.exchangeCodeForSession(code);
        if (error) {
          setMessage(error.message);
          return;
        }
        window.history.replaceState({}, document.title, window.location.pathname);
      } else {
        const { data } = await client.auth.getSession();
        if (!data.session) {
          setMessage("復旧リンクが無効か期限切れです。もう一度、復旧メールを送信してください。");
          return;
        }
      }
      setReady(true);
      setMessage("新しいパスワードを入力してください。");
    }

    void prepareRecoverySession();
  }, []);

  async function updatePassword(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const password = String(new FormData(event.currentTarget).get("password") || "");
    if (password.length < 8) { setMessage("パスワードは8文字以上で入力してください。"); return; }
    const client = getSupabaseBrowserClient("local");
    if (!client) { setMessage("Supabaseが未設定です。"); return; }
    setLoading(true);
    const { error } = await client.auth.updateUser({ password });
    setLoading(false);
    setMessage(error ? error.message : "パスワードを更新しました。ログイン画面へ戻ってください。");
  }

  return <main className="simple-page"><section className="simple-card"><h1>新しいパスワード</h1><p>8文字以上で設定してください。</p><form onSubmit={updatePassword}><label className="field"><span className="field-label">新しいパスワード</span><span className="input-shell"><input name="password" type="password" minLength={8} autoComplete="new-password" disabled={!ready || loading} required /></span></label><button className="submit-button" disabled={!ready || loading}>{loading ? "更新中…" : "パスワードを更新"}</button></form>{message && <p>{message}</p>}<Link className="simple-link" href="/">ログインへ戻る</Link></section></main>;
}
