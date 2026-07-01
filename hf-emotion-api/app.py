from __future__ import annotations

from io import BytesIO
import os
import time
from pathlib import Path
from typing import Any

from fastapi import FastAPI, File, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from PIL import Image
import numpy as np
import mediapipe as mp

try:
    import cv2
except Exception:  # pragma: no cover
    cv2 = None

try:
    import onnxruntime as ort
except Exception:  # pragma: no cover
    ort = None

try:
    import torch
except Exception:  # pragma: no cover
    torch = None


APP_VERSION = "emotion-api-2026-07-01"
MODEL_DIR = Path("models")
MODEL_PATH = os.getenv("MODEL_PATH") or os.getenv("ONNX_MODEL_PATH")
EMOTION_KEYS = ["anger", "contempt", "disgust", "fear", "happiness", "neutral", "sadness", "surprise"]

app = FastAPI(title="EmoAcademy Emotion API", version=APP_VERSION)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

_mp_detector = None
_model: dict[str, Any] | None = None
_model_error: str | None = None


def clamp(value: float, low: float, high: float) -> float:
    return max(low, min(high, value))


def find_model_path() -> str | None:
    if MODEL_PATH and Path(MODEL_PATH).exists():
        return MODEL_PATH
    for pattern in ("*.onnx", "*.pt", "*.pth"):
        for path in MODEL_DIR.glob(pattern):
            return str(path)
    return None


def load_model() -> dict[str, Any] | None:
    path = find_model_path()
    if not path:
        return None
    if path.lower().endswith(".onnx"):
        if ort is None:
            raise RuntimeError("onnxruntime is not available")
        session = ort.InferenceSession(path, providers=["CPUExecutionProvider"])
        return {"mode": "onnx", "session": session, "path": path, "loaded_at": time.time()}
    if path.lower().endswith((".pt", ".pth")):
        if torch is None:
            raise RuntimeError("PyTorch is not available")
        network = torch.load(path, map_location="cpu", weights_only=False)
        network.eval()
        return {"mode": "torch", "network": network, "path": path, "loaded_at": time.time()}
    return None


def get_model() -> dict[str, Any] | None:
    global _model, _model_error
    if _model is None:
        try:
            _model = load_model()
            _model_error = None
        except Exception as exc:
            _model_error = str(exc)
            _model = None
    return _model


def get_face_detector():
    global _mp_detector
    if _mp_detector is None:
        _mp_detector = mp.solutions.face_detection.FaceDetection(
            model_selection=0,
            min_detection_confidence=0.35,
        )
    return _mp_detector


def detect_face_bbox(img_np: np.ndarray):
    height, width, _ = img_np.shape
    detector = get_face_detector()
    results = detector.process(img_np)
    if results.detections:
        faces = []
        for det in results.detections:
            rel = det.location_data.relative_bounding_box
            x1 = max(int(rel.xmin * width), 0)
            y1 = max(int(rel.ymin * height), 0)
            x2 = min(int((rel.xmin + rel.width) * width), width)
            y2 = min(int((rel.ymin + rel.height) * height), height)
            area = max(x2 - x1, 0) * max(y2 - y1, 0)
            faces.append((area, x1, y1, x2, y2))
        faces.sort(reverse=True)
        _, x1, y1, x2, y2 = faces[0]
        if x2 > x1 and y2 > y1:
            return {"x": x1, "y": y1, "width": x2 - x1, "height": y2 - y1, "source": "mediapipe"}

    if cv2 is not None:
        gray = cv2.cvtColor(img_np, cv2.COLOR_RGB2GRAY)
        cascade_path = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
        cascade = cv2.CascadeClassifier(cascade_path)
        detected = cascade.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(40, 40))
        if len(detected) > 0:
            x, y, w, h = max(detected, key=lambda r: r[2] * r[3])
            return {"x": int(x), "y": int(y), "width": int(w), "height": int(h), "source": "opencv"}

    return None


def summarize_emotion(valence: float, arousal: float):
    raw = {
        "anger": max(0, round(max(-valence - 0.12, 0) * max(arousal - 0.2, 0) * 140)),
        "contempt": max(0, round(max(-valence - 0.18, 0) * max(0.55 - arousal, 0) * 135)),
        "disgust": max(0, round(max(-valence - 0.2, 0) * max(arousal - 0.25, 0) * (1 - min(abs(arousal - 0.55) * 1.15, 1)) * 150)),
        "fear": max(0, round(max(-valence, 0) * max(arousal - 0.45, 0) * 140)),
        "happiness": max(0, round(max(valence, 0) * (0.55 + arousal * 0.45) * 145)),
        "neutral": max(0, round((1 - min(abs(valence), 1)) * (1 - min(abs(arousal - 0.5) * 1.7, 1)) * 110)),
        "sadness": max(0, round(max(-valence, 0) * max(0.6 - arousal, 0) * 155)),
        "surprise": max(0, round(max(arousal - 0.55, 0) * (1 - min(abs(valence) * 0.8, 1)) * 160)),
    }
    total = sum(raw.values()) or 1
    pct = {key: round(raw[key] / total * 100) for key in EMOTION_KEYS}
    dominant = max(pct, key=pct.get)
    return {"pct": pct, "dominant": dominant, "dominant_pct": pct[dominant]}


