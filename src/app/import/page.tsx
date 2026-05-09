"use client";
import { useEffect, useState } from "react";

type DetectResult = {
  matched: Array<{
    adapterCode: string;
    adapterLabel: string;
    institutionCode: string;
    resultKind: string;
    score: number;
  }>;
  top: {
    adapterCode: string;
    adapterLabel: string;
    institutionCode: string;
    resultKind: string;
    score: number;
  } | null;
  institution: { id: number; code: string; name: string } | null;
  candidateAccounts: Array<{ id: number; name: string; kind: string }>;
  autoSelectedAccountId: number | null;
};

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

type AdapterOption = { code: string; label: string; resultKind: string };
type Inst = { id: number; code: string; name: string; kind: string; adapters: AdapterOption[] };
type Account = { id: number; name: string; kind: string; institution: { id: number; code: string; name: string } };

export default function ImportPage() {
  const [files, setFiles] = useState<File[]>([]);
  const [allInsts, setAllInsts] = useState<Inst[]>([]);
  const [allAccounts, setAllAccounts] = useState<Account[]>([]);

  useEffect(() => {
    fetch("/api/institutions").then((r) => r.json()).then(setAllInsts);
    fetch("/api/accounts").then((r) => r.json()).then(setAllAccounts);
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">CSV取込</h1>
      <p className="text-sm text-muted-foreground">
        CSVファイルをドロップまたは選択すると、機関を自動判定します。
        対応機関に口座が1つしか登録されていなければ、その口座へ自動で取り込みます。
      </p>

      <DropZone onFilesAdded={(fs) => setFiles((prev) => [...prev, ...fs])} />

      <div className="space-y-4">
        {files.map((f, i) => (
          <FileImportRow
            key={`${f.name}-${i}-${f.lastModified}`}
            file={f}
            allInsts={allInsts}
            allAccounts={allAccounts}
            onRemove={() => setFiles((prev) => prev.filter((_, idx) => idx !== i))}
          />
        ))}
      </div>
    </div>
  );
}

function DropZone({ onFilesAdded }: { onFilesAdded: (fs: File[]) => void }) {
  const [over, setOver] = useState(false);
  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        const fs = Array.from(e.dataTransfer.files).filter(
          (f) => /\.csv$/i.test(f.name) || f.type === "text/csv",
        );
        onFilesAdded(fs);
      }}
      className={`border-2 border-dashed rounded p-8 text-center ${
        over ? "border-blue-500 bg-blue-500/10" : "border-border-app"
      }`}
    >
      <p className="text-sm">CSVファイルをここにドロップ、または</p>
      <label className="inline-block mt-2 bg-blue-600 text-white px-4 py-2 cursor-pointer">
        ファイルを選択
        <input
          type="file"
          accept=".csv,text/csv"
          multiple
          className="hidden"
          onChange={(e) => {
            const fs = Array.from(e.target.files ?? []);
            onFilesAdded(fs);
            e.target.value = "";
          }}
        />
      </label>
    </div>
  );
}

