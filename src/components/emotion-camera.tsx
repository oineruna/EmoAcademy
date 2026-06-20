"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type Sample = { valence: number; arousal: number };

export function EmotionCamera({ onClose, language = "ja" }: { onClose: () => void; language?: "ja" | "en" }) {
  const text = language === "ja" ? {
    stopped: "カメラは停止中", measuring: "学習シグナルを計測中", denied: "カメラを使えません。ブラウザの権限を確認してください。", close: "閉じる", local: "端末内デモ推定", startOnly: "開始時だけカメラを使用", stop: "停止", start: "計測開始", current: "現在", trace: "集中トレース", samples: "直近18サンプル", privacy: "映像はサーバーへ送信しません。これは研究用モデルではなく、画面確認用の簡易シグナルです。",
  } : {
    stopped: "Camera is off", measuring: "Measuring study signals", denied: "Camera unavailable. Check your browser permission.", close: "Close", local: "On-device demo", startOnly: "Camera starts only when requested", stop: "Stop", start: "Start", current: "Current", trace: "Focus trace", samples: "Latest 18 samples", privacy: "Video is not sent to a server. This is a simple interface demo signal, not a research-grade model.",
  };
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const previousBrightness = useRef(0.5);
  const [active, setActive] = useState(false);
  const [status, setStatus] = useState(text.stopped);
  const [sample, setSample] = useState<Sample>({ valence: 0.18, arousal: 0.46 });
  const [history, setHistory] = useState<Sample[]>([]);

  const stop = useCallback(() => {
    if (timerRef.current) window.clearInterval(timerRef.current);
    timerRef.current = null;
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setActive(false);
    setStatus(text.stopped);
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
      timerRef.current = window.setInterval(analyseFrame, 900);
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
    let luminance = 0;
    for (let index = 0; index < pixels.length; index += 64) {
      luminance += (pixels[index] * 0.2126 + pixels[index + 1] * 0.7152 + pixels[index + 2] * 0.0722) / 255;
    }
    const count = Math.max(1, pixels.length / 64);
    const brightness = luminance / count;
    const motion = Math.min(1, Math.abs(brightness - previousBrightness.current) * 7);
    previousBrightness.current = brightness;
    const next = {
      valence: Math.max(-1, Math.min(1, (brightness - 0.42) * 1.8)),
      arousal: Math.max(0, Math.min(1, 0.34 + motion * 0.62)),
    };
    setSample(next);
    setHistory((items) => [...items.slice(-18), next]);
  }

  const label = sample.arousal > 0.72 ? "High energy" : sample.valence > 0.22 ? "Positive focus" : sample.valence < -0.18 ? "Needs a pause" : "Steady focus";
  const dotX = 50 + sample.valence * 38;
  const dotY = 88 - sample.arousal * 76;
  const path = history.map((item, index) => `${(index / Math.max(1, history.length - 1)) * 100},${44 - item.valence * 28}`).join(" ");

  return (
    <section className="emotion-dock" aria-label="学習シグナルモニター">
      <header className="emotion-dock-head">
        <div><span className={active ? "live-pip active" : "live-pip"} /> <strong>Emotion check-in</strong><small>{text.local}</small></div>
        <button type="button" onClick={() => { stop(); onClose(); }} aria-label={text.close}>×</button>
      </header>
      <div className="emotion-grid">
        <div className="camera-frame">
          <video ref={videoRef} muted playsInline />
          {!active && <div className="camera-placeholder"><span>◉</span><p>{text.startOnly}</p></div>}
          <canvas ref={canvasRef} width="48" height="36" hidden />
          <div className="camera-controls">
            <span>{status}</span>
            <button type="button" onClick={active ? stop : start}>{active ? text.stop : text.start}</button>
          </div>
        </div>
        <div className="signal-card">
          <div className="signal-label"><span>{text.current}</span><strong>{label}</strong></div>
          <div className="circumplex" aria-label={`Valence ${sample.valence.toFixed(2)}, Arousal ${sample.arousal.toFixed(2)}`}>
            <span className="axis-y">ACTIVE</span><span className="axis-x">POSITIVE</span>
            <i style={{ left: `${dotX}%`, top: `${dotY}%` }} />
          </div>
          <div className="signal-values"><span>Valence <b>{sample.valence.toFixed(2)}</b></span><span>Arousal <b>{sample.arousal.toFixed(2)}</b></span></div>
        </div>
      </div>
      <div className="signal-timeline"><div><strong>{text.trace}</strong><span>{text.samples}</span></div><svg viewBox="0 0 100 48" preserveAspectRatio="none"><line x1="0" y1="24" x2="100" y2="24" /><polyline points={path || "0,24 100,24"} /></svg></div>
      <p className="privacy-note">{text.privacy}</p>
    </section>
  );
}
