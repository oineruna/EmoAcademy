"use client";

import { FormEvent, useEffect, useState } from "react";
import Image from "next/image";
import {
  BarChart3, BookOpen, ChevronDown, FileText, Folder,
  Home, LogOut, Menu, MessageCircle, Play,
  Plus, Search, Sparkles, Trash2, Upload, Users, X,
} from "lucide-react";
import { EmotionCamera } from "@/components/emotion-camera";
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

const materialsSeed: Material[] = [
  { id: "demo-1", title: "Greetings & Introductions", subject: "English Speaking", type: "PDF", duration: 12, descriptionJa: "基本表現を確認し、短い自己紹介を声に出して練習します。", descriptionEn: "Review key phrases and practise a short introduction aloud." },
  { id: "demo-2", title: "Conversation Practice", subject: "English Speaking", type: "LINK", duration: 18, descriptionJa: "質問と応答を交互に行う会話練習です。", descriptionEn: "Practise a conversation by alternating questions and answers." },
  { id: "demo-3", title: "Unit 1 Review", subject: "English Speaking", type: "PDF", duration: 10, descriptionJa: "Lesson 1の表現を振り返る確認問題です。", descriptionEn: "Check your understanding of the expressions from Lesson 1." },
];

const qaSeed: QaThread[] = [
  { id: "demo-q1", question: "自己紹介の最後の一文を確認したい", teacher_answer: "“Nice to meet you.” の後に、好きなことを1文足すと自然です。", status: "answered", created_at: new Date().toISOString() },
  { id: "demo-q2", question: "発音より先に意識することは？", teacher_answer: "まず会話を止めずに続けること。短い返答でもOKです。", status: "answered", created_at: new Date().toISOString() },
];

