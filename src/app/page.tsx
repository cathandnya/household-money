"use client";
import { useEffect, useState } from "react";

const accountKindLabels: Record<string, string> = {
  CHECKING: "普通預金",
  SAVINGS: "貯蓄預金",
  CREDIT_CARD: "クレジットカード",
  BROKERAGE: "証券総合口座",
  DC: "確定拠出年金",
  MANUAL: "手動入力",
};
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
type MonthlyFlow = Array<{ month: string; income: number; expense: number }>;
type Summary = {
  accounts: AccountSummary[];
  timeline: Timeline;
  monthly: Monthly;
  monthlyFlow: MonthlyFlow;
};

function shiftMonth(ym: string, delta: number): string {
  const [y, m] = ym.split("-").map(Number);
  const d = new Date(Date.UTC(y, m - 1 + delta, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}

export default function Dashboard() {
  const [data, setData] = useState<Summary | null>(null);
  const [selectedMonth, setSelectedMonth] = useState<string>(
    new Date().toISOString().slice(0, 7),
  );
  useEffect(() => {
    fetch("/api/summary").then((r) => r.json()).then(setData);
  }, []);
  if (!data) return <p>読込中...</p>;

  const totalNow = data.accounts
    .filter((a) => a.kind !== "CREDIT_CARD")
    .reduce((s, a) => s + a.balance, 0);
  const flow = data.monthlyFlow.find((f) => f.month === selectedMonth);
  const monthIncome = flow?.income ?? 0;
  const monthExpense = flow?.expense ?? 0;

  const months = Array.from({ length: 6 }, (_, i) => shiftMonth(selectedMonth, i - 5));
  const cats = Array.from(
    new Set(
      data.monthly
        .filter((m) => months.includes(m.month))
        .map((m) => m.categoryName),
    ),
  );
  const matrix: Record<string, Record<string, number>> = {};
  for (const c of cats) matrix[c] = {};
  for (const m of data.monthly) {
    if (months.includes(m.month)) matrix[m.categoryName][m.month] = m.amount;
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h1 className="text-2xl font-bold">ダッシュボード</h1>
        <div className="flex items-center gap-2 text-sm">
          <button
            type="button"
            className="border border-border-app px-2 py-1"
            onClick={() => setSelectedMonth(shiftMonth(selectedMonth, -1))}
            aria-label="前の月"
          >
            ←
          </button>
          <input
            type="month"
            className="border border-border-app p-1"
            value={selectedMonth}
            onChange={(e) => e.target.value && setSelectedMonth(e.target.value)}
          />
          <button
            type="button"
            className="border border-border-app px-2 py-1"
            onClick={() => setSelectedMonth(shiftMonth(selectedMonth, 1))}
            aria-label="次の月"
          >
            →
          </button>
          <button
            type="button"
            className="border border-border-app px-2 py-1"
            onClick={() => setSelectedMonth(new Date().toISOString().slice(0, 7))}
          >
            今月
          </button>
        </div>
      </div>

      <h2 className="text-lg font-bold border-b border-border-app pb-1">月別収支</h2>

      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <Card title={`収入 (${selectedMonth})`} value={monthIncome} />
        <Card title={`支出 (${selectedMonth})`} value={monthExpense} />
      </section>

      <section className="bg-surface border border-border-app p-4">
        <h3 className="font-bold mb-2">月次カテゴリ集計 ({months[0]} 〜 {months[months.length - 1]})</h3>
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

      <h2 className="text-lg font-bold border-b border-border-app pb-1 pt-4">資産</h2>

      <section>
        <Card title="総資産" value={totalNow} />
      </section>

      <section className="bg-surface border border-border-app p-4">
        <h3 className="font-bold mb-2">資産推移</h3>
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
        <h3 className="font-bold mb-2">口座別残高</h3>
        <table className="w-full text-sm">
          <thead className="bg-surface-muted">
            <tr>
              <th className="text-left p-2">機関</th>
              <th className="text-left p-2">口座</th>
              <th className="text-left p-2">種別</th>
              <th className="text-right p-2">残高</th>
              <th className="text-left p-2">最終取込日</th>
            </tr>
          </thead>
          <tbody>
            {data.accounts.map((a) => (
              <tr key={a.accountId} className="border-t">
                <td className="p-2">{a.institutionName}</td>
                <td className="p-2">{a.accountName}</td>
                <td className="p-2">{accountKindLabels[a.kind] ?? a.kind}</td>
                <td className="p-2 text-right">{a.balance.toLocaleString()}</td>
                <td className={`p-2 ${!a.asOf || Date.now() - new Date(a.asOf).getTime() > 31 * 24 * 60 * 60 * 1000 ? "text-red-500" : ""}`}>
                  {a.asOf ? a.asOf.slice(0, 10) : "未取込"}
                </td>
              </tr>
            ))}
            {data.accounts.length === 0 && (
              <tr><td className="p-4 text-muted-foreground" colSpan={5}>口座がまだ登録されていません</td></tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}

function Card({ title, value }: { title: string; value: number }) {
  return (
    <div className="bg-surface border border-border-app p-4">
      <p className="text-xs text-muted-foreground">{title}</p>
      <p className="text-2xl font-bold mt-1 num">{value.toLocaleString()} 円</p>
    </div>
  );
}
