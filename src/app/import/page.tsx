"use client";
import { useEffect, useMemo, useState } from "react";

type Adapter = { code: string; label: string; resultKind: string };
type Inst = { id: number; code: string; name: string; kind: string; adapters: Adapter[] };
type Account = { id: number; name: string; kind: string; institution: { id: number; code: string; name: string } };

type Preview =
  | {
      kind: "tx";
      fileHash: string;
      fileName: string;
      duplicateFile: boolean;
      duplicateRows: number;
      total: number;
      warnings: string[];
      rows: Array<{
        rowHash: string;
        occurredAt: string;
        amount: number;
        balance?: number;
        payee: string;
        memo?: string;
        suggestedCategoryId: number | null;
        duplicate: boolean;
      }>;
    }
  | {
      kind: "sec_tx";
      fileName: string;
      duplicateFile: boolean;
      duplicateRows: number;
      total: number;
      warnings: string[];
      rows: Array<{
        tradedAt: string;
        ticker?: string;
        name: string;
        side: string;
        qty?: number;
        amount: number;
        duplicate: boolean;
      }>;
    }
  | {
      kind: "snapshot";
      fileName: string;
      duplicateFile: boolean;
      duplicateSnapshot: boolean;
      snapshotDate: string;
      totalValue: number;
      warnings: string[];
      holdings: Array<{ ticker?: string; name: string; qty: number; marketValue: number }>;
    };

