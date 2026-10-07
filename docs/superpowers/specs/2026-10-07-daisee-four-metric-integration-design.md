# DAiSEE 4指標統合設計

## 目的

現在のEmoAcademyのQuizlet風学習画面、Supabase認証、教材、提出、Q&Aを維持したまま、カメラ映像からDAiSEEの4指標だけを推論・保存・表示する。

- 退屈 `boredom`
- 集中・関与 `engagement`
- 混乱 `confusion`
- フラストレーション `frustration`

学生には4指標をリアルタイム表示し、教師には学生別・クラス別の平均と時系列推移を表示する。一般的な8感情、Valence、Arousalは新しい処理経路では使用しない。

## 統合方針

`Emotion_detection_YOLO-main`を別アプリとして動かしたり、丸ごとEmoAcademyへコピーしたりしない。このフォルダは既存の`learning1-emotion_detection-main`とほぼ同じ構造で、独立したYOLO推論基盤ではない。次の部分だけを現在の構成へ取り込む。

- `models_pytorch.py`のDAiSEE EfficientNet-B2構造
- `daisee_dataset.py`の16フレーム前処理
- `train.py`と`evaluate.py`の学習・評価方法
- `predictor.py`のcheckpoint読み込み方法

次は取り込まない。

- `static/`以下の旧学生・教師・管理画面
- SQLiteの認証・教材・ログ機能
- `uploads/`以下のPDF
- 旧アプリのユーザー管理とAPI
- DAiSEEデータセット本体

DAiSEEデータセット本体は`D:\datasets\DAiSEE`に置き、学習済みcheckpointだけを`hf-emotion-api/models/`で扱う。

## システム構成

```text
EmoAcademy / EmotionCamera
  └─ 4秒程度で16枚のフレームを取得
       ↓ multipart/form-data
Emotion API /predict/learning-affect
  ├─ 各フレームから顔領域を検出
  ├─ 16枚を同じ前処理で224×224へ変換
  ├─ DAiSEE EfficientNet-B2へ [1,16,3,224,224] として入力
  └─ 4指標を0〜100で返す
       ↓
学生画面へリアルタイム表示
       ↓
Supabase learning_affect_samplesへ保存
       ↓
教師画面で平均・推移を表示
```

ブラウザから送るのは顔周辺を含む一時的なフレームだけとし、画像や動画自体はSupabaseへ保存しない。Emotion APIもリクエスト完了後に画像を保持しない。

## 推論API

新しいエンドポイントを追加する。

```http
POST /predict/learning-affect
Content-Type: multipart/form-data
frames: 16個のJPEG
```

レスポンスは4指標に限定する。

```json
{
  "scores": {
    "boredom": 18,
    "engagement": 72,
    "confusion": 24,
    "frustration": 11
  },
  "dominant": "engagement",
  "confidence": 0.74,
  "model_version": "daisee-efficientnet-b2",
  "quality": {
    "valid_frames": 15,
    "total_frames": 16
  }
}
```

4つの値は合計100に正規化しない。それぞれ独立した0〜3の強度推定を0〜100へ換算する。`dominant`は最大値の指標とする。

同じ静止画を16回複製する処理は廃止し、異なる時刻の16フレームを入力する。顔を検出できた有効フレームが12枚未満の場合は推論値を返さず、再測定を要求する。

## 学生画面

現在の右側の感情モニターを維持し、中身を4指標専用に変更する。

- カメラプレビュー
- 現在もっとも強い学習状態
- 退屈、集中・関与、混乱、フラストレーションの4本のバー
- API接続状態と測定品質
- 直近5回の移動平均

一般感情の円グラフ、Valence/Arousal座標、8感情の割合、気分・活性の数値は表示しない。推論APIが利用できない場合は4指標をブラウザ内の簡易式で捏造せず、「分析APIに接続できません」と表示する。

学生への支援文は単発値では決めない。直近3回以上で同じ傾向が継続した場合だけ表示する。

- 退屈が継続: 課題を短い単位に分ける提案
- 混乱が継続: 例題・説明の再確認を提案
- フラストレーションが継続: 短い休憩を提案
- 集中・関与が高い: 現在の学習を継続

## 教師画面

教師画面には生の画像を表示しない。次の集計だけを表示する。

