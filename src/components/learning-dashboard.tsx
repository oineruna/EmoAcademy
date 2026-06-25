"use client";

import { FormEvent, useState } from "react";
import Image from "next/image";
import {
  BarChart3, BookOpen, Camera, ChevronDown, FileText, Folder,
  GraduationCap, Home, LogOut, Menu, MessageCircle, Play,
  Plus, Search, Sparkles, Trash2, Upload, Users, X,
} from "lucide-react";
import { EmotionCamera } from "@/components/emotion-camera";

type Language = "ja" | "en";
type Props = { displayName: string; email: string; role: string; preview: boolean; message: string; onLogout: () => void; onDeleteAccount: () => void };
type Material = { id: number; title: string; subject: string; type: "PDF" | "LINK"; duration: number; descriptionJa: string; descriptionEn: string };

const materialsSeed: Material[] = [
  { id: 1, title: "Greetings & Introductions", subject: "English Speaking", type: "PDF", duration: 12, descriptionJa: "基本表現を確認し、短い自己紹介を声に出して練習します。", descriptionEn: "Review key phrases and practise a short introduction aloud." },
  { id: 2, title: "Conversation Practice", subject: "English Speaking", type: "LINK", duration: 18, descriptionJa: "質問と応答を交互に行う会話練習です。", descriptionEn: "Practise a conversation by alternating questions and answers." },
  { id: 3, title: "Unit 1 Review", subject: "English Speaking", type: "PDF", duration: 10, descriptionJa: "Lesson 1の表現を振り返る確認問題です。", descriptionEn: "Check your understanding of the expressions from Lesson 1." },
];

const ui = {
  ja: {
    menu: "メニュー", notice: "通知", student: "学生", teacher: "教師", preview: "プレビューモード", logout: "ログアウト", delete: "アカウント削除",
    courseDescription: "実践的な会話を少しずつ身につけるコース", progress: "進捗", materials: "学習教材", lesson: "レッスン", comments: "コメント",
    resume: "レッスンを再開", assigned: "割り当て教材", open: "開く", estimate: "目安", complete: "完了として記録", next: "次の教材へ",
    questions: "コメント / 質問", commentPlaceholder: "質問やコメントを入力", send: "送信", teacherName: "担当教師",
    teacherComment: "発音よりも、まず会話を止めずに続けることを意識しましょう。", selectSession: "セッション教材", monitor: "感情モニター", liveEmotion: "現在の感情", steady: "安定した集中", steadyNote: "落ち着いて取り組めています", start: "計測を開始", cameraNote: "カメラは開始時のみ使用します", today: "今日のセッション", focusTime: "集中時間 24分 · 中断 1回", latest: "最新の出力", timeline: "Arousal / Valence タイムライン",
    teacherWorkspace: "教師ワークスペース", manageTitle: "教材と学習状況", manageText: "教材の追加・編集・割り当てと、学生からの質問を管理します。", showClass: "クラスを表示", addMaterial: "教材を追加", title: "タイトル", subject: "科目", type: "教材種別", duration: "所要時間（分）", url: "外部URL", instruction: "学習指示", pdf: "PDFを選択", max: "最大20MB", add: "教材を追加", list: "教材一覧", assign: "割り当て", studentId: "学生ID", classProgress: "学生の進捗", recent: "最近のコメント", added: "教材を追加しました。Supabase Storage接続後はファイルも保存できます。", assignedNotice: "を学生へ割り当てました。",
  },
  en: {
    menu: "Menu", notice: "Notifications", student: "Student", teacher: "Teacher", preview: "Preview mode", logout: "Log out", delete: "Delete account",
    courseDescription: "Build practical conversation skills step by step.", progress: "Progress", materials: "Learning materials", lesson: "Lesson", comments: "Comments",
    resume: "Resume lesson", assigned: "Assigned material", open: "Open", estimate: "About", complete: "Mark complete", next: "Next material",
    questions: "Comments / Questions", commentPlaceholder: "Write a question or comment", send: "Send", teacherName: "Teacher",
    teacherComment: "Focus on keeping the conversation going before worrying about pronunciation.", selectSession: "Session material", monitor: "Emotion monitor", liveEmotion: "Live emotion", steady: "Steady focus", steadyNote: "You are working at a calm, steady pace.", start: "Start monitoring", cameraNote: "The camera is only used after you start it.", today: "Today’s session", focusTime: "24 min focused · 1 interruption", latest: "Latest output", timeline: "Arousal / Valence timeline",
    teacherWorkspace: "Teacher workspace", manageTitle: "Materials and learning activity", manageText: "Add, edit and assign materials, and respond to student questions.", showClass: "View class", addMaterial: "Add material", title: "Title", subject: "Subject", type: "Material type", duration: "Duration (min)", url: "External URL", instruction: "Instruction", pdf: "Choose PDF", max: "Up to 20 MB", add: "Add material", list: "Materials", assign: "Assign", studentId: "Student ID", classProgress: "Student progress", recent: "Recent comments", added: "Material added. Files can be stored after connecting Supabase Storage.", assignedNotice: " was assigned to a student.",
  },
} as const;

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

