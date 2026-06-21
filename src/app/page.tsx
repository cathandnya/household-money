"use client";
import { useEffect, useState } from "react";
import {
  ACCOUNT_KIND_LABELS as accountKindLabels,
  ASSET_GROUP_LABELS,
  ASSET_GROUP_ORDER,
  assetGroupOf,
} from "@/lib/accountKinds";

const institutionUrls: Record<string, string> = {
  shinsei: "https://www.sbishinseibank.co.jp/",
  rakuten_bank: "https://www.rakuten-bank.co.jp/",
  smtb: "https://direct.smtb.jp/ib1/contents/kk/login",
  yucho: "https://direct.jp-bank.japanpost.jp/",
  smcc: "https://www.smbc-card.com/mem/",
  rakuten_card: "https://www.rakuten-card.co.jp/e-navi/",
  rakuten_sec: "https://www.rakuten-sec.co.jp/",
  rakuten_sec_jnisa: "https://www.rakuten-sec.co.jp/",
  sbi_benefit: "https://www.benefit401k.com/customer/",
  resona: "https://ib.resonabank.co.jp/web/",
};
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from "recharts";

const PIE_COLORS = [
  "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6",
  "#ec4899", "#06b6d4", "#84cc16", "#f97316", "#6366f1",
  "#14b8a6", "#eab308", "#a855f7", "#22c55e", "#0ea5e9",
];

