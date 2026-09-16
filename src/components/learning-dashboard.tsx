"use client";

import { CSSProperties, FormEvent, useEffect, useState } from "react";
import Image from "next/image";
import {
  ArrowRight, BarChart3, BookOpen, BookText, Calculator, Camera, Check, ChevronDown, ChevronLeft, ChevronRight, Clock3, FileText, FlaskConical, Folder,
  Globe, Home, Languages, LogOut, Menu, MessageCircle, Play,
  Plus, Search, Sparkles, Trash2, Upload, Users, X,
} from "lucide-react";
import { EmotionCamera, type StudyEmotionSignal } from "@/components/emotion-camera";
import { getActiveSupabaseClient } from "@/lib/supabase/client";

type Language = "ja" | "en";
type Props = {
  displayName: string;
  email: string;
  role: string;
  preview: boolean;
  message: string;
  onLogout: () => void;
  onDeleteAccount: () => void;
};
type Material = {
  id: string;
  title: string;
  subject: string;
  type: "PDF" | "LINK" | "CARD";
  duration: number;
  descriptionJa: string;
  descriptionEn: string;
  externalUrl?: string | null;
};
type MaterialSubmission = {
  id: string;
  material_id: string | null;
  student_id?: string | null;
  answer: string;
  is_correct: boolean | null;
  teacher_feedback: string | null;
  submitted_at: string;
  graded_at?: string | null;
};
type StudySessionRecord = {
  id: string;
  material_id: string | null;
  started_at: string;
  ended_at: string | null;
};
type ProgressRecord = {
  material_id: string | null;
  status: "not_started" | "in_progress" | "completed";
  percent: number;
  last_activity_title: string;
  last_studied_at: string;
};
type StudyGroup = { id: string; name: string; description: string };
type QaThread = {
  id: string;
  question: string;
  teacher_answer: string | null;
  status: "open" | "answered" | "closed";
  created_at: string;
};
type EmotionSampleRecord = {
  id: string;
  user_id: string;
  valence: number;
  arousal: number;
  dominant_emotion: string | null;
  confidence: number | null;
  source: string;
  model_version: string | null;
  captured_at: string;
};
type ProfileRecord = { id: string; display_name: string | null; role: string | null };
type LoadProfile = {
  tone: "steady" | "warmup" | "tired" | "overload" | "high";
  load: number;
  label: string;
  detail: string;
  primaryAction: string;
  secondaryAction: string;
};
type SupportAction = "break" | "split" | "check";
type SupportOutcome = "unknown" | "helped" | "ignored" | "needs_followup";
type StudentNavId = "home" | "library" | "groups" | "material" | "submission" | "qa" | "emotion";
type TeacherPanelId = "overview" | "materials" | "questions" | "submissions" | "emotion" | "students";
type SupportActionRecord = {
  id: string;
  student_id?: string;
  action_type: SupportAction;
  message: string;
  status: "pending" | "acknowledged" | "dismissed";
  created_at: string;
  applied_at?: string | null;
  load_at_apply?: number | null;
  progress_at_apply?: number | null;
  outcome_status?: SupportOutcome;
};

const materialsSeed: Material[] = [
  { id: "demo-1", title: "Greetings & Introductions", subject: "English Speaking", type: "PDF", duration: 12, descriptionJa: "基本表現を確認し、短い自己紹介を声に出して練習します。", descriptionEn: "Review key phrases and practise a short introduction aloud." },
  { id: "demo-2", title: "Conversation Practice", subject: "English Speaking", type: "LINK", duration: 18, descriptionJa: "質問と応答を交互に行う会話練習です。", descriptionEn: "Practise a conversation by alternating questions and answers." },
  { id: "demo-3", title: "Unit 1 Review", subject: "English Speaking", type: "PDF", duration: 10, descriptionJa: "Lesson 1の表現を振り返る確認問題です。", descriptionEn: "Check your understanding of the expressions from Lesson 1." },
];

const subjectActionSeed = [
  { key: "math", labelJa: "数学", labelEn: "Math", noteJa: "復習推奨", noteEn: "Review recommended", icon: Calculator, color: "#2f6bff", tint: "#eaf1ff", done: 18, total: 30, progress: 60, status: "review", nextJa: "符号変化を2問で確認", nextEn: "2-question sign-change recall", reasonJa: "前回ミスと自信度の低さ", reasonEn: "Recent errors and low confidence" },
  { key: "english", labelJa: "英語", labelEn: "English", noteJa: "順調", noteEn: "On track", icon: Languages, color: "#08b981", tint: "#e9fbf4", done: 22, total: 28, progress: 79, status: "track", nextJa: "会話文の主張を短く要約", nextEn: "Summarize the main claim", reasonJa: "読解後の確認タイミング", reasonEn: "Recall check scheduled after reading" },
  { key: "science", labelJa: "理科", labelEn: "Science", noteJa: "復習推奨", noteEn: "Review recommended", icon: FlaskConical, color: "#f59e0b", tint: "#fff6df", done: 15, total: 25, progress: 60, status: "review", nextJa: "例題を1つ解いて説明", nextEn: "One worked example + explain", reasonJa: "概念ステップを前回飛ばしています", reasonEn: "Concept step was skipped last time" },
  { key: "social", labelJa: "社会", labelEn: "Social Studies", noteJa: "順調", noteEn: "On track", icon: Globe, color: "#ff3d68", tint: "#fff0f3", done: 20, total: 32, progress: 63, status: "track", nextJa: "地図のチェックポイント復習", nextEn: "Map checkpoint review", reasonJa: "分散復習の予定日", reasonEn: "Spacing prompt due today" },
  { key: "language", labelJa: "国語", labelEn: "Language Arts", noteJa: "復習推奨", noteEn: "Review recommended", icon: BookText, color: "#8b5cf6", tint: "#f1ecff", done: 12, total: 20, progress: 60, status: "review", nextJa: "主張と根拠を1つずつ確認", nextEn: "Identify thesis + 1 evidence", reasonJa: "自信度チェックで低め", reasonEn: "Confidence check flagged low" },
] as const;

const weeklyStudyData = [
  { dayJa: "月", dayEn: "Mon", hours: 2.5, completion: 80 },
  { dayJa: "火", dayEn: "Tue", hours: 1.5, completion: 54 },
  { dayJa: "水", dayEn: "Wed", hours: 3, completion: 100 },
  { dayJa: "木", dayEn: "Thu", hours: 2, completion: 72 },
  { dayJa: "金", dayEn: "Fri", hours: 2.5, completion: 88 },
  { dayJa: "土", dayEn: "Sat", hours: 4, completion: 92 },
  { dayJa: "日", dayEn: "Sun", hours: 3.5, completion: 76 },
] as const;

const qaSeed: QaThread[] = [
  { id: "demo-q1", question: "自己紹介の最後の一文を確認したい", teacher_answer: "“Nice to meet you.” の後に、好きなことを1文足すと自然です。", status: "answered", created_at: new Date().toISOString() },
  { id: "demo-q2", question: "発音より先に意識することは？", teacher_answer: "まず会話を止めずに続けること。短い返答でもOKです。", status: "answered", created_at: new Date().toISOString() },
];

const supportSeed: SupportActionRecord[] = [
  { id: "demo-support-1", action_type: "split", message: "", status: "pending", created_at: new Date().toISOString() },
];

const supportHistorySeed: SupportActionRecord[] = [
  { id: "demo-history-1", student_id: "student-a", action_type: "split", message: "", status: "acknowledged", created_at: new Date().toISOString(), applied_at: new Date().toISOString(), load_at_apply: 72, progress_at_apply: 42, outcome_status: "helped" },
  { id: "demo-history-2", student_id: "student-b", action_type: "break", message: "", status: "acknowledged", created_at: new Date(Date.now() - 1000 * 60 * 24).toISOString(), applied_at: new Date(Date.now() - 1000 * 60 * 20).toISOString(), load_at_apply: 61, progress_at_apply: 58, outcome_status: "needs_followup" },
];

const submissionSeed: MaterialSubmission[] = [
  { id: "demo-sub-1", material_id: "demo-1", student_id: "student-a", answer: "Nice to meet you. I like English conversation.", is_correct: true, teacher_feedback: "自然な自己紹介です。次は理由も1文足してみましょう。", submitted_at: new Date(Date.now() - 1000 * 60 * 18).toISOString(), graded_at: new Date(Date.now() - 1000 * 60 * 8).toISOString() },
  { id: "demo-sub-2", material_id: "demo-2", student_id: "student-b", answer: "I have question about pronunciation.", is_correct: null, teacher_feedback: null, submitted_at: new Date(Date.now() - 1000 * 60 * 36).toISOString() },
];

const ui = {
  ja: {
    menu: "メニュー", student: "学生", teacher: "教師", preview: "プレビューモード", logout: "ログアウト", delete: "アカウント削除",
    liveEmotion: "現在の感情", steady: "安定した集中", steadyNote: "落ち着いて取り組めています", start: "計測を開始", latest: "最新の出力",
    teacherWorkspace: "教師ワークスペース", manageTitle: "教材と学習状況", manageText: "教材の追加・割り当て・質問回答を管理します。", showClass: "クラスを表示", addMaterial: "教材を追加", title: "タイトル", subject: "科目", type: "教材種別", duration: "所要時間（分）", url: "外部URL", instruction: "学習指示", pdf: "PDFを選択", max: "最大20MB", add: "教材を追加", list: "教材一覧", assign: "割り当て", studentId: "学生メール", classProgress: "学生の進捗", recent: "最近の質問", added: "教材を保存しました。", assignedNotice: "を学生へ割り当てました。", answer: "回答する", answered: "回答済み",
    breakPrompt: "休憩提案", splitPrompt: "課題分割", checkPrompt: "確認を送る",
  },
  en: {
    menu: "Menu", student: "Student", teacher: "Teacher", preview: "Preview mode", logout: "Log out", delete: "Delete account",
    liveEmotion: "Live emotion", steady: "Steady focus", steadyNote: "You are working at a calm, steady pace.", start: "Start monitoring", latest: "Latest output",
    teacherWorkspace: "Teacher workspace", manageTitle: "Materials and learning activity", manageText: "Manage materials, assignments, and student questions.", showClass: "View class", addMaterial: "Add material", title: "Title", subject: "Subject", type: "Material type", duration: "Duration (min)", url: "External URL", instruction: "Instruction", pdf: "Choose PDF", max: "Up to 20 MB", add: "Add material", list: "Materials", assign: "Assign", studentId: "Student email", classProgress: "Student progress", recent: "Recent questions", added: "Material saved.", assignedNotice: " was assigned to a student.", answer: "Answer", answered: "Answered",
    breakPrompt: "Suggest break", splitPrompt: "Split task", checkPrompt: "Send check-in",
  },
} as const;

