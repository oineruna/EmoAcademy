"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Lightbulb, RotateCcw, Target } from "lucide-react";

type Language = "ja" | "en";
type StepId = "recall" | "example" | "explain" | "check";

const steps: Array<{ id: StepId; ja: string; en: string; minutes: number }> = [
  { id: "recall", ja: "思い出す", en: "Recall", minutes: 3 },
  { id: "example", ja: "例を見る", en: "Worked example", minutes: 5 },
  { id: "explain", ja: "説明する", en: "Self-explain", minutes: 5 },
  { id: "check", ja: "確認する", en: "Retrieval check", minutes: 4 },
];

const copy = {
  ja: {
    eyebrow: "LEARNING ROUTE", title: "今日の17分学習", subtitle: "短い4段階で、思い出す力まで確認します。", goal: "今日の目標", goalText: "挨拶を見ずに1回言える", change: "変更", goals: ["挨拶を見ずに1回言える", "自己紹介を30秒続ける", "確認問題を2問正解する"],
    recallTitle: "まず、見ずに思い出す", recallPrompt: "初対面の相手に使う英語の挨拶を1つ声に出してください。", reveal: "答えの例を見る", recallAnswer: "Hello, it’s nice to meet you. My name is Alex.",
    exampleTitle: "会話の型を確認する", examplePrompt: "色の付いた部分を入れ替えて、自分の表現を作ります。", signal: "要点を表示", hideSignal: "要点を隠す", signalText: "挨拶 → 名前 → 相手への質問、の順にすると会話を続けやすくなります。",
    explainTitle: "自分の言葉で説明する", explainPrompt: "この会話が自然に続く理由を1文で書いてください。", explainPlaceholder: "例：最後に質問があるので、相手が返事をしやすい。", save: "説明を保存", saved: "保存しました",
    checkTitle: "ヒントなしで確認する", confidence: "回答前の自信度", unsure: "自信なし", almost: "たぶん", sure: "自信あり", question: "“Nice to meet you.” の次に最も自然な文は？", answers: ["What’s your name?", "I am a textbook.", "Good night yesterday."], check: "答えを確認", correct: "正解です。次は表現を見ずに会話へ使ってみましょう。", incorrect: "もう一度、相手が返答しやすい質問を選びましょう。", needConfidence: "先に自信度を選んでください。", previous: "戻る", next: "次へ", finish: "学習を完了", complete: "完了", added: "復習予定に追加済み", addReview: "明日の復習に追加", recommended: "次のおすすめ", recommendedText: "明日、同じ挨拶をヒントなしで1回確認します。",
  },
  en: {
    eyebrow: "LEARNING ROUTE", title: "Today’s 17-minute session", subtitle: "Four short stages that finish with active recall.", goal: "Today’s goal", goalText: "Say one greeting without looking", change: "Change", goals: ["Say one greeting without looking", "Keep an introduction going for 30 seconds", "Answer two checks correctly"],
    recallTitle: "Recall before reviewing", recallPrompt: "Say one English greeting you could use when meeting someone for the first time.", reveal: "Show an example", recallAnswer: "Hello, it’s nice to meet you. My name is Alex.",
    exampleTitle: "Study the conversation pattern", examplePrompt: "Swap the highlighted parts to make the pattern your own.", signal: "Show key idea", hideSignal: "Hide key idea", signalText: "Greeting → name → question gives the other person an easy way to continue.",
    explainTitle: "Explain it in your own words", explainPrompt: "Write one sentence explaining why this exchange is easy to continue.", explainPlaceholder: "Example: The final question gives the other person something clear to answer.", save: "Save explanation", saved: "Saved",
    checkTitle: "Check without a hint", confidence: "Confidence before answering", unsure: "Unsure", almost: "Almost", sure: "Sure", question: "What naturally follows “Nice to meet you”?", answers: ["What’s your name?", "I am a textbook.", "Good night yesterday."], check: "Check answer", correct: "Correct. Now try using it in a conversation without looking.", incorrect: "Try again and choose the question that is easiest for the other person to answer.", needConfidence: "Choose a confidence level first.", previous: "Previous", next: "Next", finish: "Finish session", complete: "Complete", added: "Added to review plan", addReview: "Review again tomorrow", recommended: "Recommended next", recommendedText: "Tomorrow, retrieve the same greeting once without a hint.",
  },
} as const;

