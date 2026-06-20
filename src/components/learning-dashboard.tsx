"use client";

import { FormEvent, useState } from "react";
import Image from "next/image";
import {
  BarChart3, Bell, BookOpen, Camera, CheckCircle2, ChevronDown, Clock3,
  ExternalLink, FileText, Library, LogOut, Menu, MessageCircle, Play,
  Plus, Trash2, Upload, Users, X,
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
  return <header className="lab-header">
    <div className="lab-header-brand"><button className="lab-mobile-menu" type="button" aria-label={t.menu} onClick={() => setMobileOpen(!mobileOpen)}>{mobileOpen ? <X /> : <Menu />}</button><a href="/dashboard"><Image src="/emoacademy-mark.png" width={38} height={38} alt="" unoptimized /><span><strong>EmoAcademy</strong><small>Learn · Practice · Improve</small></span></a></div>
    <div className="lab-header-actions"><LanguageSwitch language={language} setLanguage={setLanguage} /><button className="lab-icon-button" type="button" aria-label={t.notice}><Bell /><i /></button><div className="lab-profile-wrap"><button className="lab-profile" type="button" aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}><span>{displayName.slice(0, 1).toUpperCase()}</span><div><strong>{displayName}</strong><small>{role === "teacher" ? t.teacher : t.student}</small></div><ChevronDown /></button>{menuOpen && <div className="lab-profile-menu"><p>{email}</p>{preview && <small>{t.preview}</small>}<button type="button" onClick={onLogout}><LogOut />{t.logout}</button><button className="danger" type="button" onClick={onDeleteAccount}><Trash2 />{t.delete}</button></div>}</div></div>
  </header>;
}

const emotions = [
  ["Anger", 4], ["Contempt", 2], ["Disgust", 3], ["Fear", 6],
  ["Happiness", 18], ["Neutral", 52], ["Sadness", 5], ["Surprise", 10],
] as const;