function isRealId(id: string) {
  return !id.startsWith("demo-");
}

function dbMaterialToMaterial(row: {
  id: string;
  title: string;
  subject: string;
  material_type: "PDF" | "LINK" | "CARD";
  duration_minutes: number;
  instruction: string | null;
  external_url: string | null;
}): Material {
  return {
    id: row.id,
    title: row.title,
    subject: row.subject,
    type: row.material_type,
    duration: row.duration_minutes,
    descriptionJa: row.instruction || "保存された教材です。",
    descriptionEn: row.instruction || "Saved learning material.",
    externalUrl: row.external_url,
  };
}

function LanguageSwitch({ language, setLanguage }: { language: Language; setLanguage: (language: Language) => void }) {
  return <div className="language-switch" aria-label="Language"><button className={language === "ja" ? "active" : ""} type="button" aria-pressed={language === "ja"} onClick={() => setLanguage("ja")}>JA</button><button className={language === "en" ? "active" : ""} type="button" aria-pressed={language === "en"} onClick={() => setLanguage("en")}>EN</button></div>;
}

function getLoadProfile(signal: StudyEmotionSignal | null, language: Language): LoadProfile {
  const valence = signal?.valence ?? 0.18;
  const arousal = signal?.arousal ?? 0.46;
  const load = getLoadFromValues(valence, arousal);
  if (valence < -0.2 && arousal > 0.62) {
    return language === "ja"
      ? { tone: "overload", load, label: "負荷が高め", detail: "表情と活性が少し張っています。問題数を減らして、1問ずつ進めましょう。", primaryAction: "集中モードにする", secondaryAction: "先生に質問する" }
      : { tone: "overload", load, label: "High load", detail: "Your signal looks tense. Reduce the screen to one task and move one question at a time.", primaryAction: "Use focus mode", secondaryAction: "Ask teacher" };
  }
  if (arousal > 0.74) {
    return language === "ja"
      ? { tone: "high", load, label: "活性が高め", detail: "勢いはありますが、急ぎすぎるとミスが増えます。短い確認を挟むのがおすすめです。", primaryAction: "確認ステップを表示", secondaryAction: "ペースを落とす" }
      : { tone: "high", load, label: "High energy", detail: "Good momentum, but a quick check can prevent careless mistakes.", primaryAction: "Show check step", secondaryAction: "Slow pace" };
  }
  if (valence < -0.18 && arousal < 0.46) {
    return language === "ja"
      ? { tone: "tired", load, label: "疲れ気味", detail: "気分が少し下がっています。説明を短くして、答えやすい復習から始めましょう。", primaryAction: "復習から始める", secondaryAction: "小休憩" }
      : { tone: "tired", load, label: "Low mood", detail: "The signal looks a little low. Start with a shorter review task.", primaryAction: "Start with review", secondaryAction: "Short break" };
  }
  if (arousal < 0.32) {
    return language === "ja"
      ? { tone: "warmup", load, label: "ウォームアップ", detail: "活性が低めです。短いカードで手を動かしてから本題に入りましょう。", primaryAction: "短いカードを出す", secondaryAction: "音読する" }
      : { tone: "warmup", load, label: "Warm-up", detail: "Energy is low. A short card activity can ease you into the session.", primaryAction: "Show short cards", secondaryAction: "Read aloud" };
  }
  return language === "ja"
    ? { tone: "steady", load, label: "安定した集中", detail: "今は画面を増やしすぎず、この教材を続けるのがよさそうです。", primaryAction: "このまま続ける", secondaryAction: "負荷を下げる" }
    : { tone: "steady", load, label: "Steady focus", detail: "Keep the screen calm and continue this activity.", primaryAction: "Continue", secondaryAction: "Reduce load" };
}

function getLoadFromValues(valence: number, arousal: number) {
  return Math.round(Math.min(1, Math.max(0, arousal * 0.62 + Math.max(-valence, 0) * 0.5)) * 100);
}

function getSupportAdvice(load: number, valence: number, arousal: number, language: Language) {
  if (load >= 68 || (valence < -0.22 && arousal > 0.58)) {
    return language === "ja" ? "分割課題 + 声かけ" : "Split task + check in";
  }
  if (arousal < 0.34) {
    return language === "ja" ? "短い導入" : "Short warm-up";
  }
  if (arousal > 0.72) {
    return language === "ja" ? "確認ステップ" : "Check step";
  }
  return language === "ja" ? "通常継続" : "Continue";
}

function supportMessage(action: SupportAction, language: Language) {
  const copy = {
    ja: {
      break: "少し負荷が高そうです。1分だけ画面から目を離してから再開しましょう。",
      split: "次の課題は半分に分けて進めましょう。まず1問だけで大丈夫です。",
      check: "ここまでの理解を短く確認しましょう。迷ったところを1つだけ送ってください。",
    },
    en: {
      break: "Your load looks a little high. Take one minute away from the screen before continuing.",
      split: "Split the next task in half. Starting with one question is enough.",
      check: "Let's do a short check-in. Send just one part that felt confusing.",
    },
  } as const;
  return copy[language][action];
}

function supportLabel(action: SupportAction, language: Language) {
  const copy = {
    ja: { break: "休憩提案を反映中", split: "課題を半分に調整中", check: "確認ステップを追加中" },
    en: { break: "Break suggestion active", split: "Task split active", check: "Check-in step active" },
  } as const;
  return copy[language][action];
}

function evaluateSupportOutcome(item: SupportActionRecord, currentLoad: number, currentProgress: number): SupportOutcome {
  const baseLoad = item.load_at_apply;
  const baseProgress = item.progress_at_apply;
  if (typeof baseLoad !== "number" || typeof baseProgress !== "number") return "unknown";
  if (currentProgress >= baseProgress + 8 || currentLoad <= baseLoad - 8) return "helped";
  if (currentLoad >= baseLoad + 8 && currentProgress <= baseProgress + 3) return "needs_followup";
  return "unknown";
}

function outcomeLabel(outcome: SupportOutcome | undefined, language: Language) {
  const copy = {
    ja: { helped: "効果あり", needs_followup: "追加支援", ignored: "未反応", unknown: "観察中" },
    en: { helped: "Helped", needs_followup: "Follow up", ignored: "Ignored", unknown: "Watching" },
  } as const;
  return copy[language][outcome || "unknown"];
}

function latestEmotionSamplesByUser(samples: EmotionSampleRecord[]) {
  const map = new Map<string, EmotionSampleRecord>();
  for (const sample of samples) {
    const previous = map.get(sample.user_id);
    if (!previous || new Date(sample.captured_at).getTime() > new Date(previous.captured_at).getTime()) {
      map.set(sample.user_id, sample);
    }
  }
  return [...map.values()];
}

function AppHeader({ displayName, email, role, preview, menuOpen, setMenuOpen, mobileOpen, setMobileOpen, onLogout, onDeleteAccount, language, setLanguage }: Props & { menuOpen: boolean; setMenuOpen: (value: boolean) => void; mobileOpen: boolean; setMobileOpen: (value: boolean) => void; language: Language; setLanguage: (language: Language) => void }) {
  const t = ui[language];
  const [search, setSearch] = useState("");
  return <header className="lab-header">
    <div className="lab-header-brand"><button className="lab-mobile-menu" type="button" aria-label={t.menu} onClick={() => setMobileOpen(!mobileOpen)}>{mobileOpen ? <X /> : <Menu />}</button><a href="/dashboard"><Image src="/emoacademy-mark.png" width={38} height={38} alt="" unoptimized /><span><strong>EmoAcademy</strong><small>Learn · Practice · Improve</small></span></a></div>
    <form className="lab-search" onSubmit={(event) => { event.preventDefault(); document.getElementById("create-study-set")?.scrollIntoView({ behavior: "smooth" }); }}><Search /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={language === "ja" ? "学習セット、教材、質問" : "Study sets, materials, questions"} aria-label={language === "ja" ? "検索" : "Search"} /></form>
    <div className="lab-header-actions"><LanguageSwitch language={language} setLanguage={setLanguage} /><div className="lab-profile-wrap"><button className="lab-profile" type="button" aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}><span>{displayName.slice(0, 1).toUpperCase()}</span><div><strong>{displayName}</strong><small>{role === "teacher" ? t.teacher : t.student}</small></div><ChevronDown /></button>{menuOpen && <div className="lab-profile-menu"><p>{email}</p>{preview && <small>{t.preview}</small>}<button type="button" onClick={onLogout}><LogOut />{t.logout}</button><button className="danger" type="button" onClick={onDeleteAccount}><Trash2 />{t.delete}</button></div>}</div></div>
  </header>;
}

function ClosedEmotionMonitor({ language, onOpen, materialTitle, signal }: { language: Language; onOpen: () => void; materialTitle: string; signal: StudyEmotionSignal | null }) {
  const t = ui[language];
  const text = language === "ja" ? {
    title: "感情モニター", idle: "未計測", stopped: "停止中", hint: "学習中の状態をここに表示",
    details: "詳細を見る", material: "学習中の教材", empty: "計測を開始すると、表情・気分・活性を確認できます。",
    latest: "前回の計測", mood: "気分", energy: "活性",
  } : {
    title: "Emotion monitor", idle: "Not measured", stopped: "Stopped", hint: "Your learning state appears here",
    details: "View details", material: "Session material", empty: "Start measuring to see expression, mood and energy.",
    latest: "Last measurement", mood: "Mood", energy: "Energy",
  };
  return <section className="emotion-dock emotion-dock-preview emotion-monitor-card is-idle" aria-label={text.title}>
    <header className="emotion-dock-head">
      <div><strong>{text.title}</strong><small>{signal ? text.stopped : text.idle}</small></div>
    </header>
    <div className="emotion-idle-body">
      <div className="emotion-idle-placeholder"><span><Camera aria-hidden="true" /></span><p>{text.hint}</p></div>
      <button className="emotion-start-button" type="button" onClick={onOpen}>{t.start}</button>
    </div>
    <details className="emotion-idle-details">
      <summary>{text.details}<ChevronDown aria-hidden="true" /></summary>
      <div><small>{text.material}</small><strong>{materialTitle}</strong>
        {signal ? <><small>{text.latest} · {new Date(signal.capturedAt).toLocaleString(language === "ja" ? "ja-JP" : "en-US")}</small><p>{text.mood} {signal.valence.toFixed(2)} · {text.energy} {signal.arousal.toFixed(2)}</p></> : <p>{text.empty}</p>}
      </div>
    </details>
  </section>;
}

