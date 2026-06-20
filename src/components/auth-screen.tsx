"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";

type AuthMode = "login" | "signup";
type Role = "student" | "teacher";
type SocialProvider = "google" | "apple";
type Status = { message: string; kind: "error" | "warning" | "success" | "info" } | null;

function LockIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M7.5 10V7a4.5 4.5 0 0 1 9 0v3M6 10h12v10H6z" /></svg>;
}

function MailIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 6h18v12H3zM3 7l9 6 9-6" /></svg>;
}

function UserIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4" /><path d="M4.5 21a7.5 7.5 0 0 1 15 0" /></svg>;
}

function EyeIcon({ closed = false }: { closed?: boolean }) {
  return closed
    ? <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 3 18 18M10.5 6.1A9.8 9.8 0 0 1 12 6c6 0 9.5 6 9.5 6a16 16 0 0 1-2.4 3.1M6.2 6.2C3.8 8 2.5 12 2.5 12s3.5 6 9.5 6a9.8 9.8 0 0 0 3-.5M9.8 9.8a3 3 0 0 0 4.4 4.4" /></svg>
    : <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z" /><circle cx="12" cy="12" r="2.6" /></svg>;
}

function GoogleIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path fill="#4285F4" d="M21.6 12.2c0-.7-.1-1.5-.2-2.2H12v4.3h5.4a4.7 4.7 0 0 1-2 3v2.8h3.3c1.9-1.8 2.9-4.4 2.9-7.9Z" /><path fill="#34A853" d="M12 22c2.7 0 5-.9 6.7-2.4l-3.3-2.8c-.9.6-2.1 1-3.4 1a5.9 5.9 0 0 1-5.5-4.1H3.1v2.9A10.1 10.1 0 0 0 12 22Z" /><path fill="#FBBC05" d="M6.5 13.7a6 6 0 0 1 0-3.8V7H3.1a10.1 10.1 0 0 0 0 9.6l3.4-2.9Z" /><path fill="#EA4335" d="M12 5.8c1.5 0 2.8.5 3.9 1.5l2.9-2.9A9.8 9.8 0 0 0 3.1 7l3.4 2.9A5.9 5.9 0 0 1 12 5.8Z" /></svg>;
}

function AppleIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M17.1 12.5c0-2.5 2.1-3.7 2.2-3.8a4.8 4.8 0 0 0-3.8-2.1c-1.6-.2-3.1.9-3.9.9-.8 0-2-1-3.3-1a5 5 0 0 0-4.2 2.6c-1.8 3.1-.5 7.7 1.3 10.2.9 1.2 1.9 2.6 3.2 2.5 1.3-.1 1.8-.8 3.4-.8 1.6 0 2 .8 3.4.8 1.4 0 2.3-1.2 3.1-2.5a11 11 0 0 0 1.4-2.9c-.1 0-2.8-1.1-2.8-3.9ZM14.4 4.9c.7-.9 1.2-2.1 1.1-3.3-1.1.1-2.4.7-3.2 1.6-.7.8-1.3 2-1.1 3.2 1.2.1 2.5-.6 3.2-1.5Z" /></svg>;
}

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
  const [socialLoading, setSocialLoading] = useState<SocialProvider | null>(null);
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

  async function handleSocialLogin(provider: SocialProvider) {
    const client = requireClient("local");
    if (!client) return;
    setSocialLoading(provider);
    setStatus(null);
    const { error } = await client.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      setSocialLoading(null);
      setStatus({ kind: "error", message: `${provider === "google" ? "Google" : "Apple"}ログインを開始できませんでした。${error.message}` });
    }
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
          <header className="brand-row"><span className="brand">EmoAcademy</span><span className="secure-badge"><LockIcon />Secure</span></header>
          <div className="auth-tabs" role="tablist" aria-label="認証方法">
            <button type="button" role="tab" aria-selected={mode === "signup"} className={`auth-tab ${mode === "signup" ? "active" : ""}`} onClick={() => switchMode("signup")}>新規登録</button>
            <button type="button" role="tab" aria-selected={mode === "login"} className={`auth-tab ${mode === "login" ? "active" : ""}`} onClick={() => switchMode("login")}>ログイン</button>
          </div>

          {mode === "login" ? (
            <section className="auth-pane" role="tabpanel">
              <div className="pane-heading"><p className="eyebrow">WELCOME BACK</p><h1>おかえりなさい</h1><p>EmoAcademyで、前回の学習から続けましょう。</p></div>
              <form onSubmit={handleLogin}>
                <label className="field"><span className="field-label">メールアドレス</span><span className="input-shell"><MailIcon /><input id="login-email" name="email" type="email" placeholder="name@example.com" autoComplete="email" required /></span></label>
                <label className="field"><span className="field-line"><span>パスワード</span><button className="inline-action" type="button" onClick={requestPasswordReset}>パスワードを忘れた</button></span><span className="input-shell"><LockIcon /><input name="password" type={passwordVisible ? "text" : "password"} placeholder="パスワードを入力" autoComplete="current-password" required /><button className="password-toggle" type="button" aria-label={passwordVisible ? "パスワードを隠す" : "パスワードを表示"} onClick={() => setPasswordVisible((value) => !value)}><EyeIcon closed={passwordVisible} /></button></span></label>
                <label className="remember-control"><input type="checkbox" checked={remember} onChange={(event) => setRemember(event.target.checked)} /><span className="switch" /><span>ログインしたままにする</span></label>
                <button className="submit-button" type="submit" disabled={loading}>{loading ? <span className="button-spinner" /> : "ログイン"}</button>
                <div className="auth-divider"><span>または</span></div>
                <div className="social-login-row">
                  <button className="social-login-button" type="button" onClick={() => handleSocialLogin("google")} disabled={Boolean(socialLoading)}><GoogleIcon />{socialLoading === "google" ? "接続中…" : "Google"}</button>
                  <button className="social-login-button apple" type="button" onClick={() => handleSocialLogin("apple")} disabled={Boolean(socialLoading)}><AppleIcon />{socialLoading === "apple" ? "接続中…" : "Apple"}</button>
                </div>
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
                  <label className="field"><span className="field-label">名前</span><span className="input-shell"><UserIcon /><input name="name" type="text" placeholder="山田 花子" autoComplete="name" required /></span></label>
                  <label className="field"><span className="field-label">メールアドレス</span><span className="input-shell"><MailIcon /><input name="email" type="email" placeholder="name@example.com" autoComplete="email" required /></span></label>
                </div>
                <label className="field"><span className="field-label">パスワード</span><span className="input-shell"><LockIcon /><input value={password} onChange={(event) => setPassword(event.target.value)} type={passwordVisible ? "text" : "password"} placeholder="8文字以上のパスワード" autoComplete="new-password" minLength={8} required /><button className="password-toggle" type="button" aria-label={passwordVisible ? "パスワードを隠す" : "パスワードを表示"} onClick={() => setPasswordVisible((value) => !value)}><EyeIcon closed={passwordVisible} /></button></span><div className="strength-row"><span className="strength-track"><i className={passwordStrength.tone} style={{ width: `${passwordStrength.score}%` }} /></span><b>{passwordStrength.label}</b></div><ul className="password-rules"><li className={password.length >= 8 ? "met" : ""}>8文字以上</li><li className={/[A-Za-z]/.test(password) && /\d/.test(password) ? "met" : ""}>英字と数字を含む</li></ul></label>
                <label className="consent-control"><input name="consent" type="checkbox" /><span className="checkmark"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 7" /></svg></span><span><a href="#terms">利用規約</a>と<a href="#privacy">プライバシーポリシー</a>、学習データの取り扱いに同意します。</span></label>
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
