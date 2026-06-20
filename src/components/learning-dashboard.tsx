"use client";

import { FormEvent, useState } from "react";
import Image from "next/image";
import {
  BarChart3,
  Bell,
  BookOpen,
  Camera,
  CheckCircle2,
  ChevronDown,
  Clock3,
  ExternalLink,
  FileText,
  Library,
  LogOut,
  Menu,
  MessageCircle,
  Play,
  Plus,
  Trash2,
  Upload,
  Users,
  X,
} from "lucide-react";
import { EmotionCamera } from "@/components/emotion-camera";

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
  id: number;
  title: string;
  subject: string;
  type: "PDF" | "LINK";
  duration: number;
  description: string;
};

const initialMaterials: Material[] = [
  { id: 1, title: "Greetings & Introductions", subject: "English Speaking", type: "PDF", duration: 12, description: "基本表現を確認し、短い自己紹介を声に出して練習します。" },
  { id: 2, title: "Conversation Practice", subject: "English Speaking", type: "LINK", duration: 18, description: "質問と応答を交互に行う会話練習です。" },
  { id: 3, title: "Unit 1 Review", subject: "English Speaking", type: "PDF", duration: 10, description: "Lesson 1の表現を振り返る確認問題です。" },
];

function AppHeader({ displayName, email, role, preview, menuOpen, setMenuOpen, mobileOpen, setMobileOpen, onLogout, onDeleteAccount }: Props & {
  menuOpen: boolean;
  setMenuOpen: (value: boolean) => void;
  mobileOpen: boolean;
  setMobileOpen: (value: boolean) => void;
}) {
  return (
    <header className="lab-header">
      <div className="lab-header-brand">
        <button className="lab-mobile-menu" type="button" aria-label="メニュー" onClick={() => setMobileOpen(!mobileOpen)}>{mobileOpen ? <X /> : <Menu />}</button>
        <a href="/dashboard"><Image src="/emoacademy-mark.png" width={38} height={38} alt="" unoptimized /><span><strong>EmoAcademy</strong><small>Learn · Practice · Improve</small></span></a>
      </div>
      <div className="lab-header-actions">
        <button className="lab-icon-button" type="button" aria-label="通知"><Bell /><i /></button>
        <div className="lab-profile-wrap">
          <button className="lab-profile" type="button" aria-expanded={menuOpen} onClick={() => setMenuOpen(!menuOpen)}>
            <span>{displayName.slice(0, 1).toUpperCase()}</span><div><strong>{displayName}</strong><small>{role === "teacher" ? "教師" : "学生"}</small></div><ChevronDown />
          </button>
          {menuOpen && <div className="lab-profile-menu"><p>{email}</p>{preview && <small>プレビューモード</small>}<button type="button" onClick={onLogout}><LogOut />ログアウト</button><button className="danger" type="button" onClick={onDeleteAccount}><Trash2 />アカウント削除</button></div>}
        </div>
      </div>
    </header>
  );
}

