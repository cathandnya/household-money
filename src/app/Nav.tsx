"use client";
import Link from "next/link";
import { useState } from "react";

const items = [
  { href: "/", label: "ダッシュボード" },
  { href: "/transactions", label: "明細" },
  { href: "/portfolio", label: "ポートフォリオ" },
  { href: "/categories", label: "カテゴリ" },
  { href: "/rules", label: "ルール" },
  { href: "/accounts", label: "口座" },
  { href: "/import", label: "取込" },
  { href: "/history", label: "履歴" },
];

export default function Nav() {
  const [open, setOpen] = useState(false);
  return (
    <header
      className="bg-surface border-b border-border-app"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
        <Link href="/" className="font-bold text-lg" onClick={() => setOpen(false)}>
          household-money
        </Link>

        {/* desktop nav */}
        <nav className="hidden sm:flex flex-wrap gap-x-4 gap-y-1 text-sm">
          {items.map((n) => (
            <Link
              key={n.href}
              href={n.href}
              className="hover:text-blue-500 whitespace-nowrap"
            >
              {n.label}
            </Link>
          ))}
        </nav>

        {/* mobile menu button */}
        <button
          type="button"
          aria-label="メニュー"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="sm:hidden border border-border-app px-3 py-1 text-lg leading-none"
        >
          {open ? "✕" : "≡"}
        </button>
      </div>

      {/* mobile dropdown */}
      {open && (
        <nav className="sm:hidden border-t border-border-app">
          <div className="max-w-7xl mx-auto px-4 py-2 flex flex-col">
            {items.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                onClick={() => setOpen(false)}
                className="py-2 hover:text-blue-500"
              >
                {n.label}
              </Link>
            ))}
          </div>
        </nav>
      )}
    </header>
  );
}
