"""4指標APIの入力・品質・モデル境界を検証する。画像は合成データ。"""
import io
import unittest
from unittest.mock import patch

import numpy as np
from PIL import Image
from fastapi import HTTPException
from fastapi.testclient import TestClient

import app as api


def image_bytes(index=0):
    data = np.random.default_rng(index).integers(20, 230, (240, 320, 3), dtype=np.uint8)
    stream = io.BytesIO()
    Image.fromarray(data).save(stream, format="JPEG")
    return stream.getvalue()


class FakeSession:
    def get_inputs(self):
        return [type("Input", (), {"name": "sequence"})()]

    def run(self, _, inputs):
        assert inputs["sequence"].shape == (1, 16, 3, 224, 224)
        logits = np.full((1, 4, 4), -20, dtype=np.float32)
        for index in range(4):
            logits[0, index, index] = 20
        return [logits]


class LearningAffectTests(unittest.TestCase):
    def setUp(self):
        va = patch.object(api, "valence_arousal_prediction", return_value={"valence": 0.25, "arousal": 0.7, "model": "enet_b0_8_va_mtl.pt"})
        va.start(); self.addCleanup(va.stop)
        self.client = TestClient(api.app)
        self.model = {"architecture": "daisee", "mode": "onnx", "session": FakeSession(), "path": "models/daisee_test.onnx"}
        self.face = {"x": 60, "y": 20, "width": 140, "height": 180, "source": "test"}

    def test_distinct_temporal_frames(self):
        with patch.object(api, "detect_face_bbox", return_value=self.face):
            sequence, quality = api.prepare_learning_sequence([image_bytes(i) for i in range(16)])
        self.assertEqual(sequence.shape, (1, 16, 3, 224, 224))
        self.assertEqual(quality["valid_frames"], 16)
        self.assertTrue(np.isfinite(sequence).all())
        self.assertFalse(np.array_equal(sequence[0, 0], sequence[0, 15]))

    def test_only_four_independent_scores(self):
        files = [("frames", (f"{i}.jpg", image_bytes(i), "image/jpeg")) for i in range(16)]
        with patch.object(api, "get_model", return_value=self.model), patch.object(api, "detect_face_bbox", return_value=self.face):
            response = self.client.post("/predict/learning-affect", files=files)
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertEqual(data["scores"], {"boredom": 0, "engagement": 33, "confusion": 67, "frustration": 100})
        self.assertGreater(sum(data["scores"].values()), 100)
        self.assertEqual(data["dominant"], "frustration")
        self.assertFalse({"valence", "arousal", "emotion_pct"} & data.keys())

    def test_dedicated_valence_arousal_and_missing_model(self):
        files = [("frames", (f"{i}.jpg", image_bytes(i), "image/jpeg")) for i in range(16)]
        with patch.object(api, "get_model", return_value=self.model), patch.object(api, "detect_face_bbox", return_value=self.face):
            data = self.client.post("/predict/learning-affect", files=files).json()
            self.assertEqual(data["valence_arousal"], {"valence": 0.25, "arousal": 0.7, "model": "enet_b0_8_va_mtl.pt"})
            with patch.object(api, "valence_arousal_prediction", side_effect=HTTPException(503, "missing")):
                response = self.client.post("/predict/learning-affect", files=files)
                self.assertEqual(response.status_code, 200)
                self.assertIsNone(response.json()["valence_arousal"])
                self.assertIsNotNone(response.json()["valence_arousal_error"])
                self.assertEqual(response.json()["scores"], data["scores"])

    def test_missing_face_frames(self):
        with patch.object(api, "detect_face_bbox", side_effect=[self.face] * 11 + [None] * 5):
            with self.assertRaises(HTTPException) as failure:
                api.prepare_learning_sequence([image_bytes(i) for i in range(16)])
        self.assertEqual(failure.exception.status_code, 422)
        with patch.object(api, "detect_face_bbox", side_effect=[self.face] * 12 + [None] * 4):
            sequence, quality = api.prepare_learning_sequence([image_bytes(i) for i in range(16)])
        self.assertEqual(quality["valid_frames"], 12)
        self.assertEqual(sequence.shape, (1, 16, 3, 224, 224))

    def test_wrong_count_and_oversized_frame(self):
        self.assertEqual(self.client.post("/predict/learning-affect", files={"frames": ("one.jpg", image_bytes())}).status_code, 422)
        files = [("frames", (f"{i}.jpg", b"x" * 512001, "image/jpeg")) for i in range(16)]
        self.assertEqual(self.client.post("/predict/learning-affect", files=files).status_code, 413)

    def test_no_model_never_falls_back(self):
        files = [("frames", (f"{i}.jpg", image_bytes(i), "image/jpeg")) for i in range(16)]
        for model in (None, {"architecture": "enet"}):
            with patch.object(api, "get_model", return_value=model):
                self.assertEqual(self.client.post("/predict/learning-affect", files=files).status_code, 503)

    def test_invalid_image_and_output(self):
        with self.assertRaises(HTTPException) as failure:
            api.prepare_learning_sequence([b"invalid"] * 16)
        self.assertEqual(failure.exception.status_code, 400)
        with patch.object(self.model["session"], "run", return_value=[np.zeros((1, 10))]):
            with self.assertRaises(HTTPException):
                api.learning_affect_prediction(np.zeros((1, 16, 3, 224, 224), dtype=np.float32), self.model)

    def test_health_model_gate(self):
        with patch.object(api, "get_model", return_value=None):
            self.assertEqual(self.client.get("/health").status_code, 503)
        with patch.object(api, "get_model", return_value=self.model):
            self.assertTrue(self.client.get("/health").json()["learning_affect_ready"])


if __name__ == "__main__":
    unittest.main()
