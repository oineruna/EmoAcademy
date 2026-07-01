# EmoAcademy 仕様書

最終更新: 2026-07-01  
対象リポジトリ: `EmoAcademy`  
公開予定URL: <https://emo-academy.vercel.app>

## 1. この仕様書の目的

この文書は、EmoAcademyを自分で保守・拡張・公開できるようにするための仕様書です。画面の見た目だけでなく、ログイン、Supabase、Vercel、GitHub、データ保存、今後追加すべきテーブルまで含めます。

専門用語は初出で説明します。実装済みと未実装を分け、あとで「どこまで本当にできているのか」が分かるようにします。

## 2. プロダクト概要

EmoAcademyは、学生と教師が使う学習プラットフォームです。

- 学生はログイン後、Quizletに近いホーム画面で学習セット、最近の学習、学習再開、感情モニターを確認する。
- 教師は教材の追加、割り当て、学生進捗、コメント確認を行う。
- 認証はSupabase Authを使う。
- 公開はVercelを使う。
- コード管理はGitHubを使う。

感情モニターは学習支援のための補助機能です。成績判定、処罰、能力判定には使いません。

## 3. 対象ユーザー

### 3.1 学生

- メール/パスワードまたはGoogleでログインする。
- 学習セットを再開する。
- 最近の学習内容を見る。
- 感情モニターを任意で起動する。
- 日本語/英語を切り替える。

### 3.2 教師

- 教材を追加する。
- 教材を学生へ割り当てる。
- 学生の進捗やコメントを確認する。
- 日本語/英語を切り替える。

### 3.3 管理者

現時点では、サイト内に専用の管理画面はありません。管理者はSupabaseの管理画面でユーザー、プロフィール、ロールを確認します。

## 4. 現在の技術構成

| 項目           | 使用技術                       | 役割                                               |
| -------------- | ------------------------------ | -------------------------------------------------- |
| フロントエンド | Next.js 16 / React 19          | 画面、ページ、ユーザー操作を作る                   |
| 言語           | TypeScript                     | JavaScriptに型チェックを追加する                   |
| スタイル       | CSS / Tailwind v4 PostCSS依存  | 見た目、レスポンシブ、アニメーション               |
| 認証           | Supabase Auth                  | 新規登録、ログイン、Googleログイン、セッション管理 |
| データベース   | Supabase Database / PostgreSQL | プロフィール、ロール、将来的な進捗保存             |
| サーバー処理   | Supabase Edge Functions / Hugging Face Space | アカウント削除、感情推論APIなど、ブラウザだけで完結しない処理 |
| ホスティング   | Vercel                         | Webサイトの公開と自動デプロイ                      |
| コード管理     | GitHub                         | ソースコードの保存、履歴管理、Vercel連携           |
| 感情推論       | Hugging Face Spaces / PyTorch  | `enet_b0_8_va_mtl.pt` を使ったフレーム単位の感情推論 |

### 用語説明

- **フロントエンド**: ユーザーがブラウザで見る画面側の実装。
- **Next.js**: Reactを使ってWebアプリを作るためのフレームワーク。ページ遷移、ビルド、公開向け最適化を扱う。
- **React**: 画面を部品単位で作るJavaScriptライブラリ。
- **TypeScript**: JavaScriptに型を追加した言語。文字列と数値の取り違えなどを見つけやすくする。
- **PostgreSQL**: Supabaseの中で使われるデータベース。
- **ホスティング**: Webサイトをインターネット上で見られるように置くこと。
- **デプロイ**: 作ったコードを公開サーバーへ反映すること。

## 5. 現在のアプリ構成

