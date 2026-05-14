"use client";
import { useEffect, useState } from "react";
import RuleEditDialog from "./RuleEditDialog";

type Category = { id: number; name: string };
type Rule = {
  id: number;
  pattern: string;
  isRegex: boolean;
  field: string;
  priority: number;
  accountKindFilter: string | null;
  amountMin: number | null;
  amountMax: number | null;
  enabled: boolean;
  category: { id: number; name: string };
};

export default function RulesPage() {
  const [rules, setRules] = useState<Rule[]>([]);
  const [cats, setCats] = useState<Category[]>([]);
  const [pattern, setPattern] = useState("");
  const [categoryId, setCategoryId] = useState<string>("");
  const [field, setField] = useState("PAYEE");
  const [isRegex, setIsRegex] = useState(false);
  const [priority, setPriority] = useState(100);
  const [amountMin, setAmountMin] = useState("");
  const [amountMax, setAmountMax] = useState("");
  const [reapplying, setReapplying] = useState(false);
  const [reapplyMsg, setReapplyMsg] = useState<string | null>(null);
  const [editing, setEditing] = useState<Rule | null>(null);

  const reload = async () => {
    const [r, c] = await Promise.all([
      fetch("/api/rules").then((r) => r.json()),
      fetch("/api/categories").then((r) => r.json()),
    ]);
    setRules(r);
    setCats(c);
  };
  useEffect(() => {
    reload();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pattern || !categoryId) return;
    await fetch("/api/rules", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pattern,
        categoryId,
        field,
        isRegex,
        priority,
        amountMin: amountMin === "" ? null : Number(amountMin),
        amountMax: amountMax === "" ? null : Number(amountMax),
      }),
    });
    setPattern("");
    setAmountMin("");
    setAmountMax("");
    reload();
  };

  const remove = async (id: number) => {
    await fetch(`/api/rules?id=${id}`, { method: "DELETE" });
    reload();
  };

  const reapply = async () => {
    setReapplying(true);
    setReapplyMsg(null);
    const res = await fetch("/api/rules/reapply", { method: "POST" });
    const j = await res.json();
    setReapplying(false);
    setReapplyMsg(`再適用完了: ${j.updated} 件にカテゴリ付与`);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">カテゴリ自動分類ルール</h1>

      <div className="flex gap-2 items-center">
        <button
          className="bg-emerald-700 text-white px-4 py-2 disabled:bg-neutral-400"
          onClick={reapply}
          disabled={reapplying}
        >
          全明細にルールを再適用
        </button>
        {reapplyMsg && <span className="text-sm">{reapplyMsg}</span>}
      </div>

      <section className="bg-surface border border-border-app">
        {/* PC: テーブル */}
        <table className="hidden md:table w-full text-sm">
          <thead className="bg-surface-muted">
            <tr>
              <th className="text-right p-2">優先度</th>
              <th className="text-left p-2">対象</th>
              <th className="text-left p-2">パターン</th>
              <th className="text-left p-2">正規表現</th>
              <th className="text-left p-2">金額条件</th>
              <th className="text-left p-2">カテゴリ</th>
              <th className="text-left p-2"></th>
            </tr>
          </thead>
          <tbody>
            {rules.map((r) => {
              const amt =
                r.amountMin == null && r.amountMax == null
                  ? "-"
                  : r.amountMin != null && r.amountMax != null
                    ? `${r.amountMin.toLocaleString()} 〜 ${r.amountMax.toLocaleString()}`
                    : r.amountMin != null
                      ? `${r.amountMin.toLocaleString()} 以上`
                      : `${r.amountMax!.toLocaleString()} 以下`;
              return (
                <tr key={r.id} className="border-t">
                  <td className="p-2 text-right">{r.priority}</td>
                  <td className="p-2">{r.field}</td>
                  <td className="p-2 font-mono">{r.pattern}</td>
                  <td className="p-2">{r.isRegex ? "✓" : ""}</td>
                  <td className="p-2">{amt}</td>
                  <td className="p-2">{r.category.name}</td>
                  <td className="p-2 whitespace-nowrap">
                    <button
                      className="text-blue-600 text-xs mr-2"
                      onClick={() => setEditing(r)}
                    >
                      編集
                    </button>
                    <button className="text-red-500 text-xs" onClick={() => remove(r.id)}>
                      削除
                    </button>
                  </td>
                </tr>
              );
            })}
            {rules.length === 0 && (
              <tr>
                <td className="p-4 text-muted-foreground" colSpan={7}>
                  ルールがありません
                </td>
              </tr>
            )}
          </tbody>
        </table>

        {/* モバイル: カード */}
        <ul className="md:hidden flex flex-col">
          {rules.map((r) => {
            const amt =
              r.amountMin == null && r.amountMax == null
                ? null
                : r.amountMin != null && r.amountMax != null
                  ? `${r.amountMin.toLocaleString()} 〜 ${r.amountMax.toLocaleString()}`
                  : r.amountMin != null
                    ? `${r.amountMin.toLocaleString()} 以上`
                    : `${r.amountMax!.toLocaleString()} 以下`;
            const fieldLabel = r.field === "MEMO" ? "メモ" : "摘要";
            return (
              <li
                key={r.id}
                className="border-t border-border-app/40 first:border-t-0 p-3 flex flex-col gap-1"
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="font-mono break-all min-w-0 flex-1">
                    {r.pattern}
                  </span>
                  <button
                    onClick={() => setEditing(r)}
                    aria-label="編集"
                    className="w-11 h-11 flex items-center justify-center text-blue-600 -m-2 flex-shrink-0"
                  >
                    ✎
                  </button>
                  <button
                    onClick={() => remove(r.id)}
                    aria-label="削除"
                    className="w-11 h-11 flex items-center justify-center text-red-500 -m-2 flex-shrink-0"
                  >
                    🗑
                  </button>
                </div>
                <div className="text-xs text-muted-foreground flex flex-wrap gap-x-2">
                  <span>優先度 {r.priority}</span>
                  <span>· {fieldLabel}</span>
                  {r.isRegex && <span>· 正規表現</span>}
                  {r.accountKindFilter && <span>· {r.accountKindFilter}</span>}
                </div>
                <div className="text-xs flex flex-wrap gap-x-2">
                  {amt && (
                    <span className="text-muted-foreground">
                      金額 <span className="num">{amt}</span>
                    </span>
                  )}
                  <span className="font-medium">→ {r.category.name}</span>
                </div>
              </li>
            );
          })}
          {rules.length === 0 && (
            <li className="p-4 text-sm text-muted-foreground text-center">
              ルールがありません
            </li>
          )}
        </ul>
      </section>

      <section className="bg-surface border border-border-app p-4 max-w-2xl">
        <h2 className="font-bold mb-2">ルール追加</h2>
        <form onSubmit={submit} className="grid grid-cols-2 gap-2 text-sm">
          <input
            className="border border-border-app p-2 col-span-2"
            placeholder="マッチさせる文字列 (例: スターバックス)"
            value={pattern}
            onChange={(e) => setPattern(e.target.value)}
          />
          <select className="border border-border-app p-2" value={field} onChange={(e) => setField(e.target.value)}>
            <option value="PAYEE">摘要</option>
            <option value="MEMO">メモ</option>
          </select>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={isRegex}
              onChange={(e) => setIsRegex(e.target.checked)}
            />
            正規表現として扱う
          </label>
          <select className="border border-border-app p-2" value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">カテゴリ選択</option>
            {cats.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
          <input
            type="number"
            className="border border-border-app p-2"
            value={priority}
            onChange={(e) => setPriority(Number(e.target.value))}
            placeholder="優先度 (小さいほど先)"
          />
          <div className="col-span-2 flex items-center gap-2 text-xs">
            <span>金額条件 (絶対値):</span>
            <input
              type="number"
              placeholder="下限"
              className="border border-border-app p-1 w-24"
              value={amountMin}
              onChange={(e) => setAmountMin(e.target.value)}
            />
            <span>〜</span>
            <input
              type="number"
              placeholder="上限"
              className="border border-border-app p-1 w-24"
              value={amountMax}
              onChange={(e) => setAmountMax(e.target.value)}
            />
            <span className="text-muted-foreground">空欄なら制限なし</span>
          </div>
          <button className="bg-blue-600 text-white px-4 py-2 col-span-2">追加</button>
        </form>
      </section>

      {editing && (
        <RuleEditDialog
          rule={editing}
          cats={cats}
          onClose={() => setEditing(null)}
          onSaved={() => {
            setEditing(null);
            reload();
          }}
        />
      )}
    </div>
  );
}
