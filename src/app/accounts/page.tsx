"use client";
import { useEffect, useState } from "react";

type Inst = { id: number; code: string; name: string; kind: string };
type Account = {
  id: number;
  name: string;
  kind: string;
  currency: string;
  institution: Inst;
};

const accountKinds: Record<string, string[]> = {
  BANK: ["CHECKING", "SAVINGS"],
  CARD: ["CREDIT_CARD"],
  SECURITIES: ["BROKERAGE"],
  DC: ["DC"],
};

export default function AccountsPage() {
  const [insts, setInsts] = useState<Inst[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [institutionId, setInstitutionId] = useState<number | "">("");
  const [name, setName] = useState("");
  const [kind, setKind] = useState("");

  const reload = async () => {
    const [i, a] = await Promise.all([
      fetch("/api/institutions").then((r) => r.json()),
      fetch("/api/accounts").then((r) => r.json()),
    ]);
    setInsts(i);
    setAccounts(a);
  };

  useEffect(() => {
    reload();
  }, []);

  const selectedInst = insts.find((x) => x.id === institutionId);
  const kindOptions = selectedInst ? accountKinds[selectedInst.kind] ?? [] : [];

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!institutionId || !name || !kind) return;
    const res = await fetch("/api/accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ institutionId, name, kind }),
    });
    if (!res.ok) {
      alert("登録に失敗しました");
      return;
    }
    setName("");
    setKind("");
    setInstitutionId("");
    reload();
  };

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold">口座管理</h1>

      <section>
        <h2 className="font-bold mb-2">登録済み口座</h2>
        <table className="w-full border border-border-app bg-surface text-sm">
          <thead className="bg-surface-muted">
            <tr>
              <th className="text-left p-2">機関</th>
              <th className="text-left p-2">口座名</th>
              <th className="text-left p-2">種別</th>
              <th className="text-left p-2">通貨</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((a) => (
              <tr key={a.id} className="border-t">
                <td className="p-2">{a.institution.name}</td>
                <td className="p-2">{a.name}</td>
                <td className="p-2">{a.kind}</td>
                <td className="p-2">{a.currency}</td>
              </tr>
            ))}
            {accounts.length === 0 && (
              <tr>
                <td className="p-4 text-muted-foreground" colSpan={4}>
                  まだ口座が登録されていません
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </section>

      <section>
        <h2 className="font-bold mb-2">口座を追加</h2>
        <form onSubmit={submit} className="space-y-3 max-w-md bg-surface p-4 border border-border-app">
          <div>
            <label className="block text-sm mb-1">機関</label>
            <select
              className="w-full border border-border-app p-2"
              value={institutionId}
              onChange={(e) => {
                setInstitutionId(e.target.value ? Number(e.target.value) : "");
                setKind("");
              }}
            >
              <option value="">選択してください</option>
              {insts.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name} ({i.kind})
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm mb-1">口座名</label>
            <input
              className="w-full border border-border-app p-2"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="例: 普通預金, 楽天カード本人"
            />
          </div>
          <div>
            <label className="block text-sm mb-1">種別</label>
            <select
              className="w-full border border-border-app p-2"
              value={kind}
              onChange={(e) => setKind(e.target.value)}
              disabled={!selectedInst}
            >
              <option value="">選択してください</option>
              {kindOptions.map((k) => (
                <option key={k} value={k}>
                  {k}
                </option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            className="bg-blue-600 text-white px-4 py-2 disabled:bg-neutral-400"
            disabled={!institutionId || !name || !kind}
          >
            追加
          </button>
        </form>
      </section>
    </div>
  );
}
