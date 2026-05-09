import type { Metadata, Viewport } from "next";
import Link from "next/link";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "household-money - 個人資産管理",
  description: "銀行・カード・証券のCSVを取り込んで一元管理",
  appleWebApp: {
    capable: true,
    title: "Household",
    statusBarStyle: "black-translucent",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
};

const nav = [
  { href: "/", label: "ダッシュボード" },
  { href: "/transactions", label: "明細" },
  { href: "/portfolio", label: "ポートフォリオ" },
  { href: "/categories", label: "カテゴリ" },
  { href: "/rules", label: "ルール" },
  { href: "/accounts", label: "口座" },
  { href: "/import", label: "取込" },
  { href: "/history", label: "履歴" },
];

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ja" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <header className="bg-surface border-b border-border-app">
          <div className="max-w-7xl mx-auto px-4 py-3 flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-6">
            <Link href="/" className="font-bold text-lg">household-money</Link>
            <nav className="flex flex-wrap gap-x-4 gap-y-1 text-sm overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
              {nav.map((n) => (
                <Link key={n.href} href={n.href} className="hover:text-blue-500 whitespace-nowrap">
                  {n.label}
                </Link>
              ))}
            </nav>
          </div>
        </header>
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
