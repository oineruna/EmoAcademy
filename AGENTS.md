# AGENTS.md

## Core Style

- 日本語で、結論先、短めに答える。
- 実装・検証・ファイル整理を優先し、説明だけで止まらない。
- 既存ファイルや未コミット変更を勝手に戻さない。
- 非自明な作業では、最初に関連スキルを確認し、使うスキルを短く宣言してから進める。

## Token Budget Guard

- 返答は必要十分に短くする。全文貼り付け、巨大な表、長いログ転載は避け、要点とファイル参照を優先する。
- トークン消費が大きそうな作業（広範囲検索、10ファイル以上の精読、大量ログ解析、複数repo横断、長文レポート、網羅的なskill棚卸し、Web調査の大量実行）の前に、まずユーザーへ確認する。
- 確認時は「軽量に進める」「詳しく進める」「上限を決めて進める」のように短い選択肢を出す。
- まず `rg` / `fd` / 目次確認 / ファイル名確認で対象を絞り、必要なファイルだけ読む。
- skill は最小限だけ読む。関連しそうという理由だけで多数の `SKILL.md` を開かない。
- 長くなりそうな説明は、先に短い結論を出し、詳細が必要か確認する。

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