```text
EmoAcademy
├─ src
│  ├─ app
│  │  ├─ page.tsx                 ログイン/新規登録画面
│  │  ├─ dashboard/page.tsx        ログイン後画面
│  │  ├─ auth/callback/page.tsx    メール確認/Googleログイン後の戻り先
│  │  ├─ reset-password/page.tsx   パスワード再設定
│  │  ├─ terms/page.tsx            利用規約
│  │  ├─ privacy/page.tsx          プライバシーポリシー
│  │  ├─ layout.tsx                フォント、メタ情報、favicon
│  │  └─ globals.css               全体スタイル
│  ├─ components
│  │  ├─ auth-screen.tsx           認証画面
│  │  ├─ learning-dashboard.tsx    学生/教師ダッシュボード
│  │  ├─ emotion-camera.tsx        感情モニター
│  │  └─ learning-session.tsx      学習セッション部品候補
│  └─ lib/supabase/client.ts       Supabase接続
├─ supabase
│  ├─ migrations                   DBテーブル作成SQL
│  └─ functions/delete-account     アカウント削除Edge Function
├─ hf-emotion-api                  Hugging Face上で動かす感情推論API
│  ├─ app.py
│  └─ models/enet_b0_8_va_mtl.pt
├─ public
│  ├─ emoacademy-mark.png          ロゴ/favicon
│  └─ classroom-desk.jpg           ログイン/カード用画像
├─ docs
│  ├─ SPECIFICATION.md             この仕様書
│  └─ COMPLETED.md                 完了したものの解説
└─ next.config.ts                  Next.js設定
```

## 6. 画面仕様

### 6.1 ログイン/新規登録画面

実装ファイル: `src/components/auth-screen.tsx`

主な機能:

- ログイン/新規登録タブ
- メールアドレス/パスワードログイン
- Googleログイン
- 新規登録時のみロール選択
  - 学生
  - 教師
- パスワード強度バー
- パスワード表示/非表示
- ログインしたままにする
- パスワード復旧
- 確認メール再送
- 利用規約/プライバシーポリシー/学習データ取り扱い同意
- 日本語/英語切り替え

### 6.2 学生ダッシュボード

実装ファイル: `src/components/learning-dashboard.tsx`

現在はQuizlet風の構成です。

- 左サイドメニュー
  - ホーム
  - ライブラリー
  - 学習グループ
  - 単語カード
- 中央フィード
  - 続きから始める
  - 最近
  - あなた向けの学習
  - 単語カード作成カード
- 右側
  - 感情モニター
  - 閉じた状態とLIVE状態で同じカード構造
  - 気分/活性、感情割合、タイムライン表示

現時点の学生画面の進捗値や教材はデモデータです。Supabaseへ永続保存するには、後述の進捗テーブルが必要です。

### 6.3 教師ダッシュボード

実装ファイル: `src/components/learning-dashboard.tsx`

主な機能:

- 教材追加フォーム
- PDFまたはWebリンク教材の選択
- 教材タイトル、科目、所要時間、URL、学習指示
- 学生IDへの割り当て操作
- 教材一覧
- 学生進捗一覧
- 最近のコメント

現時点では教師画面もデモ状態です。入力した教材はブラウザ上の状態として扱われ、Supabaseへ永続保存されません。

### 6.4 感情モニター

実装ファイル: `src/components/emotion-camera.tsx`

主な仕様:

- ユーザーが感情モニターを開くとカメラを開始する。
- 閉じた状態とLIVE状態で同じカード構造を使う。
- ブラウザ上では短い間隔で簡易推定を行い、UIをリアルタイムに動かす。
- 約2.5秒ごとにHugging Face Emotion APIへフレーム画像を送り、`enet_b0_8_va_mtl.pt` による推論結果を反映する。
- 保存するのは動画ではなく、`valence`、`arousal`、主な感情、信頼度、モデル情報などの数値ログ。
- 学習支援用の補助信号として扱い、成績判定や処罰には使わない。
- 参考元: `C:\Users\Admin\Downloads\learning1-emotion_detection-main` のカメラ、顔領域、タイムライン、Valence/Arousal更新の構成。

### 用語説明

