"""
Simple, replaceable emotion predictor module.

Currently uses a lightweight heuristic on an input image to produce
valence (range -1..1) and arousal (0..1). Replace `load_model` and
`predict_from_image` implementation with a trained regression model
(PyTorch/ONNX/TensorFlow) for production or research experiments.
"""
from io import BytesIO
import os
from PIL import Image
import numpy as np
import time
import mediapipe as mp

try:
    import cv2
except Exception:
    cv2 = None

try:
    import onnxruntime as ort
except Exception:
    ort = None

try:
    import torch
except Exception:
    torch = None


class NoFaceDetectedError(RuntimeError):
    """Raised when no face ROI is found in input image."""


_MP_FACE_DETECTOR = None
_MP_TASKS_FACE_DETECTOR = None


def _resolve_face_task_model_path():
    env_path = os.environ.get("MP_FACE_MODEL_PATH")
    if env_path and os.path.exists(env_path):
        return env_path

    candidates = [
        "./face_detector.task",
        "./models/face_detector.task",
        "./assets/face_detector.task",
    ]
    for path in candidates:
        if os.path.exists(path):
            return path
    return None


def _get_mediapipe_tasks_face_detector():
    global _MP_TASKS_FACE_DETECTOR
    if _MP_TASKS_FACE_DETECTOR is not None:
        return _MP_TASKS_FACE_DETECTOR

    model_path = _resolve_face_task_model_path()
    if not model_path:
        return None

    if not hasattr(mp, "tasks"):
        return None

    try:
        base_options = mp.tasks.BaseOptions(model_asset_path=model_path)
        vision = mp.tasks.vision
        options = vision.FaceDetectorOptions(
            base_options=base_options,
            running_mode=vision.RunningMode.IMAGE,
        )
        _MP_TASKS_FACE_DETECTOR = vision.FaceDetector.create_from_options(options)
    except Exception:
        _MP_TASKS_FACE_DETECTOR = None

    return _MP_TASKS_FACE_DETECTOR


def _get_mediapipe_face_detector():
    global _MP_FACE_DETECTOR
    if _MP_FACE_DETECTOR is None:
        _MP_FACE_DETECTOR = mp.solutions.face_detection.FaceDetection(
            model_selection=0,
            min_detection_confidence=0.35,
        )
    return _MP_FACE_DETECTOR


def _detect_face_bbox(img_np: np.ndarray):
    """Detect a face bbox in absolute pixel coordinates. Returns None if not found."""
    H, W, _ = img_np.shape

    # 0) MediaPipe Tasks detector (if face_detector.task is available)
    tasks_detector = _get_mediapipe_tasks_face_detector()
    if tasks_detector is not None:
        try:
            mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=img_np)
            detection_result = tasks_detector.detect(mp_image)
            if detection_result and detection_result.detections:
                faces = []
                for det in detection_result.detections:
                    bb = det.bounding_box
                    x1 = max(int(bb.origin_x), 0)
                    y1 = max(int(bb.origin_y), 0)
                    x2 = min(int(bb.origin_x + bb.width), W)
                    y2 = min(int(bb.origin_y + bb.height), H)
                    area = max(x2 - x1, 0) * max(y2 - y1, 0)
                    faces.append((area, x1, y1, x2, y2))
                if faces:
                    faces.sort(reverse=True)
                    _, x1, y1, x2, y2 = faces[0]
                    if x2 > x1 and y2 > y1:
                        return {
                            "x": x1,
                            "y": y1,
                            "width": x2 - x1,
                            "height": y2 - y1,
                            "source": "mediapipe_tasks",
                        }
        except Exception:
            pass

    # 1) MediaPipe detection on RGB image
    detector = _get_mediapipe_face_detector()
    results = detector.process(img_np)
    if results.detections:
        faces = []
        for det in results.detections:
            rel = det.location_data.relative_bounding_box
            x1 = max(int(rel.xmin * W), 0)
            y1 = max(int(rel.ymin * H), 0)
            x2 = min(int((rel.xmin + rel.width) * W), W)
            y2 = min(int((rel.ymin + rel.height) * H), H)
            area = max(x2 - x1, 0) * max(y2 - y1, 0)
            faces.append((area, x1, y1, x2, y2))
        faces.sort(reverse=True)
        _, x1, y1, x2, y2 = faces[0]
        if x2 > x1 and y2 > y1:
            return {"x": x1, "y": y1, "width": x2 - x1, "height": y2 - y1, "source": "mediapipe"}

    # 2) OpenCV Haar fallback (if available)
    if cv2 is not None:
        gray = cv2.cvtColor(img_np, cv2.COLOR_RGB2GRAY)
        cascade_path = cv2.data.haarcascades + "haarcascade_frontalface_default.xml"
        detector_cv = cv2.CascadeClassifier(cascade_path)
        detected = detector_cv.detectMultiScale(gray, scaleFactor=1.1, minNeighbors=5, minSize=(40, 40))
        if len(detected) > 0:
            x, y, w, h = max(detected, key=lambda r: r[2] * r[3])
            return {"x": int(x), "y": int(y), "width": int(w), "height": int(h), "source": "opencv"}

    return None


