"use client";
import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
} from "recharts";

type AccountSummary = {
  accountId: number;
  accountName: string;
  institutionName: string;
  kind: string;
  balance: number;
  asOf: string | null;
};
type Timeline = Array<{ date: string; total: number }>;
type Monthly = Array<{
  month: string;
  categoryId: number | null;
  categoryName: string;
  kind: string | null;
  amount: number;
}>;
type Summary = { accounts: AccountSummary[]; timeline: Timeline; monthly: Monthly };

export default function Dashboard() {
  const [data, setData] = useState<Summary | null>(null);
  useEffect(() => {
    fetch("/api/summary").then((r) => r.json()).then(setData);
  }, []);
  if (!data) return <p>読込中...</p>;

  const totalNow = data.accounts.reduce((s, a) => s + a.balance, 0);
  const thisMonth = new Date().toISOString().slice(0, 7);
  const monthExpense = data.monthly
    .filter((m) => m.month === thisMonth && m.kind === "EXPENSE")
    .reduce((s, m) => s + m.amount, 0);
  const monthIncome = data.monthly
    .filter((m) => m.month === thisMonth && m.kind === "INCOME")
    .reduce((s, m) => s + m.amount, 0);

  const months = Array.from(new Set(data.monthly.map((m) => m.month))).sort().slice(-6);
  const cats = Array.from(new Set(data.monthly.map((m) => m.categoryName)));
  const matrix: Record<string, Record<string, number>> = {};
  for (const c of cats) matrix[c] = {};
  for (const m of data.monthly) matrix[m.categoryName][m.month] = m.amount;

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">ダッシュボード</h1>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card title="総資産" value={totalNow} />
        <Card title={`今月収入 (${thisMonth})`} value={monthIncome} />
        <Card title={`今月支出 (${thisMonth})`} value={monthExpense} />
      </section>

      <section className="bg-surface border border-border-app p-4">
        <h2 className="font-bold mb-2">資産推移</h2>
        <div className="h-72">
          <ResponsiveContainer>
            <LineChart data={data.timeline.slice(-365)}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: "var(--muted-foreground)" }} stroke="var(--border)" />
              <YAxis
                tickFormatter={(v: number) => v.toLocaleString()}
                tick={{ fontSize: 10, fill: "var(--muted-foreground)" }}
                stroke="var(--border)"
              />
              <Tooltip
                formatter={(v) => Number(v).toLocaleString() + "円"}
                contentStyle={{
                  background: "var(--surface)",
                  border: "1px solid var(--border)",
                  color: "var(--foreground)",
                }}
              />
              <Line type="monotone" dataKey="total" stroke="#3b82f6" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="bg-surface border border-border-app p-4">
        <h2 className="font-bold mb-2">口座別残高</h2>
        <table className="w-full text-sm">
          <thead className="bg-surface-muted">
            <tr>
              <th className="text-left p-2">機関</th>
              <th className="text-left p-2">口座</th>
              <th className="text-left p-2">種別</th>
              <th className="text-right p-2">残高</th>
              <th className="text-left p-2">As of</th>
            </tr>
          </thead>
          <tbody>
            {data.accounts.map((a) => (
              <tr key={a.accountId} className="border-t">
                <td className="p-2">{a.institutionName}</td>
                <td className="p-2">{a.accountName}</td>
                <td className="p-2">{a.kind}</td>
                <td className="p-2 text-right">{a.balance.toLocaleString()}</td>
                <td className="p-2">{a.asOf?.slice(0, 10) ?? "-"}</td>
              </tr>
            ))}
            {data.accounts.length === 0 && (
              <tr><td className="p-4 text-muted-foreground" colSpan={5}>口座がまだ登録されていません</td></tr>
            )}
          </tbody>
        </table>
      </section>

      <section className="bg-surface border border-border-app p-4">
        <h2 className="font-bold mb-2">月次カテゴリ集計 (直近6ヶ月)</h2>
        <div className="overflow-auto">
          <table className="w-full text-xs">
            <thead className="bg-surface-muted">
              <tr>
                <th className="text-left p-1">カテゴリ</th>
                {months.map((m) => (
                  <th key={m} className="text-right p-1">{m}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {cats.map((c) => (
                <tr key={c} className="border-t">
                  <td className="p-1">{c}</td>
                  {months.map((m) => (
                    <td key={m} className="p-1 text-right">
                      {matrix[c][m]?.toLocaleString() ?? ""}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function Card({ title, value }: { title: string; value: number }) {
  return (
    <div className="bg-surface border border-border-app p-4">
      <p className="text-xs text-muted-foreground">{title}</p>
      <p className="text-2xl font-bold mt-1">{value.toLocaleString()} 円</p>
    </div>
  );
}
