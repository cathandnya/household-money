"use client";
import { useEffect, useMemo, useState } from "react";
import RuleCreateDialog, { type RuleDialogTx } from "./RuleCreateDialog";

type Tx = {
  id: number;
  occurredAt: string;
  amount: number;
  balance: number | null;
  payee: string;
  memo: string | null;
  account: {
    id: number;
    name: string;
    kind: string;
    institution: { name: string };
  };
  category: { id: number; name: string } | null;
};
type Account = { id: number; name: string; institution: { name: string } };
type Category = { id: number; name: string; kind: string };

export default function TransactionsPage() {
  const [txs, setTxs] = useState<Tx[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [q, setQ] = useState("");
  const [accountId, setAccountId] = useState<string>("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [from, setFrom] = useState<string>("");
  const [to, setTo] = useState<string>("");
  const [dialog, setDialog] = useState<{ tx: RuleDialogTx; category: Category } | null>(null);

  const reload = async () => {
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (accountId) params.set("accountId", accountId);
    if (categoryId) params.set("categoryId", categoryId);
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    const txs = await fetch("/api/transactions?" + params.toString()).then((r) => r.json());
    setTxs(txs);
  };

  useEffect(() => {
    fetch("/api/accounts").then((r) => r.json()).then(setAccounts);
    fetch("/api/categories")
      .then((r) => r.json())
      .then((cs: Category[]) =>
        setCategories(
          [...cs].sort((a, b) => {
            const order = (k: string) => (k === "TRANSFER" ? 1 : 0);
            return order(a.kind) - order(b.kind);
          }),
        ),
      );
  }, []);

  // フィルタが変わったら自動で再読み込み (テキスト検索は 250ms デバウンス)
  useEffect(() => {
    const handle = setTimeout(reload, q ? 250 : 0);
    return () => clearTimeout(handle);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, accountId, categoryId, from, to]);

  const totals = useMemo(() => {
    const inc = txs.filter((t) => t.amount > 0).reduce((s, t) => s + t.amount, 0);
    const exp = txs.filter((t) => t.amount < 0).reduce((s, t) => s + t.amount, 0);
    return { inc, exp };
  }, [txs]);

  const updateCategory = async (tx: Tx, newCatId: string) => {
    await fetch("/api/transactions", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: tx.id, categoryId: newCatId ? Number(newCatId) : null }),
    });
    // 新カテゴリが選ばれた場合、ルール作成ダイアログを開く (空に戻したときは開かない)
    if (newCatId) {
      const cat = categories.find((c) => c.id === Number(newCatId));
      if (cat) {
        setDialog({
          tx: {
            id: tx.id,
            payee: tx.payee,
            memo: tx.memo,
            account: tx.account,
          },
          category: cat,
        });
        return;
      }
    }
    reload();
  };

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-bold">取引明細</h1>

      <div className="bg-surface border border-border-app p-3 grid grid-cols-2 md:grid-cols-5 gap-2 text-sm">
        <input
          className="border border-border-app p-1"
          placeholder="検索 (摘要/メモ)"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select className="border border-border-app p-1" value={accountId} onChange={(e) => setAccountId(e.target.value)}>
          <option value="">全口座</option>
          {accounts.map((a) => (
            <option key={a.id} value={a.id}>
              {a.institution.name} / {a.name}
            </option>
          ))}
        </select>
        <select
          className="border border-border-app p-1"
          value={categoryId}
          onChange={(e) => setCategoryId(e.target.value)}
        >
          <option value="">全カテゴリ</option>
          <option value="null">未分類のみ</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <input type="date" className="border border-border-app p-1" value={from} onChange={(e) => setFrom(e.target.value)} />
        <input type="date" className="border border-border-app p-1" value={to} onChange={(e) => setTo(e.target.value)} />
      </div>

      <p className="text-sm text-muted-foreground">
        {txs.length} 件 / 入金 {totals.inc.toLocaleString()} / 出金 {totals.exp.toLocaleString()}
      </p>

      {dialog && (
        <RuleCreateDialog
          tx={dialog.tx}
          category={dialog.category}
          onClose={() => {
            setDialog(null);
            reload();
          }}
          onApplied={() => {
            // 適用後の再読み込みは onClose で行う
          }}
        />
      )}

      <div className="bg-surface border border-border-app overflow-auto">
        <table className="w-full text-xs">
          <thead className="bg-surface-muted sticky top-0">
            <tr>
              <th className="text-left p-1">日付</th>
              <th className="text-left p-1">口座</th>
              <th className="text-right p-1">金額</th>
              <th className="text-right p-1">残高</th>
              <th className="text-left p-1">摘要</th>
              <th className="text-left p-1">カテゴリ</th>
            </tr>
          </thead>
          <tbody>
            {txs.map((t) => (
              <tr key={t.id} className="border-t">
                <td className="p-1">{t.occurredAt.slice(0, 10)}</td>
                <td className="p-1">
                  {t.account.institution.name}/{t.account.name}
                </td>
                <td className={`p-1 text-right ${t.amount < 0 ? "text-red-500" : t.amount > 0 ? "text-green-500" : ""}`}>
                  {t.amount === 0 && t.payee === "残高記録" ? "" : t.amount.toLocaleString()}
                </td>
                <td className="p-1 text-right">{t.balance?.toLocaleString() ?? ""}</td>
                <td className="p-1">{t.payee}</td>
                <td className="p-1">
                  <select
                    className="border border-border-app text-xs"
                    value={t.category?.id ?? ""}
                    onChange={(e) => updateCategory(t, e.target.value)}
                  >
                    <option value="">-</option>
                    {categories
                      .filter((c) =>
                        t.amount > 0
                          ? c.kind === "INCOME" || c.kind === "TRANSFER"
                          : t.amount < 0
                          ? c.kind === "EXPENSE" || c.kind === "TRANSFER"
                          : true,
                      )
                      .map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                  </select>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