def _apply_timm_compat_fixes(model_obj):
    """Patch known missing attrs on older timm modules loaded via torch.load."""
    if torch is None or model_obj is None or not hasattr(model_obj, "modules"):
        return
    efficientnet_block_types = {"DepthwiseSeparableConv", "InvertedResidual"}
    for module in model_obj.modules():
        if module.__class__.__name__ in efficientnet_block_types:
            if not hasattr(module, "conv_s2d"):
                module.conv_s2d = None
            if not hasattr(module, "bn_s2d"):
                module.bn_s2d = torch.nn.Identity()
            if not hasattr(module, "aa"):
                module.aa = torch.nn.Identity()
            if not hasattr(module, "drop_path"):
                module.drop_path = torch.nn.Identity()


def load_model(path: str = None):
    """Load a model for affect/emotion prediction (.onnx, .pt, .pth)."""
    if not path:
        raise ValueError("Model path must be provided.")
    if not os.path.exists(path):
        raise ValueError(f"Model file not found: {path}")

    # Dynamically import DAiSEEEfficientNet to avoid circular imports
    try:
        from models_pytorch import DAiSEEEfficientNet
    except ImportError:
        DAiSEEEfficientNet = None

    ext = os.path.splitext(path)[1].lower()
    if ext == ".onnx":
        if ort is None:
            raise RuntimeError(
                "onnxruntime is not available in this environment. "
                "Install a compatible version or use a .pt/.pth model."
            )
        session = ort.InferenceSession(path, providers=["CPUExecutionProvider"])
        return {"mode": "onnx", "session": session, "loaded_at": time.time(), "path": path}

    if ext in {".pt", ".pth"}:
        if torch is None:
            raise RuntimeError("PyTorch is required to load .pt/.pth models. Please install torch.")

        device = "cpu"
        
        # 1) Try loading as a TorchScript model
        try:
            jit_model = torch.jit.load(path, map_location=device)
            jit_model.eval()
            return {"mode": "torchscript", "session": jit_model, "loaded_at": time.time(), "path": path}
        except Exception:
            pass

        # 2) Load standard PyTorch object (state_dict or full object)
        try:
            loaded_obj = torch.load(path, map_location=device)
            
            # Check if it is a dictionary representing our DAiSEEEfficientNet checkpoint (state dict or metadata dict)
            if isinstance(loaded_obj, dict) and DAiSEEEfficientNet is not None:
                model_obj = DAiSEEEfficientNet(pretrained=False)
                state_dict = loaded_obj.get("model_state_dict", loaded_obj)
                model_obj.load_state_dict(state_dict)
                model_obj.eval()
                print("Loaded DAiSEEEfficientNet model from state dict.")
                return {"mode": "daisee_torch", "session": model_obj, "loaded_at": time.time(), "path": path}
            
            # Check if it is a direct instance of DAiSEEEfficientNet
            if DAiSEEEfficientNet is not None and isinstance(loaded_obj, DAiSEEEfficientNet):
                loaded_obj.eval()
                print("Loaded DAiSEEEfficientNet model object directly.")
                return {"mode": "daisee_torch", "session": loaded_obj, "loaded_at": time.time(), "path": path}
            
            # Check class name string to handle cases where class type check might fail but behaves identical
            if hasattr(loaded_obj, "__class__") and loaded_obj.__class__.__name__ == "DAiSEEEfficientNet":
                loaded_obj.eval()
                print("Loaded DAiSEEEfficientNet model object directly (by name match).")
                return {"mode": "daisee_torch", "session": loaded_obj, "loaded_at": time.time(), "path": path}

            # Fallback/Legacy loaded PyTorch model handler
            if hasattr(loaded_obj, "eval"):
                _apply_timm_compat_fixes(loaded_obj)
                loaded_obj.eval()
                mode = "daisee_torch" if loaded_obj.__class__.__name__ == "DAiSEEEfficientNet" else "torch"
                return {"mode": mode, "session": loaded_obj, "loaded_at": time.time(), "path": path}
                
            raise ValueError("Loaded object does not have an eval() method and is not a valid state_dict.")
            
        except Exception as e:
            raise ValueError(f"Failed to load PyTorch model: {e}")

    raise ValueError("Unsupported model format. Use .onnx, .pt, or .pth")


