"use client";

import { FormEvent, useState } from "react";
import Link from "next/link";
import { getSupabaseBrowserClient } from "@/lib/supabase/client";

export default function ResetPasswordPage() {
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

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

  return <main className="simple-page"><section className="simple-card"><h1>新しいパスワード</h1><p>8文字以上で設定してください。</p><form onSubmit={updatePassword}><label className="field"><span className="field-label">新しいパスワード</span><span className="input-shell"><input name="password" type="password" minLength={8} autoComplete="new-password" required /></span></label><button className="submit-button" disabled={loading}>{loading ? "更新中…" : "パスワードを更新"}</button></form>{message && <p>{message}</p>}<Link className="simple-link" href="/">ログインへ戻る</Link></section></main>;
}
