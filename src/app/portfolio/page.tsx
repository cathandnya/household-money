"use client";
import { useEffect, useMemo, useState } from "react";

type Holding = {
  ticker: string | null;
  name: string;
  qty: number;
  avgCost: number | null;
  cost: number | null;
  marketValue: number;
  currency: string;
};

// 取得額: CSV 由来の cost を優先、なければ avgCost * qty で算出 (株式向け)
const holdingCost = (h: Holding): number | null => {
  if (h.cost != null) return h.cost;
  if (h.avgCost != null) return h.avgCost * h.qty;
  return null;
};
type AccountHoldings = {
  accountId: number;
  accountName: string;
  institutionName: string;
  snapshotDate: string | null;
  holdings: Holding[];
};

export default function PortfolioPage() {
  const [data, setData] = useState<AccountHoldings[]>([]);
  useEffect(() => {
    fetch("/api/holdings").then((r) => r.json()).then(setData);
  }, []);

  const totals = useMemo(() => {
    const all = data.flatMap((d) => d.holdings);
    const total = all.reduce((s, h) => s + h.marketValue, 0);
    const totalCost = all.reduce((s, h) => s + (holdingCost(h) ?? 0), 0);
    const aggMap = new Map<
      string,
      { name: string; ticker: string | null; qty: number; marketValue: number; cost: number; hasCost: boolean }
    >();
    for (const h of all) {
      const key = h.ticker ?? h.name;
      const cur = aggMap.get(key) ?? {
        name: h.name,
        ticker: h.ticker,
        qty: 0,
        marketValue: 0,
        cost: 0,
        hasCost: false,
      };
      cur.qty += h.qty;
      cur.marketValue += h.marketValue;
      const c = holdingCost(h);
      if (c != null) {
        cur.cost += c;
        cur.hasCost = true;
      }
      aggMap.set(key, cur);
    }
    return {
      total,
      totalCost,
      totalPnL: total - totalCost,
      agg: [...aggMap.values()].sort((a, b) => b.marketValue - a.marketValue),
    };
  }, [data]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">ポートフォリオ</h1>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-surface border border-border-app p-4">
          <p className="text-xs text-muted-foreground">時価評価額合計</p>
          <p className="text-2xl font-bold num">{totals.total.toLocaleString()} 円</p>
        </div>
        <div className="bg-surface border border-border-app p-4">
          <p className="text-xs text-muted-foreground">取得額合計</p>
          <p className="text-2xl font-bold num">{Math.round(totals.totalCost).toLocaleString()} 円</p>
        </div>
        <div className="bg-surface border border-border-app p-4">
          <p className="text-xs text-muted-foreground">損益</p>
          <p
            className={`text-2xl font-bold num ${
              totals.totalPnL > 0 ? "text-green-500" : totals.totalPnL < 0 ? "text-red-500" : ""
            }`}
          >
            {totals.totalPnL >= 0 ? "+" : ""}
            {Math.round(totals.totalPnL).toLocaleString()} 円
            {totals.totalCost > 0 && (
              <span className="text-sm ml-2">
                ({totals.totalPnL >= 0 ? "+" : ""}
                {((totals.totalPnL / totals.totalCost) * 100).toFixed(2)}%)
              </span>
            )}
          </p>
        </div>
      </section>

      <section className="bg-surface border border-border-app p-4">
        <h2 className="font-bold mb-2">銘柄別 (口座横断)</h2>
        {/* PC: テーブル */}
        <table className="hidden md:table w-full text-xs">
          <thead className="bg-surface-muted">
            <tr>
              <th className="text-left p-1">銘柄</th>
              <th className="text-right p-1">数量</th>
              <th className="text-right p-1">取得額</th>
              <th className="text-right p-1">評価額</th>
              <th className="text-right p-1">損益</th>
              <th className="text-right p-1">損益率</th>
              <th className="text-right p-1">構成比</th>
            </tr>
          </thead>
          <tbody>
            {totals.agg.map((h, i) => {
              const pnl = h.hasCost ? h.marketValue - h.cost : null;
              const pnlPct = pnl != null && h.cost > 0 ? (pnl / h.cost) * 100 : null;
              const colorCls = pnl == null ? "" : pnl > 0 ? "text-green-500" : pnl < 0 ? "text-red-500" : "";
              return (
                <tr key={i} className="border-t">
                  <td className="p-1">{h.ticker ? `${h.ticker} ` : ""}{h.name}</td>
                  <td className="p-1 text-right">{h.qty.toLocaleString()}</td>
                  <td className="p-1 text-right">{h.hasCost ? Math.round(h.cost).toLocaleString() : "-"}</td>
                  <td className="p-1 text-right">{h.marketValue.toLocaleString()}</td>
                  <td className={`p-1 text-right ${colorCls}`}>
                    {pnl == null ? "-" : (pnl >= 0 ? "+" : "") + Math.round(pnl).toLocaleString()}
                  </td>
                  <td className={`p-1 text-right ${colorCls}`}>
                    {pnlPct == null ? "-" : (pnlPct >= 0 ? "+" : "") + pnlPct.toFixed(2) + "%"}
                  </td>
                  <td className="p-1 text-right">
                    {totals.total ? ((h.marketValue / totals.total) * 100).toFixed(1) + "%" : "-"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>

        {/* モバイル: カード */}
        <ul className="md:hidden flex flex-col gap-2">
          {totals.agg.map((h, i) => {
            const pnl = h.hasCost ? h.marketValue - h.cost : null;
            const pnlPct = pnl != null && h.cost > 0 ? (pnl / h.cost) * 100 : null;
            const colorCls = pnl == null ? "" : pnl > 0 ? "text-green-500" : pnl < 0 ? "text-red-500" : "";
            const ratio = totals.total
              ? ((h.marketValue / totals.total) * 100).toFixed(1) + "%"
              : "-";
            return (
              <li key={i} className="border border-border-app rounded-sm p-3 flex flex-col gap-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-medium break-all min-w-0 flex-1">
                    {h.ticker ? `${h.ticker} ` : ""}
                    {h.name}
                  </span>
                  <span className="num font-bold whitespace-nowrap">
                    {h.marketValue.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                  <span>
                    数量 <span className="num">{h.qty.toLocaleString()}</span>
                    {" · 取得 "}
                    <span className="num">
                      {h.hasCost ? Math.round(h.cost).toLocaleString() : "-"}
                    </span>
                  </span>
                  <span className={`num whitespace-nowrap ${colorCls}`}>
                    {pnl == null
                      ? "-"
                      : (pnl >= 0 ? "+" : "") + Math.round(pnl).toLocaleString()}
                    {pnlPct != null && (
                      <span className="ml-1">
                        ({(pnlPct >= 0 ? "+" : "") + pnlPct.toFixed(2)}%)
                      </span>
                    )}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">
                  構成比 <span className="num">{ratio}</span>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

      {data.map((acc) => (
        <section key={acc.accountId} className="bg-surface border border-border-app p-4">
          <h2 className="font-bold">
            {acc.institutionName} / {acc.accountName}
            <span className="text-xs text-muted-foreground ml-2">
              {acc.snapshotDate ? `as of ${acc.snapshotDate.slice(0, 10)}` : "(未取込)"}
            </span>
          </h2>
          {acc.holdings.length === 0 ? (
            <p className="text-sm text-muted-foreground mt-2">スナップショット未取込</p>
          ) : (
            <>
              {/* PC: テーブル */}
              <table className="hidden md:table w-full text-xs mt-2">
                <thead className="bg-surface-muted">
                  <tr>
                    <th className="text-left p-1">銘柄</th>
                    <th className="text-right p-1">数量</th>
                    <th className="text-right p-1">取得単価</th>
                    <th className="text-right p-1">取得額</th>
                    <th className="text-right p-1">評価額</th>
                    <th className="text-right p-1">損益</th>
                    <th className="text-right p-1">損益率</th>
                  </tr>
                </thead>
                <tbody>
                  {acc.holdings.map((h, i) => {
                    const cost = holdingCost(h);
                    const pnl = cost != null ? h.marketValue - cost : null;
                    const pnlPct = pnl != null && cost && cost > 0 ? (pnl / cost) * 100 : null;
                    const colorCls = pnl == null ? "" : pnl > 0 ? "text-green-500" : pnl < 0 ? "text-red-500" : "";
                    return (
                      <tr key={i} className="border-t">
                        <td className="p-1">{h.ticker ? `${h.ticker} ` : ""}{h.name}</td>
                        <td className="p-1 text-right">{h.qty.toLocaleString()}</td>
                        <td className="p-1 text-right">{h.avgCost?.toLocaleString() ?? "-"}</td>
                        <td className="p-1 text-right">{cost != null ? Math.round(cost).toLocaleString() : "-"}</td>
                        <td className="p-1 text-right">{h.marketValue.toLocaleString()}</td>
                        <td className={`p-1 text-right ${colorCls}`}>
                          {pnl == null ? "-" : (pnl >= 0 ? "+" : "") + Math.round(pnl).toLocaleString()}
                        </td>
                        <td className={`p-1 text-right ${colorCls}`}>
                          {pnlPct == null ? "-" : (pnlPct >= 0 ? "+" : "") + pnlPct.toFixed(2) + "%"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>

              {/* モバイル: カード */}
              <ul className="md:hidden flex flex-col gap-2 mt-2">
                {acc.holdings.map((h, i) => {
                  const cost = holdingCost(h);
                  const pnl = cost != null ? h.marketValue - cost : null;
                  const pnlPct = pnl != null && cost && cost > 0 ? (pnl / cost) * 100 : null;
                  const colorCls = pnl == null ? "" : pnl > 0 ? "text-green-500" : pnl < 0 ? "text-red-500" : "";
                  return (
                    <li key={i} className="border border-border-app rounded-sm p-3 flex flex-col gap-1">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="font-medium break-all min-w-0 flex-1">
                          {h.ticker ? `${h.ticker} ` : ""}
                          {h.name}
                        </span>
                        <span className="num font-bold whitespace-nowrap">
                          {h.marketValue.toLocaleString()}
                        </span>
                      </div>
                      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                        <span>
                          数量 <span className="num">{h.qty.toLocaleString()}</span>
                          {h.avgCost != null && (
                            <>
                              {" · 単価 "}
                              <span className="num">
                                {h.avgCost.toLocaleString()}
                              </span>
                            </>
                          )}
                        </span>
                        <span className={`num whitespace-nowrap ${colorCls}`}>
                          {pnl == null
                            ? "-"
                            : (pnl >= 0 ? "+" : "") + Math.round(pnl).toLocaleString()}
                          {pnlPct != null && (
                            <span className="ml-1">
                              ({(pnlPct >= 0 ? "+" : "") + pnlPct.toFixed(2)}%)
                            </span>
                          )}
                        </span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
        </section>
      ))}
    </div>
  );
}
