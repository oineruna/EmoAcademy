# DAiSEEデータセット利用メモ

## 結論

EmoAcademyでは、DAiSEEを「学習中の状態を推定するためのモデル学習データ」として使う。

ただし、DAiSEEの動画データ本体はリポジトリ、Vercel、通常のアプリ配布物には入れない。データセットはローカルまたは学習用環境に置き、学習済みモデルだけをHugging Face Spaceの推論APIへ置く。

## DAiSEEで扱う指標

DAiSEEは、学習者の動画クリップに対して以下の4種類の状態を扱う。

- Boredom: 退屈
- Engagement: 集中・関与
- Confusion: 混乱
- Frustration: 負荷・フラストレーション

それぞれを4段階の強さとして扱う。EmoAcademyのUIでは、この4指標を「学習状態」として表示する。

## EmoAcademyでの使い分け

- ログイン、ユーザー、ロール、学習進捗: Supabaseに保存する。
- 学習画面: VercelまたはHugging Face Static Spaceで表示する。
- 感情・学習状態の推論: Hugging Face SpaceのPython APIで行う。
- カメラ映像: 保存しない。推論用の短いフレームだけAPIに送り、数値結果だけ保存対象にする。

## 実装上の対応

`hf-emotion-api/app.py` は、`hf-emotion-api/models/` に `daisee*.pt` または `daisee*.pth` がある場合、DAiSEEモデルとして読み込む。

DAiSEEモデルは、16値の出力を想定する。

```text
4カテゴリ × 4段階 = 16値
```

APIレスポンスでは次を返す。

- `learning_affect_pct`: DAiSEEの4指標
- `dominant_learning_affect`: 一番強い学習状態
- `valence`: 既存UIと互換させるための気分軸
- `arousal`: 既存UIと互換させるための活性軸
- `emotion_pct`: 既存の8感情UIと互換させるための補助値

## データセットを置く場所

推奨:

```text
D:\datasets\DAiSEE
```

または、外付けSSDやColab/学習用マシン側に置く。

非推奨:

```text
D:\OneDrive - Kyushu Institute Of Technolgy\EmoAcademy\DAiSEE
```

理由は、OneDrive同期とGit管理が重くなりやすいため。

## 学習の流れ

1. DAiSEEを公式配布元から入手する。
2. 学習環境に動画とラベルCSVを配置する。
3. EfficientNet-B2などの動画分類モデルを学習する。
4. `daisee_efficientnet_b2.pt` として保存する。
5. `hf-emotion-api/models/` に置く。
6. Hugging Face Spaceを再起動する。
7. `/health` で `model_loaded: true` を確認する。

## 注意点

- DAiSEEは「成績判定」には使わない。
- 教師画面では、個人を責める指標ではなく、支援のきっかけとして扱う。
- 照明、顔角度、カメラ画質で精度が落ちる。
- 1フレームだけで判断するより、数秒間の連続フレームを使う方が自然。

## 参考

- DAiSEE公式配布ページ: https://people.iith.ac.in/vineethnb/resources/daisee/index.html
- DAiSEE論文: https://arxiv.org/abs/1609.01885