function TeacherSupportHistoryCard({ items, language, profileLabel }: { items: SupportActionRecord[]; language: Language; profileLabel: (userId: string | undefined, index: number) => string }) {
  const copy = language === "ja"
    ? { title: "支援反応ログ", eyebrow: "SUPPORT RESPONSE", summary: "反映された支援", empty: "まだ支援反応はありません。", load: "反映時負荷", progress: "進捗", pending: "未反映", applied: "反映済み", helped: "効果あり" }
    : { title: "Support response log", eyebrow: "SUPPORT RESPONSE", summary: "Applied supports", empty: "No support responses yet.", load: "Load at apply", progress: "Progress", pending: "Pending", applied: "Applied", helped: "Helped" };
  const appliedItems = items.filter((item) => item.status === "acknowledged");
  const helpedItems = appliedItems.filter((item) => item.outcome_status === "helped");
  const avgLoad = Math.round(appliedItems.reduce((sum, item) => sum + (item.load_at_apply ?? 0), 0) / Math.max(1, appliedItems.length));
  return <section className="teacher-card support-history-card"><header><div><small>{copy.eyebrow}</small><h2>{copy.title}</h2></div><b>{appliedItems.length}</b></header><div className="support-history-summary"><strong>{copy.summary}: {appliedItems.length}</strong><span>{copy.load}: {appliedItems.length ? `${avgLoad}%` : "-"} · {copy.helped}: {helpedItems.length}</span><p>{items.length ? supportLabel(items[0].action_type, language) : copy.empty}</p></div><div className="support-history-list">{items.map((item, index) => <article key={item.id} className={`outcome-${item.outcome_status || "unknown"}`}><span>{item.action_type === "break" ? "休" : item.action_type === "split" ? "分" : "確"}</span><div><strong>{profileLabel(item.student_id, index)}</strong><small>{supportLabel(item.action_type, language)} · {item.status === "acknowledged" ? copy.applied : copy.pending}</small><i><b style={{ width: `${item.load_at_apply ?? 0}%` }} /></i><small>{copy.load}: {item.load_at_apply ?? "-"}% · {copy.progress}: {item.progress_at_apply ?? "-"}%</small></div><em><span>{outcomeLabel(item.outcome_status, language)}</span>{item.applied_at ? new Date(item.applied_at).toLocaleTimeString(language === "ja" ? "ja-JP" : "en-US", { hour: "2-digit", minute: "2-digit" }) : "—"}</em></article>)}</div></section>;
}

function SubjectActionBoard({ language, onAddReview }: { language: Language; onAddReview: (subjectLabel: string) => void }) {
  const [selectedKey, setSelectedKey] = useState<(typeof subjectActionSeed)[number]["key"]>("math");
  const [filter, setFilter] = useState<"all" | "review" | "track">("all");
  const [queued, setQueued] = useState<string[]>([]);
  const copy = language === "ja"
    ? { eyebrow: "教科全体", title: "次に役立つ行動を選ぶ", subject: "教科", progress: "単元進捗", done: "完了", selected: "選択中のフォーカス", add: "復習を予定に追加", added: "学習予定に追加済み", all: "すべて", review: "復習", track: "順調" }
    : { eyebrow: "Across your subjects", title: "Choose the next useful action", subject: "Subject", progress: "Unit progress", done: "Done", selected: "Selected focus", add: "Add review to plan", added: "Added to study plan", all: "All", review: "Needs review", track: "On track" };
  const visibleSubjects = subjectActionSeed.filter((subject) => filter === "all" || subject.status === filter);
  const selected = subjectActionSeed.find((subject) => subject.key === selectedKey) || subjectActionSeed[0];
  function selectFilter(nextFilter: "all" | "review" | "track") {
    setFilter(nextFilter);
    if (!subjectActionSeed.some((subject) => subject.key === selectedKey && (nextFilter === "all" || subject.status === nextFilter))) {
      const first = subjectActionSeed.find((subject) => nextFilter === "all" || subject.status === nextFilter);
      if (first) setSelectedKey(first.key);
    }
  }
  return <section className="subject-action-board">
    <header>
      <div><small>{copy.eyebrow}</small><h2>{copy.title}</h2></div>
      <div className="subject-filter" aria-label={language === "ja" ? "教科フィルター" : "Subject filter"}>
        {[["all", copy.all], ["review", copy.review], ["track", copy.track]].map(([id, label]) => <button key={id} type="button" className={filter === id ? "active" : ""} aria-pressed={filter === id} onClick={() => selectFilter(id as "all" | "review" | "track")}>{label}</button>)}
      </div>
    </header>
    <div className="subject-action-layout">
      <div className="subject-table">
        <div className="subject-table-head"><span>{copy.subject}</span><span>{copy.progress}</span><span>{copy.done}</span></div>
        {visibleSubjects.map((subject) => {
          const Icon = subject.icon;
          const label = language === "ja" ? subject.labelJa : subject.labelEn;
          return <button key={subject.key} type="button" className={selectedKey === subject.key ? "active" : ""} aria-pressed={selectedKey === subject.key} onClick={() => setSelectedKey(subject.key)}>
            <span className="subject-name"><i style={{ color: subject.color, background: subject.tint }}><Icon /></i><b>{label}</b><small>{language === "ja" ? subject.noteJa : subject.noteEn}</small></span>
            <span className="subject-progress-line"><em><b style={{ width: `${subject.progress}%`, background: subject.color }} /></em><strong style={{ color: subject.color }}>{subject.progress}%</strong></span>
            <span className="subject-done">{subject.done}/{subject.total}</span>
          </button>;
        })}
      </div>
      <aside className="selected-focus-card">
        <small>{copy.selected}</small>
        <h3>{language === "ja" ? selected.labelJa : selected.labelEn}</h3>
        <strong>{language === "ja" ? selected.nextJa : selected.nextEn}</strong>
        <p>{language === "ja" ? selected.reasonJa : selected.reasonEn}</p>
        <button type="button" className={queued.includes(selected.key) ? "added" : ""} onClick={() => { setQueued((items) => items.includes(selected.key) ? items : [...items, selected.key]); onAddReview(language === "ja" ? selected.labelJa : selected.labelEn); }}>
          {queued.includes(selected.key) ? <>{copy.added}<Check /></> : <>{copy.add}<ArrowRight /></>}
        </button>
      </aside>
    </div>
  </section>;
}

function WeeklyRhythmCard({ language }: { language: Language }) {
  const [metric, setMetric] = useState<"time" | "completion">("time");
  const [weekOffset, setWeekOffset] = useState(0);
  const copy = language === "ja"
    ? { eyebrow: "学習リズム", week: weekOffset === 0 ? "今週" : weekOffset < 0 ? "先週" : "来週", time: "時間", completion: "完了率", studied: "学習しました", summary: "短い学習が安定しています。金曜の復習は軽めで大丈夫です。", avg: "平均完了率" }
    : { eyebrow: "Study rhythm", week: weekOffset === 0 ? "This week" : weekOffset < 0 ? "Last week" : "Next week", time: "Time", completion: "Completion", studied: "studied", summary: "Short sessions are staying consistent. Keep Friday's review brief.", avg: "average completion" };
  const totalHours = weeklyStudyData.reduce((sum, day) => sum + day.hours, 0);
  const max = metric === "time" ? 4 : 100;
  return <section className="weekly-rhythm-card">
    <header>
      <div><small>{copy.eyebrow}</small><h2>{copy.week}</h2></div>
      <div className="week-nav">
        <button type="button" aria-label={language === "ja" ? "先週" : "Previous week"} onClick={() => setWeekOffset((value) => value - 1)}><ChevronLeft /></button>
        <button type="button" aria-label={language === "ja" ? "今週" : "Current week"} onClick={() => setWeekOffset(0)}><Clock3 /></button>
        <button type="button" aria-label={language === "ja" ? "来週" : "Next week"} onClick={() => setWeekOffset((value) => value + 1)}><ChevronRight /></button>
      </div>
      <div className="rhythm-filter">
        <button type="button" className={metric === "time" ? "active" : ""} onClick={() => setMetric("time")}>{copy.time}</button>
        <button type="button" className={metric === "completion" ? "active" : ""} onClick={() => setMetric("completion")}>{copy.completion}</button>
      </div>
    </header>
    <div className="rhythm-bars">
      {weeklyStudyData.map((day) => {
        const value = metric === "time" ? day.hours : day.completion;
        return <div key={day.dayEn}>
          <span>{metric === "time" ? `${value}h` : `${value}%`}</span>
          <i><b style={{ height: `${(value / max) * 100}%` }} /></i>
          <em>{language === "ja" ? day.dayJa : day.dayEn}</em>
        </div>;
      })}
    </div>
    <footer><p><Clock3 />{metric === "time" ? `${totalHours}h ${copy.studied}` : `80% ${copy.avg}`}</p><strong>{copy.summary}</strong></footer>
  </section>;
}