- **Valence**: 快/不快の方向を表す軸。
- **Arousal**: 活性度、つまり落ち着いているか興奮しているかを表す軸。
- **ローカル処理**: サーバーへ送らず、利用者のブラウザ内で処理すること。
- **Hugging Face Space**: Python APIや静的サイトを公開できるホスティング環境。ここではWeb本体と感情推論APIに使う。
- **PyTorch**: 機械学習モデルを動かすためのPythonライブラリ。

## 7. 認証仕様

### 7.1 使用サービス

認証はSupabase Authを使用します。

Supabase Authが担当するもの:

- ユーザー登録
- ログイン
- Google OAuthログイン
- メール確認
- パスワード再設定
- セッション管理
- パスワードの安全な保存

アプリ側でパスワードそのものを見ることはできません。Supabase管理画面でも、パスワードの生データは見られません。

### 7.2 ログイン方法

| 方法              | 実装状況 | 備考                                   |
| ----------------- | -------: | -------------------------------------- |
| メール/パスワード | 実装済み | Supabase Auth                          |
| Googleログイン    | 実装済み | Supabase側とGoogle Cloud側の設定が必要 |
| Microsoftログイン |   未実装 | 必要ならSupabase Provider追加          |
| Appleログイン     |   未実装 | Apple Developer設定が必要              |

### 7.3 セッション

**セッション**とは、ログイン状態を維持するための情報です。

EmoAcademyでは2種類の保存先を使い分けます。

| ユーザー操作              | 保存先         | 挙動                              |
| ------------------------- | -------------- | --------------------------------- |
| ログインしたままにするON  | localStorage   | ブラウザを閉じても残りやすい      |
| ログインしたままにするOFF | sessionStorage | タブ/ブラウザを閉じると消えやすい |

Supabaseの認証フローはPKCEを使います。

### 用語説明

- **OAuth**: Googleなど外部サービスのアカウントでログインする仕組み。
- **PKCE**: OAuthログイン時に、途中で認証コードを盗まれても悪用されにくくする仕組み。
- **localStorage**: ブラウザ内にデータを残す保存場所。
- **sessionStorage**: タブ単位で一時的にデータを残す保存場所。

## 8. Supabaseデータ仕様

### 8.1 現在あるテーブル

#### `auth.users`

Supabase Authが内部で管理するユーザーテーブルです。

保存される主な情報:

- ユーザーID
- メールアドレス
- ログイン方法
- 作成日時
- 最終ログイン日時

このテーブルはSupabaseのAuthentication画面で確認できます。

場所:

```text
Supabase Dashboard
→ Authentication
→ Users
```

#### `public.profiles`

EmoAcademy側で作成しているプロフィールテーブルです。
このテーブルに、表示名だけでなくユーザーのロールも保存します。

ロールをSupabase Authの内部テーブルだけに置かない理由は、アプリ側から安全に読みやすく、画面分岐や今後の権限制御に使いやすいからです。`auth.users` は認証そのものを管理し、`public.profiles` はEmoAcademyで使うユーザー属性を管理します。

定義:

| カラム         | 型          | 内容                                              |
| -------------- | ----------- | ------------------------------------------------- |
| `id`           | uuid        | `auth.users.id` と同じユーザーID                  |
| `display_name` | text        | 表示名                                            |
| `role`         | text        | アプリ内ロール。現在は `student` または `teacher` |
| `created_at`   | timestamptz | 作成日時                                          |
| `updated_at`   | timestamptz | 更新日時                                          |

ロールはここに保存されます。ログイン後の学生画面/教師画面の切り替えも、この `profiles.role` を読む前提です。

場所:

```text
Supabase Dashboard
→ Table Editor
→ profiles
```

#### `public.learning_materials`

教師が作成する教材を保存します。学生は公開済み教材を読み、教師は教材を追加・編集できます。

主なカラム:

| カラム             | 内容                            |
| ------------------ | ------------------------------- |
| `id`               | 教材ID                          |
| `created_by`       | 作成した教師のユーザーID        |
| `title`            | 教材名                          |
| `subject`          | 科目                            |
| `material_type`    | `PDF` / `LINK` / `CARD`         |
| `duration_minutes` | 目安時間                        |
| `external_url`     | 外部リンク                      |
| `instruction`      | 学習指示                        |
| `is_published`     | 学生に表示するかどうか          |