function StudentWorkspace({ displayName, mobileOpen, language }: { displayName: string; mobileOpen: boolean; language: Language }) {
  const t = ui[language];
  const [activeNav, setActiveNav] = useState("home");
  const [groupCreated, setGroupCreated] = useState(false);
  const [cameraOpen, setCameraOpen] = useState(false);
  const [resumeNotice, setResumeNotice] = useState("");
  const copy = language === "ja" ? {
    home: "ホーム", library: "ライブラリー", groups: "学習グループ", qa: "質問・先生の回答", groupTitle: "学習グループ", newGroup: "新しいグループ", start: "ここから始めましょう", cards: "単語カード", answers: "質問・先生の回答", jump: "続きから始める", recent: "最近", personalize: "あなた向けの学習", exact: "必要なものを学習", continue: "続ける", create: "単語カードを作成", update: "学習目標を更新する", progress: "42% 完了", monitor: "感情モニター", resumed: "前回の続きから開きます。", openDetail: "詳細を開く", closeDetail: "閉じる",
  } : {
    home: "Home", library: "Library", groups: "Study groups", qa: "Q&A history", groupTitle: "Study groups", newGroup: "New group", start: "Start here", cards: "Flashcards", answers: "Questions & teacher answers", jump: "Jump back in", recent: "Recents", personalize: "Personalize your content", exact: "Study exactly what you need", continue: "Continue", create: "Create flashcards", update: "Update your learning goal", progress: "42% complete", monitor: "Emotion monitor", resumed: "Opening your last study activity.", openDetail: "Open detail", closeDetail: "Close",
  };
  const navItems = [
    ["home", copy.home, <Home key="home" />],
    ["library", copy.library, <Folder key="library" />],
    ["groups", copy.groups, <Users key="groups" />],
    ["qa", copy.qa, <MessageCircle key="qa" />],
  ] as const;

  return <main className="quiz-home-shell" aria-label={`${displayName} dashboard`}>
    <aside className={`quiz-home-sidebar ${mobileOpen ? "open" : ""}`}>
      <nav className="quiz-primary-nav" aria-label={copy.home}>{navItems.map(([id, label, icon]) => <button key={id} className={activeNav === id ? "active" : ""} type="button" aria-pressed={activeNav === id} onClick={() => setActiveNav(id)}>{icon}<span>{label}</span></button>)}</nav>
      <section className="quiz-side-section"><h2>{copy.groupTitle}</h2><button type="button" className={groupCreated ? "created" : ""} onClick={() => setGroupCreated(true)}><Plus /><span>{groupCreated ? `${copy.newGroup} 1` : copy.newGroup}</span></button></section>
      <section className="quiz-side-section"><h2>{copy.start}</h2><button type="button" onClick={() => setActiveNav("library")}><BookOpen /><span>{copy.cards}</span></button><button type="button" onClick={() => setActiveNav("qa")}><GraduationCap /><span>{copy.answers}</span></button></section>
    </aside>

    <div className="quiz-home-feed">
      {activeNav === "home" && <>
        <section className="quiz-feed-section"><h2>{copy.jump}</h2><article className="quiz-jump-card"><div><span>ENGLISH SPEAKING</span><h1>Greetings &amp; Introductions</h1><div className="quiz-progress"><i /></div><p>{resumeNotice || copy.progress}</p><button type="button" onClick={() => setResumeNotice(copy.resumed)}><Play />{copy.continue}</button></div><Image src="/classroom-desk.jpg" width={310} height={226} alt="" unoptimized /></article></section>
        <section className="quiz-feed-section quiz-recents"><h2>{copy.recent}</h2><button type="button" onClick={() => setActiveNav("library")}><span><BookOpen /></span><div><strong>Greetings &amp; Introductions</strong><small>12 terms · EmoAcademy</small></div></button></section>
        <section className="quiz-feed-section" id="personalize"><h2>{copy.personalize}</h2><article className="quiz-personalize-card"><Sparkles /><h3>{language === "ja" ? "目標に合わせて、次の学習を見つけましょう" : "Find your next study activity based on your goals"}</h3><button type="button">{copy.update}</button></article></section>
      </>}
      {activeNav === "library" && <section className="quiz-feed-section"><h2>{copy.library}</h2><div className="quiz-list-grid">{materialsSeed.map((material) => <button key={material.id} type="button" className="quiz-list-card" onClick={() => setResumeNotice(copy.resumed)}><span><FileText /></span><div><strong>{material.title}</strong><small>{material.subject} · {material.duration} min · {material.type}</small><p>{language === "ja" ? material.descriptionJa : material.descriptionEn}</p></div></button>)}</div><article className="quiz-create-card" id="create-study-set"><div><span><FileText /></span><h3>{language === "ja" ? "自分だけの単語カードを作成" : "Create your own flashcards"}</h3><p>{language === "ja" ? "テストに必要な内容だけを学習できます。" : "Study exactly what is on your test."}</p><button type="button">{copy.create}</button></div><Image src="/classroom-desk.jpg" width={330} height={210} alt="" unoptimized /></article></section>}
      {activeNav === "groups" && <section className="quiz-feed-section"><h2>{copy.groups}</h2><article className="quiz-personalize-card study-group-card"><Users /><h3>{groupCreated ? (language === "ja" ? "新しいグループ 1" : "New group 1") : (language === "ja" ? "クラスや友達と同じ学習セットを進める" : "Study the same sets with classmates")}</h3><p>{language === "ja" ? "グループを作ると、メンバーの進捗や質問をまとめて確認できます。" : "Groups collect progress and questions from members in one place."}</p><button type="button" onClick={() => setGroupCreated(true)}>{copy.newGroup}</button></article></section>}
      {activeNav === "qa" && <section className="quiz-feed-section"><h2>{copy.answers}</h2><div className="qa-history-list"><article><span>Q</span><div><strong>{language === "ja" ? "自己紹介の最後の一文を確認したい" : "Could you check the final sentence of my introduction?"}</strong><p>{language === "ja" ? "先生の回答: “Nice to meet you.” の後に、好きなことを1文足すと自然です。" : "Teacher answer: After “Nice to meet you,” add one sentence about something you like."}</p><small>Greetings &amp; Introductions · 12 min ago</small></div></article><article><span>Q</span><div><strong>{language === "ja" ? "発音より先に意識することは？" : "What should I focus on before pronunciation?"}</strong><p>{language === "ja" ? "先生の回答: まず会話を止めずに続けること。短い返答でもOKです。" : "Teacher answer: Keep the conversation going first. Short replies are fine."}</p><small>Conversation Practice · yesterday</small></div></article></div></section>}
    </div>

    <aside className="quiz-emotion-panel">
      {cameraOpen ? <EmotionCamera language={language} onClose={() => setCameraOpen(false)} /> : <section className="live-monitor-card"><header><div><i /><span>{copy.monitor.toUpperCase()}</span></div><button type="button" onClick={() => setCameraOpen(true)}><Camera />{copy.openDetail}</button></header><div className="monitor-preview"><Camera /><p>{t.liveEmotion}</p><button type="button" onClick={() => setCameraOpen(true)}>{t.start}</button></div><div className="monitor-reading"><div className="emotion-ring-small">52%</div><div><small>{t.liveEmotion.toUpperCase()}</small><strong>Neutral</strong><span>{t.steadyNote}</span></div></div><div className="emotion-breakdown">{emotions.map(([name, value]) => <div key={name}><span>{name}</span><i><b style={{ width: `${value}%` }} /></i><strong>{value}%</strong></div>)}</div><div className="monitor-latest"><small>{t.latest}</small><strong>{t.steady}</strong><span>Valence +0.18 · Arousal 0.46</span></div></section>}
    </aside>
  </main>;
}

