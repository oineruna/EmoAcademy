"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, ChevronDown, X } from "lucide-react";
import { getActiveSupabaseClient } from "@/lib/supabase/client";
import { LearningAffectBars } from "@/components/learning-affect-bars";
import { affectLabels, averageScores, dominantAffect, validScores, type AffectScores, type LearningAffectSignal } from "@/lib/learning-affect";

export type StudyEmotionSignal = LearningAffectSignal;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type PendingSample = AffectScores & {
  id: string; user_id: string; material_id: string | null; study_session_id: string | null;
  dominant_affect: string; confidence: number | null; model_version: string;
  valid_frames: number; captured_at: string;
};

function apiUrl() {
  const runtime = (window as Window & { __EMOACADEMY_ENV__?: Record<string, string> }).__EMOACADEMY_ENV__;
  const configured = process.env.NEXT_PUBLIC_EMOTION_API_URL || runtime?.NEXT_PUBLIC_EMOTION_API_URL;
  if (configured) return configured.replace(/\/$/, "");
  return ["localhost", "127.0.0.1"].includes(window.location.hostname) ? "http://127.0.0.1:7860" : null;
}

export function EmotionCamera({ onClose, language = "ja", autoStart = false, onSignal, materialTitle, materialId, studySessionId, preview = false }: {
  onClose: () => void; language?: "ja" | "en"; autoStart?: boolean;
  onSignal?: (signal: StudyEmotionSignal | null) => void; materialTitle?: string;
  materialId?: string; studySessionId?: string; preview?: boolean;
}) {
  const ja = language === "ja";
  const video = useRef<HTMLVideoElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const stream = useRef<MediaStream | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const request = useRef<AbortController | null>(null);
  const generation = useRef(0);
  const running = useRef(false);
  const collecting = useRef(false);
  const frames = useRef<Blob[]>([]);
  const samples = useRef<AffectScores[]>([]);
  const recentDominants = useRef<string[]>([]);
  const pending = useRef<PendingSample[]>([]);
  const saving = useRef(false);
  const props = useRef({ onSignal, materialId, studySessionId, preview });
  useEffect(() => { props.current = { onSignal, materialId, studySessionId, preview }; }, [onSignal, materialId, studySessionId, preview]);
  const [active, setActive] = useState(false);
  const [starting, setStarting] = useState(false);
  const [signal, setSignal] = useState<StudyEmotionSignal | null>(null);
  const [status, setStatus] = useState("");
  const [saveFailed, setSaveFailed] = useState(false);
  const [frameCount, setFrameCount] = useState(0);

  const release = useCallback(() => {
    generation.current += 1;
    running.current = false;
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    request.current?.abort();
    request.current = null;
    stream.current?.getTracks().forEach((track) => track.stop());
    stream.current = null;
    frames.current = [];
    samples.current = [];
    recentDominants.current = [];
  }, []);
  const stop = useCallback(() => {
    release();
    if (video.current) video.current.srcObject = null;
    setActive(false);
    setStarting(false);
    setSignal(null);
    setFrameCount(0);
    setStatus("");
    props.current.onSignal?.(null);
  }, [release]);
  useEffect(() => release, [release]);

  async function flushQueue() {
    if (saving.current || !pending.current.length) return;
    saving.current = true;
    try {
      const result = await getActiveSupabaseClient();
      if (!result) { setSaveFailed(true); return; }
      // アカウント切替後に別の学生のデータを再送しない。
      pending.current = pending.current.filter((row) => row.user_id === result.session.user.id);
      const batch = pending.current.slice();
      if (!batch.length) return;
      const { error } = await result.client.from("learning_affect_samples").upsert(batch, { onConflict: "id", ignoreDuplicates: true });
      if (error) { setSaveFailed(true); return; }
      const saved = new Set(batch.map((row) => row.id));
      pending.current = pending.current.filter((row) => !saved.has(row.id));
      setSaveFailed(false);
    } catch { setSaveFailed(true); }
    finally { saving.current = false; }
  }

  async function saveSample(raw: AffectScores, next: StudyEmotionSignal) {
    if (props.current.preview) return;
    const result = await getActiveSupabaseClient();
    if (!result) { setSaveFailed(true); return; }
    pending.current.push({
      ...raw, id: crypto.randomUUID(), user_id: result.session.user.id,
      material_id: props.current.materialId && uuid.test(props.current.materialId) ? props.current.materialId : null,
      study_session_id: props.current.studySessionId && uuid.test(props.current.studySessionId) ? props.current.studySessionId : null,
      dominant_affect: dominantAffect(raw), confidence: next.confidence ?? null,
      model_version: next.modelVersion, valid_frames: next.validFrames, captured_at: next.capturedAt,
    });
    await flushQueue();
  }
  useEffect(() => {
    const retry = setInterval(() => { void flushQueue(); }, 10000);
    return () => clearInterval(retry);
    // キューはrefで保持し、再試行は同じIDで重複保存を防ぐ。
  }, []);

  async function infer(batch: Blob[], current: number) {
    const url = apiUrl();
    if (!url) {
      setSignal(null); props.current.onSignal?.(null);
      setStatus(ja ? "分析APIが設定されていません。" : "Analysis API is not configured.");
      return;
    }
    const controller = new AbortController();
    request.current = controller;
    const timeout = setTimeout(() => controller.abort(), 60000);
    try {
      const body = new FormData();
      batch.forEach((blob, index) => body.append("frames", blob, `frame-${index}.jpg`));
      const response = await fetch(`${url}/predict/learning-affect`, { method: "POST", body, signal: controller.signal });
      if (current !== generation.current) return;
      if (!response.ok) {
        throw new Error(response.status === 422
          ? (ja ? "顔を明るくし、カメラに正面を向いて再測定してください。" : "Improve lighting and face the camera.")
          : (ja ? "DAiSEE分析APIを利用できません。" : "DAiSEE analysis API unavailable."));
      }
      const data = await response.json();
      if (current !== generation.current) return;
      if (!validScores(data.scores) || !Number.isInteger(data.quality?.valid_frames) || data.quality.valid_frames < 12 || data.quality.valid_frames > 16 || !data.model_version) throw new Error(ja ? "分析APIの応答を確認できません。" : "Invalid analysis response.");
      samples.current = [...samples.current.slice(-4), data.scores];
      const scores = averageScores(samples.current);
      const dominant = dominantAffect(scores);
      recentDominants.current = [...recentDominants.current.slice(-2), dominantAffect(data.scores)];
      const next: StudyEmotionSignal = {
        scores, dominant, confidence: typeof data.confidence === "number" ? data.confidence : undefined,
        source: "daisee", modelVersion: data.model_version, validFrames: data.quality.valid_frames,
        capturedAt: new Date().toISOString(),
        sustained: recentDominants.current.length === 3 && recentDominants.current.every((key) => key === dominant) && scores[dominant] >= 60 && typeof data.confidence === "number" && data.confidence >= 0.4,
      };
      setSignal(next); props.current.onSignal?.(next); setStatus("");
      try { await saveSample(data.scores, next); }
      catch { setSaveFailed(true); }
    } catch (error) {
      if (current !== generation.current) return;
      samples.current = []; recentDominants.current = [];
      setSignal(null); props.current.onSignal?.(null);
      setStatus(error instanceof Error && error.name !== "TypeError" && error.name !== "AbortError" ? error.message : (ja ? "分析APIに接続できません。起動状態を確認してください。" : "Cannot connect to the analysis API."));
    } finally {
      clearTimeout(timeout);
      if (request.current === controller) request.current = null;
    }
  }

  async function capture(current: number) {
    if (current !== generation.current || !running.current) return;
    const target = canvas.current;
    const camera = video.current;
    if (target && camera && camera.readyState >= 2 && !collecting.current) {
      collecting.current = true;
      try {
        target.getContext("2d")?.drawImage(camera, 0, 0, target.width, target.height);
        const blob = await new Promise<Blob | null>((resolve) => target.toBlob(resolve, "image/jpeg", 0.75));
        if (current !== generation.current) return;
        if (blob) frames.current.push(blob);
        setFrameCount(frames.current.length);
        if (frames.current.length === 16) {
          const batch = frames.current;
          frames.current = []; setFrameCount(0);
          await infer(batch, current);
        }
      } finally { collecting.current = false; }
    }
    if (current === generation.current && running.current) timer.current = setTimeout(() => { void capture(current); }, 250);
  }

  async function start() {
    if (starting || running.current) return;
    release();
    const current = generation.current;
    setStarting(true); setSignal(null); setStatus("");
    props.current.onSignal?.(null);
    try {
      const media = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } }, audio: false });
      if (current !== generation.current) { media.getTracks().forEach((track) => track.stop()); return; }
      stream.current = media;
      if (video.current) { video.current.srcObject = media; await video.current.play(); }
      if (current !== generation.current) return;
      running.current = true; setActive(true);
      void capture(current);
    } catch {
      if (current !== generation.current) return;
      release(); setActive(false);
      setStatus(ja ? "カメラを使えません。ブラウザの権限を確認してください。" : "Camera unavailable. Check browser permissions.");
    } finally { if (current === generation.current || !running.current) setStarting(false); }
  }
  useEffect(() => {
    if (!autoStart) return;
    const id = setTimeout(() => { void start(); }, 120);
    return () => clearTimeout(id);
    // 初回のみ開始し、終了時はreleaseでキャンセルする。
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoStart]);

  return <section className={`emotion-dock emotion-monitor-card ${active ? "is-live" : "is-idle"}`} aria-label={ja ? "感情モニター" : "Emotion monitor"}>
    <header className="emotion-dock-head"><div><strong>{ja ? "感情モニター" : "Emotion monitor"}</strong><small>{active ? (ja ? "計測中" : "Live") : (ja ? "停止中" : "Stopped")}</small></div><button type="button" onClick={() => { stop(); onClose(); }} aria-label={ja ? "閉じる" : "Close"}><X /></button></header>
    <div className="emotion-idle-body">
      <div className="emotion-video-frame"><video ref={video} muted playsInline />{!active && <div className="emotion-idle-placeholder"><span><Camera /></span><p>{ja ? "学習中の状態をここに表示" : "Your learning state appears here"}</p></div>}</div>
      <canvas ref={canvas} width={480} height={360} hidden />
      <button className="emotion-start-button" type="button" disabled={starting} onClick={active ? stop : () => { void start(); }}>{starting ? (ja ? "準備中…" : "Starting…") : active ? (ja ? "計測を停止" : "Stop") : (ja ? "計測を開始" : "Start")}</button>
      {active && !signal && !status && <p className="emotion-monitor-status" role="status">{frameCount === 0 ? (ja ? "分析中…" : "Analyzing…") : `${ja ? "フレーム取得中" : "Capturing"} ${frameCount}/16`}</p>}
      {status && <p className="emotion-monitor-status" role="status">{status}</p>}
    </div>
    <div className="learning-affect-current"><small>{ja ? "学習状態" : "Learning state"}</small><strong>{signal ? (signal.confidence === undefined || signal.confidence < 0.4 ? (ja ? "判定が不確か" : "Uncertain prediction") : affectLabels[language][signal.dominant]) : (ja ? "未計測" : "Not measured")}</strong></div>
    {signal && (signal.confidence === undefined || signal.confidence < 0.4) && <p className="emotion-monitor-status" role="status">{ja ? "予測が拮抗しています。50%は確率ではなく、4段階予測から算出した参考値です。" : "Predictions are close. Scores are estimated intensities, not probabilities."}</p>}
    <LearningAffectBars language={language} scores={signal?.scores ?? null} />
    <details className="emotion-idle-details emotion-live-details"><summary>{ja ? "詳細を見る" : "View details"}<ChevronDown /></summary><div><small>{ja ? "学習中の教材" : "Material"}</small><strong>{materialTitle}</strong><p>{ja ? "直近5回の平均・各指標の強さ（0〜100）" : "Last 5 readings · independent intensity (0–100)"}</p>{signal && <p>{ja ? "モデル: DAiSEE / EfficientNet-B2 (.pt)・予測確信度" : "Model: DAiSEE / EfficientNet-B2 (.pt) · confidence"}: {signal.confidence === undefined ? "—" : `${Math.round(signal.confidence * 100)}%`}</p>}{signal && <p>{ja ? "有効フレーム" : "Valid frames"}: {signal.validFrames}/16 · {new Date(signal.capturedAt).toLocaleTimeString()}</p>}{saveFailed && <p role="status">{ja ? "保存を再試行中です。この画面を閉じずにお待ちください。" : "Retrying save. Keep this monitor open."}</p>}</div></details>
  </section>;
}
