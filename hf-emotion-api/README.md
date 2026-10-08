---
sdk: docker
app_port: 7860
---

# EmoAcademy Emotion API

DAiSEEの4指標を推論するEmoAcademy用APIです。

## モデルの置き方

`hf-emotion-api/models/` にモデルファイルを置くと、API起動時に自動で読み込みます。

- `daisee*.pt` / `daisee*.pth` がある場合: DAiSEE用の学習状態モデルとして扱います。
- それ以外の `.pt` / `.pth` / `.onnx` がある場合: 既存の表情・Valence/Arousalモデルとして扱います。
- `/health`はDAiSEEモデル未読込時に503を返します。

DAiSEEモデルの出力は、以下の4指標として返します。

- `boredom`: 退屈
- `engagement`: 集中・関与
- `confusion`: 混乱
- `frustration`: 負荷・フラストレーション

新しい`POST /predict/learning-affect`は`multipart/form-data`の`frames`として16個のJPEGを受け取り、`scores`、`dominant`、`confidence`、`model_version`、`quality`を返します。DAiSEEからValence/Arousalへの変換は行いません。別の専用モデル`models/enet_b0_8_va_mtl.pt`で最後のフレームを推論し、`valence_arousal: {valence, arousal, model}`として併せて返します。専用モデルを利用できない場合はnullとなり、4指標の結果は保持します。顔を検出できたフレームが12枚未満の場合は422です。1フレームの上限は512KBです。

```json
{"scores":{"boredom":18,"engagement":72,"confusion":24,"frustration":11},"dominant":"engagement","confidence":0.74,"model_version":"daisee-four-metrics-2026-10-08","quality":{"valid_frames":15,"total_frames":16,"warnings":[]}}
```

欠損フレームだけを時間的に最寄りの有効フレームで補います。全16枚を同じ静止画で置換しません。0〜3の強度クラスの期待値を0〜100へ換算し、4指標の合計は正規化しません。顔フレームはリクエスト完了後に保持しません。

旧`/predict`は従来モデル用に残しています。DAiSEEのPyTorchモデルでは16フレームのエンドポイントを使います。

## ローカル起動と検証

リポジトリ直下の`start-daisee.bat`で起動します。仮想環境は`.venv-daisee/`です。

```powershell
cd hf-emotion-api
.venv-daisee/Scripts/python.exe -m pip install httpx==0.28.1
.venv-daisee/Scripts/python.exe -m unittest test_learning_affect -v
```

現在のcheckpointは統合確認用です。未学習データでの予測精度を保証するものではありません。

## DAiSEEデータセットについて

DAiSEEデータセット本体は大容量なので、このリポジトリには入れません。ローカルまたは学習用マシンに置き、学習済みモデルだけを `models/` に入れてHugging Face Spaceへ載せます。

推奨の流れ:

1. DAiSEEを入手する。
2. ローカル、Colab、または別GPU環境で学習する。
3. `daisee_efficientnet_b2.pt` のような名前で保存する。
4. `hf-emotion-api/models/` に置く。
5. Hugging Face Spaceを再起動する。
