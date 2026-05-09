"use client";
import { useEffect, useMemo, useState } from "react";

type Holding = {
  ticker: string | null;
  name: string;
  qty: number;
  avgCost: number | null;
  marketValue: number;
  currency: string;
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
    const aggMap = new Map<string, { name: string; ticker: string | null; qty: number; marketValue: number }>();
    for (const h of all) {
      const key = h.ticker ?? h.name;
      const cur = aggMap.get(key) ?? { name: h.name, ticker: h.ticker, qty: 0, marketValue: 0 };
      cur.qty += h.qty;
      cur.marketValue += h.marketValue;
      aggMap.set(key, cur);
    }
    return { total, agg: [...aggMap.values()].sort((a, b) => b.marketValue - a.marketValue) };
  }, [data]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">ポートフォリオ</h1>

      <section className="bg-surface border border-border-app p-4">
        <p className="text-xs text-muted-foreground">時価評価額合計</p>
        <p className="text-2xl font-bold">{totals.total.toLocaleString()} 円</p>
      </section>

      <section className="bg-surface border border-border-app p-4">
        <h2 className="font-bold mb-2">銘柄別 (口座横断)</h2>
        <table className="w-full text-xs">
          <thead className="bg-surface-muted">
            <tr>
              <th className="text-left p-1">銘柄</th>
              <th className="text-right p-1">数量</th>
              <th className="text-right p-1">評価額</th>
              <th className="text-right p-1">構成比</th>
            </tr>
          </thead>
          <tbody>
            {totals.agg.map((h, i) => (
              <tr key={i} className="border-t">
                <td className="p-1">{h.ticker ? `${h.ticker} ` : ""}{h.name}</td>
                <td className="p-1 text-right">{h.qty.toLocaleString()}</td>
                <td className="p-1 text-right">{h.marketValue.toLocaleString()}</td>
                <td className="p-1 text-right">
                  {totals.total ? ((h.marketValue / totals.total) * 100).toFixed(1) + "%" : "-"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
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
            <table className="w-full text-xs mt-2">
              <thead className="bg-surface-muted">
                <tr>
                  <th className="text-left p-1">銘柄</th>
                  <th className="text-right p-1">数量</th>
                  <th className="text-right p-1">取得単価</th>
                  <th className="text-right p-1">評価額</th>
                </tr>
              </thead>
              <tbody>
                {acc.holdings.map((h, i) => (
                  <tr key={i} className="border-t">
                    <td className="p-1">{h.ticker ? `${h.ticker} ` : ""}{h.name}</td>
                    <td className="p-1 text-right">{h.qty.toLocaleString()}</td>
                    <td className="p-1 text-right">{h.avgCost?.toLocaleString() ?? "-"}</td>
                    <td className="p-1 text-right">{h.marketValue.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      ))}
    </div>
  );
}
