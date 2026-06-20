# EmoAcademy 仕様書

最終更新: 2026-06-20

## 1. 目的

EmoAcademyは、学生と教師が利用するオンライン学習プラットフォームです。学生は教材を選び、短い学習手順に沿って練習し、質問を送信できます。教師は教材の追加、学生への割り当て、進捗と質問の確認ができます。

感情モニターは学習を補助する任意機能です。表情から成績や能力を決定するものではありません。

## 2. 対象利用者

- 学生: 教材の学習、確認問題、自己説明、質問、進捗確認を行う。
- 教師: 教材の追加・割り当て、学生の進捗と質問の確認を行う。
- 管理者: 現段階では専用画面を実装しない。ユーザー管理はSupabase管理画面を使用する。

## 3. 実装済み機能

### 3.1 認証

- メールアドレスとパスワードによる新規登録・ログイン
- Googleログイン
- 学生・教師のロール選択
- パスワード再設定
- ログアウト
- アカウント削除
- Supabase Authによるセッション管理

**ロール**とは、利用者の種類と権限を表す値です。現在は`student`（学生）と`teacher`（教師）があります。

**セッション**とは、ログイン状態を安全に維持するための情報です。パスワードそのものはブラウザやアプリのファイルへ保存しません。

### 3.2 学生画面

- コースと教材の選択
- 教材の概要、所要時間、形式の表示
- コメント・質問の追加
- 完了状態の切り替え
- 4段階の学習ルート
  1. 思い出す
  2. 例を見る
  3. 自分の言葉で説明する
  4. ヒントなしで確認する
- 回答前の自信度選択
- 正誤フィードバック
- 翌日の復習予定への追加
- 感情モニターとArousal–Valence表示
- 日本語・英語の一時切り替え

**Arousal–Valence**とは、状態を「活発さ（Arousal）」と「快・不快の方向（Valence）」の2軸で表す方法です。本実装の値は画面確認用の簡易推定であり、感情を正確に診断する値ではありません。

### 3.3 教師画面

- PDFまたはWebリンク教材の入力
- タイトル、科目、所要時間、URL、学習指示の入力
- 学生IDによる教材割り当て操作
- 教材一覧
- 学生進捗一覧
- 最近のコメント表示

現在の教材入力と割り当ては画面内デモ状態です。永続保存にはSupabase DatabaseとStorageへの接続が必要です。

## 4. 学習設計と参考論文

### 4.1 行動につながるダッシュボード

進捗値だけを並べず、「次にすること」「おすすめの理由」「再開ボタン」を同じ場所へ配置しました。これは学習分析ダッシュボードが、認識だけでなく具体的な行動へつながる必要があるという研究を参考にしています。

