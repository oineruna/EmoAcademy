"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { clearSupabaseSessions, getSupabaseBrowserClient, isSupabaseConfigured } from "@/lib/supabase/client";

type AuthMode = "login" | "signup";
type Role = "student" | "teacher";
type Language = "ja" | "en";
type SocialProvider = "google";
type Status = { message: string; kind: "error" | "warning" | "success" | "info" } | null;

const authCopy = {
  ja: {
    visualLabel: "放課後の学習スペース", visualAlt: "机を囲んで学習する学生たち", visualCaption: "学びの時間を、もっと自分らしく。", accountLabel: "EmoAcademy アカウント", authMethods: "認証方法",
    signup: "新規登録", login: "ログイン", loginTitle: "アカウントにログイン", signupTitle: "アカウントを作成", googleLogin: "Googleでログイン", googleSignup: "Googleで登録", connecting: "接続中…", orLogin: "またはメールでログイン", orSignup: "またはメールで登録",
    email: "メールアドレス", password: "パスワード", forgot: "パスワードを忘れた", passwordPlaceholder: "パスワードを入力", showPassword: "パスワードを表示", hidePassword: "パスワードを隠す", remember: "ログインしたままにする",
    roleLabel: "ロールを選択", student: "学生", teacher: "教師", studentDetail: "授業と教材に参加", teacherDetail: "教材と授業を管理", name: "名前", namePlaceholder: "山田 花子", newPasswordPlaceholder: "8文字以上のパスワード", eightChars: "8文字以上", lettersNumbers: "英字と数字を含む", empty: "未入力", weak: "弱い", medium: "普通", strong: "強い",
    terms: "利用規約", privacy: "プライバシーポリシー", consentPrefix: "と", consentSuffix: "、学習データの取り扱いに同意します。", registerAs: (role: Role) => `${role === "teacher" ? "教師" : "学生"}として登録する`, resend: "確認メールを再送", resending: "再送中…", help: "ヘルプ", recovery: "アカウント復旧", preview: "プレビューモード — Supabaseキーが未設定です。",
    config: "SupabaseのURLとPublishable Keyを.env.localに設定すると認証が有効になります。", invalidLogin: "メールアドレスまたはパスワードが正しくありません。", network: "通信に失敗しました。接続を確認して、もう一度お試しください。", minPassword: "パスワードは8文字以上で入力してください。", consentRequired: "利用規約と学習データの取り扱いへの同意が必要です。", emailRequested: "確認メールの送信をリクエストしました。迷惑メールも確認してください。", emailResent: "確認メールを再送しました。迷惑メールも確認してください。", rateLimit: "送信回数の上限に達しました。しばらく待ってから再送してください。", smtpRequired: "このメールアドレスにはSupabase標準メールを送信できません。管理者側でCustom SMTPの設定が必要です。", resetNeedsEmail: "メールアドレスを入力してから、もう一度押してください。", resetSent: "登録がある場合、このアドレスへ復旧手順を送信しました。", helpMessage: "アカウント復旧からパスワードを再設定できます。", googleError: "Googleログインを開始できませんでした。",
  },
  en: {
    visualLabel: "After-class study space", visualAlt: "Students studying around a shared desk", visualCaption: "Learn in a way that feels like you.", accountLabel: "EmoAcademy account", authMethods: "Authentication method",
    signup: "Sign up", login: "Log in", loginTitle: "Log in to your account", signupTitle: "Create your account", googleLogin: "Continue with Google", googleSignup: "Sign up with Google", connecting: "Connecting…", orLogin: "or log in with email", orSignup: "or sign up with email",
    email: "Email address", password: "Password", forgot: "Forgot password?", passwordPlaceholder: "Enter your password", showPassword: "Show password", hidePassword: "Hide password", remember: "Keep me logged in",
    roleLabel: "Select your role", student: "Student", teacher: "Teacher", studentDetail: "Join lessons and materials", teacherDetail: "Manage lessons and materials", name: "Name", namePlaceholder: "Alex Taylor", newPasswordPlaceholder: "At least 8 characters", eightChars: "8 or more characters", lettersNumbers: "Includes letters and numbers", empty: "Empty", weak: "Weak", medium: "Fair", strong: "Strong",
    terms: "Terms of Use", privacy: "Privacy Policy", consentPrefix: " and ", consentSuffix: ", and consent to the handling of learning data.", registerAs: (role: Role) => `Sign up as ${role === "teacher" ? "a teacher" : "a student"}`, resend: "Resend confirmation email", resending: "Resending…", help: "Help", recovery: "Account recovery", preview: "Preview mode — Supabase keys are not configured.",
    config: "Set the Supabase URL and Publishable Key in .env.local to enable authentication.", invalidLogin: "The email address or password is incorrect.", network: "Connection failed. Check your connection and try again.", minPassword: "Password must be at least 8 characters long.", consentRequired: "You must agree to the terms and handling of learning data.", emailRequested: "Confirmation email requested. Please check your spam folder too.", emailResent: "Confirmation email resent. Please check your spam folder too.", rateLimit: "Too many email requests. Please wait before trying again.", smtpRequired: "Supabase cannot send to this address until the administrator configures custom SMTP.", resetNeedsEmail: "Enter your email address, then try again.", resetSent: "If the account exists, recovery instructions have been sent.", helpMessage: "Use account recovery to reset your password.", googleError: "Could not start Google login. ",
  },
} as const;

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

