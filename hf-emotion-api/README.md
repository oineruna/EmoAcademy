---
sdk: docker
app_port: 7860
---

# EmoAcademy Emotion API

Face-expression analysis API for EmoAcademy.

## モデルの置き方

`hf-emotion-api/models/` にモデルファイルを置くと、API起動時に自動で読み込みます。

- `daisee*.pt` / `daisee*.pth` がある場合: DAiSEE用の学習状態モデルとして扱います。
- それ以外の `.pt` / `.pth` / `.onnx` がある場合: 既存の表情・Valence/Arousalモデルとして扱います。
- モデルがない場合: カメラ映像の明るさや動きから簡易推定します。

DAiSEEモデルの出力は、以下の4指標として返します。

- `boredom`: 退屈
- `engagement`: 集中・関与
- `confusion`: 混乱
- `frustration`: 負荷・フラストレーション

レスポンスでは既存UIとの互換性のため `valence` と `arousal` も同時に返します。

## DAiSEEデータセットについて

DAiSEEデータセット本体は大容量なので、このリポジトリには入れません。ローカルまたは学習用マシンに置き、学習済みモデルだけを `models/` に入れてHugging Face Spaceへ載せます。

推奨の流れ:

1. DAiSEEを入手する。
2. ローカル、Colab、または別GPU環境で学習する。
3. `daisee_efficientnet_b2.pt` のような名前で保存する。
4. `hf-emotion-api/models/` に置く。
5. Hugging Face Spaceを再起動する。