- Susnjak, Ramaswami, & Mathrani (2022), [Learning analytics dashboard: a tool for providing actionable insights to learners](https://pmc.ncbi.nlm.nih.gov/articles/PMC8853217/)

**学習分析（Learning Analytics）**とは、学習履歴を集めて、進捗把握や次の学習行動の判断に利用する方法です。

### 4.2 思い出す練習

最初と最後に、答えを見る前に思い出す操作を入れました。単に読み直すだけではなく、記憶から取り出す練習を行うためです。

- Roediger & Karpicke (2006), [Test-Enhanced Learning](https://doi.org/10.1111/j.1467-9280.2006.01693.x)

**想起練習（Retrieval Practice）**とは、覚えた内容を見直す前に、自分の記憶から答えを取り出す練習です。

### 4.3 自己説明

例を見た後に、「なぜこの流れで会話が続くのか」を自分の言葉で書く欄を追加しました。

- Chi et al. (1994), [Eliciting Self-Explanations Improves Understanding](https://doi.org/10.1207/s15516709cog1803_3)

**自己説明（Self-explanation）**とは、学習内容の理由やつながりを、自分の言葉で説明する学習方法です。

### 4.4 自信度と学習の振り返り

確認問題の回答前に自信度を選択します。正解だけでなく、「自信があったか」「推測だったか」を区別し、次の復習判断へつなげるためです。

- Guo (2022), [Using metacognitive prompts to enhance self-regulated learning and learning outcomes](https://doi.org/10.1111/jcal.12650)

**メタ認知**とは、自分が何を理解し、何を理解していないかを自分で把握する働きです。

### 4.5 学習者が制御できるアニメーション

説明やヒントは自動再生せず、学習者がボタンを押した時だけ表示します。常時動く装飾を避け、学習段階の切り替え、進捗、選択、正誤など意味がある変化だけを短く動かします。

- Hasler, Kersten, & Sweller (2007/2009), [Learner control in animated multimedia instructions](https://doi.org/10.1007/s11251-009-9119-4)

**学習者制御（Learner Control）**とは、再生、停止、次へ進む操作などを学習者自身が選べる設計です。

## 5. アニメーション仕様

- ボタンホバー: 約160msで1px上へ移動する。
- ボタン押下: 約160msで少し縮小し、押した感触を示す。
- 選択状態: 約240msの小さな拡大と復帰で、状態変更を示す。
- 学習段階の変更: 約220msで右から短く表示する。
- 正誤・ヒント・目標メニュー: 約180msで出現する。
- 常時ループする装飾は使用しない。ただしLIVE状態の小さな点だけは状態表示として点滅する。
- OSの`prefers-reduced-motion`設定が有効な場合、アニメーション時間をほぼ0にする。

**prefers-reduced-motion**とは、画面の動きを減らしたいという利用者のOS設定をWebサイトへ伝える仕組みです。

## 6. フォント仕様

QuizletのWeb表示で使われる`Hurme Geometric Sans No. 2`系のフォント名を第1候補に指定しています。

```css
font-family: "hurmegeo sans no2", "hurme_no2-webfont",
  "Hurme Geometric Sans No. 2", "Nunito Sans", "Noto Sans JP", sans-serif;
```

Hurme Geometric Sans No. 2は商用フォントです。EmoAcademyにはライセンス不明のフォントファイルを複製していません。利用端末または正式に購入したWebフォントが存在する場合はHurmeを使用し、存在しない場合は英語をNunito Sans、日本語をNoto Sans JPで表示します。

## 7. 技術構成

- Next.js: Reactを使ってWeb画面とページ遷移を構成する仕組み。
- TypeScript: JavaScriptへ型の検査を追加し、入力ミスを見つけやすくする言語。
- Supabase Auth: 新規登録、ログイン、セッションを管理するサービス。
- Supabase Database: PostgreSQL形式のデータベース。プロフィールを保存する。
- Supabase Edge Function: サーバー側で安全にアカウント削除を行う小さな処理。
- Vercel: GitHubへ反映したNext.jsアプリを公開するサービス。
- localStorage: ブラウザ内だけに小さな状態を保存する仕組み。現在は学習ルートの完了状態を保存する。

## 8. 主要ファイル

- `src/components/auth-screen.tsx`: 新規登録・ログイン画面
- `src/components/learning-dashboard.tsx`: 学生・教師ダッシュボード
- `src/components/learning-session.tsx`: 論文知見を反映した4段階学習
- `src/components/emotion-camera.tsx`: 任意のカメラ確認機能
- `src/lib/supabase/client.ts`: Supabase接続
- `src/app/globals.css`: 色、余白、レスポンシブ表示、アニメーション
- `supabase/migrations`: データベース作成・変更SQL
- `supabase/functions/delete-account`: アカウント削除処理

## 9. データとプライバシー

- パスワードはSupabase Authが安全な形式で管理し、アプリから閲覧できない。
- Publishable Keyはブラウザ公開を前提とする。Secret Keyはブラウザへ置かない。
- カメラは利用者が開始した時だけ使用する。
- 現在のカメラ映像はサーバーへ送信しない。
- 感情推定を成績、処罰、教師評価へ直接利用しない。
- 学習データを保存するテーブルにはRLSを設定する。

**RLS（Row Level Security）**とは、データベースの各行について「本人だけが見られる」などのアクセス条件を設定する仕組みです。

## 10. レスポンシブ対応

- PC: コース、教材、感情モニターを3列で表示する。
- 中型画面: 感情モニターを教材下へ移動する。
- スマートフォン: コース一覧を開閉メニューにし、学習領域を1列表示する。
- 学習4段階はスマートフォンで2列表示にする。

## 11. 整理結果

- EmoAcademy本体は認証、学習画面、Supabase、画像だけの小さな構成であり、削除可能な独立ページや未使用画像はありませんでした。
- `online-learning-site`からプロジェクト全体や大量のUIライブラリはコピーせず、学習ルート、自己説明、自信度、次の復習という必要な考え方だけを小さな独立コンポーネントへ移植しました。
- 元の`learning1-emotion_detection-main`は参照元として残し、EmoAcademyの実行には依存させていません。

## 12. 現在の制限と次の実装候補

1. 教材・コメント・完了状態をSupabaseへ永続保存する。
2. 教師がクラスを作り、招待コードで学生が参加できるようにする。
3. 学習履歴から復習日を計算する間隔反復を追加する。
4. 教材ファイルをSupabase Storageへ保存する。
5. 教師画面へ学習者別の詳細表示を追加する。
6. 感情推定は研究モデルが完成するまで「補助シグナル」として扱い、本人が停止・削除できるようにする。

**間隔反復（Spaced Repetition）**とは、一度に繰り返すのではなく、時間を空けて復習する方法です。

## 13. 動作確認

```powershell
npm run lint
npm run typecheck
npm run build
```

公開URL: <https://emo-academy.vercel.app>
