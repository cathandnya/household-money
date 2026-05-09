"use client";
import { useEffect, useState } from "react";

type Category = { id: number; name: string };
type Rule = {
  id: number;
  pattern: string;
  isRegex: boolean;
  field: string;
  priority: number;
  accountKindFilter: string | null;
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
  const [reapplying, setReapplying] = useState(false);
  const [reapplyMsg, setReapplyMsg] = useState<string | null>(null);

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
      body: JSON.stringify({ pattern, categoryId, field, isRegex, priority }),
    });
    setPattern("");
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
        <table className="w-full text-sm">
          <thead className="bg-surface-muted">
            <tr>
              <th className="text-right p-2">優先度</th>
              <th className="text-left p-2">対象</th>
              <th className="text-left p-2">パターン</th>
              <th className="text-left p-2">正規表現</th>
              <th className="text-left p-2">カテゴリ</th>
              <th className="text-left p-2"></th>
            </tr>
          </thead>
          <tbody>
            {rules.map((r) => (
              <tr key={r.id} className="border-t">
                <td className="p-2 text-right">{r.priority}</td>
                <td className="p-2">{r.field}</td>
                <td className="p-2 font-mono">{r.pattern}</td>
                <td className="p-2">{r.isRegex ? "✓" : ""}</td>
                <td className="p-2">{r.category.name}</td>
                <td className="p-2">
                  <button className="text-red-500 text-xs" onClick={() => remove(r.id)}>
                    削除
                  </button>
                </td>
              </tr>
            ))}
            {rules.length === 0 && (
              <tr>
                <td className="p-4 text-muted-foreground" colSpan={6}>
                  ルールがありません
                </td>
              </tr>
            )}
          </tbody>
        </table>
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
          <button className="bg-blue-600 text-white px-4 py-2 col-span-2">追加</button>
        </form>
      </section>
    </div>
  );
}