function StudentWorkspace({ displayName, onOpenCamera, mobileOpen }: { displayName: string; onOpenCamera: () => void; mobileOpen: boolean }) {
  const [materials] = useState(initialMaterials);
  const [selectedId, setSelectedId] = useState(1);
  const [comments, setComments] = useState([{ name: "担当教師", text: "発音よりも、まず会話を止めずに続けることを意識しましょう。", time: "10:24" }]);
  const [comment, setComment] = useState("");
  const selected = materials.find((material) => material.id === selectedId) ?? materials[0];

  function submitComment(event: FormEvent) {
    event.preventDefault();
    const value = comment.trim();
    if (!value) return;
    setComments((items) => [...items, { name: displayName, text: value, time: new Date().toLocaleTimeString("ja-JP", { hour: "2-digit", minute: "2-digit" }) }]);
    setComment("");
  }

  return (
    <main className="student-workspace">
      <aside className={`course-sidebar ${mobileOpen ? "open" : ""}`}>
        <section className="course-summary">
          <p>COURSE</p><h2>English Speaking</h2><span>実践的な会話を少しずつ身につけるコース</span>
          <div className="course-progress"><i /></div><footer><span>進捗</span><strong>42%</strong></footer>
        </section>
        <section className="side-section">
          <header><span>LEARNING MATERIALS</span><b>{materials.length}</b></header>
          <div className="material-nav">{materials.map((material) => <button key={material.id} className={selectedId === material.id ? "active" : ""} type="button" onClick={() => setSelectedId(material.id)}><span><FileText /></span><div><strong>{material.title}</strong><small>{material.type} · {material.duration}分</small></div></button>)}</div>
        </section>
        <nav className="course-links" aria-label="学習セクション"><a className="active" href="#lesson"><BookOpen />レッスン</a><a href="#materials"><Library />教材</a><a href="#comments"><MessageCircle />コメント</a></nav>
      </aside>

      <div className="lesson-column">
        <section className="lesson-overview" id="lesson">
          <div className="lesson-path">English Speaking / Unit 1 / Lesson 1</div>
          <div className="lesson-title-row"><div><span>BEGINNER</span><h1>English Speaking Practice</h1><p>Topic: Greetings &amp; Introductions</p></div><button type="button"><Play />レッスンを再開</button></div>
          <div className="lesson-progress-head"><span>Lesson progress</span><strong>65% Complete</strong></div><div className="lesson-progress-bar"><i /></div>
        </section>

        <section className="learning-card" id="materials">
          <header><div><span>LEARNING CONTENT</span><h2>Assigned Material</h2></div><button type="button"><ExternalLink />開く</button></header>
          <div className="selected-material"><span><FileText /></span><div><small>{selected.subject}</small><h3>{selected.title}</h3><p>{selected.description}</p><footer><Clock3 />目安 {selected.duration}分 <b>{selected.type}</b></footer></div></div>
          <div className="material-actions"><button type="button"><CheckCircle2 />完了として記録</button><button type="button" onClick={() => setSelectedId(materials[Math.min(materials.length - 1, materials.findIndex((item) => item.id === selectedId) + 1)].id)}>次の教材へ</button></div>
        </section>

        <section className="learning-card comments-card" id="comments">
          <header><div><span>INTERACTION</span><h2>Comments / Questions</h2></div><b>{comments.length}</b></header>
          <div className="comment-list">{comments.map((item, index) => <article key={`${item.time}-${index}`}><span>{item.name.slice(0, 1)}</span><div><header><strong>{item.name}</strong><time>{item.time}</time></header><p>{item.text}</p></div></article>)}</div>
          <form onSubmit={submitComment}><textarea value={comment} onChange={(event) => setComment(event.target.value)} placeholder="質問やコメントを入力" rows={3} maxLength={1000} /><button type="submit">送信</button></form>
        </section>
      </div>

      <aside className="monitor-column">
        <section className="live-monitor-card">
          <header><div><i /><span>LIVE MONITOR</span></div><button type="button" onClick={onOpenCamera}><Camera />開く</button></header>
          <div className="monitor-preview"><Camera /><p>学習中の表情シグナル</p><span>カメラは開始時のみ使用します</span><button type="button" onClick={onOpenCamera}>計測を開始</button></div>
          <div className="monitor-reading"><div className="emotion-ring-small">68%</div><div><small>CURRENT STATE</small><strong>Steady focus</strong><span>落ち着いて取り組めています</span></div></div>
          <div className="monitor-metrics"><div><span>Valence</span><strong>+0.18</strong></div><div><span>Arousal</span><strong>0.46</strong></div></div>
        </section>
        <section className="session-note"><BarChart3 /><div><strong>今日のセッション</strong><p>集中時間 24分 · 中断 1回</p></div></section>
      </aside>
    </main>
  );
}

