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

新しい`POST /predict/learning-affect`は`multipart/form-data`の`frames`として16個のJPEGを受け取り、`scores`、`dominant`、`confidence`、`model_version`、`quality`を返します。DAiSEEの4指標から`valence_arousal: {valence, arousal, model, source, method}`も算出します。ENetの追加推論は行いません。気分・活性は暫定ルールによる派生値で、独立して学習・校正した感情指標ではありません。顔を検出できたフレームが12枚未満の場合は422です。1フレームの上限は512KBです。

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

## 1モデルでの派生指標と差し替え

B・E・C・Fをそれぞれ退屈・関与・混乱・フラストレーションの0〜100値とする。

- Valence = `(E - (B+C+F)/3) / 100`（−1〜+1）
- Arousal = `(E+C+F+100-B) / 400`（0〜1）
- 方法ID: `daisee-proxy-v1`

表示では直近5回の平均の4指標から同じ式を適用し、グラフとの関係を保つ。APIでは各推論の4指標から計算する。全指標が50ならValence=0、Arousal=0.5となる。元のDAiSEEモデルの性能不足を解消する処理ではない。

差し替え先は`models/daisee_efficientnet_b2.pt`。現在のEfficientNet-B2・16フレーム・224×224・4指標×4段階のモデルと同じ構造の`model_state_dict`を含むcheckpointが必要。`.pt`という拡張子だけでは互換性を保証しない。ローカルでは`stop-daisee.bat`の後に`start-daisee.bat`で再読込する。公開APIでは重みを再アップロードして再起動する。ローカルに置いただけでは公開APIの重みは変わらない。
