---
sdk: docker
app_port: 7860
---

# EmoAcademy

Supabase認証と研究用の任意カメラ補助機能を備えた、学生・教師向け学習プラットフォームです。

## 起動

Windowsでは `start-daisee.bat` をダブルクリックします。初回はPython 3.11の仮想環境と必要なライブラリを準備し、その後DAiSEE推論APIとサイトをまとめて起動します。

- サイト: http://127.0.0.1:3004/dashboard
- 推論API: http://127.0.0.1:7860/health
- 停止: `stop-daisee.bat`
- 必要な環境: Node.jsとPython 3.11。初回のみダウンロードが必要です。
- ログ: `.local-daisee/`。終了時にはバッチで起動したプロセスだけを停止します。

サイトのみを起動する場合:

```powershell
npm install
npm run dev:local
```

`.env.local`に以下を設定します。

```env
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
```

ローカル画面では、未設定の`NEXT_PUBLIC_EMOTION_API_URL`は`http://127.0.0.1:7860`を使います。DAiSEE APIが停止中の場合は接続エラーを表示し、測定値を作りません。

HF上の推論APIを使う場合だけ、`.env.local` またはVercel/Hugging Faceの環境変数に以下を追加します。

```env
NEXT_PUBLIC_EMOTION_API_URL=https://your-emotion-api.hf.space
```

公開サイトでは、上記URLの`/health`がDAiSEEモデルの読込成功を報告してから設定します。GitHubへのpushやSupabaseへのmigration適用だけでは、公開推論APIの更新にはなりません。

## DAiSEEの表示

既存の学生画面の右側に、退屈・集中/関与・混乱・フラストレーションを表示します。異なる時刻の16枚を約4秒で取得し、推論終了後に次の取得を始めます。表示は直近5回の平均、保存は各回の推論値です。4指標は独立した強度で、合計100にはなりません。

教師は「感情ログ」で担当グループを設定します。グループを作成し、学生を追加すると、4指標の平均・5分ごとの推移・学生別の最新セッション平均を確認できます。30秒ごとに更新します。画像・動画は保存しません。

現在のcheckpointは統合動作確認用です。研究での測定精度は、別途4指標それぞれの検証が必要です。

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