#### `public.study_progress`

学生ごとの学習進捗を保存します。学生本人と教師が確認できます。

主なカラム:

| カラム                | 内容                                      |
| --------------------- | ----------------------------------------- |
| `user_id`             | 学生ユーザーID                            |
| `material_id`         | 対象教材ID                                |
| `status`              | `not_started` / `in_progress` / `completed` |
| `percent`             | 進捗率                                    |
| `last_activity_title` | 最後に開いた学習内容                      |
| `last_studied_at`     | 最終学習日時                              |

#### `public.study_groups` / `public.study_group_members`

学習グループとメンバーを保存します。現時点では、学生が自分のグループを作成できます。

#### `public.qa_threads`

学生の質問と教師の回答を保存します。

主なカラム:

| カラム           | 内容                              |
| ---------------- | --------------------------------- |
| `user_id`        | 質問した学生                      |
| `material_id`    | 関連教材                          |
| `question`       | 学生の質問                        |
| `teacher_answer` | 教師の回答                        |
| `status`         | `open` / `answered` / `closed`    |

### 8.2 ユーザーとロールを見るSQL

Supabase SQL Editorで以下を実行すると、メールアドレスとロールをまとめて確認できます。

```sql
select
  u.id,
  u.email,
  p.display_name,
  p.role,
  u.created_at,
  u.last_sign_in_at
from auth.users u
left join public.profiles p on p.id = u.id
order by u.created_at desc;
```

### 8.3 RLS

`profiles` にはRLSを設定しています。

**RLS（Row Level Security）**とは、データベースの行ごとに「誰が見られるか」「誰が更新できるか」を制限する仕組みです。

現在の方針:

- ユーザーは自分のプロフィールだけ読める。
- ユーザーは自分のプロフィールだけ更新できる。
- `role` は `student` または `teacher` のみ。

### 8.4 ロール管理方針

EmoAcademyでは、ロールを `public.profiles.role` で管理します。

現在のロール:

| ロール    | 意味 | 表示される画面                       |
| --------- | ---- | ------------------------------------ |
| `student` | 学生 | 学習ホーム、学習セット、感情モニター |
| `teacher` | 教師 | 教材追加、割り当て、学生進捗確認     |

ロール保存の流れ:

1. 新規登録フォームで学生/教師を選択する。
2. Supabase Authへユーザーが作られる。
3. DBトリガー `handle_new_user()` が `public.profiles` に行を作る。
4. `raw_user_meta_data.role` が `student` または `teacher` の場合、それを `profiles.role` に保存する。
5. ログイン後、`dashboard/page.tsx` が `profiles.role` を読み、学生画面か教師画面を表示する。

Googleログインの場合は、OAuthのリダイレクト後に `auth/callback/page.tsx` が選択済みロールを `profiles.role` へ反映します。

将来的に管理者ロールを追加する場合は、`role` のcheck制約とアプリ側の分岐を同時に更新します。例: `admin`、`school_admin`。

**DBトリガー**とは、データベース上で特定の出来事が起きた時に自動実行される処理です。ここでは「Authユーザーが作成されたら、プロフィールも自動作成する」ために使っています。

## 9. 学習データベース設計

今回追加したSQL:

```text
supabase/migrations/202607010001_learning_core.sql
```

このSQLをSupabase SQL Editorで実行すると、教材、進捗、学習グループ、質問回答を保存できるようになります。

### 9.1 現在実装済みの保存対象

| 保存対象           | テーブル                         | アプリ内の用途                         |
| ------------------ | -------------------------------- | -------------------------------------- |
| 教材               | `learning_materials`             | 教師が教材を追加、学生が教材を見る     |
| 学習進捗           | `study_progress`                 | 続きから始める、教師の進捗確認         |
| 学習グループ       | `study_groups` / `study_group_members` | 学習グループの作成と一覧表示           |
| 質問・教師回答     | `qa_threads`                     | 学生が質問し、教師が回答する           |