const ui = {
  ja: {
    menu: "メニュー", student: "学生", teacher: "教師", preview: "プレビューモード", logout: "ログアウト", delete: "アカウント削除",
    liveEmotion: "現在の感情", steady: "安定した集中", steadyNote: "落ち着いて取り組めています", start: "計測を開始", latest: "最新の出力",
    teacherWorkspace: "教師ワークスペース", manageTitle: "教材と学習状況", manageText: "教材の追加・割り当て・質問回答を管理します。", showClass: "クラスを表示", addMaterial: "教材を追加", title: "タイトル", subject: "科目", type: "教材種別", duration: "所要時間（分）", url: "外部URL", instruction: "学習指示", pdf: "PDFを選択", max: "最大20MB", add: "教材を追加", list: "教材一覧", assign: "割り当て", studentId: "学生メール", classProgress: "学生の進捗", recent: "最近の質問", added: "教材を保存しました。", assignedNotice: "を学生へ割り当てました。", answer: "回答する", answered: "回答済み",
  },
  en: {
    menu: "Menu", student: "Student", teacher: "Teacher", preview: "Preview mode", logout: "Log out", delete: "Delete account",
    liveEmotion: "Live emotion", steady: "Steady focus", steadyNote: "You are working at a calm, steady pace.", start: "Start monitoring", latest: "Latest output",
    teacherWorkspace: "Teacher workspace", manageTitle: "Materials and learning activity", manageText: "Manage materials, assignments, and student questions.", showClass: "View class", addMaterial: "Add material", title: "Title", subject: "Subject", type: "Material type", duration: "Duration (min)", url: "External URL", instruction: "Instruction", pdf: "Choose PDF", max: "Up to 20 MB", add: "Add material", list: "Materials", assign: "Assign", studentId: "Student email", classProgress: "Student progress", recent: "Recent questions", added: "Material saved.", assignedNotice: " was assigned to a student.", answer: "Answer", answered: "Answered",
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

function AppHeader({ displayName, email, role, preview, menuOpen, setMenuOpen, mobileOpen, setMobileOpen, onLogout, onDeleteAccount, language, setLanguage }: Props & { menuOpen: boolean; setMenuOpen: (value: boolean) => void; mobileOpen: boolean; setMobileOpen: (value: boolean) => void; language: Language; setLanguage: (language: Language) => void }) {
  const t = ui[language];
  const [search, setSearch] = useState("");
  return <header className="lab-header">
    <div className="lab-header-brand"><button className="lab-mobile-menu" type="button" aria-label={t.menu} onClick={() => setMobileOpen(!mobileOpen)}>{mobileOpen ? <X /> : <Menu />}</button><a href="/dashboard"><Image src="/emoacademy-mark.png" width={38} height={38} alt="" unoptimized /><span><strong>EmoAcademy</strong><small>Learn · Practice · Improve</small></span></a></div>
    <form className="lab-search" onSubmit={(event) => { event.preventDefault(); document.getElementById("create-study-set")?.scrollIntoView({ behavior: "smooth" }); }}><Search /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder={language === "ja" ? "学習セット、教材、質問" : "Study sets, materials, questions"} aria-label={language === "ja" ? "検索" : "Search"} /></form>
    <div className="lab-header-actions"><LanguageSwitch language={language} setLanguage={setLanguage} /><div className="lab-profile-wrap"><button className="lab-profile" type="button" aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}><span>{displayName.slice(0, 1).toUpperCase()}</span><div><strong>{displayName}</strong><small>{role === "teacher" ? t.teacher : t.student}</small></div><ChevronDown /></button>{menuOpen && <div className="lab-profile-menu"><p>{email}</p>{preview && <small>{t.preview}</small>}<button type="button" onClick={onLogout}><LogOut />{t.logout}</button><button className="danger" type="button" onClick={onDeleteAccount}><Trash2 />{t.delete}</button></div>}</div></div>
  </header>;
}

const emotions = [
  ["Anger", 4], ["Contempt", 2], ["Disgust", 3], ["Fear", 6],
  ["Happiness", 18], ["Neutral", 52], ["Sadness", 5], ["Surprise", 10],
] as const;

function ClosedEmotionMonitor({ language, onOpen }: { language: Language; onOpen: () => void }) {
  const t = ui[language];
  const text = language === "ja" ? {
    title: "感情モニター", ready: "READY", session: "学習中の教材", material: "Greetings & Introductions", startOnly: "カメラを開始するとリアルタイムに動きます", current: "今の状態", label: "安定", mood: "気分", energy: "活性", expression: "現在の表情", latest: "最新", source: "入力", trend: "リアルタイム推移", samples: "待機中",
  } : {
    title: "Emotion monitor", ready: "READY", session: "Session material", material: "Greetings & Introductions", startOnly: "Start the camera to animate the live monitor", current: "Current state", label: "Steady", mood: "Mood", energy: "Energy", expression: "Current expression", latest: "Latest", source: "Input", trend: "Realtime trend", samples: "Waiting",
  };
  return <section className="emotion-dock emotion-dock-preview is-idle" aria-label={text.title}>
    <header className="emotion-dock-head">
      <div><span className="live-pip" /> <strong>{text.title}</strong><small>{text.ready}</small></div>
      <button type="button" onClick={onOpen} aria-label={t.start}>›</button>
    </header>
    <div className="session-material compact">
      <label>{text.session}</label>
      <select defaultValue="greetings" aria-label={text.session} onChange={() => undefined}>
        <option value="greetings">{text.material}</option>
        <option value="conversation">Conversation Practice</option>
        <option value="review">Unit 1 Review</option>
      </select>
    </div>
    <div className="emotion-grid">
      <button className="camera-frame camera-frame-preview" type="button" onClick={onOpen}>
        <div className="camera-placeholder"><span>◉</span><p>{text.startOnly}</p></div>
        <div className="camera-controls"><span><b className="camera-dot-live" />{t.liveEmotion}</span><em>{t.start}</em></div>
      </button>
      <div className="signal-card">
        <div className="signal-label"><span>{text.current}</span><strong>{text.label}</strong></div>
        <div className="circumplex" aria-hidden="true"><span className="axis-y">{text.energy}</span><span className="axis-x">{text.mood}</span><i style={{ left: "57%", top: "53%" }} /></div>
        <div className="signal-values"><span>{text.mood} <b>+0.18</b></span><span>{text.energy} <b>0.46</b></span></div>
      </div>
    </div>
    <div className="emotion-summary-card">
      <div className="emotion-ring-detail" style={{ background: "conic-gradient(#24c391 0deg, #24c391 188deg, #dbe3ef 188deg, #dbe3ef 360deg)" }}><span>52%</span></div>
      <div className="emotion-summary-main"><small>{text.expression}</small><strong>Neutral</strong><p>{text.latest}: {text.mood} +0.18 · {text.energy} 0.46</p><em>{text.source}: standby</em></div>
    </div>
    <div className="emotion-percent-list">{emotions.map(([name, value]) => <div key={name}><span>{name}</span><i><b style={{ width: `${value}%` }} /></i><strong>{value}%</strong></div>)}</div>
    <div className="signal-timeline"><div><strong>{text.trend}</strong><span>{text.samples}</span></div><svg viewBox="0 0 100 48" preserveAspectRatio="none"><line x1="0" y1="24" x2="100" y2="24" /><polyline className="valence-line preview-line" points="0,32 20,28 40,30 60,24 80,27 100,23" /><polyline className="arousal-line preview-line" points="0,31 20,25 40,29 60,20 80,26 100,22" /></svg><footer><span>{text.mood}</span><span>{text.energy}</span></footer></div>
  </section>;
}

function StudentWorkspace({ displayName, mobileOpen, language, preview }: { displayName: string; mobileOpen: boolean; language: Language; preview: boolean }) {
  const [activeNav, setActiveNav] = useState("home");
  const [materials, setMaterials] = useState<Material[]>(materialsSeed);
  const [progress, setProgress] = useState<ProgressRecord | null>(null);
  const [groups, setGroups] = useState<StudyGroup[]>([]);
  const [qaItems, setQaItems] = useState<QaThread[]>(qaSeed);
  const [question, setQuestion] = useState("");
  const [cameraOpen, setCameraOpen] = useState(false);
  const [notice, setNotice] = useState("");
  const copy = language === "ja" ? {
    home: "ホーム", library: "ライブラリー", groups: "学習グループ", qa: "質問・先生の回答", groupTitle: "学習グループ", newGroup: "新しいグループ", start: "ここから始めましょう", cards: "単語カード", answers: "質問・先生の回答", jump: "続きから始める", recent: "最近", personalize: "あなた向けの学習", exact: "必要なものを学習", continue: "続ける", create: "単語カードを作成", update: "学習目標を更新する", progress: "42% 完了", monitor: "感情モニター", resumed: "前回の続きから開きます。", openDetail: "詳細を開く", send: "送信", askPlaceholder: "先生に質問する", saved: "保存しました。", offline: "まだSupabaseテーブルが未作成なので画面内だけで反映しています。",
  } : {
    home: "Home", library: "Library", groups: "Study groups", qa: "Q&A history", groupTitle: "Study groups", newGroup: "New group", start: "Start here", cards: "Flashcards", answers: "Questions & teacher answers", jump: "Jump back in", recent: "Recents", personalize: "Personalize your content", exact: "Study exactly what you need", continue: "Continue", create: "Create flashcards", update: "Update your learning goal", progress: "42% complete", monitor: "Emotion monitor", resumed: "Opening your last study activity.", openDetail: "Open detail", send: "Send", askPlaceholder: "Ask your teacher", saved: "Saved.", offline: "Supabase tables are not created yet, so this changed only on the screen.",
  };
  const navItems = [
    ["home", copy.home, <Home key="home" />],
    ["library", copy.library, <Folder key="library" />],
    ["groups", copy.groups, <Users key="groups" />],
  ] as const;
  const currentMaterial = materials[0] || materialsSeed[0];
  const progressText = progress ? `${progress.percent}% ${language === "ja" ? "完了" : "complete"}` : copy.progress;

  useEffect(() => {
    let active = true;
    async function load() {
      const result = await getActiveSupabaseClient();
      if (!active || !result) return;
      const [materialResult, progressResult, groupResult, qaResult] = await Promise.all([
        result.client.from("learning_materials").select("id,title,subject,material_type,duration_minutes,instruction,external_url").eq("is_published", true).order("created_at", { ascending: false }),
        result.client.from("study_progress").select("material_id,status,percent,last_activity_title,last_studied_at").eq("user_id", result.session.user.id).order("last_studied_at", { ascending: false }).limit(1),
        result.client.from("study_groups").select("id,name,description").order("created_at", { ascending: false }),
        result.client.from("qa_threads").select("id,question,teacher_answer,status,created_at").order("created_at", { ascending: false }),
      ]);
      if (!active) return;
      if (!materialResult.error && materialResult.data?.length) setMaterials(materialResult.data.map(dbMaterialToMaterial));
      if (!progressResult.error && progressResult.data?.[0]) setProgress(progressResult.data[0] as ProgressRecord);
      if (!groupResult.error && groupResult.data) setGroups(groupResult.data as StudyGroup[]);
      if (!qaResult.error && qaResult.data?.length) setQaItems(qaResult.data as QaThread[]);
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

  return <main className="quiz-home-shell" aria-label={`${displayName} dashboard`}>
    <aside className={`quiz-home-sidebar ${mobileOpen ? "open" : ""}`}>
      <nav className="quiz-primary-nav" aria-label={copy.home}>{navItems.map(([id, label, icon]) => <button key={id} className={activeNav === id ? "active" : ""} type="button" aria-pressed={activeNav === id} onClick={() => setActiveNav(id)}>{icon}<span>{label}</span></button>)}</nav>
      <section className="quiz-side-section"><h2>{copy.groupTitle}</h2><button type="button" className={groups.length ? "created" : ""} onClick={createGroup}><Plus /><span>{groups.length ? groups[0].name : copy.newGroup}</span></button></section>
      <section className="quiz-side-section"><h2>{copy.start}</h2><button type="button" onClick={() => setActiveNav("library")}><BookOpen /><span>{copy.cards}</span></button></section>
    </aside>

    <div className="quiz-home-feed">
      {notice && <p className="dashboard-message">{notice}</p>}
      {activeNav === "home" && <>
        <section className="quiz-feed-section"><h2>{copy.jump}</h2><article className="quiz-jump-card"><div><span>{currentMaterial.subject.toUpperCase()}</span><h1>{progress?.last_activity_title || currentMaterial.title}</h1><div className="quiz-progress"><i style={{ width: `${progress?.percent || 42}%` }} /></div><p>{progressText}</p><button type="button" onClick={() => markProgress(currentMaterial)}><Play />{copy.continue}</button></div><Image src="/classroom-desk.jpg" width={310} height={226} alt="" unoptimized /></article></section>
        <section className="quiz-feed-section quiz-recents"><h2>{copy.recent}</h2><button type="button" onClick={() => setActiveNav("library")}><span><BookOpen /></span><div><strong>{currentMaterial.title}</strong><small>{currentMaterial.duration} terms · EmoAcademy</small></div></button></section>
        <section className="quiz-feed-section" id="personalize"><h2>{copy.personalize}</h2><article className="quiz-personalize-card"><Sparkles /><h3>{language === "ja" ? "目標に合わせて、次の学習を見つけましょう" : "Find your next study activity based on your goals"}</h3><button type="button">{copy.update}</button></article></section>
      </>}
      {activeNav === "library" && <section className="quiz-feed-section"><h2>{copy.library}</h2><div className="quiz-list-grid">{materials.map((material) => <button key={material.id} type="button" className="quiz-list-card" onClick={() => markProgress(material)}><span><FileText /></span><div><strong>{material.title}</strong><small>{material.subject} · {material.duration} min · {material.type}</small><p>{language === "ja" ? material.descriptionJa : material.descriptionEn}</p></div></button>)}</div><article className="quiz-create-card" id="create-study-set"><div><span><FileText /></span><h3>{language === "ja" ? "自分だけの単語カードを作成" : "Create your own flashcards"}</h3><p>{language === "ja" ? "テストに必要な内容だけを学習できます。" : "Study exactly what is on your test."}</p><button type="button">{copy.create}</button></div><Image src="/classroom-desk.jpg" width={330} height={210} alt="" unoptimized /></article></section>}
      {activeNav === "groups" && <section className="quiz-feed-section"><h2>{copy.groups}</h2>{groups.length ? <div className="quiz-list-grid">{groups.map((group) => <article key={group.id} className="quiz-list-card"><span><Users /></span><div><strong>{group.name}</strong><small>{language === "ja" ? "学習グループ" : "Study group"}</small><p>{group.description || (language === "ja" ? "メンバーの進捗や質問をまとめて確認できます。" : "Collect progress and questions from members in one place.")}</p></div></article>)}</div> : <article className="quiz-personalize-card study-group-card"><Users /><h3>{language === "ja" ? "クラスや友達と同じ学習セットを進める" : "Study the same sets with classmates"}</h3><p>{language === "ja" ? "グループを作ると、メンバーの進捗や質問をまとめて確認できます。" : "Groups collect progress and questions from members in one place."}</p><button type="button" onClick={createGroup}>{copy.newGroup}</button></article>}</section>}
      {activeNav === "qa" && <section className="quiz-feed-section"><h2>{copy.answers}</h2><form className="qa-compose-form" onSubmit={submitQuestion}><textarea value={question} onChange={(event) => setQuestion(event.target.value)} placeholder={copy.askPlaceholder} rows={3} /><button type="submit"><MessageCircle />{copy.send}</button></form><div className="qa-history-list">{qaItems.map((item) => <article key={item.id}><span>Q</span><div><strong>{item.question}</strong><p>{item.teacher_answer ? `${language === "ja" ? "先生の回答" : "Teacher answer"}: ${item.teacher_answer}` : (language === "ja" ? "先生の回答待ちです。" : "Waiting for a teacher answer.")}</p><small>{new Date(item.created_at).toLocaleString(language === "ja" ? "ja-JP" : "en-US")}</small></div></article>)}</div></section>}
    </div>

    <aside className="quiz-emotion-panel">
      {cameraOpen ? <EmotionCamera language={language} autoStart onClose={() => setCameraOpen(false)} /> : <ClosedEmotionMonitor language={language} onOpen={() => setCameraOpen(true)} />}
    </aside>
  </main>;
}

function TeacherWorkspace({ language, preview }: { language: Language; preview: boolean }) {
  const t = ui[language];
  const [materials, setMaterials] = useState<Material[]>(materialsSeed);
  const [questions, setQuestions] = useState<QaThread[]>(qaSeed);
  const [classProgress, setClassProgress] = useState<ProgressRecord[]>([]);
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("English Speaking");
  const [type, setType] = useState<"PDF" | "LINK" | "CARD">("PDF");
  const [duration, setDuration] = useState(15);
  const [url, setUrl] = useState("");
  const [instruction, setInstruction] = useState("");
  const [studentId, setStudentId] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let active = true;
    async function load() {
      const result = await getActiveSupabaseClient();
      if (!active || !result) return;
      const [materialResult, questionResult, progressResult] = await Promise.all([
        result.client.from("learning_materials").select("id,title,subject,material_type,duration_minutes,instruction,external_url").order("created_at", { ascending: false }),
        result.client.from("qa_threads").select("id,question,teacher_answer,status,created_at").order("created_at", { ascending: false }),
        result.client.from("study_progress").select("material_id,status,percent,last_activity_title,last_studied_at").order("last_studied_at", { ascending: false }).limit(6),
      ]);
      if (!active) return;
      if (!materialResult.error && materialResult.data?.length) setMaterials(materialResult.data.map(dbMaterialToMaterial));
      if (!questionResult.error && questionResult.data?.length) setQuestions(questionResult.data as QaThread[]);
      if (!progressResult.error && progressResult.data) setClassProgress(progressResult.data as ProgressRecord[]);
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

  return <main className="teacher-workspace"><header className="teacher-title"><div><span>{t.teacherWorkspace.toUpperCase()}</span><h1>{t.manageTitle}</h1><p>{t.manageText}</p></div><button type="button"><Users />{t.showClass}</button></header>{notice && <p className="teacher-notice">{notice}</p>}<div className="teacher-grid"><section className="teacher-card upload-card"><header><span><Upload /></span><div><small>MATERIALS</small><h2>{t.addMaterial}</h2></div></header><form onSubmit={addMaterial}><div className="teacher-field-grid"><label>{t.title}<input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Unit 2 Conversation" required /></label><label>{t.subject}<input value={subject} onChange={(event) => setSubject(event.target.value)} /></label><label>{t.type}<select value={type} onChange={(event) => setType(event.target.value as "PDF" | "LINK" | "CARD")}><option value="PDF">PDF</option><option value="LINK">Website link</option><option value="CARD">Cards</option></select></label><label>{t.duration}<input type="number" min="1" value={duration} onChange={(event) => setDuration(Number(event.target.value))} /></label></div><label>{t.url}<input type="url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://" /></label><label>{t.instruction}<textarea value={instruction} onChange={(event) => setInstruction(event.target.value)} rows={3} /></label><div className="upload-zone"><FileText /><strong>{t.pdf}</strong><span>{t.max}</span><input type="file" accept="application/pdf" /></div><button type="submit"><Plus />{t.add}</button></form></section>
    <section className="teacher-card material-table"><header><div><small>ASSIGNMENT</small><h2>{t.list}</h2></div><b>{materials.length}</b></header><label className="student-id-field">{t.studentId}<input value={studentId} onChange={(event) => setStudentId(event.target.value)} placeholder="student@example.com" /></label><div>{materials.map((material) => <article key={material.id}><span><FileText /></span><div><strong>{material.title}</strong><small>{material.subject} · {material.duration} min</small></div><em>{material.type}</em><button type="button" onClick={() => setNotice(language === "ja" ? `${material.title} ${t.assignedNotice}` : `${material.title}${t.assignedNotice}`)}>{t.assign}</button></article>)}</div></section>
    <section className="teacher-card student-pulse"><header><div><small>CLASS PULSE</small><h2>{t.classProgress}</h2></div><BarChart3 /></header>{(classProgress.length ? classProgress : [{ last_activity_title: "Greetings & Introductions", percent: 72, status: "in_progress", material_id: null, last_studied_at: new Date().toISOString() }, { last_activity_title: "Conversation Practice", percent: 58, status: "in_progress", material_id: null, last_studied_at: new Date().toISOString() }]).map((progressItem, index) => <article key={`${progressItem.last_activity_title}-${index}`}><span>{index + 1}</span><div><strong>{progressItem.last_activity_title || "Learning activity"}</strong><i><b style={{width:`${progressItem.percent}%`}} /></i></div><em>{progressItem.percent}%</em></article>)}</section><section className="teacher-card teacher-comments"><header><div><small>QUESTIONS</small><h2>{t.recent}</h2></div><MessageCircle /></header>{questions.map((item) => <article key={item.id}><span>Q</span><div><strong>{item.question}</strong><p>{item.teacher_answer || (language === "ja" ? "まだ回答していません。" : "Not answered yet.")}</p><small>{new Date(item.created_at).toLocaleString(language === "ja" ? "ja-JP" : "en-US")}</small>{!item.teacher_answer && <button type="button" onClick={() => answerQuestion(item)}>{t.answer}</button>}{item.teacher_answer && <small>{t.answered}</small>}</div></article>)}</section></div></main>;
}

export function LearningDashboard(props: Props) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [language, setLanguage] = useState<Language>("ja");
  return <div className="lab-shell"><AppHeader {...props} menuOpen={menuOpen} setMenuOpen={setMenuOpen} mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} language={language} setLanguage={setLanguage} />{props.message && <p className="dashboard-message">{props.message}</p>}{props.role === "teacher" ? <TeacherWorkspace language={language} preview={props.preview} /> : <StudentWorkspace displayName={props.displayName} mobileOpen={mobileOpen} language={language} preview={props.preview} />}</div>;
}