function strength(password: string, language: Language) {
  const labels = authCopy[language];
  if (!password) return { score: 0, label: labels.empty, tone: "neutral" };
  let score = Math.min(40, (password.length / 12) * 40);
  score += [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((rule) => rule.test(password)).length * 15;
  if (score < 40) return { score, label: labels.weak, tone: "weak" };
  if (score < 70) return { score, label: labels.medium, tone: "medium" };
  return { score: Math.min(100, score), label: labels.strong, tone: "strong" };
}

export function AuthScreen() {
  const router = useRouter();
  const [language, setLanguage] = useState<Language>("ja");
  const [mode, setMode] = useState<AuthMode>("login");
  const [role, setRole] = useState<Role>("student");
  const [password, setPassword] = useState("");
  const [passwordVisible, setPasswordVisible] = useState(false);
  const [remember, setRemember] = useState(true);
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState<SocialProvider | null>(null);
  const [resendLoading, setResendLoading] = useState(false);
  const [pendingSignupEmail, setPendingSignupEmail] = useState("");
  const [status, setStatus] = useState<Status>(null);
  const t = authCopy[language];
  const passwordStrength = strength(password, language);
  const busy = loading || Boolean(socialLoading) || resendLoading;

  function switchMode(next: AuthMode) {
    if (busy || next === mode) return;
    setMode(next);
    setStatus(null);
    setPassword("");
    setPasswordVisible(false);
    setPendingSignupEmail("");
  }

  function changeLanguage(next: Language) {
    setLanguage(next);
    setStatus(null);
  }

  function requireClient(storage: "local" | "session" = "local") {
    const client = getSupabaseBrowserClient(storage);
    if (!client) {
      setStatus({
        kind: "info",
        message: t.config,
      });
    }
    return client;
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email") || "").trim();
    const loginPassword = String(form.get("password") || "");
    const storageMode = remember ? "local" : "session";
    const client = requireClient(storageMode);
    if (!client) return;

    setLoading(true);
    setStatus(null);
    try {
      await clearSupabaseSessions();
      const { error } = await client.auth.signInWithPassword({ email, password: loginPassword });
      if (error) {
        setStatus({ kind: "error", message: t.invalidLogin });
        return;
      }
      router.push("/dashboard");
    } catch {
      setStatus({ kind: "error", message: t.network });
    } finally {
      setLoading(false);
    }
  }

  async function handleSignup(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const name = String(form.get("name") || "").trim();
    const email = String(form.get("email") || "").trim();
    const consent = form.get("consent") === "on";
    if (password.length < 8) {
      setStatus({ kind: "warning", message: t.minPassword });
      return;
    }
    if (!consent) {
      setStatus({ kind: "warning", message: t.consentRequired });
      return;
    }
    const client = requireClient("local");
    if (!client) return;

    setLoading(true);
    setStatus(null);
    try {
      await clearSupabaseSessions();
      const { data, error } = await client.auth.signUp({
        email,
        password,
        options: {
          data: { display_name: name, role },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) {
        const message = error.message.includes("not authorized")
          ? t.smtpRequired
          : error.message.includes("rate limit")
            ? t.rateLimit
            : error.message;
        setStatus({ kind: "error", message });
        return;
      }
      if (data.session) {
        router.push("/dashboard");
        return;
      }
      setPendingSignupEmail(email);
      setStatus({ kind: "success", message: t.emailRequested });
    } catch {
      setStatus({ kind: "error", message: t.network });
    } finally {
      setLoading(false);
    }
  }

  async function resendSignupEmail() {
    if (!pendingSignupEmail) return;
    const client = requireClient("local");
    if (!client) return;
    setResendLoading(true);
    const { error } = await client.auth.resend({
      type: "signup",
      email: pendingSignupEmail,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    setResendLoading(false);
    setStatus(error
      ? { kind: "error", message: error.message.includes("rate limit") ? t.rateLimit : error.message }
      : { kind: "success", message: t.emailResent });
  }

  async function requestPasswordReset() {
    const emailInput = document.querySelector<HTMLInputElement>("#login-email");
    const email = emailInput?.value.trim() || "";
    if (!email) {
      switchMode("login");
      setStatus({ kind: "info", message: t.resetNeedsEmail });
      return;
    }
    const client = requireClient("local");
    if (!client) return;
    const { error } = await client.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setStatus(error
      ? { kind: "error", message: error.message }
      : { kind: "success", message: t.resetSent });
  }

  async function handleSocialLogin(provider: SocialProvider, signupRole?: Role) {
    const storageMode = signupRole ? "local" : remember ? "local" : "session";
    const client = requireClient(storageMode);
    if (!client) return;
    setSocialLoading(provider);
    setStatus(null);
    await clearSupabaseSessions();
    // Keep callback metadata in localStorage so it survives the full OAuth
    // redirect even when the resulting auth session itself is session-only.
    window.localStorage.setItem("emo-academy-oauth-storage", storageMode);
    if (signupRole) window.localStorage.setItem("emo-academy-oauth-role", signupRole);
    else window.localStorage.removeItem("emo-academy-oauth-role");
    const { error } = await client.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      setSocialLoading(null);
      setStatus({ kind: "error", message: `${t.googleError}${error.message}` });
    }
  }

  return (
    <main className="auth-screen" lang={language}>
      <div className="dot-field" aria-hidden="true" />
      <i className="float-shape shape-a" aria-hidden="true" />
      <i className="float-shape shape-b" aria-hidden="true" />
      <i className="float-shape shape-c" aria-hidden="true" />
      <i className="float-shape shape-d" aria-hidden="true" />

      <section className="visual-panel" aria-label={t.visualLabel}>
        <div className="visual-image">
          <Image src="/classroom-desk.jpg" alt={t.visualAlt} fill sizes="(max-width: 780px) 100vw, 720px" priority unoptimized />
          <div className="visual-caption"><span className="live-dot" />{t.visualCaption}</div>
        </div>
      </section>

      <section className="auth-panel" aria-label={t.accountLabel}>
        <div className="liquid-orb orb-one" aria-hidden="true" />
        <div className="liquid-orb orb-two" aria-hidden="true" />
        <div className={`auth-inner ${mode}-mode`}>
          <header className="brand-row"><span className="brand"><Image className="brand-mark" src="/emoacademy-mark.png" width={38} height={38} alt="" priority unoptimized />EmoAcademy</span><div className="auth-language-switch" aria-label="Language"><button className={language === "ja" ? "active" : ""} type="button" aria-pressed={language === "ja"} onClick={() => changeLanguage("ja")}>JA</button><button className={language === "en" ? "active" : ""} type="button" aria-pressed={language === "en"} onClick={() => changeLanguage("en")}>EN</button></div></header>
          <div className="auth-tabs" role="tablist" aria-label={t.authMethods}>
            <button type="button" role="tab" aria-selected={mode === "signup"} aria-controls="signup-panel" disabled={busy} className={`auth-tab ${mode === "signup" ? "active" : ""}`} onClick={() => switchMode("signup")}>{t.signup}</button>
            <button type="button" role="tab" aria-selected={mode === "login"} aria-controls="login-panel" disabled={busy} className={`auth-tab ${mode === "login" ? "active" : ""}`} onClick={() => switchMode("login")}>{t.login}</button>
          </div>

          {mode === "login" ? (
            <section key="login" id="login-panel" className="auth-pane login-pane" role="tabpanel" aria-busy={busy}>
              <div className="pane-heading"><h1>{t.loginTitle}</h1></div>
              <form onSubmit={handleLogin}>
                <button className="social-login-button" type="button" onClick={() => handleSocialLogin("google")} disabled={busy}><GoogleIcon />{socialLoading === "google" ? t.connecting : t.googleLogin}</button>
                <div className="auth-divider"><span>{t.orLogin}</span></div>
                <label className="field"><span className="field-label">{t.email}</span><span className="input-shell"><MailIcon /><input id="login-email" name="email" type="email" placeholder="name@example.com" autoComplete="email" required /></span></label>
                <label className="field"><span className="field-line"><span>{t.password}</span><button className="inline-action" type="button" onClick={requestPasswordReset}>{t.forgot}</button></span><span className="input-shell"><LockIcon /><input name="password" type={passwordVisible ? "text" : "password"} placeholder={t.passwordPlaceholder} autoComplete="current-password" required /><button className="password-toggle" type="button" aria-label={passwordVisible ? t.hidePassword : t.showPassword} onClick={() => setPasswordVisible((value) => !value)}><EyeIcon closed={passwordVisible} /></button></span></label>
                <label className="remember-control"><input type="checkbox" checked={remember} disabled={loading || Boolean(socialLoading)} onChange={(event) => setRemember(event.target.checked)} /><span className="remember-switch" /><span>{t.remember}</span></label>
                <div className="auth-bottom-actions login-bottom-actions">
                  <button className="submit-button" type="submit" disabled={busy}>{loading ? <span className="button-spinner" /> : t.login}</button>
                </div>
              </form>
            </section>
          ) : (
            <section key="signup" id="signup-panel" className="auth-pane signup-pane" role="tabpanel" aria-busy={busy}>
              <div className="pane-heading compact"><h1>{t.signupTitle}</h1></div>
              <form onSubmit={handleSignup}>
                <div className="role-selector" role="group" aria-label={t.roleLabel}>
                  <button className={`role-option ${role === "student" ? "active" : ""}`} type="button" aria-pressed={role === "student"} onClick={() => setRole("student")}><span className="role-icon">{language === "ja" ? "学" : "S"}</span><span><strong>{t.student}</strong><small>{t.studentDetail}</small></span></button>
                  <button className={`role-option ${role === "teacher" ? "active" : ""}`} type="button" aria-pressed={role === "teacher"} onClick={() => setRole("teacher")}><span className="role-icon">{language === "ja" ? "教" : "T"}</span><span><strong>{t.teacher}</strong><small>{t.teacherDetail}</small></span></button>
                </div>
                <button className="social-login-button" type="button" onClick={() => handleSocialLogin("google", role)} disabled={busy}><GoogleIcon />{socialLoading === "google" ? t.connecting : t.googleSignup}</button>
                <div className="auth-divider signup-divider"><span>{t.orSignup}</span></div>
                <div className="field-grid">
                  <label className="field"><span className="field-label">{t.name}</span><span className="input-shell"><UserIcon /><input name="name" type="text" placeholder={t.namePlaceholder} autoComplete="name" required /></span></label>
                  <label className="field"><span className="field-label">{t.email}</span><span className="input-shell"><MailIcon /><input name="email" type="email" placeholder="name@example.com" autoComplete="email" required /></span></label>
                </div>
                <label className="field"><span className="field-label">{t.password}</span><span className="input-shell"><LockIcon /><input name="password" value={password} onChange={(event) => setPassword(event.target.value)} type={passwordVisible ? "text" : "password"} placeholder={t.newPasswordPlaceholder} autoComplete="new-password" minLength={8} required /><button className="password-toggle" type="button" aria-label={passwordVisible ? t.hidePassword : t.showPassword} onClick={() => setPasswordVisible((value) => !value)}><EyeIcon closed={passwordVisible} /></button></span><div className="strength-row"><span className="strength-track"><i className={passwordStrength.tone} style={{ width: `${passwordStrength.score}%` }} /></span><b>{passwordStrength.label}</b></div><ul className="password-rules"><li className={password.length >= 8 ? "met" : ""}>{t.eightChars}</li><li className={/[A-Za-z]/.test(password) && /\d/.test(password) ? "met" : ""}>{t.lettersNumbers}</li></ul></label>
                <div className="auth-bottom-actions signup-bottom-actions">
                  <label className="consent-control"><input name="consent" type="checkbox" /><span className="checkmark"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 7" /></svg></span><span><a href="/terms" target="_blank" rel="noreferrer">{t.terms}</a>{t.consentPrefix}<a href="/privacy" target="_blank" rel="noreferrer">{t.privacy}</a>{t.consentSuffix}</span></label>
                  <button className="submit-button" type="submit" disabled={busy}>{loading ? <span className="button-spinner" /> : t.registerAs(role)}</button>
                </div>
              </form>
            </section>
          )}

          <div className={`status ${status?.kind || ""}`} role="status" aria-live="polite">
            {status?.message}
            {mode === "signup" && pendingSignupEmail && <button className="resend-button" type="button" disabled={resendLoading} onClick={resendSignupEmail}>{resendLoading ? t.resending : t.resend}</button>}
          </div>
          {!isSupabaseConfigured() && <p className="setup-note">{t.preview}</p>}
          {mode === "login" && <nav className="support-links" aria-label={t.recovery}><button type="button" onClick={() => setStatus({ kind: "info", message: t.helpMessage })}>{t.help}</button><span /><button type="button" onClick={requestPasswordReset}>{t.recovery}</button></nav>}
        </div>
      </section>
    </main>
  );
}