function StudentWorkspace({ displayName, mobileOpen, language, preview }: { displayName: string; mobileOpen: boolean; language: Language; preview: boolean }) {
  const [activeNav, setActiveNav] = useState<StudentNavId>("home");
  const [materials, setMaterials] = useState<Material[]>(materialsSeed);
  const [progress, setProgress] = useState<ProgressRecord | null>(null);
  const [groups, setGroups] = useState<StudyGroup[]>([]);
  const [qaItems, setQaItems] = useState<QaThread[]>(qaSeed);
  const [question, setQuestion] = useState("");
  const [answerDraft, setAnswerDraft] = useState("");
  const [submissions, setSubmissions] = useState<MaterialSubmission[]>([]);
  const [selectedMaterialId, setSelectedMaterialId] = useState<string>(materialsSeed[0].id);
  const [studySession, setStudySession] = useState<StudySessionRecord | null>(null);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [emotionSignal, setEmotionSignal] = useState<StudyEmotionSignal | null>(null);

  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "auto" });
  }, [activeNav]);
  const [supportActions, setSupportActions] = useState<SupportActionRecord[]>(preview ? supportSeed : []);
  const [focusMode, setFocusMode] = useState(false);
  const [notice, setNotice] = useState("");
  const copy = language === "ja" ? {
    home: "ホーム", library: "ライブラリー", groups: "学習グループ", qa: "質問・回答", groupTitle: "学習グループ", newGroup: "新しいグループ", start: "ここから始めましょう", cards: "単語カード", answers: "質問・回答", jump: "続きから始める", recent: "最近", personalize: "あなた向けの学習", exact: "必要なものを学習", continue: "続ける", create: "単語カードを作成", update: "学習目標を更新する", progress: "42% 完了", monitor: "感情モニター", resumed: "前回の続きから開きます。", openDetail: "詳細を開く", send: "送信", askPlaceholder: "先生に質問する", saved: "保存しました。", offline: "まだSupabaseテーブルが未作成なので画面内だけで反映しています。",
    materialDetail: "教材詳細", instruction: "学習指示", preview: "プレビュー", submission: "提出", answerPlaceholder: "ここに回答を入力", submitAnswer: "回答を提出", submitted: "提出済み", teacherFeedback: "先生のフィードバック", startSession: "セッション開始", stopSession: "終了", sessionActive: "感情セッション中", noFeedback: "先生の確認待ちです。", emotionSession: "感情セッション",
    adaptive: "学習負荷サポート", signal: "感情シグナル", load: "推定負荷", source: "入力元", focusOn: "集中モード中", focusNote: "表示量を減らし、次にやることだけを残しています。", normal: "通常表示に戻す", stepOne: "1. まず1問だけ解く", stepTwo: "2. 答え合わせを短く見る", stepThree: "3. 迷ったら質問へ送る",
    teacherSupport: "先生からの支援", supportEmpty: "新しい支援提案はありません。", acknowledge: "反映する", breakPrompt: "休憩提案", splitPrompt: "課題分割", checkPrompt: "確認", supportApplied: "支援提案を学習画面に反映しました。",
  } : {
    home: "Home", library: "Library", groups: "Study groups", qa: "Q&A", groupTitle: "Study groups", newGroup: "New group", start: "Start here", cards: "Flashcards", answers: "Questions & answers", jump: "Jump back in", recent: "Recents", personalize: "Personalize your content", exact: "Study exactly what you need", continue: "Continue", create: "Create flashcards", update: "Update your learning goal", progress: "42% complete", monitor: "Emotion monitor", resumed: "Opening your last study activity.", openDetail: "Open detail", send: "Send", askPlaceholder: "Ask your teacher", saved: "Saved.", offline: "Supabase tables are not created yet, so this changed only on the screen.",
    materialDetail: "Material detail", instruction: "Instruction", preview: "Preview", submission: "Submission", answerPlaceholder: "Write your answer here", submitAnswer: "Submit answer", submitted: "Submitted", teacherFeedback: "Teacher feedback", startSession: "Start session", stopSession: "Stop", sessionActive: "Emotion session active", noFeedback: "Waiting for teacher review.", emotionSession: "Emotion session",
    adaptive: "Learning load support", signal: "Emotion signal", load: "Estimated load", source: "Source", focusOn: "Focus mode", focusNote: "The screen is reduced to only the next useful action.", normal: "Return to normal", stepOne: "1. Try just one question", stepTwo: "2. Check feedback briefly", stepThree: "3. Send a question if stuck",
    teacherSupport: "Teacher support", supportEmpty: "No new support suggestions.", acknowledge: "Apply", breakPrompt: "Break", splitPrompt: "Split task", checkPrompt: "Check-in", supportApplied: "The support suggestion was applied to your study view.",
  };
  const navItems = [
    ["home", copy.home, <Home key="home" />],
    ["library", copy.library, <Folder key="library" />],
    ["groups", copy.groups, <Users key="groups" />],
  ] as const;
  const currentMaterial = materials[0] || materialsSeed[0];
  const selectedMaterial = materials.find((material) => material.id === selectedMaterialId) || currentMaterial;
  const selectedSubmission = submissions.find((item) => item.material_id === selectedMaterial.id || (!isRealId(selectedMaterial.id) && item.material_id === selectedMaterial.id));
  const progressText = progress ? `${progress.percent}% ${language === "ja" ? "完了" : "complete"}` : copy.progress;
  const loadProfile = getLoadProfile(emotionSignal, language);
  const activeSupport = supportActions.find((action) => action.status === "pending");

  async function updateLatestSupportOutcome(currentLoad: number, currentProgress: number) {
    const target = supportActions.find((item) => item.status === "acknowledged" && (!item.outcome_status || item.outcome_status === "unknown"));
    if (!target) return;
    const outcome = evaluateSupportOutcome(target, currentLoad, currentProgress);
    if (outcome === "unknown") return;
    setSupportActions((items) => items.map((item) => item.id === target.id ? { ...item, outcome_status: outcome } : item));
    const result = await getActiveSupabaseClient();
    if (!result || preview || !isRealId(target.id)) return;
    await result.client.from("support_actions").update({ outcome_status: outcome }).eq("id", target.id);
  }

  function handleEmotionSignal(signal: StudyEmotionSignal) {
    setEmotionSignal(signal);
    const nextLoad = getLoadFromValues(signal.valence, signal.arousal);
    void updateLatestSupportOutcome(nextLoad, progress?.percent ?? 42);
  }

  useEffect(() => {
    let active = true;
    async function load() {
      const result = await getActiveSupabaseClient();
      if (!active || !result) return;
      const [materialResult, progressResult, groupResult, qaResult, emotionResult, supportResult, submissionResult, sessionResult] = await Promise.all([
        result.client.from("learning_materials").select("id,title,subject,material_type,duration_minutes,instruction,external_url").eq("is_published", true).order("created_at", { ascending: false }),
        result.client.from("study_progress").select("material_id,status,percent,last_activity_title,last_studied_at").eq("user_id", result.session.user.id).order("last_studied_at", { ascending: false }).limit(1),
        result.client.from("study_groups").select("id,name,description").order("created_at", { ascending: false }),
        result.client.from("qa_threads").select("id,question,teacher_answer,status,created_at").order("created_at", { ascending: false }),
        result.client.from("emotion_samples").select("valence,arousal,dominant_emotion,confidence,source,model_version,captured_at").eq("user_id", result.session.user.id).order("captured_at", { ascending: false }).limit(1),
        result.client.from("support_actions").select("id,action_type,message,status,created_at,applied_at,load_at_apply,progress_at_apply,outcome_status").eq("student_id", result.session.user.id).neq("status", "dismissed").order("created_at", { ascending: false }).limit(4),
        result.client.from("material_submissions").select("id,material_id,student_id,answer,is_correct,teacher_feedback,submitted_at,graded_at").eq("student_id", result.session.user.id).order("submitted_at", { ascending: false }),
        result.client.from("study_sessions").select("id,material_id,started_at,ended_at").eq("student_id", result.session.user.id).is("ended_at", null).order("started_at", { ascending: false }).limit(1),
      ]);
      if (!active) return;
      if (!materialResult.error && materialResult.data?.length) {
        const nextMaterials = materialResult.data.map(dbMaterialToMaterial);
        setMaterials(nextMaterials);
        setSelectedMaterialId((current) => nextMaterials.some((material) => material.id === current) ? current : nextMaterials[0].id);
      }
      if (!progressResult.error && progressResult.data?.[0]) setProgress(progressResult.data[0] as ProgressRecord);
      if (!groupResult.error && groupResult.data) setGroups(groupResult.data as StudyGroup[]);
      if (!qaResult.error && qaResult.data?.length) setQaItems(qaResult.data as QaThread[]);
      if (!supportResult.error && supportResult.data) setSupportActions(supportResult.data as SupportActionRecord[]);
      if (!submissionResult.error && submissionResult.data) setSubmissions(submissionResult.data as MaterialSubmission[]);
      if (!sessionResult.error && sessionResult.data?.[0]) setStudySession(sessionResult.data[0] as StudySessionRecord);
      if (!emotionResult.error && emotionResult.data?.[0]) {
        const latest = emotionResult.data[0];
        setEmotionSignal({
          valence: Number(latest.valence),
          arousal: Number(latest.arousal),
          dominant: String(latest.dominant_emotion || "neutral") as StudyEmotionSignal["dominant"],
          confidence: latest.confidence ?? undefined,
          source: latest.source || "emotion-api",
          modelVersion: latest.model_version ?? undefined,
          capturedAt: latest.captured_at,
        });
      }
    }
    load();
    return () => { active = false; };
  }, []);

  async function createGroup() {
    const fallbackGroup = { id: `demo-group-${Date.now()}`, name: `${copy.newGroup} ${groups.length + 1}`, description: "" };
    const result = await getActiveSupabaseClient();
    if (!result || preview) {
      setGroups((items) => [fallbackGroup, ...items]);
      setNotice(copy.offline);
      return;
    }
    const { data, error } = await result.client.from("study_groups").insert({ owner_id: result.session.user.id, name: fallbackGroup.name, description: "" }).select("id,name,description").single();
    if (error || !data) {
      setGroups((items) => [fallbackGroup, ...items]);
      setNotice(copy.offline);
      return;
    }
    await result.client.from("study_group_members").insert({ group_id: data.id, user_id: result.session.user.id, role: "owner" });
    setGroups((items) => [data as StudyGroup, ...items]);
    setNotice(copy.saved);
  }

  async function markProgress(material: Material, completed = false) {
    const localProgress: ProgressRecord = {
      material_id: isRealId(material.id) ? material.id : null,
      status: completed ? "completed" : "in_progress",
      percent: completed ? 100 : Math.max(progress?.percent || 42, 65),
      last_activity_title: material.title,
      last_studied_at: new Date().toISOString(),
    };
    setProgress(localProgress);
    await updateLatestSupportOutcome(loadProfile.load, localProgress.percent);
    const result = await getActiveSupabaseClient();
    if (!result || preview || !isRealId(material.id)) {
      setNotice(isRealId(material.id) ? copy.saved : copy.offline);
      return;
    }
    const { error } = await result.client.from("study_progress").upsert({
      user_id: result.session.user.id,
      material_id: material.id,
      status: localProgress.status,
      percent: localProgress.percent,
      last_activity_title: localProgress.last_activity_title,
      last_studied_at: localProgress.last_studied_at,
    }, { onConflict: "user_id,material_id" });
    setNotice(error ? copy.offline : copy.saved);
  }

  async function toggleStudySession() {
    const result = await getActiveSupabaseClient();
    if (studySession) {
      const endedAt = new Date().toISOString();
      setStudySession({ ...studySession, ended_at: endedAt });
      if (!result || preview || !isRealId(studySession.id)) {
        setNotice(copy.saved);
        return;
      }
      const { error } = await result.client.from("study_sessions").update({ ended_at: endedAt }).eq("id", studySession.id);
      setNotice(error ? copy.offline : copy.saved);
      return;
    }

    const localSession: StudySessionRecord = {
      id: `demo-session-${Date.now()}`,
      material_id: isRealId(selectedMaterial.id) ? selectedMaterial.id : null,
      started_at: new Date().toISOString(),
      ended_at: null,
    };
    setStudySession(localSession);
    setCameraOpen(true);
    if (!result || preview || !isRealId(selectedMaterial.id)) {
      setNotice(copy.offline);
      return;
    }
    const { data, error } = await result.client.from("study_sessions").insert({
      student_id: result.session.user.id,
      material_id: selectedMaterial.id,
      started_at: localSession.started_at,
    }).select("id,material_id,started_at,ended_at").single();
    if (!error && data) setStudySession(data as StudySessionRecord);
    setNotice(error ? copy.offline : copy.saved);
  }

  async function submitMaterialAnswer(event: FormEvent) {
    event.preventDefault();
    const trimmed = answerDraft.trim();
    if (!trimmed) return;
    const submittedAt = new Date().toISOString();
    const localSubmission: MaterialSubmission = {
      id: `demo-sub-${selectedMaterial.id}`,
      material_id: selectedMaterial.id,
      answer: trimmed,
      is_correct: null,
      teacher_feedback: null,
      submitted_at: submittedAt,
    };
    setAnswerDraft("");
    setSubmissions((items) => [localSubmission, ...items.filter((item) => item.material_id !== selectedMaterial.id)]);
    await markProgress(selectedMaterial, true);
    const result = await getActiveSupabaseClient();
    if (!result || preview || !isRealId(selectedMaterial.id)) {
      setNotice(copy.offline);
      return;
    }
    const { data, error } = await result.client.from("material_submissions").insert({
      material_id: selectedMaterial.id,
      student_id: result.session.user.id,
      answer: trimmed,
    }).select("id,material_id,student_id,answer,is_correct,teacher_feedback,submitted_at,graded_at").single();
    if (!error && data) setSubmissions((items) => [data as MaterialSubmission, ...items.filter((item) => item.id !== localSubmission.id)]);
    setNotice(error ? copy.offline : copy.saved);
  }

  async function submitQuestion(event: FormEvent) {
    event.preventDefault();
    const trimmed = question.trim();
    if (!trimmed) return;
    const localQuestion: QaThread = { id: `demo-q-${Date.now()}`, question: trimmed, teacher_answer: null, status: "open", created_at: new Date().toISOString() };
    setQuestion("");
    const result = await getActiveSupabaseClient();
    if (!result || preview) {
      setQaItems((items) => [localQuestion, ...items]);
      setNotice(copy.offline);
      return;
    }
    const { data, error } = await result.client.from("qa_threads").insert({
      user_id: result.session.user.id,
      material_id: isRealId(currentMaterial.id) ? currentMaterial.id : null,
      question: trimmed,
    }).select("id,question,teacher_answer,status,created_at").single();
    setQaItems((items) => [(error || !data ? localQuestion : data as QaThread), ...items]);
    setNotice(error ? copy.offline : copy.saved);
  }

  async function acknowledgeSupport(item: SupportActionRecord) {
    const appliedAt = new Date().toISOString();
    const progressAtApply = progress?.percent ?? 42;
    setSupportActions((items) => items.map((action) => action.id === item.id ? { ...action, status: "acknowledged", applied_at: appliedAt, load_at_apply: loadProfile.load, progress_at_apply: progressAtApply } : action));
    if (item.action_type === "split" || item.action_type === "check") setFocusMode(true);
    if (item.action_type === "break") setFocusMode(false);
    setNotice(copy.supportApplied);
    const result = await getActiveSupabaseClient();
    if (!result || preview || !isRealId(item.id)) return;
    const { error } = await result.client.from("support_actions").update({ status: "acknowledged", read_at: appliedAt, applied_at: appliedAt, load_at_apply: loadProfile.load, progress_at_apply: progressAtApply }).eq("id", item.id);
    if (error) setNotice(copy.offline);
  }

  return <main className={`quiz-home-shell ${activeNav === "home" ? "home-overview" : ""}`} aria-label={`${displayName} dashboard`}>
    <aside className={`quiz-home-sidebar ${mobileOpen ? "open" : ""}`}>
      <nav className="quiz-primary-nav" aria-label={copy.home}>{navItems.map(([id, label, icon]) => <button key={id} className={activeNav === id ? "active" : ""} type="button" aria-pressed={activeNav === id} onClick={() => setActiveNav(id)}>{icon}<span>{label}</span></button>)}</nav>
      <section className="quiz-side-section"><h2>{copy.groupTitle}</h2><button type="button" className={groups.length ? "created" : ""} onClick={createGroup}><Plus /><span>{groups.length ? groups[0].name : copy.newGroup}</span></button></section>
      <section className="quiz-side-section"><h2>{copy.start}</h2><button type="button" className={activeNav === "library" ? "active" : ""} onClick={() => setActiveNav("library")}><BookOpen /><span>{copy.cards}</span></button><button type="button" className={activeNav === "material" ? "active" : ""} onClick={() => setActiveNav("material")}><FileText /><span>{copy.materialDetail}</span></button><button type="button" className={activeNav === "submission" ? "active" : ""} onClick={() => setActiveNav("submission")}><Upload /><span>{copy.submission}</span></button><button type="button" className={activeNav === "qa" ? "active" : ""} onClick={() => setActiveNav("qa")}><MessageCircle /><span>{copy.answers}</span></button><button type="button" className={activeNav === "emotion" ? "active" : ""} onClick={() => setActiveNav("emotion")}><Sparkles /><span>{copy.emotionSession}</span></button></section>
    </aside>

    <div className="quiz-home-feed">
      {notice && <p className="dashboard-message">{notice}</p>}
      {activeNav === "home" && <>
        <h1 className="home-page-title">{copy.home}</h1>
        <section className="quiz-feed-section">
          <h2>{copy.jump}</h2>
          <article className="home-resume-card">
            <span className="home-subject">{selectedMaterial.subject}</span>
            <h3>{selectedMaterial.title}</h3>
            <p>{language === "ja" ? selectedMaterial.descriptionJa : selectedMaterial.descriptionEn}</p>
            <div className="home-progress-row">
              <div className="quiz-progress" role="progressbar" aria-label={selectedMaterial.title} aria-valuenow={progress?.percent ?? 42} aria-valuemin={0} aria-valuemax={100}><i style={{ width: `${progress?.percent ?? 42}%` }} /></div>
              <span>{progressText}</span>
            </div>
            <div className="home-resume-actions">
              <button className="home-primary-button" type="button" onClick={() => { setActiveNav("material"); void markProgress(selectedMaterial); }}><Play aria-hidden="true" />{language === "ja" ? "学習を続ける" : "Continue learning"}</button>
              {activeSupport && <button className="home-text-button" type="button" onClick={() => setActiveNav("emotion")}>{copy.teacherSupport}<ChevronRight aria-hidden="true" /></button>}
            </div>
          </article>
        </section>
        {studySession && !studySession.ended_at && <button className="home-session-link" type="button" onClick={() => setActiveNav("emotion")}><Sparkles aria-hidden="true" />{copy.sessionActive}<ChevronRight aria-hidden="true" /></button>}
        <section className="quiz-feed-section">
          <div className="home-section-heading"><h2>{language === "ja" ? "教材" : "Materials"}</h2><button className="home-text-button" type="button" onClick={() => setActiveNav("library")}>{language === "ja" ? "すべて見る" : "View all"}<ChevronRight aria-hidden="true" /></button></div>
          <div className="home-material-list">
            {materials.slice(0, 3).map((material) => <button key={material.id} className="home-material-row" type="button" onClick={() => { setSelectedMaterialId(material.id); setActiveNav("material"); }}>
              <span className="home-row-icon"><FileText aria-hidden="true" /></span>
              <span className="home-row-copy"><strong>{material.title}</strong><small>{material.subject}<span>·</span>{material.type}<span>·</span>{material.duration} {language === "ja" ? "分" : "min"}</small></span>
              <ChevronRight aria-hidden="true" />
            </button>)}
          </div>
        </section>
        <section className="quiz-feed-section">
          <div className="home-section-heading"><h2>{copy.answers}</h2><button className="home-text-button" type="button" onClick={() => setActiveNav("qa")}>{language === "ja" ? "すべて見る" : "View all"}<ChevronRight aria-hidden="true" /></button></div>
          {qaItems[0] ? <button className="home-question-row" type="button" onClick={() => setActiveNav("qa")}>
            <span className="home-row-icon"><MessageCircle aria-hidden="true" /></span>
            <span className="home-row-copy"><strong>{qaItems[0].question}</strong><small className={qaItems[0].teacher_answer ? "home-answer-ready" : ""}>{qaItems[0].teacher_answer && <Check aria-hidden="true" />}{qaItems[0].teacher_answer ? (language === "ja" ? "回答済み" : "Answered") : (language === "ja" ? "回答待ち" : "Awaiting answer")}</small></span>
            <ChevronRight aria-hidden="true" />
          </button> : <button className="home-question-row" type="button" onClick={() => setActiveNav("qa")}><span className="home-row-icon"><MessageCircle aria-hidden="true" /></span><span className="home-row-copy"><strong>{copy.askPlaceholder}</strong></span><ChevronRight aria-hidden="true" /></button>}
        </section>
        <details className="learning-insight-pocket home-insight-pocket">
          <summary><strong>{language === "ja" ? "参考機能：科目別の進捗と学習リズム" : "Optional: subject progress and study rhythm"}</strong><ChevronDown aria-hidden="true" /></summary>
          <div className="subject-rhythm-grid compact">
            <SubjectActionBoard language={language} onAddReview={(subjectLabel) => setNotice(language === "ja" ? `${subjectLabel}の復習を学習予定に追加しました。` : `${subjectLabel} review was added to your study plan.`)} />
            <WeeklyRhythmCard language={language} />
          </div>
        </details>
      </>}
      {activeNav === "library" && <section className="quiz-feed-section"><h2>{copy.library}</h2><div className="quiz-list-grid">{materials.map((material) => <button key={material.id} type="button" className={`quiz-list-card ${selectedMaterial.id === material.id ? "active" : ""}`} onClick={() => { setSelectedMaterialId(material.id); setActiveNav("home"); }}><span><FileText /></span><div><strong>{material.title}</strong><small>{material.subject} · {material.duration} min · {material.type}</small><p>{language === "ja" ? material.descriptionJa : material.descriptionEn}</p></div></button>)}</div><article className="quiz-create-card" id="create-study-set"><div><span><FileText /></span><h3>{language === "ja" ? "自分だけの単語カードを作成" : "Create your own flashcards"}</h3><p>{language === "ja" ? "テストに必要な内容だけを学習できます。" : "Study exactly what is on your test."}</p><button type="button">{copy.create}</button></div><Image src="/classroom-desk.jpg" width={330} height={210} alt="" unoptimized /></article></section>}
      {activeNav === "groups" && <section className="quiz-feed-section"><h2>{copy.groups}</h2>{groups.length ? <div className="quiz-list-grid">{groups.map((group) => <article key={group.id} className="quiz-list-card"><span><Users /></span><div><strong>{group.name}</strong><small>{language === "ja" ? "学習グループ" : "Study group"}</small><p>{group.description || (language === "ja" ? "メンバーの進捗や質問をまとめて確認できます。" : "Collect progress and questions from members in one place.")}</p></div></article>)}</div> : <article className="quiz-personalize-card study-group-card"><Users /><h3>{language === "ja" ? "クラスや友達と同じ学習セットを進める" : "Study the same sets with classmates"}</h3><p>{language === "ja" ? "グループを作ると、メンバーの進捗や質問をまとめて確認できます。" : "Groups collect progress and questions from members in one place."}</p><button type="button" onClick={createGroup}>{copy.newGroup}</button></article>}</section>}
      {activeNav === "material" && <section className="quiz-feed-section"><h2>{copy.materialDetail}</h2><article className="material-detail-card material-detail-card-standalone"><header><span><FileText /></span><div><small>{selectedMaterial.subject} · {selectedMaterial.type} · {selectedMaterial.duration} min</small><h3>{selectedMaterial.title}</h3></div></header><p>{language === "ja" ? selectedMaterial.descriptionJa : selectedMaterial.descriptionEn}</p>{selectedMaterial.externalUrl && <a href={selectedMaterial.externalUrl} target="_blank" rel="noreferrer">{copy.preview}</a>}<div className="material-detail-actions">{materials.map((material) => <button key={material.id} className={selectedMaterial.id === material.id ? "active" : ""} type="button" onClick={() => setSelectedMaterialId(material.id)}>{material.title}</button>)}</div><div className="jump-actions"><button type="button" onClick={() => markProgress(selectedMaterial)}><Play />{copy.continue}</button><button type="button" className={studySession ? "session-live" : ""} onClick={toggleStudySession}>{studySession ? copy.stopSession : copy.startSession}</button></div></article></section>}
      {activeNav === "submission" && <section className="quiz-feed-section"><h2>{copy.submission}</h2><form className="submission-card submission-card-standalone" onSubmit={submitMaterialAnswer}><textarea value={answerDraft} onChange={(event) => setAnswerDraft(event.target.value)} placeholder={selectedSubmission ? selectedSubmission.answer : copy.answerPlaceholder} rows={5} /><footer><div>{selectedSubmission ? <><strong>{copy.submitted}</strong><span>{selectedSubmission.teacher_feedback || copy.noFeedback}</span></> : <><strong>{copy.instruction}</strong><span>{language === "ja" ? selectedMaterial.descriptionJa : selectedMaterial.descriptionEn}</span></>}</div><button type="submit">{copy.submitAnswer}</button></footer>{selectedSubmission?.teacher_feedback && <p className="teacher-feedback"><b>{copy.teacherFeedback}</b>{selectedSubmission.teacher_feedback}</p>}</form></section>}
      {activeNav === "qa" && <section className="quiz-feed-section"><h2>{copy.answers}</h2><form className="qa-compose-form" onSubmit={submitQuestion}><textarea value={question} onChange={(event) => setQuestion(event.target.value)} placeholder={copy.askPlaceholder} rows={3} /><button type="submit"><MessageCircle />{copy.send}</button></form><div className="qa-history-list">{qaItems.map((item) => <article key={item.id}><span>Q</span><div><strong>{item.question}</strong><p>{item.teacher_answer ? `${language === "ja" ? "先生の回答" : "Teacher answer"}: ${item.teacher_answer}` : (language === "ja" ? "先生の回答待ちです。" : "Waiting for a teacher answer.")}</p><small>{new Date(item.created_at).toLocaleString(language === "ja" ? "ja-JP" : "en-US")}</small></div></article>)}</div></section>}
      {activeNav === "emotion" && <><section className="quiz-feed-section"><h2>{copy.emotionSession}</h2>{studySession ? <article className="session-note"><span>{copy.sessionActive}</span><strong>{selectedMaterial.title}</strong><p>{new Date(studySession.started_at).toLocaleTimeString(language === "ja" ? "ja-JP" : "en-US", { hour: "2-digit", minute: "2-digit" })} 〜</p></article> : <article className="material-detail-card emotion-session-card"><header><span><Sparkles /></span><div><small>{copy.signal}</small><h3>{loadProfile.label}</h3></div></header><p>{loadProfile.detail}</p><div className="jump-actions"><button type="button" onClick={toggleStudySession}>{copy.startSession}</button><button type="button" onClick={() => setCameraOpen(true)}>{copy.monitor}</button></div></article>}</section><section className="quiz-feed-section"><h2>{copy.adaptive}</h2><article className={`load-adapter-card ${loadProfile.tone}`}><div className="load-adapter-main"><span>{copy.signal}</span><h3>{loadProfile.label}</h3><p>{loadProfile.detail}</p><div className="load-actions"><button type="button" onClick={() => setFocusMode(true)}>{loadProfile.primaryAction}</button><button type="button" onClick={() => setActiveNav("qa")}>{loadProfile.secondaryAction}</button></div></div><div className="load-meter" aria-label={`${copy.load} ${loadProfile.load}%`}><strong>{loadProfile.load}%</strong><i><b style={{ height: `${loadProfile.load}%`, "--load": `${loadProfile.load}%` } as CSSProperties} /></i><small>{copy.source}: {emotionSignal?.source || "standby"}</small></div></article></section>{supportActions.length > 0 && <section className="quiz-feed-section"><h2>{copy.teacherSupport}</h2><div className="support-inbox-list">{supportActions.map((item) => <article key={item.id} className={`support-inbox-card ${item.status}`}><span>{item.action_type === "break" ? "休" : item.action_type === "split" ? "分" : "確"}</span><div><strong>{item.action_type === "break" ? copy.breakPrompt : item.action_type === "split" ? copy.splitPrompt : copy.checkPrompt}</strong><p>{item.message || supportMessage(item.action_type, language)}</p><small>{new Date(item.created_at).toLocaleString(language === "ja" ? "ja-JP" : "en-US")}</small></div>{item.status === "pending" ? <button type="button" onClick={() => acknowledgeSupport(item)}>{copy.acknowledge}</button> : <em className="support-outcome-pill">{outcomeLabel(item.outcome_status, language)}</em>}</article>)}</div></section>}{focusMode && <section className="quiz-feed-section"><h2>{copy.focusOn}</h2><article className="focus-mode-card"><div><Sparkles /><h3>{copy.focusNote}</h3><ol><li>{copy.stepOne}</li><li>{copy.stepTwo}</li><li>{copy.stepThree}</li></ol></div><button type="button" onClick={() => setFocusMode(false)}>{copy.normal}</button></article></section>}</>}
    </div>

    <aside className="quiz-emotion-panel">
      {cameraOpen ? <EmotionCamera language={language} materialTitle={selectedMaterial.title} autoStart onSignal={handleEmotionSignal} onClose={() => setCameraOpen(false)} /> : <ClosedEmotionMonitor language={language} onOpen={() => setCameraOpen(true)} materialTitle={selectedMaterial.title} signal={emotionSignal} />}
    </aside>
  </main>;
}

