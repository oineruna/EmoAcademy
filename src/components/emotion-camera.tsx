"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getActiveSupabaseClient } from "@/lib/supabase/client";

type Sample = { valence: number; arousal: number };
type FaceBox = { x: number; y: number; width: number; height: number; source: string };
type EmotionKey = "anger" | "contempt" | "disgust" | "fear" | "happiness" | "neutral" | "sadness" | "surprise";
type EmotionSummary = { pct: Record<EmotionKey, number>; dominant: EmotionKey; dominantPct: number };
type RemoteEmotionResponse = {
  valence?: number;
  arousal?: number;
  confidence?: number;
  dominant_emotion?: EmotionKey;
  bbox?: FaceBox;
  frame_width?: number;
  frame_height?: number;
  source?: string;
  model_version?: string;
};

const emotionKeys: EmotionKey[] = ["anger", "contempt", "disgust", "fear", "happiness", "neutral", "sadness", "surprise"];
const defaultEmotionApiUrl = "https://emoacademy-emotion-api.hf.space";

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function summarizeEmotion(sample: Sample): EmotionSummary {
  const v = Number(sample.valence || 0);
  const a = Number(sample.arousal || 0);
  const raw: Record<EmotionKey, number> = {
    anger: Math.max(0, Math.round(Math.max(-v - 0.12, 0) * Math.max(a - 0.2, 0) * 140)),
    contempt: Math.max(0, Math.round(Math.max(-v - 0.18, 0) * Math.max(0.55 - a, 0) * 135)),
    disgust: Math.max(0, Math.round(Math.max(-v - 0.2, 0) * Math.max(a - 0.25, 0) * (1 - Math.min(Math.abs(a - 0.55) * 1.15, 1)) * 150)),
    fear: Math.max(0, Math.round(Math.max(-v, 0) * Math.max(a - 0.45, 0) * 140)),
    happiness: Math.max(0, Math.round(Math.max(v, 0) * (0.55 + a * 0.45) * 145)),
    neutral: Math.max(0, Math.round((1 - Math.min(Math.abs(v), 1)) * (1 - Math.min(Math.abs(a - 0.5) * 1.7, 1)) * 110)),
    sadness: Math.max(0, Math.round(Math.max(-v, 0) * Math.max(0.6 - a, 0) * 155)),
    surprise: Math.max(0, Math.round(Math.max(a - 0.55, 0) * (1 - Math.min(Math.abs(v) * 0.8, 1)) * 160)),
  };
  const total = Object.values(raw).reduce((sum, value) => sum + value, 0) || 1;
  const pct = Object.fromEntries(emotionKeys.map((key) => [key, Math.round((raw[key] / total) * 100)])) as Record<EmotionKey, number>;
  let dominant: EmotionKey = "neutral";
  let dominantPct = -1;
  for (const key of emotionKeys) {
    if (pct[key] > dominantPct) {
      dominant = key;
      dominantPct = pct[key];
    }
  }
  return { pct, dominant, dominantPct: Math.max(0, dominantPct) };
}