### 9.2 今後さらに分けるとよいテーブル

#### `learning_sets`

学習セットを保存するテーブル。

| カラム        | 内容                     |
| ------------- | ------------------------ |
| `id`          | 学習セットID             |
| `owner_id`    | 作成者のユーザーID       |
| `title`       | タイトル                 |
| `description` | 説明                     |
| `visibility`  | private / class / public |
| `created_at`  | 作成日時                 |

#### `learning_items`

単語カードや問題を保存するテーブル。

| カラム        | 内容               |
| ------------- | ------------------ |
| `id`          | 項目ID             |
| `set_id`      | 所属する学習セット |
| `front`       | 表面、問題文       |
| `back`        | 裏面、答え         |
| `order_index` | 表示順             |

#### `learning_progress`

学生ごとの進捗を保存するテーブル。

| カラム            | 内容           |
| ----------------- | -------------- |
| `id`              | 進捗ID         |
| `user_id`         | 学生ユーザーID |
| `set_id`          | 学習セットID   |
| `completed_count` | 完了した項目数 |
| `total_count`     | 全項目数       |
| `last_studied_at` | 最終学習日時   |
| `next_review_at`  | 次回復習予定   |

#### `classes`

教師が作るクラスを保存するテーブル。

| カラム        | 内容           |
| ------------- | -------------- |
| `id`          | クラスID       |
| `teacher_id`  | 教師ユーザーID |
| `name`        | クラス名       |
| `invite_code` | 招待コード     |

#### `class_members`

どの学生がどのクラスに所属しているかを保存するテーブル。

| カラム     | 内容              |
| ---------- | ----------------- |
| `class_id` | クラスID          |
| `user_id`  | 学生ユーザーID    |
| `role`     | student / teacher |

#### `emotion_sessions`

感情モニターの利用ログを保存する場合のテーブル。

| カラム       | 内容         |
| ------------ | ------------ |
| `id`         | セッションID |
| `user_id`    | ユーザーID   |
| `started_at` | 開始日時     |
| `ended_at`   | 終了日時     |
| `summary`    | 集計結果     |

注意: 現在は映像を保存しません。将来保存する場合も、映像ではなく集計値だけにする方が安全です。

## 10. Vercel仕様

### 10.1 Vercelの役割

Vercelは、EmoAcademyのNext.jsアプリをインターネット上に公開するサービスです。

GitHubと連携している場合:

- `main` ブランチへpushすると本番URLが更新される。
- `main` 以外へpushするとPreview URLが作られる。

### 10.2 本番URL

```text
https://emo-academy.vercel.app
```

### 10.3 必要な環境変数

Vercel Project Settings → Environment Variables に設定します。

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
```

### 用語説明

- **環境変数**: コードに直接書かず、Vercelやローカル環境に保存する設定値。
- **Publishable Key**: ブラウザに置いてよい公開用キー。SupabaseのRLSと組み合わせて安全に使う。
- **Secret Key / Service Role Key**: 絶対にブラウザへ置かない秘密鍵。管理者権限を持つ。

## 11. Supabase側で必要な設定

### 11.1 URL Configuration

Supabase Dashboardで設定します。

```text
Authentication
→ URL Configuration
```

設定例:

```text
Site URL:
https://emo-academy.vercel.app