type AccountSummary = {
  accountId: number;
  accountName: string;
  institutionName: string;
  institutionCode: string;
  kind: string;
  balance: number;
  cost: number | null;
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

// タッチデバイスではグラフのツールチップを無効化する (タップで誤発火するため)
function useIsCoarsePointer() {
  const [coarse, setCoarse] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(pointer: coarse)");
    const update = () => setCoarse(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return coarse;
}

export default function Dashboard() {
  const isCoarse = useIsCoarsePointer();
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

  // 資産内訳: 口座種別を現金/投資信託/年金にまとめる (クレカ等は対象外)。
  // 損益は取得額 (cost) が取れる口座だけを合算した部分損益。1 件も無ければ null。
  const assetBreakdown = ASSET_GROUP_ORDER.map((group) => {
    const accts = data.accounts.filter((a) => assetGroupOf(a.kind) === group);
    const value = accts.reduce((s, a) => s + a.balance, 0);
    const withCost = accts.filter((a) => a.cost != null);
    const profit =
      withCost.length > 0
        ? withCost.reduce((s, a) => s + (a.balance - (a.cost ?? 0)), 0)
        : null;
    return { group, label: ASSET_GROUP_LABELS[group], value, profit };
  }).filter((g) => g.value !== 0);
  const flow = data.monthlyFlow.find((f) => f.month === selectedMonth);
  const monthIncome = flow?.income ?? 0;
  const monthExpense = flow?.expense ?? 0;

  const monthRows = data.monthly.filter((m) => m.month === selectedMonth);
  // 表示中の月のみ、収入と支出に分けてカテゴリ集計 (TRANSFER は除外)
  const aggregate = (predicate: (m: Monthly[number]) => boolean) => {
    const map = new Map<string, number>();
    for (const m of monthRows) {
      if (m.kind === "TRANSFER") continue;
      if (!predicate(m)) continue;
      const abs = Math.abs(m.amount);
      if (abs === 0) continue;
      map.set(m.categoryName, (map.get(m.categoryName) ?? 0) + abs);
    }
    return [...map.entries()]
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  };
  const incomeCats = aggregate(
    (m) => m.kind === "INCOME" || (m.kind == null && m.amount > 0),
  );
  const expenseCats = aggregate(
    (m) => m.kind === "EXPENSE" || (m.kind == null && m.amount < 0),
  );

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

      <section className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <CategoryBreakdown title={`収入 (${selectedMonth})`} data={incomeCats} />
        <CategoryBreakdown title={`支出 (${selectedMonth})`} data={expenseCats} />
      </section>

      <h2 className="text-lg font-bold border-b border-border-app pb-1 pt-4">資産</h2>

      <section>
        <Card title="総資産" value={totalNow} />
      </section>

      {assetBreakdown.length > 0 && (
        <section
          className={`grid grid-cols-1 gap-4 ${
            assetBreakdown.length >= 3 ? "md:grid-cols-3" : "md:grid-cols-2"
          }`}
        >
          {assetBreakdown.map((g) => (
            <Card
              key={g.group}
              title={`${g.label}${
                totalNow > 0 ? ` (${Math.round((g.value / totalNow) * 100)}%)` : ""
              }`}
              value={g.value}
              profit={g.profit}
            />
          ))}
        </section>
      )}

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
              {!isCoarse && (
                <Tooltip
                  formatter={(v) => Number(v).toLocaleString() + "円"}
                  contentStyle={{
                    background: "var(--surface)",
                    border: "1px solid var(--border)",
                    color: "var(--foreground)",
                  }}
                />
              )}
              <Line type="monotone" dataKey="total" stroke="#3b82f6" dot={false} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </section>

      <section className="bg-surface border border-border-app p-4">
        <h3 className="font-bold mb-2">口座別残高</h3>
        {(() => {
          const visibleAccounts = data.accounts;
          return (
        <>
        {/* PC: テーブル */}
        <table className="hidden md:table w-full text-sm">
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
            {visibleAccounts.map((a) => (
              <tr key={a.accountId} className="border-t">
                <td className="p-2">
                  {institutionUrls[a.institutionCode] ? (
                    <a
                      href={institutionUrls[a.institutionCode]}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="hover:text-blue-500 underline"
                    >
                      {a.institutionName}
                    </a>
                  ) : (
                    a.institutionName
                  )}
                </td>
                <td className="p-2">{a.accountName}</td>
                <td className="p-2">{accountKindLabels[a.kind] ?? a.kind}</td>
                <td className="p-2 text-right">{a.kind === "CREDIT_CARD" ? "" : a.balance.toLocaleString()}</td>
                <td className={`p-2 ${!a.asOf || Date.now() - new Date(a.asOf).getTime() > 31 * 24 * 60 * 60 * 1000 ? "text-red-500" : ""}`}>
                  {a.asOf ? a.asOf.slice(0, 10) : "未取込"}
                </td>
              </tr>
            ))}
            {visibleAccounts.length === 0 && (
              <tr><td className="p-4 text-muted-foreground" colSpan={5}>口座がまだ登録されていません</td></tr>
            )}
          </tbody>
        </table>

        {/* モバイル: カード */}
        <ul className="md:hidden flex flex-col gap-2">
          {visibleAccounts.map((a) => {
            const stale =
              !a.asOf ||
              Date.now() - new Date(a.asOf).getTime() > 31 * 24 * 60 * 60 * 1000;
            return (
              <li
                key={a.accountId}
                className="border border-border-app rounded-sm p-3 flex flex-col gap-1"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-medium break-all min-w-0 flex-1">
                    {institutionUrls[a.institutionCode] ? (
                      <a
                        href={institutionUrls[a.institutionCode]}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-blue-500 underline"
                      >
                        {a.institutionName}
                      </a>
                    ) : (
                      a.institutionName
                    )}
                    {" / "}
                    {a.accountName}
                  </span>
                  <span className="num font-bold whitespace-nowrap">
                    {a.kind === "CREDIT_CARD" ? "" : a.balance.toLocaleString()}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {accountKindLabels[a.kind] ?? a.kind} ·{" "}
                  <span className={stale ? "text-red-500" : ""}>
                    {a.asOf ? a.asOf.slice(0, 10) : "未取込"}
                  </span>
                </div>
              </li>
            );
          })}
          {visibleAccounts.length === 0 && (
            <li className="bg-surface border border-border-app p-4 text-sm text-muted-foreground text-center">
              口座がまだ登録されていません
            </li>
          )}
        </ul>
        </>
          );
        })()}
      </section>
    </div>
  );
}

function Card({
  title,
  value,
  profit,
}: {
  title: string;
  value: number;
  profit?: number | null;
}) {
  return (
    <div className="bg-surface border border-border-app p-4">
      <p className="text-xs text-muted-foreground">{title}</p>
      <p className="text-2xl font-bold mt-1 num">{value.toLocaleString()} 円</p>
      {profit != null && (
        <p
          className={`text-xs mt-1 num ${
            profit >= 0 ? "text-emerald-600" : "text-red-500"
          }`}
        >
          損益 {profit >= 0 ? "+" : ""}
          {profit.toLocaleString()} 円
        </p>
      )}
    </div>
  );
}

function CategoryBreakdown({
  title,
  data,
}: {
  title: string;
  data: Array<{ name: string; value: number }>;
}) {
  const isCoarse = useIsCoarsePointer();
  const total = data.reduce((s, d) => s + d.value, 0);
  return (
    <div className="bg-surface border border-border-app p-4">
      <h3 className="font-bold mb-2">{title}</h3>
      {data.length === 0 ? (
        <p className="text-sm text-muted-foreground">データなし</p>
      ) : (
        <>
          <div className="h-56">
            <ResponsiveContainer>
              <PieChart>
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="name"
                  outerRadius="80%"
                  stroke="var(--surface)"
                >
                  {data.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                {!isCoarse && (
                  <Tooltip
                    formatter={(v) => Number(v).toLocaleString() + "円"}
                    contentStyle={{
                      background: "var(--surface)",
                      border: "1px solid var(--border)",
                      color: "var(--foreground)",
                    }}
                  />
                )}
              </PieChart>
            </ResponsiveContainer>
          </div>
          {/* PC: テーブル */}
          <table className="hidden md:table w-full text-xs mt-2">
            <thead className="bg-surface-muted">
              <tr>
                <th className="text-left p-1">カテゴリ</th>
                <th className="text-right p-1">金額</th>
                <th className="text-right p-1">構成比</th>
              </tr>
            </thead>
            <tbody>
              {data.map((d, i) => (
                <tr key={d.name} className="border-t">
                  <td className="p-1">
                    <span
                      className="inline-block w-2 h-2 mr-1 align-middle"
                      style={{ background: PIE_COLORS[i % PIE_COLORS.length] }}
                    />
                    {d.name}
                  </td>
                  <td className="p-1 text-right">{d.value.toLocaleString()}</td>
                  <td className="p-1 text-right">
                    {total > 0 ? ((d.value / total) * 100).toFixed(1) : "0.0"}%
                  </td>
                </tr>
              ))}
              <tr className="border-t font-bold">
                <td className="p-1">合計</td>
                <td className="p-1 text-right">{total.toLocaleString()}</td>
                <td className="p-1 text-right">100.0%</td>
              </tr>
            </tbody>
          </table>

          {/* モバイル: カード */}
          <ul className="md:hidden flex flex-col gap-1 mt-2 text-xs">
            {data.map((d, i) => (
              <li
                key={d.name}
                className="flex items-baseline justify-between gap-2 p-2 border-t border-border-app/40"
              >
                <span className="flex items-center gap-2 min-w-0">
                  <span
                    className="inline-block w-2 h-2 flex-shrink-0"
                    style={{ background: PIE_COLORS[i % PIE_COLORS.length] }}
                  />
                  <span className="break-all">{d.name}</span>
                </span>
                <span className="flex items-baseline gap-2 whitespace-nowrap">
                  <span className="num">{d.value.toLocaleString()}</span>
                  <span className="num text-muted-foreground">
                    {total > 0 ? ((d.value / total) * 100).toFixed(1) : "0.0"}%
                  </span>
                </span>
              </li>
            ))}
            <li className="flex items-baseline justify-between gap-2 p-2 border-t border-border-app font-bold">
              <span>合計</span>
              <span className="flex items-baseline gap-2 whitespace-nowrap">
                <span className="num">{total.toLocaleString()}</span>
                <span className="num">100.0%</span>
              </span>
            </li>
          </ul>
        </>
      )}
    </div>
  );
}
