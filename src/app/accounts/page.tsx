"use client";
import { useEffect, useState } from "react";
import Link from "next/link";

type Inst = { id: number; code: string; name: string; kind: string };
type Account = {
  id: number;
  name: string;
  kind: string;
  currency: string;
  institution: Inst;
};

const accountKindLabels: Record<string, string> = {
  CHECKING: "普通預金",
  SAVINGS: "貯蓄預金",
  CREDIT_CARD: "クレジットカード",
  BROKERAGE: "証券総合口座",
  DC: "確定拠出年金",
  MANUAL: "手動入力",
};

const institutionKindLabels: Record<string, string> = {
  BANK: "銀行",
  CARD: "カード",
  SECURITIES: "証券",
  DC: "確定拠出年金",
  MANUAL: "手動入力",
};

const accountKinds: Record<string, string[]> = {
  BANK: ["CHECKING", "SAVINGS"],
  CARD: ["CREDIT_CARD"],
  SECURITIES: ["BROKERAGE"],
  DC: ["DC"],
  MANUAL: ["MANUAL"],
};

type EditState = { name: string; kind: string; currency: string };

export default function AccountsPage() {
  const [insts, setInsts] = useState<Inst[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [institutionId, setInstitutionId] = useState<number | "">("");
  const [name, setName] = useState("");
  const [kind, setKind] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [edit, setEdit] = useState<EditState>({ name: "", kind: "", currency: "" });

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

  useEffect(() => {
    if (kindOptions.length === 0) {
      setKind("");
    } else if (!kindOptions.includes(kind)) {
      setKind(kindOptions[0]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [institutionId, insts]);

  const startEdit = (a: Account) => {
    setEditingId(a.id);
    setEdit({ name: a.name, kind: a.kind, currency: a.currency });
  };

  const cancelEdit = () => {
    setEditingId(null);
  };

  const saveEdit = async (id: number) => {
    const res = await fetch(`/api/accounts/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(edit),
    });
    if (!res.ok) {
      alert("更新に失敗しました");
      return;
    }
    setEditingId(null);
    reload();
  };

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
              <th className="text-left p-2">操作</th>
            </tr>
          </thead>
          <tbody>
            {accounts.map((a) => {
              const editing = editingId === a.id;
              const editKindOptions = accountKinds[a.institution.kind] ?? [];
              return (
                <tr key={a.id} className="border-t">
                  <td className="p-2">{a.institution.name}</td>
                  <td className="p-2">
                    {editing ? (
                      <input
                        className="w-full border border-border-app p-1"
                        value={edit.name}
                        onChange={(e) => setEdit({ ...edit, name: e.target.value })}
                      />
                    ) : (
                      a.name
                    )}
                  </td>
                  <td className="p-2">
                    {editing ? (
                      <select
                        className="w-full border border-border-app p-1"
                        value={edit.kind}
                        onChange={(e) => setEdit({ ...edit, kind: e.target.value })}
                      >
                        {editKindOptions.map((k) => (
                          <option key={k} value={k}>
                            {accountKindLabels[k] ?? k}
                          </option>
                        ))}
                      </select>
                    ) : (
                      accountKindLabels[a.kind] ?? a.kind
                    )}
                  </td>
                  <td className="p-2">
                    {editing ? (
                      <input
                        className="w-20 border border-border-app p-1"
                        value={edit.currency}
                        onChange={(e) => setEdit({ ...edit, currency: e.target.value })}
                      />
                    ) : (
                      a.currency
                    )}
                  </td>
                  <td className="p-2">
                    {editing ? (
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => saveEdit(a.id)}
                          className="bg-blue-600 text-white px-2 py-1 text-xs"
                        >
                          保存
                        </button>
                        <button
                          type="button"
                          onClick={cancelEdit}
                          className="border border-border-app px-2 py-1 text-xs"
                        >
                          取消
                        </button>
                      </div>
                    ) : (
                      <div className="flex gap-1">
                        <button
                          type="button"
                          onClick={() => startEdit(a)}
                          className="border border-border-app px-2 py-1 text-xs"
                        >
                          編集
                        </button>
                        {a.kind === "MANUAL" && (
                          <Link
                            href={`/accounts/${a.id}/balance`}
                            className="border border-border-app px-2 py-1 text-xs hover:text-blue-500"
                          >
                            残高記録
                          </Link>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              );
            })}
            {accounts.length === 0 && (
              <tr>
                <td className="p-4 text-muted-foreground" colSpan={5}>
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
              }}
            >
              <option value="">選択してください</option>
              {insts.map((i) => (
                <option key={i.id} value={i.id}>
                  {i.name} ({institutionKindLabels[i.kind] ?? i.kind})
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
          {kindOptions.length > 1 && (
            <div>
              <label className="block text-sm mb-1">種別</label>
              <select
                className="w-full border border-border-app p-2"
                value={kind}
                onChange={(e) => setKind(e.target.value)}
              >
                {kindOptions.map((k) => (
                  <option key={k} value={k}>
                    {accountKindLabels[k] ?? k}
                  </option>
                ))}
              </select>
            </div>
          )}
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
