"use client";
import { useEffect, useState } from "react";
import RuleCreateDialog from "../transactions/RuleCreateDialog";
import { matchRule } from "@/lib/matchRule";

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
type Category = { id: number; name: string; kind: string };

export default function ImportPage() {
  // 1 ファイルずつプレビュー → 取込/閉じるで次のファイルへ。
  // プレビュー中は DropZone を非表示にして「途中で別ファイルが投入される」事故を防ぐ。
  const [file, setFile] = useState<File | null>(null);
  const [allInsts, setAllInsts] = useState<Inst[]>([]);
  const [allAccounts, setAllAccounts] = useState<Account[]>([]);
  const [allCategories, setAllCategories] = useState<Category[]>([]);

  useEffect(() => {
    fetch("/api/institutions").then((r) => r.json()).then(setAllInsts);
    fetch("/api/accounts").then((r) => r.json()).then(setAllAccounts);
    fetch("/api/categories").then((r) => r.json()).then(setAllCategories);
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">取込</h1>
      <p className="text-sm text-muted-foreground">
        CSV / PDF / HTML ファイルをドロップまたは選択すると、機関を自動判定します。
        対応機関に口座が1つしか登録されていなければ、その口座へ自動で取り込みます。
      </p>

      {!file && (
        <DropZone onFilesAdded={(fs) => fs[0] && setFile(fs[0])} />
      )}

      {file && (
        <FileImportRow
          key={`${file.name}-${file.lastModified}`}
          file={file}
          allInsts={allInsts}
          allAccounts={allAccounts}
          allCategories={allCategories}
          onRemove={() => setFile(null)}
        />
      )}
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
          (f) =>
            /\.(csv|pdf|html?)$/i.test(f.name) ||
            f.type === "text/csv" ||
            f.type === "application/pdf" ||
            f.type === "text/html",
        );
        onFilesAdded(fs);
      }}
      className={`border-2 border-dashed rounded p-8 text-center ${
        over ? "border-blue-500 bg-blue-500/10" : "border-border-app"
      }`}
    >
      <p className="text-sm">CSV / PDF / HTML ファイルをここにドロップ、または</p>
      <label className="inline-block mt-2 bg-blue-600 text-white px-4 py-2 cursor-pointer">
        ファイルを選択
        <input
          type="file"
          accept=".csv,.pdf,.html,.htm,text/csv,application/pdf,text/html"
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
  allCategories,
  onRemove,
}: {
  file: File;
  allInsts: Inst[];
  allAccounts: Account[];
  allCategories: Category[];
  onRemove: () => void;
}) {
  const [detect, setDetect] = useState<DetectResult | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [adapterCode, setAdapterCode] = useState<string>("");
  const [accountId, setAccountId] = useState<number | "">("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [committed, setCommitted] = useState(false);
  // tx プレビューで rowHash → 選択 categoryId (null は明示的にカテゴリなし)
  // preview を再取得するたびにリセットされる。
  const [overrides, setOverrides] = useState<Record<string, number | null>>({});
  // ルール作成ダイアログを開く対象行 + 選択カテゴリ
  const [ruleDialog, setRuleDialog] = useState<{
    rowHash: string;
    payee: string;
    memo: string | null;
    accountKind: string;
    category: { id: number; name: string };
  } | null>(null);

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
    setOverrides({}); // 再プレビューでクリア
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
    if (Object.keys(overrides).length > 0) {
      fd.append("categoryOverrides", JSON.stringify(overrides));
    }
    const res = await fetch("/api/import/commit", { method: "POST", body: fd });
    const json = await res.json();
    setBusy(false);
    if (!res.ok) {
      setMessage(`取込失敗: ${json.error ?? ""}`);
      return;
    }
    setCommitted(true);
    setPreview(null);
    setAccountId("");
    setAdapterCode("");
    const summary =
      json.kind === "snapshot"
        ? `スナップショット取込: ${json.inserted} 件`
        : `取込完了: ${json.inserted} 件 / スキップ ${json.skipped} 件`;
    setMessage(summary);
    // 取込結果を 1.2 秒だけ表示してから自動で閉じ、DropZone を復活させる
    setTimeout(() => onRemove(), 1200);
  };

  // adapterCode に対応する機関 → その機関の口座一覧を返す
  const accountsForAdapter = (() => {
    if (!adapterCode) return [];
    const inst = allInsts.find((i) => i.adapters.some((a) => a.code === adapterCode));
    if (!inst) return [];
    return allAccounts.filter((a) => a.institution.id === inst.id);
  })();

  // 現在選択中の口座オブジェクト
  const account = typeof accountId === "number"
    ? allAccounts.find((a) => a.id === accountId)
    : undefined;

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
        <button
          className="text-muted-foreground hover:text-red-500 text-lg leading-none px-2"
          onClick={onRemove}
          aria-label="除外"
        >
          ×
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
            <option value="">フォーマット</option>
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
      {preview && (
        <PreviewBlock
          preview={preview}
          allCategories={allCategories}
          overrides={overrides}
          onChangeCategory={(row, catId) => {
            // override を更新
            setOverrides((prev) => ({ ...prev, [row.rowHash]: catId }));
            // 新しいカテゴリが選ばれたらルール作成ダイアログを開く
            if (catId != null) {
              const cat = allCategories.find((c) => c.id === catId);
              if (cat && account) {
                setRuleDialog({
                  rowHash: row.rowHash,
                  payee: row.payee,
                  memo: row.memo ?? null,
                  accountKind: account.kind,
                  category: { id: cat.id, name: cat.name },
                });
              }
            }
          }}
        />
      )}

      {ruleDialog && preview?.kind === "tx" && (
        <RuleCreateDialog
          tx={{
            id: 0,
            payee: ruleDialog.payee,
            memo: ruleDialog.memo,
            account: {
              kind: ruleDialog.accountKind,
              name: account?.name ?? "",
              institution: { name: account?.institution.name ?? "" },
            },
          }}
          category={ruleDialog.category}
          onClose={() => setRuleDialog(null)}
          onApplied={() => {
            // ルール作成だけなら overrides は変更しない (このダイアログを開いた
            // 起点行の categoryId は既に overrides に入っている)
          }}
          scope={{
            label: "プレビュー内の他の行のうち",
            matcher: ({ pattern, isRegex, field, accountKindFilter, amountMin, amountMax }) => {
              if (preview.kind !== "tx" || !account) return { matchCount: 0, sampleMatches: [] };
              const rule = { pattern, isRegex, field, accountKindFilter, amountMin, amountMax };
              const matched = preview.rows.filter((r) => {
                if (r.rowHash === ruleDialog.rowHash) return false; // 起点行は除外
                if (r.duplicate) return false;
                return matchRule(rule, {
                  payee: r.payee,
                  memo: r.memo ?? null,
                  accountKind: account.kind,
                  amount: r.amount,
                });
              });
              return {
                matchCount: matched.length,
                sampleMatches: matched.slice(0, 5).map((r, i) => ({
                  id: i,
                  occurredAt: r.occurredAt,
                  payee: r.payee,
                  account: `${account.institution.name}/${account.name}`,
                })),
              };
            },
            onApplyToScope: ({
              pattern,
              isRegex,
              field,
              accountKindFilter,
              amountMin,
              amountMax,
              categoryId,
            }) => {
              if (preview.kind !== "tx" || !account) return;
              const rule = { pattern, isRegex, field, accountKindFilter, amountMin, amountMax };
              setOverrides((prev) => {
                const next = { ...prev };
                for (const r of preview.rows) {
                  if (r.rowHash === ruleDialog.rowHash) continue;
                  if (r.duplicate) continue;
                  if (
                    matchRule(rule, {
                      payee: r.payee,
                      memo: r.memo ?? null,
                      accountKind: account.kind,
                      amount: r.amount,
                    })
                  ) {
                    next[r.rowHash] = categoryId;
                  }
                }
                return next;
              });
            },
          }}
        />
      )}
    </section>
  );
}

