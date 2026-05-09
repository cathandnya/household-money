"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { suggestRulePatterns, type SuggestedPattern } from "@/lib/suggestRule";

export type RuleDialogTx = {
  id: number;
  payee: string;
  memo: string | null;
  account: { kind: string; name: string; institution: { name: string } };
};

type ExistingRule = {
  id: number;
  pattern: string;
  isRegex: boolean;
  field: string;
  accountKindFilter: string | null;
  category: { id: number; name: string };
};

type PreviewResp = {
  matchCount: number;
  sampleMatches: Array<{ id: number; payee: string; account: string }>;
  truncated: boolean;
};

type CategoryLite = { id: number; name: string };

export default function RuleCreateDialog({
  tx,
  category,
  onClose,
  onApplied,
}: {
  tx: RuleDialogTx;
  category: CategoryLite;
  onClose: () => void;
  onApplied: () => void;
}) {
  const candidates = useMemo(() => suggestRulePatterns(tx.payee), [tx.payee]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [isRegex, setIsRegex] = useState(false);
  const [accountKindOn, setAccountKindOn] = useState(true);
  const [field, setField] = useState<"PAYEE" | "MEMO">("PAYEE");
  const [priority, setPriority] = useState(100);
  const [overwriteExisting, setOverwriteExisting] = useState(false);

  const [existingRules, setExistingRules] = useState<ExistingRule[]>([]);
  const [preview, setPreview] = useState<PreviewResp | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // 初回: 既存ルール一覧を取得
  useEffect(() => {
    fetch("/api/rules")
      .then((r) => r.json())
      .then((data: ExistingRule[]) => setExistingRules(data))
      .catch(() => setExistingRules([]));
  }, []);

  const selected = candidates[selectedIdx];
  const accountKindFilter = accountKindOn ? tx.account.kind : null;

  // 同 pattern + field + accountKindFilter の既存ルールを探す
  const conflict = useMemo(() => {
    if (!selected) return null;
    const targetKind = accountKindOn ? tx.account.kind : null;
    return (
      existingRules.find(
        (r) =>
          r.pattern === selected.pattern &&
          r.field === field &&
          (r.accountKindFilter || null) === targetKind &&
          r.isRegex === isRegex,
      ) ?? null
    );
  }, [existingRules, selected, field, accountKindOn, tx.account.kind, isRegex]);

  // プレビュー (debounce 300ms)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!selected) {
      setPreview(null);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setPreviewing(true);
      try {
        const params = new URLSearchParams({
          pattern: selected.pattern,
          isRegex: isRegex ? "1" : "0",
          field,
        });
        if (accountKindFilter) params.set("accountKindFilter", accountKindFilter);
        const res = await fetch("/api/rules/preview?" + params.toString());
        const json = (await res.json()) as PreviewResp;
        setPreview(json);
      } finally {
        setPreviewing(false);
      }
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [selected?.pattern, isRegex, field, accountKindFilter]);

  const createAndMaybeApply = async (alsoApply: boolean) => {
    if (!selected) return;
    setBusy(true);
    setMessage(null);
    try {
      // 既存衝突がある場合は上書き選択時のみ削除して作り直す
      if (conflict && overwriteExisting) {
        await fetch(`/api/rules?id=${conflict.id}`, { method: "DELETE" });
      } else if (conflict && !overwriteExisting) {
        setMessage("同じパターンの既存ルールがあるため作成できません。「上書きする」にチェックを入れてください。");
        setBusy(false);
        return;
      }

      const createRes = await fetch("/api/rules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pattern: selected.pattern,
          isRegex,
          field,
          priority,
          accountKindFilter,
          categoryId: category.id,
          enabled: true,
        }),
      });
      if (!createRes.ok) {
        const err = await createRes.json().catch(() => ({}));
        setMessage(`ルール作成失敗: ${err.error ?? createRes.status}`);
        setBusy(false);
        return;
      }
      const rule = await createRes.json();

      if (alsoApply) {
        const applyRes = await fetch("/api/rules/apply-now", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ruleId: rule.id }),
        });
        const appliedJson = await applyRes.json();
        setMessage(
          appliedJson.updated != null
            ? `ルールを作成し、${appliedJson.updated} 件に適用しました`
            : `ルールは作成されましたが適用に失敗しました`,
        );
      } else {
        setMessage("ルールを作成しました");
      }
      onApplied();
      // 短い間メッセージを表示してから閉じる
      setTimeout(() => onClose(), 800);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={onClose}
    >
      <div
        className="bg-surface border border-border-app w-full max-w-lg max-h-[90vh] overflow-auto p-4 space-y-3 text-sm"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="space-y-1">
          <h2 className="font-bold">ルールを作成</h2>
          <p className="text-xs text-muted-foreground">
            元の摘要: <span className="font-mono">{tx.payee}</span>
          </p>
          <p className="text-xs text-muted-foreground">
            適用カテゴリ: <strong>{category.name}</strong> /
            口座種別: <strong>{tx.account.kind}</strong>
          </p>
        </header>

        {candidates.length === 0 ? (
          <p className="text-muted-foreground">パターン候補が生成できません。</p>
        ) : (
          <section>
            <h3 className="font-bold mb-1">パターン候補</h3>
            <ul className="space-y-1">
              {candidates.map((c, i) => {
                const isExisting = existingRules.some(
                  (r) =>
                    r.pattern === c.pattern &&
                    r.field === field &&
                    (r.accountKindFilter || null) === accountKindFilter &&
                    r.isRegex === isRegex,
                );
                return (
                  <li key={i}>
                    <label className="flex items-start gap-2 cursor-pointer">
                      <input
                        type="radio"
                        name="rule-candidate"
                        checked={selectedIdx === i}
                        onChange={() => setSelectedIdx(i)}
                        className="mt-1"
                      />
                      <div className="flex-1">
                        <div className="font-mono break-all">{c.pattern}</div>
                        <div className="text-xs text-muted-foreground">
                          {c.label} / score {c.score.toFixed(2)}
                          {isExisting && (
                            <span className="ml-2 px-1 bg-amber-500/20 text-amber-700 dark:text-amber-300 rounded">
                              既存
                            </span>
                          )}
                        </div>
                      </div>
                    </label>
                  </li>
                );
              })}
            </ul>
          </section>
        )}

        <section className="grid grid-cols-2 gap-2">
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={isRegex}
              onChange={(e) => setIsRegex(e.target.checked)}
            />
            正規表現として扱う
          </label>
          <label className="flex items-center gap-2 text-xs">
            <input
              type="checkbox"
              checked={accountKindOn}
              onChange={(e) => setAccountKindOn(e.target.checked)}
            />
            口座種別 {tx.account.kind} のみ
          </label>
          <label className="flex items-center gap-2 text-xs">
            対象:
            <select
              value={field}
              onChange={(e) => setField(e.target.value === "MEMO" ? "MEMO" : "PAYEE")}
              className="border border-border-app p-1 text-xs"
            >
              <option value="PAYEE">摘要</option>
              <option value="MEMO">メモ</option>
            </select>
          </label>
          <label className="flex items-center gap-2 text-xs">
            優先度:
            <input
              type="number"
              value={priority}
              onChange={(e) => setPriority(Number(e.target.value) || 100)}
              className="border border-border-app p-1 w-20 text-xs"
            />
          </label>
        </section>

        {conflict && (
          <div className="border border-amber-500/50 bg-amber-500/10 p-2 text-xs space-y-1">
            <p>
              同じパターンの既存ルール (#{conflict.id}, カテゴリ:{" "}
              {conflict.category.name}) があります。
            </p>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={overwriteExisting}
                onChange={(e) => setOverwriteExisting(e.target.checked)}
              />
              既存ルールを削除して上書きする
            </label>
          </div>
        )}

        <section className="bg-surface-muted border border-border-app p-2 text-xs">
          {previewing ? (
            <p className="text-muted-foreground">プレビュー中...</p>
          ) : preview ? (
            <>
              <p>
                未分類のうち <strong>{preview.matchCount}</strong> 件にマッチ
                {preview.truncated && " (1000件まで走査)"}
              </p>
              {preview.sampleMatches.length > 0 && (
                <ul className="text-muted-foreground mt-1 list-disc pl-4">
                  {preview.sampleMatches.map((m) => (
                    <li key={m.id} className="truncate">
                      {m.payee} <span className="opacity-70">@ {m.account}</span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <p className="text-muted-foreground">候補を選択するとプレビューが表示されます</p>
          )}
        </section>

        {message && <p className="text-xs">{message}</p>}

        <footer className="flex flex-wrap gap-2 justify-end pt-2">
          <button
            type="button"
            className="px-3 py-1 text-xs border border-border-app"
            onClick={onClose}
            disabled={busy}
          >
            スキップ
          </button>
          <button
            type="button"
            className="px-3 py-1 text-xs bg-neutral-700 text-white disabled:bg-neutral-400"
            onClick={() => createAndMaybeApply(false)}
            disabled={busy || !selected}
          >
            ルールだけ作成
          </button>
          <button
            type="button"
            className="px-3 py-1 text-xs bg-blue-600 text-white disabled:bg-neutral-400"
            onClick={() => createAndMaybeApply(true)}
            disabled={busy || !selected}
          >
            作成して {preview?.matchCount ?? 0} 件に適用
          </button>
        </footer>
      </div>
    </div>
  );
}