export function LearningSession({ language }: { language: Language }) {
  const t = copy[language];
  const [active, setActive] = useState(0);
  const [completed, setCompleted] = useState<StepId[]>([]);
  const [goal, setGoal] = useState<string>(t.goalText);
  const [goalOpen, setGoalOpen] = useState(false);
  const [revealed, setRevealed] = useState(false);
  const [signal, setSignal] = useState(false);
  const [explanation, setExplanation] = useState("");
  const [saved, setSaved] = useState(false);
  const [confidence, setConfidence] = useState("");
  const [answer, setAnswer] = useState<number | null>(null);
  const [submitted, setSubmitted] = useState(false);
  const [reviewAdded, setReviewAdded] = useState(false);

  useEffect(() => {
    window.localStorage.setItem("emoacademy-learning-progress", JSON.stringify({ completed, reviewAdded }));
  }, [completed, reviewAdded]);

  const current = steps[active];
  const markComplete = (id: StepId) => setCompleted((items) => items.includes(id) ? items : [...items, id]);
  const advance = () => { markComplete(current.id); if (active < steps.length - 1) setActive((value) => value + 1); };

  return (
    <section className="learning-cycle" aria-labelledby="learning-cycle-title">
      <header className="cycle-header">
        <div><span>{t.eyebrow}</span><h2 id="learning-cycle-title">{t.title}</h2><p>{t.subtitle}</p></div>
        <div className="goal-control"><small><Target />{t.goal}</small><strong>{goal}</strong><button type="button" onClick={() => setGoalOpen((value) => !value)} aria-expanded={goalOpen}>{t.change}</button>{goalOpen && <div className="goal-menu">{t.goals.map((item) => <button key={item} type="button" onClick={() => { setGoal(item); setGoalOpen(false); }}>{item}</button>)}</div>}</div>
      </header>

      <nav className="cycle-steps" aria-label={t.title}>{steps.map((step, index) => <button key={step.id} className={index === active ? "active" : completed.includes(step.id) ? "done" : ""} type="button" aria-current={index === active ? "step" : undefined} onClick={() => setActive(index)}><span>{completed.includes(step.id) ? <Check /> : index + 1}</span><div><strong>{language === "ja" ? step.ja : step.en}</strong><small>{step.minutes} min</small></div></button>)}</nav>

      <div className="cycle-stage" key={current.id}>
        {current.id === "recall" && <div className="stage-content"><span className="stage-icon"><RotateCcw /></span><div><h3>{t.recallTitle}</h3><p>{t.recallPrompt}</p><button className="secondary-action" type="button" onClick={() => setRevealed((value) => !value)}>{revealed ? t.hideSignal : t.reveal}</button>{revealed && <div className="reveal-panel">{t.recallAnswer}</div>}</div></div>}
        {current.id === "example" && <div className="stage-content"><span className="stage-icon"><Lightbulb /></span><div><h3>{t.exampleTitle}</h3><p>{t.examplePrompt}</p><div className="conversation-pattern"><span>Hello, nice to meet you.</span><span>My name is <b>Alex</b>.</span><span>What’s your <b>name</b>?</span></div><button className="secondary-action" type="button" onClick={() => setSignal((value) => !value)}>{signal ? t.hideSignal : t.signal}</button>{signal && <div className="signal-explanation"><Lightbulb />{t.signalText}</div>}</div></div>}
        {current.id === "explain" && <div className="stage-content"><span className="stage-icon"><Lightbulb /></span><div><h3>{t.explainTitle}</h3><p>{t.explainPrompt}</p><textarea value={explanation} onChange={(event) => { setExplanation(event.target.value); setSaved(false); }} placeholder={t.explainPlaceholder} maxLength={240} rows={3} /><button className={saved ? "primary-action confirmed" : "primary-action"} type="button" disabled={!explanation.trim()} onClick={() => { setSaved(true); markComplete("explain"); }}>{saved ? <CheckCircle2 /> : null}{saved ? t.saved : t.save}</button></div></div>}
        {current.id === "check" && <div className="stage-content"><span className="stage-icon"><CheckCircle2 /></span><div><h3>{t.checkTitle}</h3><p>{t.question}</p><fieldset className="confidence-control"><legend>{t.confidence}</legend>{[["low",t.unsure],["medium",t.almost],["high",t.sure]].map(([id,label]) => <button key={id} className={confidence === id ? "active" : ""} type="button" aria-pressed={confidence === id} onClick={() => { setConfidence(id); setSubmitted(false); }}>{label}</button>)}</fieldset><div className="answer-grid">{t.answers.map((item, index) => <button key={item} className={answer === index ? "active" : ""} type="button" aria-pressed={answer === index} onClick={() => { setAnswer(index); setSubmitted(false); }}><span>{String.fromCharCode(65 + index)}</span>{item}{answer === index && <Check />}</button>)}</div><button className="primary-action" type="button" disabled={answer === null} onClick={() => { if (!confidence) return; setSubmitted(true); if (answer === 0) markComplete("check"); }}>{t.check}</button>{answer !== null && !confidence && <p className="field-hint">{t.needConfidence}</p>}{submitted && <div className={answer === 0 ? "answer-feedback correct" : "answer-feedback incorrect"}>{answer === 0 ? <CheckCircle2 /> : <RotateCcw />}<span>{answer === 0 ? t.correct : t.incorrect}</span></div>}</div></div>}
      </div>

      <footer className="cycle-footer"><button type="button" disabled={active === 0} onClick={() => setActive((value) => Math.max(0, value - 1))}><ArrowLeft />{t.previous}</button><div><small>{t.recommended}</small><strong>{t.recommendedText}</strong><button className={reviewAdded ? "review-added" : ""} type="button" onClick={() => setReviewAdded(true)}>{reviewAdded ? <Check /> : <PlusIcon />}{reviewAdded ? t.added : t.addReview}</button></div><button className="next-cycle" type="button" onClick={advance}>{active === steps.length - 1 ? t.finish : t.next}<ArrowRight /></button></footer>
    </section>
  );
}

function PlusIcon() { return <span aria-hidden="true">＋</span>; }
