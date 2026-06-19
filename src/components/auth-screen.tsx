"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";

type AuthMode = "login" | "signup";
type Role = "student" | "teacher";
type Status = { message: string; kind: "error" | "warning" | "success" | "info" } | null;

function strength(password: string) {
  if (!password) return { score: 0, label: "未入力", tone: "neutral" };
  let score = Math.min(40, (password.length / 12) * 40);
  score += [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((rule) => rule.test(password)).length * 15;
  if (score < 40) return { score, label: "弱い", tone: "weak" };
  if (score < 70) return { score, label: "普通", tone: "medium" };
  return { score: Math.min(100, score), label: "強い", tone: "strong" };
}

export function AuthScreen() {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>("login");
  const [role, setRole] = useState<Role>("student");
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<Status>(null);
  const passwordStrength = strength(password);

  function switchMode(next: AuthMode) {
    setMode(next);
    setStatus(null);
    setPassword("");
  }

  function requireClient(storage: "local" | "session" = "local") {
    const client = getSupabaseBrowserClient(storage);
    if (!client) {
      setStatus({
        kind: "info",
        message: "SupabaseのURLとPublishable Keyを.env.localに設定すると認証が有効になります。",
      });
    }
    return client;
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") || "").trim();
    const loginPassword = String(form.get("password") || "");
    const client = requireClient(remember ? "local" : "session");
    if (!client) return;

    setLoading(true);
    setStatus(null);
    const { error } = await client.auth.signInWithPassword({ email, password: loginPassword });
    setLoading(false);
    if (error) {
      setStatus({ kind: "error", message: "メールアドレスまたはパスワードが正しくありません。" });
      return;
    }
    router.push("/dashboard");
  }

  async function handleSignup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") || "").trim();
    const email = String(form.get("email") || "").trim();
    const consent = form.get("consent") === "on";
    if (password.length < 8) {
      setStatus({ kind: "warning", message: "Password must be at least 8 characters long." });
      return;
    }
    if (!consent) {
      setStatus({ kind: "warning", message: "利用規約と学習データの取り扱いへの同意が必要です。" });
      return;
    }
    const client = requireClient("local");
    if (!client) return;

    setLoading(true);
    setStatus(null);
    const { data, error } = await client.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: name, role },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    setLoading(false);
    if (error) {
      setStatus({ kind: "error", message: error.message });
      return;
    }
    if (data.session) {
      router.push("/dashboard");
      return;
    }
    setStatus({ kind: "success", message: "確認メールを送信しました。メール内のリンクを開いてください。" });
  }

  async function requestPasswordReset() {
    const emailInput = document.querySelector<HTMLInputElement>("#login-email");
    const email = emailInput?.value.trim() || "";
    if (!email) {
      switchMode("login");
      setStatus({ kind: "info", message: "メールアドレスを入力してから、もう一度押してください。" });
      return;
    }
    const client = requireClient("local");
    if (!client) return;
    const { error } = await client.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setStatus(error
      ? { kind: "error", message: error.message }
      : { kind: "success", message: "登録がある場合、このアドレスへ復旧手順を送信しました。" });
  }

  return (
    <main className="auth-screen">
      <div className="dot-field" aria-hidden="true" />
      <i className="float-shape shape-a" aria-hidden="true" />
      <i className="float-shape shape-b" aria-hidden="true" />
      <i className="float-shape shape-c" aria-hidden="true" />
      <i className="float-shape shape-d" aria-hidden="true" />

      <section className="visual-panel" aria-label="放課後の学習スペース">
        <div className="visual-image">
          <Image src="/classroom-desk.jpg" alt="机を囲んで学習する学生たち" fill sizes="(max-width: 780px) 100vw, 560px" priority unoptimized />
          <div className="image-dots" aria-hidden="true" />
          <div className="visual-caption"><span className="live-dot" />学びの時間を、もっと自分らしく。</div>
        </div>
      </section>

      <section className="auth-panel" aria-label="EmoAcademy アカウント">
        <div className="liquid-orb orb-one" aria-hidden="true" />
        <div className="liquid-orb orb-two" aria-hidden="true" />
        <div className="auth-inner">
          <header className="brand-row"><span className="brand">EmoAcademy</span><span className="secure-badge">⌑ Secure</span></header>
          <div className="auth-tabs" role="tablist" aria-label="認証方法">
            <button type="button" role="tab" aria-selected={mode === "signup"} className={`auth-tab ${mode === "signup" ? "active" : ""}`} onClick={() => switchMode("signup")}>新規登録</button>
            <button type="button" role="tab" aria-selected={mode === "login"} className={`auth-tab ${mode === "login" ? "active" : ""}`} onClick={() => switchMode("login")}>ログイン</button>
          </div>

          {mode === "login" ? (
            <section className="auth-pane" role="tabpanel">
              <div className="pane-heading"><p className="eyebrow">WELCOME BACK</p><h1>おかえりなさい</h1><p>EmoAcademyで、前回の学習から続けましょう。</p></div>
              <form onSubmit={handleLogin}>
                <label className="field"><span className="field-label">メールアドレス</span><span className="input-shell"><span className="input-icon">@</span><input id="login-email" name="email" type="email" placeholder="name@example.com" autoComplete="email" required /></span></label>
                <label className="field"><span className="field-line"><span>パスワード</span><button className="inline-action" type="button" onClick={requestPasswordReset}>パスワードを忘れた</button></span><span className="input-shell"><span className="input-icon">⌑</span><input name="password" type={passwordVisible ? "text" : "password"} placeholder="パスワードを入力" autoComplete="current-password" required /><button className="password-toggle" type="button" aria-label={passwordVisible ? "パスワードを隠す" : "パスワードを表示"} onClick={() => setPasswordVisible((value) => !value)}>{passwordVisible ? "╱" : "◉"}</button></span></label>
                <label className="remember-control"><input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} /><span className="switch" /><span>ログインしたままにする</span></label>
                <button className="submit-button" type="submit" disabled={loading}>{loading ? <span className="button-spinner" /> : "ログイン"}</button>
              </form>
            </section>
          ) : (
            <section className="auth-pane" role="tabpanel">
              <div className="pane-heading compact"><h1>アカウントを作成</h1><p>最初に利用するロールを選択してください。</p></div>
              <form onSubmit={handleSignup}>
                <div className="role-selector" role="group" aria-label="ロールを選択">
                  <button className={`role-option ${role === "student" ? "active" : ""}`} type="button" aria-pressed={role === "student"} onClick={() => setRole("student")}><span className="role-icon">学</span><span><strong>学生</strong><small>授業と教材に参加</small></span></button>
                  <button className={`role-option ${role === "teacher" ? "active" : ""}`} type="button" aria-pressed={role === "teacher"} onClick={() => setRole("teacher")}><span className="role-icon">教</span><span><strong>教師</strong><small>教材と授業を管理</small></span></button>
                </div>
                <div className="field-grid">
                  <label className="field"><span className="field-label">名前</span><span className="input-shell"><span className="input-icon">人</span><input name="name" type="text" placeholder="山田 花子" autoComplete="name" required /></span></label>
                  <label className="field"><span className="field-label">メールアドレス</span><span className="input-shell"><span className="input-icon">@</span><input name="email" type="email" placeholder="name@example.com" autoComplete="email" required /></span></label>
                </div>
                <label className="field"><span className="field-label">パスワード</span><span className="input-shell"><span className="input-icon">⌑</span><input value={password} onChange={(event) => setPassword(event.target.value)} type={passwordVisible ? "text" : "password"} placeholder="8文字以上のパスワード" autoComplete="new-password" minLength={8} required /><button className="password-toggle" type="button" aria-label={passwordVisible ? "パスワードを隠す" : "パスワードを表示"} onClick={() => setPasswordVisible((value) => !value)}>{passwordVisible ? "╱" : "◉"}</button></span><div className="strength-row"><span className="strength-track"><i className={passwordStrength.tone} style={{ width: `${passwordStrength.score}%` }} /></span><b>{passwordStrength.label}</b></div><ul className="password-rules"><li className={password.length >= 8 ? "met" : ""}>8文字以上</li><li className={/[A-Za-z]/.test(password) && /\d/.test(password) ? "met" : ""}>英字と数字を含む</li></ul></label>
                <label className="consent-control"><input name="consent" type="checkbox" /><span className="checkmark">✓</span><span><a href="#terms">利用規約</a>と<a href="#privacy">プライバシーポリシー</a>、学習データの取り扱いに同意します。</span></label>
                <button className="submit-button" type="submit" disabled={loading}>{loading ? <span className="button-spinner" /> : `${role === "teacher" ? "教師" : "学生"}として登録する`}</button>
              </form>
            </section>
          )}

          <div className={`status ${status?.kind || ""}`} role="status" aria-live="polite">{status?.message}</div>
          {!isSupabaseConfigured() && <p className="setup-note">Preview mode — Supabase keys are not configured.</p>}
          <nav className="support-links" aria-label="アカウントサポート"><button type="button" onClick={() => setStatus({ kind: "info", message: "アカウント復旧からパスワードを再設定できます。" })}>ヘルプ</button><span /><button type="button" onClick={requestPasswordReset}>アカウント復旧</button></nav>
        </div>
      </section>
    </main>
  );
}
