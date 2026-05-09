"use client";
import { useEffect, useState } from "react";

type Category = { id: number; name: string; kind: string };

const categoryKindLabels: Record<string, string> = {
  EXPENSE: "支出",
  INCOME: "収入",
  TRANSFER: "振替",
};

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

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">カテゴリ</h1>

      <section className="bg-surface border border-border-app p-4">
        <table className="w-full text-sm">
          <thead className="bg-surface-muted">
            <tr>
              <th className="text-left p-2">名前</th>
              <th className="text-left p-2">種別</th>
              <th className="text-left p-2 w-32">操作</th>
            </tr>
          </thead>
          <tbody>
            {cats.map((c) => {
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
                  <td className="p-2">{categoryKindLabels[c.kind] ?? c.kind}</td>
                  <td className="p-2">
                    {editing ? (
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={async () => {
                            if (!editName.trim()) return;
                            const res = await fetch(`/api/categories/${c.id}`, {
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
                          }}
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
                          onClick={async () => {
                            if (!confirm(`カテゴリ「${c.name}」を削除しますか？\n紐づいている明細はカテゴリ未設定に戻ります。関連ルールも削除されます。`)) return;
                            const res = await fetch(`/api/categories/${c.id}`, { method: "DELETE" });
                            if (!res.ok) {
                              alert("削除失敗");
                              return;
                            }
                            reload();
                          }}
                          className="text-xs text-muted-foreground hover:text-red-500 px-2 py-1"
                        >
                          削除
                        </button>
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>

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
