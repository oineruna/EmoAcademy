import Link from "next/link";

export default function TermsPage() {
  return <main className="legal-page"><article className="legal-document"><Link href="/">← EmoAcademyへ戻る</Link><h1>利用規約</h1><span className="legal-draft">運用開始前の暫定版</span><p>最終更新日: 2026年6月22日</p><section><h2>1. サービスの目的</h2><p>EmoAcademyは、教材の学習、確認問題、進捗確認などを支援する学習プラットフォームです。</p></section><section><h2>2. アカウント</h2><p>利用者は正確な情報を登録し、ログイン情報を第三者へ共有しないものとします。不正利用が疑われる場合は利用を停止することがあります。</p></section><section><h2>3. 禁止事項</h2><ul><li>他者へのなりすましや不正アクセス</li><li>教材や他者の情報の無断転載</li><li>サービスの運用を妨げる行為</li></ul></section><section><h2>4. カメラ補助機能</h2><p>カメラ機能は任意です。現在の推定結果は画面確認用の補助情報であり、能力、成績、健康状態を判定するものではありません。</p></section><section><h2>5. 変更と停止</h2><p>安全性や機能改善のため、事前に案内したうえで内容を変更または一時停止する場合があります。</p></section><section><h2>6. 注意</h2><p>この文書は開発段階の暫定版です。正式運用前に、対象地域と運用主体に合わせた法務確認が必要です。</p></section></article></main>;
}