def predict_from_image_bytes(image_bytes: bytes, model=None):
    """
    Predict affect/emotion outputs.
    Supports:
    - Legacy AffectNet models (outputs valence & arousal directly).
    - New DAiSEE video models (outputs 4 learning-affect states, mapped to valence & arousal for backward compatibility).
    """
    if not model or "mode" not in model:
        raise RuntimeError("Model must be loaded with load_model(path) before prediction.")
    session = model["session"]
    
    # Load image
    img = Image.open(BytesIO(image_bytes)).convert("RGB")
    img_np = np.array(img)
    frame_height, frame_width, _ = img_np.shape
    
    # Detect face ROI
    bbox = _detect_face_bbox(img_np)
    if bbox is None:
        model_path_hint = _resolve_face_task_model_path()
        if model_path_hint:
            raise NoFaceDetectedError("No face detected in frame. Move closer to camera and improve lighting.")
        raise NoFaceDetectedError(
            "No face detected in frame. Move closer to camera and improve lighting. "
            "Optional: set MP_FACE_MODEL_PATH to a valid face_detector.task for MediaPipe Tasks detector."
        )

    x1 = int(bbox["x"])
    y1 = int(bbox["y"])
    x2 = int(bbox["x"] + bbox["width"])
    y2 = int(bbox["y"] + bbox["height"])
    face_img = img_np[y1:y2, x1:x2]
    if face_img.size == 0:
        raise NoFaceDetectedError("Face ROI invalid after detection.")

    # Resize to model input size
    face_img = Image.fromarray(face_img).resize((224, 224))
    arr = np.array(face_img).astype(np.float32) / 255.0

    if model["mode"] == "daisee_torch":
        # New DAiSEE video-based model workflow
        # Apply standard ImageNet normalization
        mean = np.array([0.485, 0.456, 0.406], dtype=np.float32)
        std = np.array([0.229, 0.224, 0.225], dtype=np.float32)
        arr = (arr - mean) / std
        
        # Transpose HWC -> CHW: [3, 224, 224]
        arr = np.transpose(arr, (2, 0, 1))
        
        # For a single image input in real-time inference, replicate the frame `num_frames` times
        # to construct the expected video tensor structure: [batch_size, num_frames, 3, height, width]
        import daisee_config
        num_frames = getattr(daisee_config, "NUM_FRAMES", 16)
        arr_seq = np.stack([arr] * num_frames, axis=0) # [num_frames, 3, 224, 224]
        arr_batch = arr_seq[None, ...] # [1, num_frames, 3, 224, 224]
        
        tensor = torch.from_numpy(arr_batch).to(torch.float32)
        with torch.no_grad():
            out = session(tensor) # Output shape: [1, 4, 4]
            
        # Extract probabilities for the four categories: Boredom, Engagement, Confusion, Frustration
        # Each category has 4 intensity levels
        probs = torch.softmax(out, dim=2).squeeze(0).cpu().numpy() # [4, 4]
        
        # Calculate expectation-based scores (scale intensity levels 0..3 to range 0.0..1.0)
        intensities = []
        weights = np.array([0.0, 1.0, 2.0, 3.0], dtype=np.float32)
        for i in range(4):
            expected_intensity = np.sum(probs[i] * weights) # [0.0, 3.0]
            normalized_intensity = expected_intensity / 3.0 # [0.0, 1.0]
            intensities.append(normalized_intensity)
            
        boredom = float(intensities[0])
        engagement = float(intensities[1])
        confusion = float(intensities[2])
        frustration = float(intensities[3])
        
        # Map target affect intensities to 2D Valence-Arousal space for backward compatibility
        # - Valence (pleasantness): Engagement (+), Boredom (-), Confusion (-), Frustration (--)
        valence = 0.5 * engagement - 0.2 * boredom - 0.3 * confusion - 0.7 * frustration
        valence = float(np.clip(valence, -1.0, 1.0))
        
        # - Arousal (physiological activation): Frustration (++), Engagement (+), Confusion (+), Boredom (--)
        arousal = 0.5 * frustration + 0.4 * engagement + 0.3 * confusion - 0.3 * boredom + 0.3
        arousal = float(np.clip(arousal, 0.0, 1.0))
        
        return {
            "valence": valence,
            "arousal": arousal,
            "boredom": boredom,
            "engagement": engagement,
            "confusion": confusion,
            "frustration": frustration,
            "bbox": bbox,
            "frame_width": int(frame_width),
            "frame_height": int(frame_height),
            "model_version": "daisee_efficientnet_b2"
        }
        
    else:
        # Legacy/Original model workflow
        arr = np.transpose(arr, (2, 0, 1))[None, ...]  # (1,3,224,224)
        if model["mode"] == "onnx":
            input_name = session.get_inputs()[0].name
            outputs = session.run(None, {input_name: arr})
            out = outputs[0]
        elif model["mode"] in {"torch", "torchscript"}:
            if torch is None:
                raise RuntimeError("PyTorch is not available for .pt inference.")
            tensor = torch.from_numpy(arr).to(torch.float32)
            with torch.no_grad():
                out = session(tensor)
            if isinstance(out, (list, tuple)):
                out = out[0]
            if hasattr(out, "detach"):
                out = out.detach().cpu().numpy()
        else:
            raise RuntimeError(f"Unsupported loaded model mode: {model['mode']}")

        flat = np.array(out).reshape(-1)
        if flat.size < 2:
            raise RuntimeError("Model output must contain at least 2 values: [valence, arousal].")

        valence = float(np.clip(flat[0], -1.0, 1.0))
        raw_arousal = float(flat[1])
        arousal = float(np.clip((raw_arousal + 1.0) / 2.0, 0.0, 1.0)) if raw_arousal < 0 else float(np.clip(raw_arousal, 0.0, 1.0))
        return {
            "valence": valence,
            "arousal": arousal,
            "bbox": bbox,
            "frame_width": int(frame_width),
            "frame_height": int(frame_height),
            "model_version": "affectnet_legacy"
        }


if __name__ == "__main__":
    print("predictor module loaded.")

