"use client";
import { useEffect, useState } from "react";

type ImportRow = {
  id: number;
  importedAt: string;
  fileName: string;
  source: string;
  status: string;
  rowCount: number;
  account: { id: number; name: string; kind: string };
  institution: { id: number; code: string; name: string };
  counts: { tx: number; secTx: number; snapshot: number };
};

const kindLabel = (row: ImportRow) => {
  if (row.source === "MANUAL") return "残高記録";
  const labels: string[] = [];
  if (row.counts.tx > 0) labels.push("入出金");
  if (row.counts.secTx > 0) labels.push("証券取引");
  if (row.counts.snapshot > 0) labels.push("資産スナップショット");
  return labels.join(" / ") || "-";
};

const formatDateTime = (iso: string) => {
  const d = new Date(iso);
  const yy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mi = String(d.getMinutes()).padStart(2, "0");
  return `${yy}-${mm}-${dd} ${hh}:${mi}`;
};

export default function HistoryPage() {
  const [rows, setRows] = useState<ImportRow[] | null>(null);

  useEffect(() => {
    fetch("/api/imports")
      .then((r) => r.json())
      .then(setRows);
  }, []);

  if (!rows) return <p>読込中...</p>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">取り込み履歴</h1>

      <section>
        {/* PC: テーブル */}
        <table className="hidden md:table w-full border border-border-app bg-surface text-sm">
          <thead className="bg-surface-muted">
            <tr>
              <th className="text-left p-2">取込日時</th>
              <th className="text-left p-2">機関</th>
              <th className="text-left p-2">口座</th>
              <th className="text-left p-2">ファイル名</th>
              <th className="text-left p-2">種別</th>
              <th className="text-right p-2">行数</th>
              <th className="text-left p-2">ステータス</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="p-2 whitespace-nowrap">{formatDateTime(r.importedAt)}</td>
                <td className="p-2">{r.institution.name}</td>
                <td className="p-2">{r.account.name}</td>
                <td className="p-2 break-all">{r.source === "MANUAL" ? "" : r.fileName}</td>
                <td className="p-2">{kindLabel(r)}</td>
                <td className="p-2 text-right">{r.rowCount.toLocaleString()}</td>
                <td className="p-2">{r.status}</td>
              </tr>
            ))}
            {rows.length === 0 && (
              <tr>
                <td className="p-4 text-muted-foreground" colSpan={7}>
                  まだ取り込み履歴がありません
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* モバイル: カード */}
        <ul className="md:hidden flex flex-col gap-2">
          {rows.map((r) => (
            <li
              key={r.id}
              className="bg-surface border border-border-app p-3 flex flex-col gap-1"
            >
              <div className="flex items-baseline justify-between gap-2">
                <span className="font-medium break-all min-w-0 flex-1">
                  {r.source === "MANUAL" ? "残高記録" : r.fileName}
                </span>
                <span className="num font-bold whitespace-nowrap">
                  {r.rowCount.toLocaleString()} 行
                </span>
              </div>
              <div className="text-xs text-muted-foreground flex flex-wrap gap-x-2">
                <span className="whitespace-nowrap">{formatDateTime(r.importedAt)}</span>
                <span>· {r.institution.name} / {r.account.name}</span>
              </div>
              <div className="text-xs flex flex-wrap gap-x-2 gap-y-1">
                <span className="text-muted-foreground">{kindLabel(r)}</span>
                <span className="text-muted-foreground">· {r.status}</span>
              </div>
            </li>
          ))}
          {rows.length === 0 && (
            <li className="bg-surface border border-border-app p-4 text-sm text-muted-foreground text-center">
              まだ取り込み履歴がありません
            </li>
          )}
        </ul>
      </section>
    </div>
  );
}