- 学生ごとの最新4指標
- 学生ごとのセッション平均
- 5分単位の4指標の時系列推移
- クラス全体の4指標平均
- 継続して高い混乱・フラストレーションの件数

支援操作は既存の「休憩」「分割」「確認」を維持する。成績評価や自動採点には使用しない。

教師ダッシュボードは情報量を増やしすぎず、4指標の概要を主カード、詳細推移を展開式の領域に置く。

## Supabase

既存の`emotion_samples`は過去データ保持のため削除しない。新しい処理は専用テーブルを使用する。

```text
learning_affect_samples
- id uuid
- user_id uuid
- material_id uuid nullable
- study_session_id uuid nullable
- boredom smallint 0..100
- engagement smallint 0..100
- confusion smallint 0..100
- frustration smallint 0..100
- dominant_affect text
- confidence double precision nullable
- valid_frames smallint
- model_version text
- captured_at timestamptz
```

RLSは次の範囲にする。

- 学生: 自分のデータのみ追加・参照可能
- 教師: 自分が所有する`study_groups`に所属する学生のデータのみ参照可能
- 匿名ユーザー: 参照・追加不可
- 画像・動画: 保存しない

教師向け集計は、認証済み教師だけが呼べるSupabase RPCで返す。RPCは`study_groups`と`study_group_members`で担当範囲を検証したうえで、学生ID、時間範囲、教材IDをフィルターに持ち、必要な平均値と時間バケットだけを返す。

## 移行方法

1. 新しいSupabaseテーブルとRLSをmigrationで追加する。
2. Emotion APIへ16フレーム対応エンドポイントを追加する。
3. API単体でcheckpoint読み込み、出力形状、欠損フレームを検証する。
4. `EmotionCamera`を4指標の型と表示へ切り替える。
5. 新しいテーブルへの保存処理を接続する。
6. 学生画面のリアルタイム表示を確認する。
7. 教師画面の平均・推移を接続する。
8. 旧`emotion_samples`参照を停止する。
9. 公開推論環境の`/health`がDAiSEE checkpointを報告した後だけ、本番環境変数を切り替える。

既存データを4指標へ変換しない。Valence/ArousalからDAiSEE指標を逆算すると、実測値と推定値が混在するためである。

## エラー処理

- API未接続: 4指標を表示・保存しない
- 有効フレーム不足: 明るさ、顔位置、カメラ距離を案内して再測定
- checkpoint未読込: `/health`を失敗状態にし、推論を開始しない
- Supabase保存失敗: 画面表示は続け、保存失敗を再試行キューへ入れる
- カメラ拒否: 手動で開始できる停止状態へ戻す

## 検証

### API

- checkpointを読み込める
- 入力が`[1,16,3,224,224]`になる
- 出力が`[1,4,4]`になる
- 4指標が0〜100に収まる
- 12枚未満の有効フレームを拒否する
- レスポンスに一般感情、Valence、Arousalが含まれない

### Supabase

- 学生が自分の行だけ追加・参照できる
- 他学生の行を参照できない
- 教師が自分の学習グループに所属する学生だけを参照できる
- 教師だけが集計RPCを呼べ、担当外グループを指定すると拒否される
- 匿名アクセスが拒否される

### UI

- 学生画面に4指標だけが表示される
- メニュー切替で3カラムの位置が変わらない
- API未接続時に偽の値を表示しない
- 教師画面の平均と推移が保存データと一致する

## 公開条件

現在の公開Emotion APIは旧ENetモデルを使用しており、Hugging Face Docker Spaceの更新は課金条件で停止している。コード統合とローカル検証を先に完了し、公開時はDAiSEE checkpointを実行できるDocker環境を用意する。

現在のDAiSEE checkpointは配線と推論経路の動作確認にだけ使用する。研究上妥当な測定器として扱わず、学生・教師へ正式提供するcheckpointには4指標それぞれの検証結果を記録する。

本番サイトの`NEXT_PUBLIC_EMOTION_API_URL`は、公開APIの`/health`が`daisee_efficientnet_b2.pt`を返し、16フレーム推論テストに成功してから設定する。GitHubにcheckpointが存在するだけでは公開利用済みと判定しない。

## 対象外

- DAiSEEデータセットのリポジトリ保存
- 旧HTMLアプリの移植
- PDFアップロードファイルの移行
- 感情値による採点・成績評価
- 顔画像や動画の永続保存
- 新しい一般感情分類器の追加
