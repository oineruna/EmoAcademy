import type { Metadata } from "next";
import { Noto_Sans_JP, Poppins } from "next/font/google";
import Script from "next/script";
import "./globals.css";

const notoSansJp = Noto_Sans_JP({
  variable: "--font-noto-sans-jp",
  subsets: ["latin"],
});

const poppins = Poppins({
  variable: "--font-poppins",
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
});

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
    <html
      lang="ja"
      className={`${notoSansJp.variable} ${poppins.variable}`}
    >
      <body>
        <Script src="/env.js" strategy="beforeInteractive" />
        {children}
      </body>
    </html>
  );
}