Redirect URLs:
https://emo-academy.vercel.app/auth/callback
https://emo-academy.vercel.app/reset-password
```

### 11.2 Google Provider

```text
Authentication
→ Sign In / Providers
→ Google
```

必要なもの:

- Google Cloud Consoleで作成したClient ID
- Google Cloud Consoleで作成したClient Secret
- Supabaseが指定するCallback URLをGoogle Cloud側へ登録

### 11.3 Confirm Email

独自ドメインやCustom SMTPを用意しない場合、確認メールが届きにくいことがあります。テスト段階ではConfirm EmailをOFFにして動作確認してもよいです。

本番運用では、確認メールをONにし、Resendなどのメール配信サービスをCustom SMTPとして設定する方が安全です。

### 用語説明

- **SMTP**: メールを送信するための仕組み。
- **Resend**: 開発者向けのメール配信サービス。Supabaseの確認メール送信に使える。
- **独自ドメイン**: `emo-academy.com` のような自分で所有するドメイン。

## 12. ローカル開発

### 12.1 起動

```powershell
cd "D:\OneDrive - Kyushu Institute Of Technolgy\EmoAcademy"
npm install
npm run dev
```

### 12.2 ローカル環境変数

`.env.local` に以下を置きます。

```text
NEXT_PUBLIC_SUPABASE_URL=https://xxxxxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_xxxxxxxx
```

`.env.local` はGitHubに上げません。秘密情報や環境ごとの設定を守るためです。

### 12.3 確認コマンド

```powershell
npm run lint
npm run typecheck
npm run build
```

### 12.4 静的出力

`next.config.ts` で以下を設定しています。

```ts
output: "export";
```

これは、Next.jsを静的HTMLとして書き出す設定です。現状のアプリはクライアント側からSupabaseへ接続するため、この方式で動きます。

ただし、Next.jsのサーバー機能を使うAPIやSSRを増やす場合は、この設定を見直す必要があります。

### 用語説明

- **静的HTML**: サーバーで毎回ページを作らず、事前に作ったHTML/CSS/JSを配信する方式。
- **SSR**: Server-Side Renderingの略。アクセス時にサーバー側でHTMLを作る方式。
- **API Route**: Next.js内にサーバー側処理を作る仕組み。

## 13. GitHub運用

### 13.1 基本フロー

```powershell
git status
git add .
git commit -m "Update EmoAcademy"
git push origin main
```

VercelとGitHubが連携済みなら、`main` にpushした後にVercelが自動で本番デプロイします。

### 13.2 注意点

- `.env.local` はpushしない。
- `node_modules` はpushしない。
- SupabaseのService Role Keyは絶対にpushしない。
- 大きい画像や不要な参照元フォルダを混ぜない。

## 14. UI/デザイン仕様

### 14.1 デザイン方向

- Quizletに近い、丸みのあるカード型レイアウト。
- 左側に固定メニュー。
- 中央に学習フィード。
- 右側に感情モニター。
- ログイン画面は淡い青背景、点線、liquid glass風カード。
- 学習画面はログイン画面と近い青系のポップな印象。

### 14.2 フォント

現在は以下の方針です。

- 英語: Poppins
- 日本語: Noto Sans JP

実装:

```ts
import { Noto_Sans_JP, Poppins } from "next/font/google";
```

Quizlet本体はHurme系フォントを使っていることがありますが、Hurmeは商用フォントです。そのためEmoAcademyでは無料で使いやすいPoppinsとNoto Sans JPを採用します。

### 14.3 アニメーション

使用するアニメーション:

- ボタンホバー時の小さな浮き上がり
- ボタン押下時の軽い縮小
- 選択状態の短い反応
- カード操作時の自然な反応
- 感情モニターのLIVE表示

避けるアニメーション:

- 画面ロード時の大きなスライドイン
- 学習内容を邪魔する常時派手な動き
- 意味のない装飾だけの過剰なループ

## 15. セキュリティとプライバシー

### 15.1 パスワード

パスワードはSupabase Authが管理します。アプリ側、GitHub、Vercel、Supabaseの通常画面でパスワードそのものを見ることはできません。

### 15.2 Service Role Key

Service Role Keyは管理者権限の秘密鍵です。ブラウザに出してはいけません。

現在、アカウント削除はSupabase Edge Functionで実行する設計です。Edge Function側だけがService Role Keyを使います。

### 15.3 カメラ

- ユーザーが感情モニターを開いた時だけ使用。
- フレーム画像は推論のためHugging Face Emotion APIへ送信される。
- 動画そのものは保存しない。
- 保存する場合は、映像ではなく推論後の数値ログだけを保存する。
- いつでも停止できるUIを維持する。

## 16. アカウント削除仕様

実装ファイル:

```text
supabase/functions/delete-account/index.ts
```

流れ:

1. ユーザーがダッシュボードで「アカウント削除」を押す。
2. ブラウザからSupabase Edge Functionを呼ぶ。
3. Edge Functionがログイン中ユーザーを確認する。
4. Service Role Keyを使ってSupabase Authのユーザーを削除する。
5. `profiles.id` は `auth.users.id` を参照しているため、プロフィールも連動削除される。

### 用語説明

- **Edge Function**: Supabase上で動く小さなサーバー処理。ブラウザに置けない秘密処理に使う。
- **Cascade Delete**: 親データが消えた時に、関連する子データも自動で消す仕組み。

## 17. 現在の制限

現在できていないこと:

- 学習セットの永続保存
- 単語カードの永続保存
- 教材PDFのSupabase Storage保存
- クラス作成
- 招待コード
- 教師が学生個人の詳細進捗を見る画面
- 感情モニター結果の保存
- 本格的な間隔反復

### 用語説明

- **永続保存**: ページを閉じても、別端末で開いても、データが残る保存方式。
- **Supabase Storage**: PDFや画像などのファイルを保存するSupabaseの機能。
- **間隔反復**: 忘れかけるタイミングで復習する学習方法。

## 18. 次に実装するとよい順番

1. Supabase SQL Editorで `202607010001_learning_core.sql` を実行する。
2. 学生でログインし、続きから始める・質問送信・グループ作成を確認する。
3. 教師でログインし、教材追加・質問回答・進捗一覧を確認する。
4. `learning_sets` と `learning_items` を作り、単語カードを教材から独立させる。
5. 教師用の `classes` と `class_members` を作り、招待コードを追加する。
6. 教材PDFをSupabase Storageへ保存する。
7. ResendなどでCustom SMTPを設定し、確認メールを本番対応にする。
8. 感情モニターは保存前に同意UIと削除UIを作る。

## 19. 構築者が知っておくべき確認場所

### 19.1 ユーザー一覧を見る

```text
Supabase Dashboard
→ Authentication
→ Users
```

見るもの:

- 登録メールアドレス
- User ID
- 作成日
- 最終ログイン
- ログインProvider

### 19.2 ロールを見る

```text
Supabase Dashboard
→ Table Editor
→ profiles
```

見るもの:

- `display_name`
- `role`
- `id`

### 19.3 Vercelの公開状態を見る

```text
Vercel Dashboard
→ emo-academy
→ Deployments
```

見るもの:

- ビルド成功/失敗
- 本番URL
- Preview URL
- エラーログ

### 19.4 環境変数を見る

```text
Vercel Dashboard
→ emo-academy
→ Settings
→ Environment Variables
```

見るもの:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

## 20. 完了条件

現時点でのMVP完了条件:

- メール/パスワードで新規登録できる。
- Googleログインできる。
- 学生/教師のロールが `profiles` に保存される。
- ログイン後、ロールに応じた画面へ入れる。
- 学生画面はQuizlet風の左メニュー、中央フィード、感情モニターを持つ。
- 教師画面は教材追加と学生進捗確認のUIを持つ。
- Vercelで `https://emo-academy.vercel.app` が表示できる。
- Supabaseで登録ユーザーとロールを確認できる。

本格運用の完了条件:

- 学習セット、カード、進捗、クラス、教材ファイルがSupabaseへ保存される。
- 教師がクラス単位で進捗を確認できる。
- 学生が自分の進捗を別端末でも見られる。
- メール確認が安定して届く。
- プライバシー方針と利用規約が最終化されている。
- 感情モニターの保存有無、削除方法、同意方法が明確になっている。
