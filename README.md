# Quizroom Web

Quizroomの独立Webフロントエンドです。

- Next.js App Router
- Supabase Auth / Postgres / Edge Functions
- Vercelデプロイ対応
- 学生・教師の新規登録
- メール確認、ログイン、ログアウト、パスワード復旧
- アカウント削除

FastAPI、SQLite、自作JWT、パスワード保存処理はこのリポジトリに含みません。Supabase Authがパスワードとセッションを管理します。

## 1. Supabaseを作成

1. Supabaseで新しいProjectを作成します。
2. Project URLとPublishable Keyを確認します。
3. `.env.example`を`.env.local`へコピーし、値を入力します。
4. SQL Editorで`supabase/migrations/202606200001_profiles.sql`を実行します。
5. Authentication > URL Configurationで次を登録します。
   - Site URL: ローカルでは`http://localhost:3000`
   - Redirect URL: `http://localhost:3000/auth/callback`
   - Redirect URL: `http://localhost:3000/reset-password`
6. Supabase CLIで削除用Functionを配備します。

```powershell
supabase functions deploy delete-account
```

## 2. ローカル確認

```powershell
npm install
npm run dev
```

http://localhost:3000 を開きます。

## 3. Vercelへ公開

1. このフォルダを独立GitHubリポジトリへpushします。
2. VercelでGitHubリポジトリをImportします。
3. VercelのEnvironment Variablesへ次を登録します。

```text
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY
```

4. Vercelの本番URLをSupabase AuthenticationのSite URLとRedirect URLsへ追加します。

## セキュリティ

- パスワードはSupabase Authへ送信され、このリポジトリや`profiles`テーブルには保存されません。
- Service Role KeyはSupabase Edge Function内だけで使用します。
- ブラウザへService Role Keyを置かないでください。
- 公開データはRLSポリシーで制御します。
