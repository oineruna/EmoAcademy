"use client";

import { useState } from "react";
import Image from "next/image";
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

const subjects = [
  { name: "数学", detail: "二次方程式", progress: 68, tone: "blue" },
  { name: "英語", detail: "Speaking practice", progress: 52, tone: "mint" },
  { name: "科学", detail: "力と運動", progress: 81, tone: "amber" },
];

export function LearningDashboard({ displayName, email, role, preview, message, onLogout, onDeleteAccount }: Props) {
  const [cameraOpen, setCameraOpen] = useState(false);
  const [activeStep, setActiveStep] = useState(1);
  const [menuOpen, setMenuOpen] = useState(false);
  const isTeacher = role === "teacher";

  return (
    <div className="learn-shell">
      <aside className="learn-sidebar">
        <a className="learn-brand" href="/dashboard"><Image src="/emoacademy-mark.png" width={34} height={34} alt="" unoptimized /><strong>EmoAcademy</strong></a>
        <nav aria-label="メインナビゲーション">
          <a className="active" href="#today"><span>⌂</span>今日の学習</a>
          <a href="#subjects"><span>▦</span>{isTeacher ? "クラス" : "科目"}</a>
          <a href="#progress"><span>↗</span>進捗</a>
          <a href="#plan"><span>◷</span>学習プラン</a>
        </nav>
        <div className="sidebar-focus">
          <span>WEEKLY FOCUS</span><strong>4日連続</strong><p>あと1日で今週の目標達成</p><div><i /></div>
        </div>
        <button className="sidebar-camera" type="button" onClick={() => setCameraOpen(true)}><span>◎</span><div><strong>Emotion check-in</strong><small>集中状態を確認</small></div></button>
      </aside>

      <div className="learn-content">
        <header className="learn-header">
          <div><p>2026年6月20日 土曜日</p><h1>こんにちは、{displayName}</h1></div>
          <div className="header-actions"><button aria-label="通知" type="button">●<em>1</em></button><button className="profile-button" type="button" onClick={() => setMenuOpen((v) => !v)}><span>{displayName.slice(0, 1).toUpperCase()}</span><div><strong>{displayName}</strong><small>{isTeacher ? "教師" : "学生"}</small></div><b>⌄</b></button></div>
          {menuOpen && <div className="profile-menu"><p>{email}</p>{preview && <small>プレビューモード</small>}<button type="button" onClick={onLogout}>ログアウト</button><button className="danger-text" type="button" onClick={onDeleteAccount}>アカウント削除</button></div>}
        </header>
        {message && <p className="dashboard-message">{message}</p>}

        <main className="learning-main" id="today">
          <section className="lesson-hero">
            <div className="lesson-copy"><div className="lesson-meta"><span>今日の学習</span><b>数学 · Chapter 3</b><em>順調</em></div><p className="recommendation">前回のチェックポイントからのおすすめ</p><h2>二次方程式を、<br /><span>符号の変化から理解する。</span></h2><p>例題を一つ進め、変化の理由を自分の言葉で説明してから、見ずに一度解きます。</p><button type="button" onClick={() => setActiveStep((s) => Math.min(2, s + 1))}>レッスンを再開 <span>→</span></button></div>
            <div className="lesson-visual" aria-hidden="true"><span className="formula formula-a">x² + 5x + 6</span><span className="formula formula-b">= 0</span><i /><b>65%</b><small>Lesson progress</small></div>
          </section>

          <section className="runway-card" id="plan"><header><div><p>LEARNING RUNWAY</p><h3>小さな3ステップで、明確に終える</h3></div><span>合計 21分</span></header><div className="runway-list">
            {[{t:"ウォームアップ",d:"符号変化のルールを思い出す",m:"3分"},{t:"例題",d:"項を移し、等式のバランスを説明",m:"12分"},{t:"想起チェック",d:"見ずに一問解く",m:"6分"}].map((step,index)=><button type="button" key={step.t} className={activeStep===index?"active":""} onClick={()=>setActiveStep(index)}><span>{index < activeStep ? "✓" : index+1}</span><div><strong>{step.t}</strong><small>{step.d}</small></div><b>{step.m}</b></button>)}
          </div></section>

          <div className="dashboard-grid" id="subjects">
            <section className="subject-card"><header><div><p>{isTeacher ? "CLASS PULSE" : "SUBJECT PROGRESS"}</p><h3>{isTeacher ? "クラスの理解度" : "科目ごとの進み具合"}</h3></div><a href="#progress">すべて見る →</a></header><div className="subject-list">{subjects.map((subject)=><article key={subject.name}><span className={`subject-icon ${subject.tone}`}>{subject.name.slice(0,1)}</span><div><strong>{subject.name}</strong><small>{subject.detail}</small><div className="progress-track"><i className={subject.tone} style={{width:`${subject.progress}%`}} /></div></div><b>{subject.progress}%</b></article>)}</div></section>
            <section className="rhythm-card" id="progress"><header><p>WEEKLY RHYTHM</p><h3>今週の学習時間</h3></header><div className="week-bars">{[42,68,35,82,58,74,28].map((height,index)=><div key={index}><i style={{height:`${height}%`}} className={index===5?"today":""}/><span>{["月","火","水","木","金","土","日"][index]}</span></div>)}</div><footer><strong>3時間42分</strong><span>先週より <b>+18%</b></span></footer></section>
          </div>
        </main>
      </div>
      {!cameraOpen && <button className="floating-camera" type="button" onClick={() => setCameraOpen(true)}><span>◎</span><div><strong>Emotion check-in</strong><small>集中シグナルを見る</small></div></button>}
      {cameraOpen && <EmotionCamera onClose={() => setCameraOpen(false)} />}
    </div>
  );
}
