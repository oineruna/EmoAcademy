from __future__ import annotations

from io import BytesIO
import os
import time
import threading
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
    import torch.nn as nn
except Exception:  # pragma: no cover
    torch = None
    nn = None

try:
    import timm
except Exception:  # pragma: no cover
    timm = None


APP_VERSION = "daisee-four-metrics-2026-10-08"
MODEL_DIR = Path(__file__).resolve().parent / "models"
MODEL_PATH = os.getenv("MODEL_PATH") or os.getenv("ONNX_MODEL_PATH")
EMOTION_KEYS = ["anger", "contempt", "disgust", "fear", "happiness", "neutral", "sadness", "surprise"]
DAISEE_KEYS = ["boredom", "engagement", "confusion", "frustration"]
DAISEE_NUM_FRAMES = int(os.getenv("DAISEE_NUM_FRAMES", "16"))
_inference_lock = threading.Lock()

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


class DAiSEEEfficientNet(nn.Module if nn is not None else object):
    """EfficientNet-B2 + temporal average pooling for DAiSEE 4-axis learning affect."""

    def __init__(self, pretrained: bool = False, dropout_rate: float = 0.2):
        if nn is None or timm is None:
            raise RuntimeError("PyTorch/timm is required for the DAiSEE model")
        super().__init__()
        self.backbone = timm.create_model("efficientnet_b2", pretrained=pretrained, num_classes=0)
        self.num_features = getattr(self.backbone, "num_features", 1408)
        self.dropout = nn.Dropout(p=dropout_rate)
        self.classifier = nn.Linear(self.num_features, 4 * 4)

    def forward(self, x):
        batch_size, num_frames, channels, height, width = x.size()
        x_flat = x.view(batch_size * num_frames, channels, height, width)
        features = self.backbone(x_flat)
        features = features.view(batch_size, num_frames, self.num_features)
        pooled_features = torch.mean(features, dim=1)
        logits = self.classifier(self.dropout(pooled_features))
        return logits.view(batch_size, 4, 4)


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
    for pattern in ("daisee*.onnx", "daisee*.pt", "daisee*.pth", "*.onnx", "*.pt", "*.pth"):
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
        architecture = "daisee" if len(session.get_inputs()[0].shape) == 5 else "enet"
        return {"mode": "onnx", "session": session, "path": path, "loaded_at": time.time(), "architecture": architecture}
    if path.lower().endswith((".pt", ".pth")):
        if torch is None:
            raise RuntimeError("PyTorch is not available")
        checkpoint = torch.load(path, map_location="cpu", weights_only=False)
        architecture = "daisee" if "daisee" in Path(path).name.lower() else "enet"
        if isinstance(checkpoint, dict) and "model_state_dict" in checkpoint:
            network = DAiSEEEfficientNet(pretrained=False)
            network.load_state_dict(checkpoint["model_state_dict"])
            architecture = "daisee"
        else:
            network = checkpoint
            if hasattr(network, "classifier") and "daisee" in network.__class__.__name__.lower():
                architecture = "daisee"
        network.eval()
        return {"mode": "torch", "network": network, "path": path, "loaded_at": time.time(), "architecture": architecture}
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
    if flat.size == 16:
        logits = flat.reshape(4, 4)
        probabilities = np.stack([softmax(row) for row in logits], axis=0)
        levels = np.array([0.0, 1.0, 2.0, 3.0], dtype=np.float32)
        daisee_scores = probabilities.dot(levels) / 3.0
        daisee_pct = {
            key: round(float(daisee_scores[index]) * 100)
            for index, key in enumerate(DAISEE_KEYS)
        }
        engagement = float(daisee_scores[1])
        support_load = float((daisee_scores[0] + daisee_scores[2] + daisee_scores[3]) / 3.0)
        valence = clamp((engagement - support_load) * 1.25, -1, 1)
        arousal = clamp(0.28 + engagement * 0.34 + float(daisee_scores[2]) * 0.22 + float(daisee_scores[3]) * 0.3, 0, 1)
        emotion_pct = {
            "anger": round(float(daisee_scores[3]) * 45),
            "contempt": round(float(daisee_scores[0]) * 20),
            "disgust": round(float(daisee_scores[3]) * 20),
            "fear": round(float(daisee_scores[2]) * 55),
            "happiness": round(engagement * 78),
            "neutral": round(max(0.0, 1.0 - max(engagement, support_load)) * 75),
            "sadness": round(float(daisee_scores[0]) * 62),
            "surprise": round(float(daisee_scores[2]) * 25),
        }
        dominant_learning_index = int(np.argmax(daisee_scores))
        dominant_learning = DAISEE_KEYS[dominant_learning_index]
        dominant_emotion = max(emotion_pct, key=emotion_pct.get)
        confidence = float(np.max(probabilities[dominant_learning_index]))
        return {
            "valence": valence,
            "arousal": arousal,
            "confidence": confidence,
            "source": "daisee_efficientnet_b2",
            "dominant": dominant_emotion,
            "dominant_pct": emotion_pct[dominant_emotion],
            "emotion_pct": emotion_pct,
            "learning_affect_pct": daisee_pct,
            "dominant_learning_affect": dominant_learning,
        }
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
            if model.get("architecture") == "daisee":
                raise HTTPException(status_code=422, detail="DAiSEE requires 16 frames at /predict/learning-affect")
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
    result = root()
    model = get_model()
    ready = model is not None and model.get("architecture") == "daisee"
    result.update(ok=ready, learning_affect_ready=ready, metrics=DAISEE_KEYS, frames=16)
    if not ready:
        from fastapi.responses import JSONResponse
        return JSONResponse(status_code=503, content=result)
    return result


