---
sdk: docker
app_port: 7860
---

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

詳細は[仕様書](docs/SPECIFICATION.md)と[完了したものの解説](docs/COMPLETED.md)を参照してください。

## Hugging Face Spacesで使う場合

Static Spaceとして公開できます。

1. Hugging FaceでSpaceを作成します。
   - Space name: `emo-academy`
   - SDK: `Static`
2. SpaceのVariablesに以下を設定します。

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
```

3. SupabaseのRedirect URLsにHugging FaceのURLを追加します。

```text
https://<huggingface-username>-emo-academy.hf.space/auth/callback
https://<huggingface-username>-emo-academy.hf.space/reset-password
```