function FileImportRow({
  file,
  allInsts,
  allAccounts,
  onRemove,
}: {
  file: File;
  allInsts: Inst[];
  allAccounts: Account[];
  onRemove: () => void;
}) {
  const [detect, setDetect] = useState<DetectResult | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [adapterCode, setAdapterCode] = useState<string>("");
  const [accountId, setAccountId] = useState<number | "">("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [committed, setCommitted] = useState(false);

  // 初回マウントで判定
  useEffect(() => {
    (async () => {
      setBusy(true);
      try {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/import/detect", { method: "POST", body: fd });
        const det: DetectResult = await res.json();
        setDetect(det);
        if (det.top) setAdapterCode(det.top.adapterCode);
        if (det.autoSelectedAccountId && det.top) {
          setAccountId(det.autoSelectedAccountId);
          await runPreview(det.top.adapterCode, det.autoSelectedAccountId);
        }
      } finally {
        setBusy(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const runPreview = async (adapter: string, acc: number) => {
    setBusy(true);
    setMessage(null);
    setPreview(null);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("adapterCode", adapter);
    fd.append("accountId", String(acc));
    const res = await fetch("/api/import/preview", { method: "POST", body: fd });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) {
      setMessage(json.error ?? "プレビュー失敗");
      return;
    }
    setPreview(json);
  };

  const onCommit = async () => {
    if (!adapterCode || !accountId) return;
    setBusy(true);
    setMessage(null);
    const fd = new FormData();
    fd.append("file", file);
    fd.append("adapterCode", adapterCode);
    fd.append("accountId", String(accountId));
    const res = await fetch("/api/import/commit", { method: "POST", body: fd });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) {
      setMessage(`取込失敗: ${json.error ?? ""}`);
      return;
    }
    setCommitted(true);
    setMessage(
      json.kind === "snapshot"
        ? `スナップショット取込: ${json.inserted} 件`
        : `取込完了: ${json.inserted} 件 / スキップ ${json.skipped} 件`,
    );
  };

  // adapterCode に対応する機関 → その機関の口座一覧を返す
  const accountsForAdapter = (() => {
    if (!adapterCode) return [];
    const inst = allInsts.find((i) => i.adapters.some((a) => a.code === adapterCode));
    if (!inst) return [];
    return allAccounts.filter((a) => a.institution.id === inst.id);
  })();

  return (
    <section className="bg-surface border border-border-app p-4 space-y-3">
      <header className="flex items-center justify-between">
        <div>
          <p className="font-bold">{file.name}</p>
          {detect?.top ? (
            <p className="text-xs text-muted-foreground">
              判定: {detect.institution?.name} / {detect.top.adapterLabel}
              <span className="ml-2">(確信度 {(detect.top.score * 100).toFixed(0)}%)</span>
            </p>
          ) : detect ? (
            <p className="text-xs text-amber-500">機関を自動判定できませんでした。手動で選択してください。</p>
          ) : (
            <p className="text-xs text-muted-foreground">判定中...</p>
          )}
        </div>
        <button className="text-xs text-muted-foreground hover:text-red-500" onClick={onRemove}>
          除外
        </button>
      </header>

      {detect && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-2 text-sm">
          <select
            className="border border-border-app p-2"
            value={adapterCode}
            onChange={(e) => {
              setAdapterCode(e.target.value);
              setAccountId("");
              setPreview(null);
            }}
          >
            <option value="">CSVフォーマット</option>
            {allInsts.flatMap((i) =>
              i.adapters.map((a) => (
                <option key={a.code} value={a.code}>
                  {i.name} - {a.label}
                </option>
              )),
            )}
          </select>
          <select
            className="border border-border-app p-2"
            value={accountId}
            onChange={(e) => {
              const v = e.target.value ? Number(e.target.value) : "";
              setAccountId(v);
              setPreview(null);
              if (v && adapterCode) runPreview(adapterCode, v as number);
            }}
            disabled={!adapterCode}
          >
            <option value="">口座を選択</option>
            {accountsForAdapter.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name} ({a.kind})
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <button
              type="button"
              className="bg-neutral-700 text-white px-3 py-2 disabled:bg-neutral-400"
              onClick={() =>
                adapterCode && accountId && runPreview(adapterCode, accountId as number)
              }
              disabled={busy || !adapterCode || !accountId}
            >
              {busy ? "..." : "プレビュー"}
            </button>
            {preview && !committed && (
              <button
                type="button"
                className="bg-blue-600 text-white px-3 py-2 disabled:bg-neutral-400"
                onClick={onCommit}
                disabled={busy}
              >
                取り込む
              </button>
            )}
          </div>
        </div>
      )}

      {detect?.top && accountsForAdapter.length === 0 && (
        <p className="text-sm text-amber-500">
          {detect.institution?.name} の口座が登録されていません。
          <a className="underline ml-1" href="/accounts">口座管理</a>
          で先に登録してください。
        </p>
      )}
      {detect?.top && accountsForAdapter.length >= 2 && !accountId && (
        <p className="text-sm text-muted-foreground">
          {detect.institution?.name} に複数の口座が登録されています。どの口座に取り込むか選択してください。
        </p>
      )}

      {message && <p className="text-sm">{message}</p>}
      {preview && <PreviewBlock preview={preview} />}
    </section>
  );
}

function PreviewBlock({ preview }: { preview: Preview }) {
  return (
    <div className="text-sm space-y-2">
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
          <div className="max-h-72 overflow-auto">
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
                  <tr key={r.rowHash} className={r.duplicate ? "text-muted-foreground" : ""}>
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
                <tr key={i} className={r.duplicate ? "text-muted-foreground" : ""}>
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
    </div>
  );
}