function TeacherWorkspace({ language, preview, mobileOpen }: { language: Language; preview: boolean; mobileOpen: boolean }) {
  const t = ui[language];
  const [materials, setMaterials] = useState<Material[]>(materialsSeed);
  const [questions, setQuestions] = useState<QaThread[]>(qaSeed);
  const [classProgress, setClassProgress] = useState<ProgressRecord[]>([]);
  const [emotionSamples, setEmotionSamples] = useState<EmotionSampleRecord[]>([]);
  const [supportHistory, setSupportHistory] = useState<SupportActionRecord[]>([]);
  const [submissions, setSubmissions] = useState<MaterialSubmission[]>(submissionSeed);
  const [profiles, setProfiles] = useState<ProfileRecord[]>([]);
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("English Speaking");
  const [type, setType] = useState<"PDF" | "LINK" | "CARD">("PDF");
  const [duration, setDuration] = useState(15);
  const [url, setUrl] = useState("");
  const [instruction, setInstruction] = useState("");
  const [studentId, setStudentId] = useState("");
  const [notice, setNotice] = useState("");
  const [activePanel, setActivePanel] = useState<TeacherPanelId>("overview");
  const [selectedStudentId, setSelectedStudentId] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      const result = await getActiveSupabaseClient();
      if (!active || !result) return;
      const [materialResult, questionResult, progressResult, emotionResult, supportResult, profileResult, submissionResult] = await Promise.all([
        result.client.from("learning_materials").select("id,title,subject,material_type,duration_minutes,instruction,external_url").order("created_at", { ascending: false }),
        result.client.from("qa_threads").select("id,question,teacher_answer,status,created_at").order("created_at", { ascending: false }),
        result.client.from("study_progress").select("material_id,status,percent,last_activity_title,last_studied_at").order("last_studied_at", { ascending: false }).limit(6),
        result.client.from("emotion_samples").select("id,user_id,valence,arousal,dominant_emotion,confidence,source,model_version,captured_at").order("captured_at", { ascending: false }).limit(8),
        result.client.from("support_actions").select("id,student_id,action_type,message,status,created_at,applied_at,load_at_apply,progress_at_apply,outcome_status").order("created_at", { ascending: false }).limit(8),
        result.client.from("profiles").select("id,display_name,role"),
        result.client.from("material_submissions").select("id,material_id,student_id,answer,is_correct,teacher_feedback,submitted_at,graded_at").order("submitted_at", { ascending: false }).limit(10),
      ]);
      if (!active) return;
      if (!materialResult.error && materialResult.data?.length) setMaterials(materialResult.data.map(dbMaterialToMaterial));
      if (!questionResult.error && questionResult.data?.length) setQuestions(questionResult.data as QaThread[]);
      if (!progressResult.error && progressResult.data) setClassProgress(progressResult.data as ProgressRecord[]);
      if (!emotionResult.error && emotionResult.data) setEmotionSamples(emotionResult.data as EmotionSampleRecord[]);
      if (!supportResult.error && supportResult.data) setSupportHistory(supportResult.data as SupportActionRecord[]);
      if (!profileResult.error && profileResult.data) setProfiles(profileResult.data as ProfileRecord[]);
      if (!submissionResult.error && submissionResult.data?.length) setSubmissions(submissionResult.data as MaterialSubmission[]);
    }
    load();
    return () => { active = false; };
  }, []);

  async function addMaterial(event: FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;
    const localMaterial: Material = { id: `demo-${Date.now()}`, title: title.trim(), subject, type, duration, externalUrl: url, descriptionJa: instruction || "新しく追加された教材です。", descriptionEn: instruction || "Newly added material." };
    const result = await getActiveSupabaseClient();
    if (!result || preview) {
      setMaterials((items) => [localMaterial, ...items]);
      setNotice(language === "ja" ? "画面内に追加しました。" : "Added on this screen.");
    } else {
      const { data, error } = await result.client.from("learning_materials").insert({
        created_by: result.session.user.id,
        title: localMaterial.title,
        subject: localMaterial.subject,
        material_type: localMaterial.type,
        duration_minutes: localMaterial.duration,
        external_url: localMaterial.externalUrl || null,
        instruction,
        is_published: true,
      }).select("id,title,subject,material_type,duration_minutes,instruction,external_url").single();
      setMaterials((items) => [(error || !data ? localMaterial : dbMaterialToMaterial(data)), ...items]);
      setNotice(error ? (language === "ja" ? "保存できませんでした。教師ロールかSQL設定を確認してください。" : "Could not save. Check teacher role or SQL setup.") : t.added);
    }
    setTitle("");
    setInstruction("");
    setUrl("");
  }

  async function answerQuestion(item: QaThread) {
    const answer = language === "ja" ? "確認しました。次の学習で同じ表現をもう一度練習しましょう。" : "Checked. Practise the same expression again in your next activity.";
    setQuestions((items) => items.map((question) => question.id === item.id ? { ...question, teacher_answer: answer, status: "answered" } : question));
    const result = await getActiveSupabaseClient();
    if (!result || preview || !isRealId(item.id)) return;
    const { error } = await result.client.from("qa_threads").update({ teacher_answer: answer, status: "answered", answered_by: result.session.user.id, answered_at: new Date().toISOString() }).eq("id", item.id);
    if (error) setNotice(language === "ja" ? "回答を保存できませんでした。" : "Could not save the answer.");
  }

  async function queueSupportAction(studentId: string, studentName: string, action: SupportAction) {
    const label = action === "break" ? t.breakPrompt : action === "split" ? t.splitPrompt : t.checkPrompt;
    const queued = language === "ja" ? `${studentName} に「${label}」を準備しました。` : `${label} is ready for ${studentName}.`;
    const result = await getActiveSupabaseClient();
    if (!result || preview || studentId.startsWith("student-")) {
      setNotice(queued);
      return;
    }
    const { error } = await result.client.from("support_actions").insert({
      student_id: studentId,
      teacher_id: result.session.user.id,
      action_type: action,
      message: supportMessage(action, language),
    });
    setNotice(error ? (language === "ja" ? "支援提案を保存できませんでした。SQLの実行状態を確認してください。" : "Could not save the support suggestion. Check whether the SQL has been applied.") : queued);
  }

  async function gradeSubmission(item: MaterialSubmission) {
    const feedback = language === "ja" ? "確認しました。次は理由を1文追加して、より自然な回答にしましょう。" : "Checked. Add one reason next time to make the answer more natural.";
    const gradedAt = new Date().toISOString();
    setSubmissions((items) => items.map((submission) => submission.id === item.id ? { ...submission, is_correct: true, teacher_feedback: feedback, graded_at: gradedAt } : submission));
    const result = await getActiveSupabaseClient();
    if (!result || preview || !isRealId(item.id)) return;
    const { error } = await result.client.from("material_submissions").update({ is_correct: true, teacher_feedback: feedback, graded_at: gradedAt, graded_by: result.session.user.id }).eq("id", item.id);
    if (error) setNotice(language === "ja" ? "提出へのフィードバックを保存できませんでした。" : "Could not save submission feedback.");
  }

  const visibleEmotionSamplesRaw = emotionSamples.length ? emotionSamples : [
    { id: "demo-e1", user_id: "student-a", valence: -0.28, arousal: 0.72, dominant_emotion: "fear", confidence: 0.76, source: "emotion-api", model_version: "demo", captured_at: new Date().toISOString() },
    { id: "demo-e2", user_id: "student-b", valence: 0.18, arousal: 0.44, dominant_emotion: "neutral", confidence: 0.72, source: "browser", model_version: "demo", captured_at: new Date().toISOString() },
    { id: "demo-e3", user_id: "student-c", valence: -0.12, arousal: 0.36, dominant_emotion: "sadness", confidence: 0.68, source: "emotion-api", model_version: "demo", captured_at: new Date().toISOString() },
  ] satisfies EmotionSampleRecord[];
  const visibleEmotionSamples = latestEmotionSamplesByUser(visibleEmotionSamplesRaw);
  const loadAverage = Math.round(visibleEmotionSamples.reduce((sum, sample) => sum + getLoadFromValues(sample.valence, sample.arousal), 0) / Math.max(1, visibleEmotionSamples.length));
  const highLoadCount = visibleEmotionSamples.filter((sample) => getLoadFromValues(sample.valence, sample.arousal) >= 60).length;
  const profileById = new Map(profiles.map((profile) => [profile.id, profile]));
  const profileLabel = (userId: string | undefined, index: number) => {
    const profile = userId ? profileById.get(userId) : null;
    return profile?.display_name?.trim() || (userId?.startsWith("student-") ? `Student ${index + 1}` : `${language === "ja" ? "学生" : "Student"} ${index + 1}`);
  };
  const studentLabel = (sample: EmotionSampleRecord, index: number) => profileLabel(sample.user_id, index);
  const visibleSupportHistory = supportHistory.length ? supportHistory : supportHistorySeed;
  const teacherEmotionCopy = language === "ja"
    ? { title: "学習負荷シグナル", summary: `${highLoadCount}人に支援サイン`, avg: "平均負荷", note: "生徒ごとの最新ログをもとに、声かけ・分割課題・休憩提案を判断します。", noData: "まだ実測ログがないためデモ表示です。" }
    : { title: "Learning load signals", summary: `${highLoadCount} support signs`, avg: "Average load", note: "Latest per-student signals guide check-ins, split tasks, and break prompts.", noData: "Demo values are shown until live samples exist." };

  const reportCopy = language === "ja"
    ? { report: "教師レポート", submissions: "提出確認", reviewed: "確認済み", waiting: "未確認", feedback: "フィードバック", noSubmissions: "まだ提出はありません。", overview: "概要", materials: "教材", questions: "質問回答", emotion: "感情ログ", students: "学生別レポート", noStudent: "まだ学生データはありません。", support: "支援提案", latestEmotion: "最新シグナル", activity: "学習活動" }
    : { report: "Teacher report", submissions: "Submissions", reviewed: "Reviewed", waiting: "Waiting", feedback: "Feedback", noSubmissions: "No submissions yet.", overview: "Overview", materials: "Materials", questions: "Q&A", emotion: "Emotion log", students: "Student reports", noStudent: "No student data yet.", support: "Support", latestEmotion: "Latest signal", activity: "Activity" };
  const teacherPanels = [
    ["overview", reportCopy.overview, <Home key="overview" />],
    ["materials", reportCopy.materials, <BookOpen key="materials" />],
    ["questions", reportCopy.questions, <MessageCircle key="questions" />],
    ["submissions", reportCopy.submissions, <Upload key="submissions" />],
    ["emotion", reportCopy.emotion, <Sparkles key="emotion" />],
    ["students", reportCopy.students, <Users key="students" />],
  ] as const;
  const studentIds = Array.from(new Set([
    ...profiles.filter((profile) => profile.role === "student").map((profile) => profile.id),
    ...visibleEmotionSamples.map((sample) => sample.user_id),
    ...submissions.map((submission) => submission.student_id || ""),
    ...visibleSupportHistory.map((support) => support.student_id || ""),
  ].filter(Boolean)));
  const studentReportRows = (studentIds.length ? studentIds : ["student-a", "student-b"]).map((id, index) => {
    const latestEmotion = visibleEmotionSamples.find((sample) => sample.user_id === id);
    const studentSubmissions = submissions.filter((submission) => submission.student_id === id || (!submission.student_id && index === 0));
    const studentSupports = visibleSupportHistory.filter((support) => support.student_id === id || (!support.student_id && index === 0));
    const studentProgress = classProgress[index];
    return {
      id,
      name: profileLabel(id, index),
      load: latestEmotion ? getLoadFromValues(latestEmotion.valence, latestEmotion.arousal) : 0,
      latestEmotion,
      submissions: studentSubmissions.length,
      support: studentSupports.length,
      progress: studentProgress?.percent ?? (index === 0 ? 72 : 58),
      activity: studentProgress?.last_activity_title || materials[index % Math.max(1, materials.length)]?.title || "Learning activity",
    };
  });
  const selectedStudent = studentReportRows.find((row) => row.id === selectedStudentId) || studentReportRows[0];
  const jumpToTeacherPanel = (panel: TeacherPanelId) => {
    setActivePanel(panel);
    requestAnimationFrame(() => document.getElementById(`teacher-${panel}-panel`)?.scrollIntoView({ behavior: "smooth", block: "start" }));
  };

  return <main className="teacher-quiz-shell">
    <aside className={`quiz-home-sidebar teacher-quiz-sidebar ${mobileOpen ? "open" : ""}`}>
      <nav className="quiz-primary-nav" aria-label={reportCopy.report}>{teacherPanels.map(([id, label, icon]) => <button key={id} className={activePanel === id ? "active" : ""} type="button" aria-pressed={activePanel === id} onClick={() => jumpToTeacherPanel(id)}>{icon}<span>{label}</span></button>)}</nav>
      <section className="quiz-side-section"><h2>{reportCopy.support}</h2><button type="button" onClick={() => jumpToTeacherPanel("emotion")}><Sparkles /><span>{teacherEmotionCopy.summary}</span></button></section>
    </aside>

    <section className="teacher-workspace teacher-panel-feed">
    <header className="teacher-title">
      <div><span>{t.teacherWorkspace.toUpperCase()}</span><h1>{t.manageTitle}</h1><p>{t.manageText}</p></div>
      <button type="button"><Users />{t.showClass}</button>
    </header>
    {notice && <p className="teacher-notice">{notice}</p>}
    <div id="teacher-overview-panel" className="teacher-panel-block">
      <TeacherSupportHistoryCard items={visibleSupportHistory} language={language} profileLabel={profileLabel} />
      <section className="teacher-report-card">
      <article><small>MATERIALS</small><strong>{materials.length}</strong><span>{t.list}</span></article>
      <article><small>SUBMISSIONS</small><strong>{submissions.length}</strong><span>{reportCopy.submissions}</span></article>
      <article><small>QUESTIONS</small><strong>{questions.filter((item) => item.status === "open").length}</strong><span>{t.recent}</span></article>
      <article><small>LOAD</small><strong>{loadAverage}%</strong><span>{teacherEmotionCopy.avg}</span></article>
      </section>
    </div>
    <div className="teacher-grid">
      <section className="teacher-card upload-card" id="teacher-materials-panel">
        <header><span><Upload /></span><div><small>MATERIALS</small><h2>{t.addMaterial}</h2></div></header>
        <form onSubmit={addMaterial}>
          <div className="teacher-field-grid">
            <label>{t.title}<input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Unit 2 Conversation" required /></label>
            <label>{t.subject}<input value={subject} onChange={(event) => setSubject(event.target.value)} /></label>
            <label>{t.type}<select value={type} onChange={(event) => setType(event.target.value as "PDF" | "LINK" | "CARD")}><option value="PDF">PDF</option><option value="LINK">Website link</option><option value="CARD">Cards</option></select></label>
            <label>{t.duration}<input type="number" min="1" value={duration} onChange={(event) => setDuration(Number(event.target.value))} /></label>
          </div>
          <label>{t.url}<input type="url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://" /></label>
          <label>{t.instruction}<textarea value={instruction} onChange={(event) => setInstruction(event.target.value)} rows={3} /></label>
          <div className="upload-zone"><FileText /><strong>{t.pdf}</strong><span>{t.max}</span><input type="file" accept="application/pdf" /></div>
          <button type="submit"><Plus />{t.add}</button>
        </form>
      </section>
      <section className="teacher-card material-table">
        <header><div><small>ASSIGNMENT</small><h2>{t.list}</h2></div><b>{materials.length}</b></header>
        <label className="student-id-field">{t.studentId}<input value={studentId} onChange={(event) => setStudentId(event.target.value)} placeholder="student@example.com" /></label>
        <div>{materials.map((material) => <article key={material.id}><span><FileText /></span><div><strong>{material.title}</strong><small>{material.subject} · {material.duration} min</small></div><em>{material.type}</em><button type="button" onClick={() => setNotice(language === "ja" ? `${material.title} ${t.assignedNotice}` : `${material.title}${t.assignedNotice}`)}>{t.assign}</button></article>)}</div>
      </section>
      <section className="teacher-card student-pulse">
        <header><div><small>CLASS PULSE</small><h2>{t.classProgress}</h2></div><BarChart3 /></header>
        {(classProgress.length ? classProgress : [{ last_activity_title: "Greetings & Introductions", percent: 72, status: "in_progress", material_id: null, last_studied_at: new Date().toISOString() }, { last_activity_title: "Conversation Practice", percent: 58, status: "in_progress", material_id: null, last_studied_at: new Date().toISOString() }]).map((progressItem, index) => <article key={`${progressItem.last_activity_title}-${index}`}><span>{index + 1}</span><div><strong>{progressItem.last_activity_title || "Learning activity"}</strong><i><b style={{ width: `${progressItem.percent}%` }} /></i></div><em>{progressItem.percent}%</em></article>)}
      </section>
      <section className="teacher-card emotion-insight-card" id="teacher-emotion-panel">
        <header><div><small>EMOTION LOAD</small><h2>{teacherEmotionCopy.title}</h2></div><b>{loadAverage}%</b></header>
        <div className="emotion-class-summary"><strong>{teacherEmotionCopy.summary}</strong><span>{teacherEmotionCopy.avg}: {loadAverage}%</span><p>{emotionSamples.length ? teacherEmotionCopy.note : teacherEmotionCopy.noData}</p></div>
        <div className="emotion-student-list">{visibleEmotionSamples.map((sample, index) => { const load = getLoadFromValues(sample.valence, sample.arousal); const advice = getSupportAdvice(load, sample.valence, sample.arousal, language); const name = studentLabel(sample, index); return <article key={sample.id}><span>{index + 1}</span><div><strong>{name}</strong><small>{sample.dominant_emotion || "neutral"} · {sample.source} · {new Date(sample.captured_at).toLocaleTimeString(language === "ja" ? "ja-JP" : "en-US", { hour: "2-digit", minute: "2-digit" })}</small><i><b style={{ width: `${load}%` }} /></i><small className="emotion-advice">{advice}</small><div className="emotion-support-actions"><button type="button" onClick={() => queueSupportAction(sample.user_id, name, "break")}>{t.breakPrompt}</button><button type="button" onClick={() => queueSupportAction(sample.user_id, name, "split")}>{t.splitPrompt}</button><button type="button" onClick={() => queueSupportAction(sample.user_id, name, "check")}>{t.checkPrompt}</button></div></div><em className={load >= 60 ? "high" : ""}>{load}%</em></article>; })}</div>
      </section>
      <section className="teacher-card submission-review-card" id="teacher-submissions-panel">
        <header><div><small>SUBMISSIONS</small><h2>{reportCopy.submissions}</h2></div><b>{submissions.length}</b></header>
        <div>{submissions.length ? submissions.map((item, index) => <article key={item.id}><span>{item.is_correct === true ? "✓" : "…"}</span><div><strong>{profileLabel(item.student_id || undefined, index)}</strong><p>{item.answer}</p><small>{new Date(item.submitted_at).toLocaleString(language === "ja" ? "ja-JP" : "en-US")} · {item.teacher_feedback ? reportCopy.reviewed : reportCopy.waiting}</small>{item.teacher_feedback && <em>{item.teacher_feedback}</em>}</div>{!item.teacher_feedback && <button type="button" onClick={() => gradeSubmission(item)}>{reportCopy.feedback}</button>}</article>) : <p>{reportCopy.noSubmissions}</p>}</div>
      </section>
      <section className="teacher-card teacher-comments" id="teacher-questions-panel">
        <header><div><small>QUESTIONS</small><h2>{t.recent}</h2></div><MessageCircle /></header>
        {questions.map((item) => <article key={item.id}><span>Q</span><div><strong>{item.question}</strong><p>{item.teacher_answer || (language === "ja" ? "まだ回答していません。" : "Not answered yet.")}</p><small>{new Date(item.created_at).toLocaleString(language === "ja" ? "ja-JP" : "en-US")}</small>{!item.teacher_answer && <button type="button" onClick={() => answerQuestion(item)}>{t.answer}</button>}{item.teacher_answer && <small>{t.answered}</small>}</div></article>)}
      </section>
      <section className="teacher-card student-report-detail-card" id="teacher-students-panel">
        <header><div><small>STUDENT REPORT</small><h2>{reportCopy.students}</h2></div><Users /></header>
        {selectedStudent ? <><div className="student-report-selector">{studentReportRows.map((row) => <button key={row.id} type="button" className={selectedStudent.id === row.id ? "active" : ""} onClick={() => setSelectedStudentId(row.id)}>{row.name}</button>)}</div><article className="student-report-focus"><div><small>{reportCopy.activity}</small><strong>{selectedStudent.activity}</strong><i><b style={{ width: `${selectedStudent.progress}%` }} /></i><span>{selectedStudent.progress}%</span></div><div><small>{reportCopy.latestEmotion}</small><strong>{selectedStudent.latestEmotion?.dominant_emotion || "neutral"}</strong><i><b style={{ width: `${selectedStudent.load}%` }} /></i><span>{selectedStudent.load}%</span></div><div><small>{reportCopy.submissions}</small><strong>{selectedStudent.submissions}</strong><span>{reportCopy.reviewed}: {submissions.filter((item) => item.student_id === selectedStudent.id && item.teacher_feedback).length}</span></div><div><small>{reportCopy.support}</small><strong>{selectedStudent.support}</strong><span>{visibleSupportHistory.filter((item) => item.student_id === selectedStudent.id && item.status === "acknowledged").length} {reportCopy.reviewed}</span></div></article></> : <p>{reportCopy.noStudent}</p>}
      </section>
    </div>
    </section>
  </main>;
}

export function LearningDashboard(props: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [language, setLanguage] = useState<Language>("ja");
  return <div className="lab-shell"><AppHeader {...props} menuOpen={menuOpen} setMenuOpen={setMenuOpen} mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} language={language} setLanguage={setLanguage} />{props.message && <p className="dashboard-message">{props.message}</p>}{props.role === "teacher" ? <TeacherWorkspace language={language} preview={props.preview} mobileOpen={mobileOpen} /> : <StudentWorkspace displayName={props.displayName} mobileOpen={mobileOpen} language={language} preview={props.preview} />}</div>;
}