function detectFaceBox(pixels: Uint8ClampedArray, width: number, height: number): FaceBox {
  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  let matches = 0;

  for (let y = 0; y < height; y += 2) {
    for (let x = 0; x < width; x += 2) {
      const index = (y * width + x) * 4;
      const r = pixels[index];
      const g = pixels[index + 1];
      const b = pixels[index + 2];
      const skinLike = r > 68 && g > 42 && b > 28 && r > b * 1.08 && r > g * 0.84 && Math.max(r, g, b) - Math.min(r, g, b) > 14;
      if (!skinLike) continue;
      matches += 1;
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  if (matches > 34 && maxX > minX && maxY > minY) {
    const padX = width * 0.06;
    const padY = height * 0.1;
    return {
      x: clamp(minX - padX, 0, width - 1),
      y: clamp(minY - padY, 0, height - 1),
      width: clamp(maxX - minX + padX * 2, width * 0.18, width),
      height: clamp(maxY - minY + padY * 2, height * 0.22, height),
      source: "skin-roi",
    };
  }

  return { x: width * 0.28, y: height * 0.13, width: width * 0.44, height: height * 0.58, source: "center-prior" };
}

function sampleRegion(pixels: Uint8ClampedArray, frameWidth: number, box: FaceBox) {
  const x1 = Math.max(0, Math.floor(box.x));
  const y1 = Math.max(0, Math.floor(box.y));
  const x2 = Math.min(frameWidth, Math.floor(box.x + box.width));
  const y2 = Math.floor(box.y + box.height);
  let luminance = 0;
  let warmth = 0;
  let redness = 0;
  let count = 0;

  for (let y = y1; y < y2; y += 2) {
    for (let x = x1; x < x2; x += 2) {
      const index = (y * frameWidth + x) * 4;
      const r = pixels[index] / 255;
      const g = pixels[index + 1] / 255;
      const b = pixels[index + 2] / 255;
      luminance += r * 0.2126 + g * 0.7152 + b * 0.0722;
      warmth += r - b;
      redness += r - g;
      count += 1;
    }
  }

  const safeCount = Math.max(1, count);
  return { luminance: luminance / safeCount, warmth: warmth / safeCount, redness: redness / safeCount };
}

function toPercentBox(box: FaceBox, width: number, height: number) {
  return {
    left: `${((width - box.x - box.width) / width) * 100}%`,
    top: `${(box.y / height) * 100}%`,
    width: `${(box.width / width) * 100}%`,
    height: `${(box.height / height) * 100}%`,
  };
}

function getEmotionApiUrl() {
  const runtimeEnv =
    typeof window === "undefined"
      ? undefined
      : (window as Window & { __EMOACADEMY_ENV__?: Record<string, string | undefined> }).__EMOACADEMY_ENV__;
  return (process.env.NEXT_PUBLIC_EMOTION_API_URL || runtimeEnv?.NEXT_PUBLIC_EMOTION_API_URL || defaultEmotionApiUrl).replace(/\/$/, "");
}

export function EmotionCamera({ onClose, language = "ja" }: { onClose: () => void; language?: "ja" | "en" }) {
  const text = language === "ja" ? {
    stopped: "カメラは停止中", measuring: "表情を確認中", denied: "カメラを使えません。ブラウザの権限を確認してください。", close: "閉じる", local: "LIVE", startOnly: "開始時だけカメラを使用", stop: "停止", start: "開始", current: "今の状態", trace: "集中の流れ", samples: "直近18サンプル", title: "感情モニター", active: "活性", positive: "前向き", mood: "気分", energy: "活性", highEnergy: "少し高め", positiveFocus: "前向き", needsPause: "休憩サイン", steadyFocus: "安定", liveEmotion: "現在の表情", latest: "最新", session: "学習中の教材", material: "Greetings & Introductions",
    labels: { anger: "怒り", contempt: "軽蔑", disgust: "嫌悪", fear: "不安", happiness: "前向き", neutral: "中立", sadness: "低下", surprise: "驚き" } as Record<EmotionKey, string>,
  } : {
    stopped: "Camera is off", measuring: "Checking expression", denied: "Camera unavailable. Check your browser permission.", close: "Close", local: "LIVE", startOnly: "Camera starts only when requested", stop: "Stop", start: "Start", current: "Current state", trace: "Focus flow", samples: "Latest 18 samples", title: "Emotion monitor", active: "ACTIVE", positive: "POSITIVE", mood: "Mood", energy: "Energy", highEnergy: "High energy", positiveFocus: "Positive", needsPause: "Pause sign", steadyFocus: "Steady", liveEmotion: "Current expression", latest: "Latest", session: "Session material", material: "Greetings & Introductions",
    labels: { anger: "Anger", contempt: "Contempt", disgust: "Disgust", fear: "Fear", happiness: "Happiness", neutral: "Neutral", sadness: "Sadness", surprise: "Surprise" } as Record<EmotionKey, string>,
  };
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const previousBrightness = useRef(0.5);
  const lastRemoteAt = useRef(0);
  const remoteBusy = useRef(false);
  const lastSaveAt = useRef(0);
  const [active, setActive] = useState(false);
  const [status, setStatus] = useState(text.stopped);
  const [sample, setSample] = useState<Sample>({ valence: 0.18, arousal: 0.46 });
  const [history, setHistory] = useState<Sample[]>([]);
  const [faceBox, setFaceBox] = useState<FaceBox | null>(null);
  const summary = useMemo(() => summarizeEmotion(sample), [sample]);

  const stop = useCallback(() => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setActive(false);
    setStatus(text.stopped);
    setFaceBox(null);
  }, [text.stopped]);

  useEffect(() => stop, [stop]);

  async function start() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "user" }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setActive(true);
      setStatus(text.measuring);
      analyseFrame();
      timerRef.current = window.setInterval(analyseFrame, 700);
    } catch {
      setStatus(text.denied);
    }
  }

  function analyseFrame() {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas || video.readyState < 2) return;
    const context = canvas.getContext("2d", { willReadFrequently: true });
    if (!context) return;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
    const box = detectFaceBox(pixels, canvas.width, canvas.height);
    const region = sampleRegion(pixels, canvas.width, box);
    const motion = Math.min(1, Math.abs(region.luminance - previousBrightness.current) * 8);
    previousBrightness.current = region.luminance;
    const next = {
      valence: clamp((region.luminance - 0.46) * 1.35 + region.warmth * 0.78 - motion * 0.12, -1, 1),
      arousal: clamp(0.28 + motion * 0.72 + Math.max(region.redness, 0) * 0.42, 0, 1),
    };
    setFaceBox(box);
    setSample(next);
    setHistory((items) => [...items.slice(-18), next]);
    void saveEmotionSample(next, summarizeEmotion(next).dominant, undefined, "browser", undefined);
    // eslint-disable-next-line react-hooks/purity
    const now = Date.now();
    if (now - lastRemoteAt.current > 2500) {
      lastRemoteAt.current = now;
      void requestRemoteEmotion(canvas);
    }
  }

  async function canvasToBlob(canvas: HTMLCanvasElement) {
    return new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.72));
  }

  async function requestRemoteEmotion(canvas: HTMLCanvasElement) {
    if (remoteBusy.current) return;
    remoteBusy.current = true;
    try {
      const blob = await canvasToBlob(canvas);
      if (!blob) return;
      const body = new FormData();
      body.append("file", blob, "frame.jpg");
      const response = await fetch(`${getEmotionApiUrl()}/predict`, { method: "POST", body });
      if (!response.ok) return;
      const data = (await response.json()) as RemoteEmotionResponse;
      if (typeof data.valence !== "number" || typeof data.arousal !== "number") return;
      const next = { valence: clamp(data.valence, -1, 1), arousal: clamp(data.arousal, 0, 1) };
      const dominant = data.dominant_emotion && emotionKeys.includes(data.dominant_emotion) ? data.dominant_emotion : summarizeEmotion(next).dominant;
      setSample(next);
      setHistory((items) => [...items.slice(-18), next]);
      if (data.bbox) setFaceBox(data.bbox);
      await saveEmotionSample(next, dominant, data.confidence, data.source || "emotion-api", data.model_version);
    } catch {
      // Keep the local monitor running if the model API sleeps or is unavailable.
    } finally {
      remoteBusy.current = false;
    }
  }

  async function saveEmotionSample(sampleToSave: Sample, dominant: EmotionKey, confidence?: number, source?: string, modelVersion?: string) {
    const now = Date.now();
    if (now - lastSaveAt.current < 5000) return;
    lastSaveAt.current = now;
    const result = await getActiveSupabaseClient();
    if (!result) return;
    await result.client.from("emotion_samples").insert({
      user_id: result.session.user.id,
      valence: sampleToSave.valence,
      arousal: sampleToSave.arousal,
      dominant_emotion: dominant,
      confidence,
      source: source || "browser",
      model_version: modelVersion,
      captured_at: new Date().toISOString(),
    });
  }

  const label = sample.arousal > 0.72 ? text.highEnergy : sample.valence > 0.22 ? text.positiveFocus : sample.valence < -0.18 ? text.needsPause : text.steadyFocus;
  const dotX = 50 + sample.valence * 38;
  const dotY = 88 - sample.arousal * 76;
  const path = history.map((item, index) => `${(index / Math.max(1, history.length - 1)) * 100},${44 - item.valence * 28}`).join(" ");
  const boxStyle = faceBox ? toPercentBox(faceBox, 96, 72) : undefined;
  const ringSweep = Math.round((summary.dominantPct / 100) * 360);

  return (
    <section className="emotion-dock" aria-label={language === "ja" ? "学習シグナルモニター" : "Study signal monitor"}>
      <header className="emotion-dock-head">
        <div><span className={active ? "live-pip active" : "live-pip"} /> <strong>{text.title}</strong><small>{text.local}</small></div>
        <button type="button" onClick={() => { stop(); onClose(); }} aria-label={text.close}>×</button>
      </header>
      <div className="session-material compact">
        <label htmlFor="emotion-session">{text.session}</label>
        <select id="emotion-session" defaultValue="greetings">
          <option value="greetings">{text.material}</option>
          <option value="conversation">Conversation Practice</option>
          <option value="review">Unit 1 Review</option>
        </select>
      </div>
      <div className="emotion-grid">
        <div className="camera-frame">
          <video ref={videoRef} muted playsInline />
          {active && boxStyle && <i className="face-bbox" style={boxStyle} aria-hidden="true" />}
          {!active && <div className="camera-placeholder"><span>◉</span><p>{text.startOnly}</p></div>}
          <canvas ref={canvasRef} width="96" height="72" hidden />
          <div className="camera-controls">
            <span>{status}</span>
            <button type="button" onClick={active ? stop : start}>{active ? text.stop : text.start}</button>
          </div>
        </div>
        <div className="signal-card">
          <div className="signal-label"><span>{text.current}</span><strong>{label}</strong></div>
          <div className="circumplex" aria-label={`${text.mood} ${sample.valence.toFixed(2)}, ${text.energy} ${sample.arousal.toFixed(2)}`}>
            <span className="axis-y">{text.active}</span><span className="axis-x">{text.positive}</span>
            <i style={{ left: `${dotX}%`, top: `${dotY}%` }} />
          </div>
          <div className="signal-values"><span>{text.mood} <b>{sample.valence.toFixed(2)}</b></span><span>{text.energy} <b>{sample.arousal.toFixed(2)}</b></span></div>
        </div>
      </div>
      <div className="emotion-summary-card">
        <div className="emotion-ring-detail" style={{ background: `conic-gradient(#22c55e 0deg, #22c55e ${ringSweep}deg, #dbe3ef ${ringSweep}deg, #dbe3ef 360deg)` }}>
          <span>{summary.dominantPct}%</span>
        </div>
        <div className="emotion-summary-main">
          <small>{text.liveEmotion}</small>
          <strong>{text.labels[summary.dominant]}</strong>
          <p>{text.latest}: {text.mood} {sample.valence.toFixed(2)} · {text.energy} {sample.arousal.toFixed(2)}</p>
        </div>
      </div>
      <div className="emotion-percent-list">
        {emotionKeys.map((key) => (
          <div key={key}>
            <span>{text.labels[key]}</span>
            <i><b style={{ width: `${summary.pct[key]}%` }} /></i>
            <strong>{summary.pct[key]}%</strong>
          </div>
        ))}
      </div>
      <div className="signal-timeline"><div><strong>{text.trace}</strong><span>{text.samples}</span></div><svg viewBox="0 0 100 48" preserveAspectRatio="none"><line x1="0" y1="24" x2="100" y2="24" /><polyline points={path || "0,24 100,24"} /></svg></div>
    </section>
  );
}