export default function ImportPage() {
  const [insts, setInsts] = useState<Inst[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [institutionId, setInstitutionId] = useState<number | "">("");
  const [accountId, setAccountId] = useState<number | "">("");
  const [adapterCode, setAdapterCode] = useState<string>("");
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/institutions").then((r) => r.json()).then(setInsts);
    fetch("/api/accounts").then((r) => r.json()).then(setAccounts);
  }, []);

  const filteredAccounts = useMemo(
    () => (institutionId ? accounts.filter((a) => a.institution.id === institutionId) : []),
    [accounts, institutionId],
  );
  const selectedInst = insts.find((i) => i.id === institutionId);
  const adapterOptions = selectedInst?.adapters ?? [];

  const onPreview = async () => {
    if (!file || !accountId || !adapterCode) return;
    setLoading(true);
    setMessage(null);
    setPreview(null);
    const fd = new FormData();
    fd.append("accountId", String(accountId));
    fd.append("adapterCode", adapterCode);
    fd.append("file", file);
    const res = await fetch("/api/import/preview", { method: "POST", body: fd });
    const json = await res.json();
    setLoading(false);
    if (!res.ok) {
      setMessage(json.error ?? "プレビュー失敗");
      return;
    }
    setPreview(json);
  };

  const onCommit = async () => {
    if (!file || !accountId || !adapterCode) return;
    setLoading(true);
    setMessage(null);
    const fd = new FormData();
    fd.append("accountId", String(accountId));
    fd.append("adapterCode", adapterCode);
    fd.append("file", file);
    const res = await fetch("/api/import/commit", { method: "POST", body: fd });
    const json = await res.json();
    setLoading(false);
    if (!res.ok) {
      setMessage(`取込失敗: ${json.error ?? ""}`);
      return;
    }
    setMessage(
      json.kind === "snapshot"
        ? `スナップショット取込: ${json.inserted} 件`
        : `取込完了: ${json.inserted} 件 / スキップ ${json.skipped} 件`,
    );
    setPreview(null);
    setFile(null);
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">CSV取込</h1>

      <div className="bg-surface border border-border-app p-4 space-y-3 max-w-2xl">
        <div>
          <label className="block text-sm mb-1">機関</label>
          <select
            className="w-full border border-border-app p-2"
            value={institutionId}
            onChange={(e) => {
              setInstitutionId(e.target.value ? Number(e.target.value) : "");
              setAccountId("");
              setAdapterCode("");
            }}
          >
            <option value="">選択してください</option>
            {insts.map((i) => (
              <option key={i.id} value={i.id}>
                {i.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm mb-1">口座</label>
          <select
            className="w-full border border-border-app p-2"
            value={accountId}
            onChange={(e) => setAccountId(e.target.value ? Number(e.target.value) : "")}
            disabled={!selectedInst}
          >
            <option value="">選択してください</option>
            {filteredAccounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({a.kind})
              </option>
            ))}
          </select>
          {selectedInst && filteredAccounts.length === 0 && (
            <p className="text-xs text-amber-500 mt-1">
              この機関の口座が未登録です。「口座」ページから追加してください。
            </p>
          )}
        </div>
        <div>
          <label className="block text-sm mb-1">CSVフォーマット</label>
          <select
            className="w-full border border-border-app p-2"
            value={adapterCode}
            onChange={(e) => setAdapterCode(e.target.value)}
            disabled={!adapterOptions.length}
          >
            <option value="">選択してください</option>
            {adapterOptions.map((a) => (
              <option key={a.code} value={a.code}>
                {a.label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="block text-sm mb-1">CSVファイル</label>
          <input
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            className="bg-neutral-700 text-white px-4 py-2 disabled:bg-neutral-400"
            onClick={onPreview}
            disabled={loading || !file || !accountId || !adapterCode}
          >
            プレビュー
          </button>
          {preview && (
            <button
              type="button"
              className="bg-blue-600 text-white px-4 py-2"
              onClick={onCommit}
              disabled={loading}
            >
              この内容で取り込む
            </button>
          )}
        </div>
        {message && <p className="text-sm">{message}</p>}
      </div>

      {preview && <PreviewBlock preview={preview} />}
    </div>
  );
}

function PreviewBlock({ preview }: { preview: Preview }) {
  return (
    <section className="bg-surface border border-border-app p-4 space-y-2 text-sm">
      <h2 className="font-bold">プレビュー: {preview.fileName}</h2>
      {preview.warnings.length > 0 && (
        <ul className="text-amber-500 list-disc pl-5">
          {preview.warnings.map((w, i) => (
            <li key={i}>{w}</li>
          ))}
        </ul>
      )}
      {"duplicateFile" in preview && preview.duplicateFile && (
        <p className="text-red-500">⚠ 同じファイルが既に取込済みです</p>
      )}
      {preview.kind === "tx" && (
        <>
          <p>
            合計 {preview.total} 行 / 重複 {preview.duplicateRows} 行
          </p>
          <div className="max-h-96 overflow-auto">
            <table className="w-full text-xs">
              <thead className="bg-surface-muted sticky top-0">
                <tr>
                  <th className="text-left p-1">日付</th>
                  <th className="text-right p-1">金額</th>
                  <th className="text-right p-1">残高</th>
                  <th className="text-left p-1">摘要</th>
                  <th className="text-left p-1">重複</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.slice(0, 200).map((r) => (
                  <tr key={r.rowHash} className={r.duplicate ? "text-neutral-400" : ""}>
                    <td className="p-1">{r.occurredAt.slice(0, 10)}</td>
                    <td className="p-1 text-right">{r.amount.toLocaleString()}</td>
                    <td className="p-1 text-right">{r.balance?.toLocaleString() ?? ""}</td>
                    <td className="p-1">{r.payee}</td>
                    <td className="p-1">{r.duplicate ? "✓" : ""}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {preview.rows.length > 200 && (
              <p className="text-xs text-muted-foreground mt-1">先頭200行のみ表示</p>
            )}
          </div>
        </>
      )}
      {preview.kind === "sec_tx" && (
        <>
          <p>
            合計 {preview.total} 行 / 重複 {preview.duplicateRows} 行
          </p>
          <table className="w-full text-xs">
            <thead className="bg-surface-muted">
              <tr>
                <th className="text-left p-1">約定日</th>
                <th className="text-left p-1">銘柄</th>
                <th className="text-left p-1">区分</th>
                <th className="text-right p-1">数量</th>
                <th className="text-right p-1">金額</th>
              </tr>
            </thead>
            <tbody>
              {preview.rows.slice(0, 200).map((r, i) => (
                <tr key={i} className={r.duplicate ? "text-neutral-400" : ""}>
                  <td className="p-1">{r.tradedAt.slice(0, 10)}</td>
                  <td className="p-1">
                    {r.ticker ? `${r.ticker} ` : ""}
                    {r.name}
                  </td>
                  <td className="p-1">{r.side}</td>
                  <td className="p-1 text-right">{r.qty ?? ""}</td>
                  <td className="p-1 text-right">{r.amount.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
      {preview.kind === "snapshot" && (
        <>
          <p>
            スナップショット日: {preview.snapshotDate.slice(0, 10)} / 評価額合計{" "}
            {preview.totalValue.toLocaleString()} 円
          </p>
          {preview.duplicateSnapshot && (
            <p className="text-red-500">⚠ 同じ日付のスナップショットが既に存在します</p>
          )}
          <table className="w-full text-xs">
            <thead className="bg-surface-muted">
              <tr>
                <th className="text-left p-1">銘柄</th>
                <th className="text-right p-1">数量</th>
                <th className="text-right p-1">評価額</th>
              </tr>
            </thead>
            <tbody>
              {preview.holdings.map((h, i) => (
                <tr key={i}>
                  <td className="p-1">
                    {h.ticker ? `${h.ticker} ` : ""}
                    {h.name}
                  </td>
                  <td className="p-1 text-right">{h.qty}</td>
                  <td className="p-1 text-right">{h.marketValue.toLocaleString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </section>
  );
}
