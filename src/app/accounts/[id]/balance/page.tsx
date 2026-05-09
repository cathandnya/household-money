"use client";
import { useEffect, useState } from "react";
import { use } from "react";
import Link from "next/link";

type Entry = {
  id: number;
  occurredAt: string;
  balance: number | null;
  memo: string | null;
};

type Account = {
  id: number;
  name: string;
  kind: string;
  currency: string;
  institution: { id: number; name: string };
};

const todayISO = () => {
  const d = new Date();
  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
};

export default function BalancePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const accountId = Number(id);

  const [account, setAccount] = useState<Account | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [balance, setBalance] = useState<string>("");
  const [date, setDate] = useState<string>(todayISO());
  const [memo, setMemo] = useState<string>("");
  const [showDetails, setShowDetails] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reload = async () => {
    const [accRes, entriesRes] = await Promise.all([
      fetch("/api/accounts").then((r) => r.json()),
      fetch(`/api/accounts/${accountId}/balance-entries`).then((r) => r.json()),
    ]);
    const acc = (accRes as Account[]).find((a) => a.id === accountId) ?? null;
    setAccount(acc);
    setEntries(entriesRes);
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accountId]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!balance) return;
    const n = Number(balance.replace(/,/g, ""));
    if (!Number.isFinite(n)) {
      setError("数値を入力してください");
      return;
    }
    setBusy(true);
    setError(null);
    const res = await fetch(`/api/accounts/${accountId}/balance-entries`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ date, balance: n, memo: memo || undefined }),
    });
    setBusy(false);
    if (!res.ok) {
      const j = await res.json().catch(() => ({}));
      setError(j.error ?? "登録失敗");
      return;
    }
    setBalance("");
    setMemo("");
    setDate(todayISO());
    setShowDetails(false);
    reload();
  };

  const remove = async (entryId: number) => {
    if (!confirm("この記録を削除しますか？")) return;
    const res = await fetch(
      `/api/accounts/${accountId}/balance-entries/${entryId}`,
      { method: "DELETE" },
    );
    if (!res.ok) {
      alert("削除失敗");
      return;
    }
    reload();
  };

  const latest = entries[0];

  return (
    <div className="space-y-6">
      <div>
        <Link href="/accounts" className="text-sm text-muted-foreground hover:text-blue-500">
          ← 口座管理
        </Link>
        <h1 className="text-2xl font-bold mt-1">
          {account ? `${account.institution.name} / ${account.name}` : "残高記録"}
        </h1>
        {latest && latest.balance != null && (
          <p className="text-sm text-muted-foreground mt-1">
            最新残高:{" "}
            <span className="num font-bold">{latest.balance.toLocaleString()} 円</span>
            <span className="ml-2">({latest.occurredAt.slice(0, 10)})</span>
          </p>
        )}
      </div>

      <section className="bg-surface border border-border-app p-4">
        <form onSubmit={submit} className="space-y-3">
          <div className="flex gap-2 items-end">
            <div className="flex-1">
              <label className="block text-sm mb-1">残高 (円)</label>
              <input
                type="text"
                inputMode="numeric"
                className="w-full border border-border-app p-2 num"
                value={balance}
                onChange={(e) => setBalance(e.target.value)}
                placeholder="例: 10000"
                autoFocus
              />
            </div>
            <button
              type="submit"
              className="bg-blue-600 text-white px-4 py-2 disabled:bg-neutral-400"
              disabled={busy || !balance}
            >
              記録
            </button>
          </div>
          <button
            type="button"
            className="text-xs text-muted-foreground hover:text-blue-500"
            onClick={() => setShowDetails((v) => !v)}
          >
            {showDetails ? "▲ 詳細を閉じる" : "▼ 詳細 (日付・メモ)"}
          </button>
          {showDetails && (
            <div className="space-y-2">
              <div>
                <label className="block text-sm mb-1">日付</label>
                <input
                  type="date"
                  className="border border-border-app p-2"
                  value={date}
                  onChange={(e) => setDate(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-sm mb-1">メモ</label>
                <input
                  type="text"
                  className="w-full border border-border-app p-2"
                  value={memo}
                  onChange={(e) => setMemo(e.target.value)}
                />
              </div>
            </div>
          )}
          {error && <p className="text-red-500 text-sm">{error}</p>}
        </form>
      </section>

      <section>
        <h2 className="font-bold mb-2">記録一覧</h2>
        <table className="w-full border border-border-app bg-surface text-sm">
          <thead className="bg-surface-muted">
            <tr>
              <th className="text-left p-2">日付</th>
              <th className="text-right p-2">残高</th>
              <th className="text-left p-2">メモ</th>
              <th className="text-left p-2 w-20">操作</th>
            </tr>
          </thead>
          <tbody>
            {entries.map((e) => (
              <tr key={e.id} className="border-t">
                <td className="p-2">{e.occurredAt.slice(0, 10)}</td>
                <td className="p-2 text-right">
                  {e.balance != null ? e.balance.toLocaleString() : ""}
                </td>
                <td className="p-2">{e.memo ?? ""}</td>
                <td className="p-2">
                  <button
                    type="button"
                    onClick={() => remove(e.id)}
                    className="text-xs text-muted-foreground hover:text-red-500"
                  >
                    削除
                  </button>
                </td>
              </tr>
            ))}
            {entries.length === 0 && (
              <tr>
                <td className="p-4 text-muted-foreground" colSpan={4}>
                  まだ記録がありません
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}
