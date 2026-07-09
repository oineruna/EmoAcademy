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


APP_VERSION = "emotion-api-2026-07-09"
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


def softmax(values: np.ndarray) -> np.ndarray:
    shifted = values - np.max(values)
    exp_values = np.exp(shifted)
    return exp_values / max(float(exp_values.sum()), 1e-8)


def square_face_bbox(bbox: dict[str, Any], frame_width: int, frame_height: int, margin: float = 0.14):
    center_x = float(bbox["x"]) + float(bbox["width"]) / 2
    center_y = float(bbox["y"]) + float(bbox["height"]) / 2
    side = max(float(bbox["width"]), float(bbox["height"])) * (1 + margin * 2)
    side = min(side, float(frame_width), float(frame_height))
    x = clamp(center_x - side / 2, 0, frame_width - side)
    y = clamp(center_y - side / 2, 0, frame_height - side)
    return {
        "x": int(round(x)),
        "y": int(round(y)),
        "width": int(round(side)),
        "height": int(round(side)),
        "source": bbox["source"],
    }


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


def evaluate_capture_quality(
    frame_img: np.ndarray,
    face_img: np.ndarray,
    bbox: dict[str, Any],
):
    face_gray = (
        cv2.cvtColor(face_img, cv2.COLOR_RGB2GRAY)
        if cv2 is not None
        else np.mean(face_img, axis=2).astype(np.uint8)
    )
    brightness = float(face_gray.mean()) / 255.0
    contrast = float(face_gray.std()) / 255.0
    frame_area = max(int(frame_img.shape[0] * frame_img.shape[1]), 1)
    face_ratio = float(bbox["width"] * bbox["height"]) / frame_area
    sharpness = (
        float(cv2.Laplacian(face_gray, cv2.CV_64F).var())
        if cv2 is not None
        else None
    )
    warnings = []
    if face_ratio < 0.08:
        warnings.append("face_too_small")
    if brightness < 0.22:
        warnings.append("low_light")
    elif brightness > 0.88:
        warnings.append("overexposed")
    if contrast < 0.10:
        warnings.append("low_contrast")
    if sharpness is not None and sharpness < 35:
        warnings.append("blurred")
    return {
        "score": round(clamp(1.0 - len(warnings) * 0.18, 0.1, 1.0), 2),
        "brightness": round(brightness, 3),
        "contrast": round(contrast, 3),
        "face_ratio": round(face_ratio, 3),
        "sharpness": round(sharpness, 1) if sharpness is not None else None,
        "warnings": warnings,
    }


def interpret_model_output(flat: np.ndarray):
    if flat.size < 2:
        raise RuntimeError("Model output must contain at least [valence, arousal]")
    if flat.size >= 10:
        valence = float(clamp(float(flat[-2]), -1, 1))
        raw_arousal = float(flat[-1])
        probabilities = softmax(flat[:8])
        emotion_pct = {
            key: round(float(probabilities[index]) * 100)
            for index, key in enumerate(EMOTION_KEYS)
        }
        dominant_index = int(np.argmax(probabilities))
        dominant = EMOTION_KEYS[dominant_index]
        confidence = float(probabilities[dominant_index])
    else:
        valence = float(clamp(float(flat[0]), -1, 1))
        raw_arousal = float(flat[1])
        emotion = summarize_emotion(valence, clamp((raw_arousal + 1.0) / 2.0, 0, 1))
        emotion_pct = emotion["pct"]
        dominant = emotion["dominant"]
        confidence = float(emotion["dominant_pct"]) / 100
    arousal = clamp((raw_arousal + 1.0) / 2.0, 0, 1)
    return {
        "valence": valence,
        "arousal": arousal,
        "confidence": confidence,
        "source": "enet_b0_8_va_mtl",
        "dominant": dominant,
        "dominant_pct": emotion_pct[dominant],
        "emotion_pct": emotion_pct,
    }


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
    return interpret_model_output(np.array(out).reshape(-1))


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
    started_at = time.perf_counter()
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
    bbox = square_face_bbox(bbox, frame_width, frame_height)

    x1 = max(0, int(bbox["x"]))
    y1 = max(0, int(bbox["y"]))
    x2 = min(frame_width, int(bbox["x"] + bbox["width"]))
    y2 = min(frame_height, int(bbox["y"] + bbox["height"]))
    face_img = img_np[y1:y2, x1:x2]
    if face_img.size == 0:
        raise HTTPException(status_code=422, detail="Invalid face region")
    quality = evaluate_capture_quality(img_np, face_img, bbox)

    model = get_model()
    if model is not None:
        prediction = model_predict(face_img, model)
    else:
        valence, arousal, confidence, source = heuristic_predict(face_img)
        emotion = summarize_emotion(valence, arousal)
        prediction = {
            "valence": valence,
            "arousal": arousal,
            "confidence": confidence,
            "source": source,
            "dominant": emotion["dominant"],
            "dominant_pct": emotion["dominant_pct"],
            "emotion_pct": emotion["pct"],
        }
    return {
        "timestamp": time.time(),
        "valence": prediction["valence"],
        "arousal": prediction["arousal"],
        "confidence": prediction["confidence"],
        "dominant_emotion": prediction["dominant"],
        "dominant_pct": prediction["dominant_pct"],
        "emotion_pct": prediction["emotion_pct"],
        "bbox": bbox,
        "frame_width": int(frame_width),
        "frame_height": int(frame_height),
        "source": prediction["source"],
        "model_version": APP_VERSION,
        "model_loaded": model is not None,
        "quality": quality,
        "inference_ms": round((time.perf_counter() - started_at) * 1000, 1),
    }