def prepare_learning_sequence(images: list[bytes]):
    """時系列を維持し、欠損位置だけを最寄りの有効フレームで補う。"""
    processed: dict[int, np.ndarray] = {}
    warnings: set[str] = set()
    for index, data in enumerate(images):
        try:
            image = Image.open(BytesIO(data))
            if image.width * image.height > 8_000_000:
                raise HTTPException(status_code=413, detail="Frame dimensions too large")
            image = image.convert("RGB")
            frame = np.array(image)
        except HTTPException:
            raise
        except Exception as exc:
            raise HTTPException(status_code=400, detail=f"Invalid image at frame {index}") from exc
        bbox = detect_face_bbox(frame)
        if bbox is None:
            continue
        bbox = square_face_bbox(bbox, image.width, image.height)
        x, y, width, height = (bbox[k] for k in ("x", "y", "width", "height"))
        face = frame[y:y + height, x:x + width]
        if not face.size:
            continue
        quality = evaluate_capture_quality(frame, face, bbox)
        warnings.update(quality["warnings"])
        # 学習データと同じImageNet正規化。画像はリクエスト内だけで扱う。
        resized = np.array(Image.fromarray(face).resize((224, 224))).astype(np.float32) / 255.0
        normalized = (resized - np.array([0.485, 0.456, 0.406], dtype=np.float32)) / np.array([0.229, 0.224, 0.225], dtype=np.float32)
        processed[index] = normalized.transpose(2, 0, 1)
    if len(processed) < 12:
        raise HTTPException(status_code=422, detail={"message": "Insufficient valid face frames", "valid_frames": len(processed), "total_frames": 16})
    sequence = np.stack([processed[min(processed, key=lambda valid: abs(valid - index))] for index in range(16)])[None, ...]
    return sequence, {"valid_frames": len(processed), "total_frames": 16, "warnings": sorted(warnings)}


def learning_affect_prediction(sequence: np.ndarray, model: dict[str, Any]):
    if model.get("architecture") != "daisee":
        raise HTTPException(status_code=503, detail="DAiSEE checkpoint is not loaded")
    if model["mode"] == "torch":
        with torch.inference_mode():
            logits = model["network"](torch.from_numpy(sequence).float()).detach().cpu().numpy()
    else:
        session = model["session"]
        logits = session.run(None, {session.get_inputs()[0].name: sequence})[0]
    logits = np.asarray(logits)
    if logits.shape != (1, 4, 4) or not np.isfinite(logits).all():
        raise HTTPException(status_code=503, detail="Invalid DAiSEE model output")
    probabilities = np.stack([softmax(row) for row in logits[0]])
    strengths = probabilities @ np.arange(4, dtype=np.float32) / 3.0 * 100.0
    scores = {key: int(round(float(strengths[index]))) for index, key in enumerate(DAISEE_KEYS)}
    return {
        "scores": scores,
        "dominant": max(scores, key=scores.get),
        "confidence": round(float(probabilities.max(axis=1).mean()), 4),
        "model_version": APP_VERSION,
    }


@app.post("/predict/learning-affect")
def predict_learning_affect(frames: list[UploadFile] = File(...)):
    if len(frames) != 16:
        raise HTTPException(status_code=422, detail="Exactly 16 frames required")
    images = []
    for frame in frames:
        data = frame.file.read(512_001)
        if len(data) > 512_000:
            raise HTTPException(status_code=413, detail="Frame exceeds 512 KB")
        images.append(data)
    with _inference_lock:
        model = get_model()
        if model is None or model.get("architecture") != "daisee":
            raise HTTPException(status_code=503, detail="DAiSEE checkpoint is not loaded")
        sequence, quality = prepare_learning_sequence(images)
        result = learning_affect_prediction(sequence, model)
    return {**result, "quality": quality}


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
        "learning_affect_pct": prediction.get("learning_affect_pct"),
        "dominant_learning_affect": prediction.get("dominant_learning_affect"),
        "bbox": bbox,
        "frame_width": int(frame_width),
        "frame_height": int(frame_height),
        "source": prediction["source"],
        "model_version": APP_VERSION,
        "model_loaded": model is not None,
        "quality": quality,
        "inference_ms": round((time.perf_counter() - started_at) * 1000, 1),
    }
