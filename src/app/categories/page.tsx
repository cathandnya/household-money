"use client";
import { useEffect, useState } from "react";

type Category = { id: number; name: string; kind: string };

export default function CategoriesPage() {
  const [cats, setCats] = useState<Category[]>([]);
  const [name, setName] = useState("");
  const [kind, setKind] = useState("EXPENSE");

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
            </tr>
          </thead>
          <tbody>
            {cats.map((c) => (
              <tr key={c.id} className="border-t">
                <td className="p-2">{c.name}</td>
                <td className="p-2">{c.kind}</td>
              </tr>
            ))}
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
            <option value="EXPENSE">EXPENSE</option>
            <option value="INCOME">INCOME</option>
            <option value="TRANSFER">TRANSFER</option>
          </select>
          <button className="bg-blue-600 text-white px-4 py-2">追加</button>
        </form>
      </section>
    </div>
  );
}
