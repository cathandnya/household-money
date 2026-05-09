"use client";
import { useEffect, useState } from "react";

type Category = { id: number; name: string; kind: string };

export default function CategoriesPage() {
  const [cats, setCats] = useState<Category[]>([]);
  const [name, setName] = useState("");
  const [kind, setKind] = useState("EXPENSE");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editName, setEditName] = useState("");

  const reload = () => fetch("/api/categories").then((r) => r.json()).then(setCats);
  useEffect(() => {
    reload();
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name) return;
    await fetch("/api/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, kind }),
    });
    setName("");
    reload();
  };

  const saveEdit = async (id: number) => {
    if (!editName.trim()) return;
    const res = await fetch(`/api/categories/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: editName.trim() }),
    });
    if (!res.ok) {
      alert("更新失敗");
      return;
    }
    setEditingId(null);
    reload();
  };

  const removeCategory = async (c: Category) => {
    if (
      !confirm(
        `カテゴリ「${c.name}」を削除しますか？\n紐づいている明細はカテゴリ未設定に戻ります。関連ルールも削除されます。`,
      )
    )
      return;
    const res = await fetch(`/api/categories/${c.id}`, { method: "DELETE" });
    if (!res.ok) {
      alert("削除失敗");
      return;
    }
    reload();
  };

  const renderRow = (c: Category) => {
    const editing = editingId === c.id;
    return (
      <tr key={c.id} className="border-t">
        <td className="p-2">
          {editing ? (
            <input
              className="w-full border border-border-app p-1"
              value={editName}
              autoFocus
              onChange={(e) => setEditName(e.target.value)}
            />
          ) : (
            c.name
          )}
        </td>
        <td className="p-2">
          {editing ? (
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => saveEdit(c.id)}
                className="bg-blue-600 text-white px-2 py-1 text-xs"
              >
                保存
              </button>
              <button
                type="button"
                onClick={() => setEditingId(null)}
                className="border border-border-app px-2 py-1 text-xs"
              >
                取消
              </button>
            </div>
          ) : (
            <div className="flex gap-1">
              <button
                type="button"
                onClick={() => {
                  setEditingId(c.id);
                  setEditName(c.name);
                }}
                className="border border-border-app px-2 py-1 text-xs"
              >
                編集
              </button>
              <button
                type="button"
                onClick={() => removeCategory(c)}
                className="text-xs text-muted-foreground hover:text-red-500 px-2 py-1"
              >
                削除
              </button>
            </div>
          )}
        </td>
      </tr>
    );
  };

  const renderCard = (c: Category) => {
    const editing = editingId === c.id;
    return (
      <li
        key={c.id}
        className="border-t border-border-app/40 first:border-t-0 p-3 flex items-center justify-between gap-2"
      >
        {editing ? (
          <>
            <input
              className="flex-1 border border-border-app p-2 text-sm"
              value={editName}
              autoFocus
              onChange={(e) => setEditName(e.target.value)}
            />
            <button
              type="button"
              onClick={() => saveEdit(c.id)}
              className="bg-blue-600 text-white px-3 py-2 text-sm min-h-11"
            >
              保存
            </button>
            <button
              type="button"
              onClick={() => setEditingId(null)}
              className="border border-border-app px-3 py-2 text-sm min-h-11"
            >
              取消
            </button>
          </>
        ) : (
          <>
            <span className="flex-1 break-all">{c.name}</span>
            <button
              type="button"
              onClick={() => {
                setEditingId(c.id);
                setEditName(c.name);
              }}
              aria-label="編集"
              className="w-11 h-11 flex items-center justify-center border border-border-app -m-1"
            >
              ✏︎
            </button>
            <button
              type="button"
              onClick={() => removeCategory(c)}
              aria-label="削除"
              className="w-11 h-11 flex items-center justify-center text-red-500 -m-1"
            >
              🗑
            </button>
          </>
        )}
      </li>
    );
  };

  const renderSection = (label: string, kindKey: string) => {
    const list = cats.filter((c) => c.kind === kindKey);
    return (
      <section className="bg-surface border border-border-app p-4">
        <h2 className="font-bold mb-2">{label}</h2>
        {list.length === 0 ? (
          <p className="text-sm text-muted-foreground">カテゴリなし</p>
        ) : (
          <>
            {/* PC: テーブル */}
            <table className="hidden md:table w-full text-sm">
              <thead className="bg-surface-muted">
                <tr>
                  <th className="text-left p-2">名前</th>
                  <th className="text-left p-2 w-32">操作</th>
                </tr>
              </thead>
              <tbody>{list.map(renderRow)}</tbody>
            </table>

            {/* モバイル: カード */}
            <ul className="md:hidden flex flex-col">{list.map(renderCard)}</ul>
          </>
        )}
      </section>
    );
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">カテゴリ</h1>

      {renderSection("支出", "EXPENSE")}
      {renderSection("収入", "INCOME")}
      {renderSection("振替", "TRANSFER")}

      <section className="bg-surface border border-border-app p-4 max-w-md">
        <h2 className="font-bold mb-2">カテゴリ追加</h2>
        <form onSubmit={submit} className="space-y-2">
          <input
            className="w-full border border-border-app p-2"
            placeholder="名前"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <select className="w-full border border-border-app p-2" value={kind} onChange={(e) => setKind(e.target.value)}>
            <option value="EXPENSE">支出</option>
            <option value="INCOME">収入</option>
            <option value="TRANSFER">振替</option>
          </select>
          <button className="bg-blue-600 text-white px-4 py-2">追加</button>
        </form>
      </section>
    </div>
  );
}
