# EmoAcademy

Supabase認証と研究用の任意カメラ補助機能を備えた、学生・教師向け学習プラットフォームです。

## 起動

```powershell
npm install
npm run dev
```

`.env.local`に以下を設定します。

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
```

## 確認

```powershell
npm run lint
npm run typecheck
npm run build
```

詳細は[仕様書](docs/SPECIFICATION.md)を参照してください。