function StudentWorkspace({ displayName, onOpenCamera, mobileOpen, language }: { displayName: string; onOpenCamera: () => void; mobileOpen: boolean; language: Language }) {
  const t = ui[language];
  const [materials] = useState(materialsSeed);
  const [selectedId, setSelectedId] = useState(1);
  const [completed, setCompleted] = useState<number[]>([]);
  const [comments, setComments] = useState<Array<{ name: string; text: string; time: string }>>([]);
  const [comment, setComment] = useState("");
  const selected = materials.find((material) => material.id === selectedId) ?? materials[0];
  const description = language === "ja" ? selected.descriptionJa : selected.descriptionEn;

  function submitComment(event: FormEvent) { event.preventDefault(); const value = comment.trim(); if (!value) return; setComments((items) => [...items, { name: displayName, text: value, time: new Date().toLocaleTimeString(language === "ja" ? "ja-JP" : "en-US", { hour: "2-digit", minute: "2-digit" }) }]); setComment(""); }
  function goNext() { const index = materials.findIndex((item) => item.id === selectedId); setSelectedId(materials[(index + 1) % materials.length].id); }

  return <main className="student-workspace">
    <aside className={`course-sidebar ${mobileOpen ? "open" : ""}`}><section className="course-summary"><p>COURSE</p><h2>English Speaking</h2><span>{t.courseDescription}</span><div className="course-progress"><i /></div><footer><span>{t.progress}</span><strong>42%</strong></footer></section><section className="side-section"><header><span>{t.materials.toUpperCase()}</span><b>{materials.length}</b></header><div className="material-nav">{materials.map((material) => <button key={material.id} className={selectedId === material.id ? "active" : ""} type="button" aria-pressed={selectedId === material.id} onClick={() => setSelectedId(material.id)}><span>{completed.includes(material.id) ? <CheckCircle2 /> : <FileText />}</span><div><strong>{material.title}</strong><small>{material.type} · {material.duration} min</small></div></button>)}</div></section><nav className="course-links" aria-label={t.materials}><a className="active" href="#lesson"><BookOpen />{t.lesson}</a><a href="#materials"><Library />{t.materials}</a><a href="#comments"><MessageCircle />{t.comments}</a></nav></aside>
    <div className="lesson-column"><section className="lesson-overview" id="lesson"><div className="lesson-path">English Speaking Course / Unit 1 / Lesson 1</div><div className="lesson-title-row"><div><span>BEGINNER</span><h1>English Speaking Practice</h1><p>Topic: Greetings &amp; Introductions</p></div><button type="button"><Play />{t.resume}</button></div><div className="lesson-progress-head"><span>Lesson progress</span><strong>65% Complete</strong></div><div className="lesson-progress-bar"><i /></div></section>
      <section className="learning-card" id="materials"><header><div><span>LEARNING CONTENT</span><h2>{t.assigned}</h2></div><button type="button"><ExternalLink />{t.open}</button></header><label className="material-select-label"><span>{t.materials}</span><select value={selectedId} onChange={(event) => setSelectedId(Number(event.target.value))}>{materials.map((material) => <option key={material.id} value={material.id}>{material.title}</option>)}</select></label><div className="selected-material"><span><FileText /></span><div><small>{selected.subject}</small><h3>{selected.title}</h3><p>{description}</p><footer><Clock3 />{t.estimate} {selected.duration} min <b>{selected.type}</b></footer></div></div><div className="material-actions"><button className={completed.includes(selected.id) ? "selected" : ""} type="button" aria-pressed={completed.includes(selected.id)} onClick={() => setCompleted((items) => items.includes(selected.id) ? items.filter((id) => id !== selected.id) : [...items, selected.id])}><CheckCircle2 />{t.complete}</button><button type="button" onClick={goNext}>{t.next}</button></div></section>
      <section className="learning-card comments-card" id="comments"><header><div><span>INTERACTION</span><h2>{t.questions}</h2></div><b>{comments.length + 1}</b></header><div className="comment-list"><article><span>{t.teacherName.slice(0, 1)}</span><div><header><strong>{t.teacherName}</strong><time>10:24</time></header><p>{t.teacherComment}</p></div></article>{comments.map((item, index) => <article key={`${item.time}-${index}`}><span>{item.name.slice(0, 1)}</span><div><header><strong>{item.name}</strong><time>{item.time}</time></header><p>{item.text}</p></div></article>)}</div><form onSubmit={submitComment}><textarea value={comment} onChange={(event) => setComment(event.target.value)} placeholder={t.commentPlaceholder} rows={3} maxLength={1000} /><button type="submit">{t.send}</button></form></section>
    </div>
    <aside className="monitor-column"><section className="live-monitor-card"><header><div><i /><span>{t.monitor.toUpperCase()}</span></div><button type="button" onClick={onOpenCamera}><Camera />{t.open}</button></header><div className="session-material"><label>{t.selectSession}</label><select value={selectedId} onChange={(event) => setSelectedId(Number(event.target.value))}>{materials.map((material) => <option key={material.id} value={material.id}>{material.title}</option>)}</select></div><div className="monitor-preview"><Camera /><p>{t.liveEmotion}</p><span>{t.cameraNote}</span><button type="button" onClick={onOpenCamera}>{t.start}</button></div><div className="monitor-reading"><div className="emotion-ring-small">52%</div><div><small>{t.liveEmotion.toUpperCase()}</small><strong>Neutral</strong><span>{t.steadyNote}</span></div></div><div className="emotion-breakdown">{emotions.map(([name, value]) => <div key={name}><span>{name}</span><i><b style={{ width: `${value}%` }} /></i><strong>{value}%</strong></div>)}</div><div className="monitor-latest"><small>{t.latest}</small><strong>{t.steady}</strong><span>Valence +0.18 · Arousal 0.46</span></div><div className="mini-timeline"><span>{t.timeline}</span><svg viewBox="0 0 240 50" role="img" aria-label={t.timeline}><path d="M2 35 C30 29, 48 39, 71 25 S112 16, 137 27 S178 37, 199 20 S225 23, 238 13" /><line x1="0" y1="25" x2="240" y2="25" /></svg></div></section><section className="session-note"><BarChart3 /><div><strong>{t.today}</strong><p>{t.focusTime}</p></div></section></aside>
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
  const [cameraOpen, setCameraOpen] = useState(false); const [menuOpen, setMenuOpen] = useState(false); const [mobileOpen, setMobileOpen] = useState(false); const [language, setLanguage] = useState<Language>("ja");
  return <div className="lab-shell"><AppHeader {...props} menuOpen={menuOpen} setMenuOpen={setMenuOpen} mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} language={language} setLanguage={setLanguage} />{props.message && <p className="dashboard-message">{props.message}</p>}{props.role === "teacher" ? <TeacherWorkspace language={language} /> : <StudentWorkspace displayName={props.displayName} onOpenCamera={() => setCameraOpen(true)} mobileOpen={mobileOpen} language={language} />}{cameraOpen && <EmotionCamera onClose={() => setCameraOpen(false)} />}</div>;
}