function TeacherWorkspace() {
  const [materials, setMaterials] = useState(initialMaterials);
  const [title, setTitle] = useState("");
  const [subject, setSubject] = useState("English Speaking");
  const [notice, setNotice] = useState("");

  function addMaterial(event: FormEvent) {
    event.preventDefault();
    if (!title.trim()) return;
    setMaterials((items) => [...items, { id: Date.now(), title: title.trim(), subject, type: "PDF", duration: 15, description: "新しく追加された教材です。" }]);
    setTitle("");
    setNotice("教材を追加しました。Supabase Storage接続後はファイルも保存できます。");
  }

  return (
    <main className="teacher-workspace">
      <header className="teacher-title"><div><span>TEACHER WORKSPACE</span><h1>教材と学習状況</h1><p>教材の追加、割り当て、学生からの質問を一つの画面で管理します。</p></div><button type="button"><Users />クラスを表示</button></header>
      {notice && <p className="teacher-notice">{notice}</p>}
      <div className="teacher-grid">
        <section className="teacher-card upload-card"><header><span><Upload /></span><div><small>MATERIALS</small><h2>教材を追加</h2></div></header><form onSubmit={addMaterial}><label>タイトル<input value={title} onChange={(event) => setTitle(event.target.value)} placeholder="例：Unit 2 Conversation" required /></label><label>科目<input value={subject} onChange={(event) => setSubject(event.target.value)} /></label><div className="upload-zone"><FileText /><strong>PDFを選択</strong><span>最大20MB</span><input type="file" accept="application/pdf" /></div><button type="submit"><Plus />教材を追加</button></form></section>
        <section className="teacher-card material-table"><header><div><small>ASSIGNMENT</small><h2>教材一覧</h2></div><b>{materials.length}件</b></header><div>{materials.map((material) => <article key={material.id}><span><FileText /></span><div><strong>{material.title}</strong><small>{material.subject} · {material.duration}分</small></div><em>{material.type}</em><button type="button" onClick={() => setNotice(`${material.title} を学生へ割り当てました。`)}>割り当て</button></article>)}</div></section>
        <section className="teacher-card student-pulse"><header><div><small>CLASS PULSE</small><h2>学生の進捗</h2></div><BarChart3 /></header>{[{name:"山田 花子",value:72},{name:"佐藤 海斗",value:58},{name:"田中 美咲",value:84}].map((student) => <article key={student.name}><span>{student.name.slice(0,1)}</span><div><strong>{student.name}</strong><i><b style={{width:`${student.value}%`}} /></i></div><em>{student.value}%</em></article>)}</section>
        <section className="teacher-card teacher-comments"><header><div><small>QUESTIONS</small><h2>最近のコメント</h2></div><MessageCircle /></header><article><span>山</span><div><strong>山田 花子</strong><p>自己紹介の最後の一文をもう一度確認したいです。</p><small>Greetings &amp; Introductions · 12分前</small></div></article><article><span>佐</span><div><strong>佐藤 海斗</strong><p>会話練習を完了しました。</p><small>Conversation Practice · 28分前</small></div></article></section>
      </div>
    </main>
  );
}

export function LearningDashboard(props: Props) {
  const [cameraOpen, setCameraOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const isTeacher = props.role === "teacher";

  return (
    <div className="lab-shell">
      <AppHeader {...props} menuOpen={menuOpen} setMenuOpen={setMenuOpen} mobileOpen={mobileOpen} setMobileOpen={setMobileOpen} />
      {props.message && <p className="dashboard-message">{props.message}</p>}
      {isTeacher ? <TeacherWorkspace /> : <StudentWorkspace displayName={props.displayName} onOpenCamera={() => setCameraOpen(true)} mobileOpen={mobileOpen} />}
      {cameraOpen && <EmotionCamera onClose={() => setCameraOpen(false)} />}
    </div>
  );
}