def heuristic_predict(face_img: np.ndarray):
    arr = face_img.astype(np.float32) / 255.0
    r = float(arr[:, :, 0].mean())
    g = float(arr[:, :, 1].mean())
    b = float(arr[:, :, 2].mean())
    luminance = r * 0.2126 + g * 0.7152 + b * 0.0722
    warmth = r - b
    redness = r - g
    valence = clamp((luminance - 0.46) * 1.35 + warmth * 0.78, -1, 1)
    arousal = clamp(0.32 + max(redness, 0) * 0.58 + abs(warmth) * 0.22, 0, 1)
    confidence = clamp(0.42 + min(luminance, 0.8) * 0.25, 0, 0.86)
    return valence, arousal, confidence, "heuristic"


def model_predict(face_img: np.ndarray, model: dict[str, Any]):
    face = Image.fromarray(face_img).resize((224, 224))
    arr = np.array(face).astype(np.float32) / 255.0
    arr = (arr - np.array([0.485, 0.456, 0.406], dtype=np.float32)) / np.array([0.229, 0.224, 0.225], dtype=np.float32)
    arr = np.transpose(arr, (2, 0, 1))[None, ...]
    if model["mode"] == "onnx":
        session = model["session"]
        input_name = session.get_inputs()[0].name
        out = session.run(None, {input_name: arr})[0]
    elif model["mode"] == "torch":
        if torch is None:
            raise RuntimeError("PyTorch is not available")
        with torch.no_grad():
            tensor = torch.from_numpy(arr).float()
            out = model["network"](tensor)
            if isinstance(out, (list, tuple)):
                out = out[0]
            out = out.detach().cpu().numpy()
    else:
        raise RuntimeError(f"Unsupported model mode: {model['mode']}")
    flat = np.array(out).reshape(-1)
    if flat.size < 2:
        raise RuntimeError("Model output must contain at least [valence, arousal]")
    if flat.size >= 10:
        valence = float(clamp(float(flat[-2]), -1, 1))
        raw_arousal = float(flat[-1])
    else:
        valence = float(clamp(float(flat[0]), -1, 1))
        raw_arousal = float(flat[1])
    arousal = clamp((raw_arousal + 1.0) / 2.0, 0, 1)
    return valence, arousal, 0.9, model["mode"]


@app.get("/")
def root():
    model = get_model()
    return {
        "ok": True,
        "service": "EmoAcademy Emotion API",
        "model_loaded": model is not None,
        "model_path": model["path"] if model else None,
        "model_error": _model_error,
        "version": APP_VERSION,
    }


@app.get("/health")
def health():
    return root()


@app.post("/predict")
async def predict(file: UploadFile = File(...)):
    data = await file.read()
    try:
        img = Image.open(BytesIO(data)).convert("RGB")
    except Exception as exc:
        raise HTTPException(status_code=400, detail="Invalid image") from exc

    img_np = np.array(img)
    frame_height, frame_width, _ = img_np.shape
    bbox = detect_face_bbox(img_np)
    if bbox is None:
        raise HTTPException(status_code=422, detail="No face detected")

    x1 = max(0, int(bbox["x"]))
    y1 = max(0, int(bbox["y"]))
    x2 = min(frame_width, int(bbox["x"] + bbox["width"]))
    y2 = min(frame_height, int(bbox["y"] + bbox["height"]))
    face_img = img_np[y1:y2, x1:x2]
    if face_img.size == 0:
        raise HTTPException(status_code=422, detail="Invalid face region")

    model = get_model()
    if model is not None:
        valence, arousal, confidence, source = model_predict(face_img, model)
    else:
        valence, arousal, confidence, source = heuristic_predict(face_img)

    emotion = summarize_emotion(valence, arousal)
    return {
        "timestamp": time.time(),
        "valence": valence,
        "arousal": arousal,
        "confidence": confidence,
        "dominant_emotion": emotion["dominant"],
        "dominant_pct": emotion["dominant_pct"],
        "emotion_pct": emotion["pct"],
        "bbox": bbox,
        "frame_width": int(frame_width),
        "frame_height": int(frame_height),
        "source": source,
        "model_version": APP_VERSION,
        "model_loaded": model is not None,
    }