function TeacherWorkspace({ language }: { language: Language }) {
  const t = ui[language];
  const [materials, setMaterials] = useState(materialsSeed);
  const [title, setTitle] = useState(""); const [subject, setSubject] = useState("English Speaking"); const [type, setType] = useState<"PDF" | "LINK">("PDF"); const [duration, setDuration] = useState(15); const [url, setUrl] = useState(""); const [instruction, setInstruction] = useState(""); const [studentId, setStudentId] = useState(""); const [notice, setNotice] = useState("");
  function addMaterial(event: FormEvent) { event.preventDefault(); if (!title.trim()) return; setMaterials((items) => [...items, { id: Date.now(), title: title.trim(), subject, type, duration, descriptionJa: instruction || "新しく追加された教材です。", descriptionEn: instruction || "Newly added material." }]); setTitle(""); setInstruction(""); setNotice(t.added); }
  return <main className="teacher-workspace"><header className="teacher-title"><div><span>{t.teacherWorkspace.toUpperCase()}</span><h1>{t.manageTitle}</h1><p>{t.manageText}</p></div><button type="button"><Users />{t.showClass}</button></header>{notice && <p className="teacher-notice">{notice}</p>}<div className="teacher-grid"><section className="teacher-card upload-card"><header><span><Upload /></span><div><small>MATERIALS</small><h2>{t.addMaterial}</h2></div></header><form onSubmit={addMaterial}><div className="teacher-field-grid"><label>{t.title}<input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="Unit 2 Conversation" required /></label><label>{t.subject}<input value={subject} onChange={(event) => setSubject(event.target.value)} /></label><label>{t.type}<select value={type} onChange={(event) => setType(event.target.value as "PDF" | "LINK")}><option value="PDF">PDF</option><option value="LINK">Website link</option></select></label><label>{t.duration}<input type="number" min="1" value={duration} onChange={(event) => setDuration(Number(event.target.value))} /></label></div><label>{t.url}<input type="url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://" /></label><label>{t.instruction}<textarea value={instruction} onChange={(event) => setInstruction(event.target.value)} rows={3} /></label><div className="upload-zone"><FileText /><strong>{t.pdf}</strong><span>{t.max}</span><input type="file" accept="application/pdf" /></div><button type="submit"><Plus />{t.add}</button></form></section>
    <section className="teacher-card material-table"><header><div><small>ASSIGNMENT</small><h2>{t.list}</h2></div><b>{materials.length}</b></header><label className="student-id-field">{t.studentId}<input value={studentId} onChange={(event) => setStudentId(event.target.value)} placeholder="student@example.com" /></label><div>{materials.map((material) => <article key={material.id}><span><FileText /></span><div><strong>{material.title}</strong><small>{material.subject} · {material.duration} min</small></div><em>{material.type}</em><button type="button" onClick={() => setNotice(language === "ja" ? `${material.title} ${t.assignedNotice}` : `${material.title}${t.assignedNotice}`)}>{t.assign}</button></article>)}</div></section>
    <section className="teacher-card student-pulse"><header><div><small>CLASS PULSE</small><h2>{t.classProgress}</h2></div><BarChart3 /></header>{[{name:"山田 花子",value:72},{name:"佐藤 海斗",value:58},{name:"田中 美咲",value:84}].map((student) => <article key={student.name}><span>{student.name.slice(0,1)}</span><div><strong>{student.name}</strong><i><b style={{width:`${student.value}%`}} /></i></div><em>{student.value}%</em></article>)}</section><section className="teacher-card teacher-comments"><header><div><small>QUESTIONS</small><h2>{t.recent}</h2></div><MessageCircle /></header><article><span>山</span><div><strong>山田 花子</strong><p>{language === "ja" ? "自己紹介の最後の一文をもう一度確認したいです。" : "Could you check the final sentence of my introduction?"}</p><small>Greetings &amp; Introductions · 12 min</small></div></article><article><span>佐</span><div><strong>佐藤 海斗</strong><p>{language === "ja" ? "会話練習を完了しました。" : "I completed the conversation practice."}</p><small>Conversation Practice · 28 min</small></div></article></section></div></main>;
}

export function LearningDashboard(props: Props) {
  const [menuOpen, setMenuOpen] = useState(false); const [mobileOpen, setMobileOpen] = useState(false); const [language, setLanguage] = useState<Language>("ja");
  return <div className="lab-shell"><AppHeader {...props} menuOpen={menuOpen} setMenuOpen={setMenuOpen} mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} language={language} setLanguage={setLanguage} />{props.message && <p className="dashboard-message">{props.message}</p>}{props.role === "teacher" ? <TeacherWorkspace language={language} /> : <StudentWorkspace displayName={props.displayName} mobileOpen={mobileOpen} language={language} />}</div>;
}
