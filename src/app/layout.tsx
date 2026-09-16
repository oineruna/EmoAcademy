import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: "EmoAcademy",
  description: "学びの時間を、もっと自分らしく。",
  icons: {
    icon: "/emoacademy-mark.png",
    apple: "/emoacademy-mark.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ja">
      <body>
        <Script src="/env.js" strategy="beforeInteractive" />
        {children}
      </body>
    </html>
  );
}
