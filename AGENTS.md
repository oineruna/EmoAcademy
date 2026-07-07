# AGENTS.md

## Core Style

- 日本語で、結論先、短めに答える。
- 実装・検証・ファイル整理を優先し、説明だけで止まらない。
- 既存ファイルや未コミット変更を勝手に戻さない。
- 非自明な作業では、最初に関連スキルを確認し、使うスキルを短く宣言してから進める。

## Skill Routing

- Web UI は `frontend-design` + `webapp-testing` + `browser:control-in-app-browser` + `playwright-cli` を優先する。
- プロダクトデザイン、UX設計、画面設計、体験改善、デザインレビューは Product Design plugin が利用可能なら最優先する。見えない環境では `frontend-design` + `design-an-interface` + `web-design-guidelines` で代替する。
- React / Next / Vercel は `vercel:nextjs`、`vercel:react-best-practices`、`vercel:shadcn`、`vercel:vercel-cli`、`vercel:deployments-cicd`、`deploy-to-vercel` を検討する。
- Supabase / Auth は `supabase`、`supabase-postgres-best-practices`、`better-auth-best-practices` を検討する。
- ブラウザ確認は `browser:control-in-app-browser` を優先する。実Chromeのログイン状態や拡張機能が必要な時だけ `browser:control-chrome` / `@chrome` 系を使う。
- Chrome以外のデスクトップアプリを画面操作する必要がある時だけ `computer-use@openai-bundled` / Computer Use を候補にする。

## Workspace Rules

- `EmoAcademy` では既存UI文脈を保ち、emotion monitoring、学習ダッシュボード、Next.js、Supabase、Vercel の動作確認を優先する。
- 公開前は `npm run lint`、`npm run build`、必要に応じて実画面確認を行う。
- 目に見えるUIコピーを変更する時は、AIっぽい説明文や不要な補足を増やさない。