type TxPreviewRow = Extract<Preview, { kind: "tx" }>["rows"][number];

function PreviewBlock({
  preview,
  allCategories,
  overrides,
  onChangeCategory,
}: {
  preview: Preview;
  allCategories: Category[];
  overrides: Record<string, number | null>;
  onChangeCategory: (row: TxPreviewRow, categoryId: number | null) => void;
}) {
  // tx 行で実際に保存される categoryId (override > suggestedCategoryId)
  const effectiveCategoryId = (rowHash: string, suggested: number | null) =>
    Object.prototype.hasOwnProperty.call(overrides, rowHash) ? overrides[rowHash] : suggested;

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
          <div className="max-h-96 overflow-auto">
            {/* PC: テーブル */}
            <table className="hidden md:table w-full text-xs">
              <thead className="bg-surface-muted sticky top-0">
                <tr>
                  <th className="text-left p-1">日付</th>
                  <th className="text-right p-1">金額</th>
                  <th className="text-right p-1">残高</th>
                  <th className="text-left p-1">摘要</th>
                  <th className="text-left p-1">カテゴリ</th>
                </tr>
              </thead>
              <tbody>
                {preview.rows.filter((r) => !r.duplicate).slice(0, 200).map((r) => {
                  const cat = effectiveCategoryId(r.rowHash, r.suggestedCategoryId);
                  return (
                    <tr key={r.rowHash}>
                      <td className="p-1">{r.occurredAt.slice(0, 10)}</td>
                      <td className="p-1 text-right">{r.amount.toLocaleString()}</td>
                      <td className="p-1 text-right">{r.balance?.toLocaleString() ?? ""}</td>
                      <td className="p-1">{r.payee}</td>
                      <td className="p-1">
                        <select
                          className="border border-border-app text-xs"
                          value={cat ?? ""}
                          onChange={(e) =>
                            onChangeCategory(
                              r,
                              e.target.value ? Number(e.target.value) : null,
                            )
                          }
                        >
                          <option value="">-</option>
                          {allCategories.map((c) => (
                            <option key={c.id} value={c.id}>
                              {c.name}
                            </option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* モバイル: カード */}
            <ul className="md:hidden flex flex-col gap-2">
              {preview.rows.filter((r) => !r.duplicate).slice(0, 200).map((r) => {
                const cat = effectiveCategoryId(r.rowHash, r.suggestedCategoryId);
                const amountColor =
                  r.amount < 0 ? "text-red-500" : r.amount > 0 ? "text-green-500" : "";
                return (
                  <li
                    key={r.rowHash}
                    className="border border-border-app rounded-sm p-3 flex flex-col gap-1"
                  >
                    <div className="flex items-baseline justify-between gap-2">
                      <span className="font-medium break-all min-w-0 flex-1">
                        {r.payee}
                      </span>
                      <span className={`num font-bold whitespace-nowrap ${amountColor}`}>
                        {r.amount.toLocaleString()}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
                      <span>{r.occurredAt.slice(0, 10)}</span>
                      {r.balance != null && (
                        <span className="num whitespace-nowrap">
                          残 {r.balance.toLocaleString()}
                        </span>
                      )}
                    </div>
                    <select
                      className="border border-border-app text-sm w-full p-2 min-h-11 mt-1 disabled:opacity-60"
                      value={cat ?? ""}
                      onChange={(e) =>
                        onChangeCategory(
                          r,
                          e.target.value ? Number(e.target.value) : null,
                        )
                      }
                    >
                      <option value="">カテゴリ未設定</option>
                      {allCategories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                  </li>
                );
              })}
            </ul>

            {preview.rows.filter((r) => !r.duplicate).length > 200 && (
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
          {/* PC: テーブル */}
          <table className="hidden md:table w-full text-xs">
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
              {preview.rows.filter((r) => !r.duplicate).slice(0, 200).map((r, i) => (
                <tr key={i}>
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

          {/* モバイル: カード */}
          <ul className="md:hidden flex flex-col gap-2">
            {preview.rows.filter((r) => !r.duplicate).slice(0, 200).map((r, i) => (
              <li
                key={i}
                className="border border-border-app rounded-sm p-3 flex flex-col gap-1"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-medium break-all min-w-0 flex-1">
                    {r.ticker ? `${r.ticker} ` : ""}
                    {r.name}
                  </span>
                  <span className="num font-bold whitespace-nowrap">
                    {r.amount.toLocaleString()}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">
                  {r.tradedAt.slice(0, 10)} · {r.side}
                  {r.qty != null && (
                    <>
                      {" · 数量 "}
                      <span className="num">{r.qty.toLocaleString()}</span>
                    </>
                  )}
                </div>
              </li>
            ))}
          </ul>
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
          {/* PC: テーブル */}
          <table className="hidden md:table w-full text-xs">
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

          {/* モバイル: カード */}
          <ul className="md:hidden flex flex-col gap-2">
            {preview.holdings.map((h, i) => (
              <li key={i} className="border border-border-app rounded-sm p-3 flex flex-col gap-1">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-medium break-all min-w-0 flex-1">
                    {h.ticker ? `${h.ticker} ` : ""}
                    {h.name}
                  </span>
                  <span className="num font-bold whitespace-nowrap">
                    {h.marketValue.toLocaleString()}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground">
                  数量 <span className="num">{h.qty.toLocaleString()}</span>
                </div>
              </li>
            ))}
          </ul>
        </>
      )}
    </div>
  );
}
