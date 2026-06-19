import type { Metadata } from "next";
import { Noto_Sans_JP, Nunito_Sans } from "next/font/google";
import "./globals.css";

const notoSansJp = Noto_Sans_JP({
  variable: "--font-noto-sans-jp",
  subsets: ["latin"],
});

const nunitoSans = Nunito_Sans({
  variable: "--font-nunito-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Quizroom",
  description: "学びの時間を、もっと自分らしく。",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ja"
      className={`${notoSansJp.variable} ${nunitoSans.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
