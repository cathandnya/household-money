"use client";
import { useEffect, useRef, useState } from "react";
import { ACCOUNT_KINDS, ACCOUNT_KIND_LABELS } from "@/lib/accountKinds";

type Category = { id: number; name: string };

export type EditableRule = {
  id: number;
  pattern: string;
  isRegex: boolean;
  field: string;
  priority: number;
  accountKindFilter: string | null;
  amountMin: number | null;
  amountMax: number | null;
  enabled: boolean;
  category: { id: number; name: string };
};

type PreviewResp = {
  matchCount: number;
  sampleMatches: Array<{
    id: number;
    occurredAt: string;
    payee: string;
    account: string;
  }>;
  truncated: boolean;
};

export default function RuleEditDialog({
  rule,
  cats,
  onClose,
  onSaved,
}: {
  rule: EditableRule;
  cats: Category[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [pattern, setPattern] = useState(rule.pattern);
  const [isRegex, setIsRegex] = useState(rule.isRegex);
  const [field, setField] = useState<"PAYEE" | "MEMO">(
    rule.field === "MEMO" ? "MEMO" : "PAYEE",
  );
  const [categoryId, setCategoryId] = useState(String(rule.category.id));
  const [priority, setPriority] = useState(rule.priority);
  const [accountKindFilter, setAccountKindFilter] = useState(
    rule.accountKindFilter ?? "",
  );
  const [amountMin, setAmountMin] = useState(
    rule.amountMin == null ? "" : String(rule.amountMin),
  );
  const [amountMax, setAmountMax] = useState(
    rule.amountMax == null ? "" : String(rule.amountMax),
  );

  const parseIntOrNull = (s: string): number | null => {
    const t = s.trim();
    if (!t) return null;
    const n = Number(t);
    return Number.isFinite(n) ? Math.trunc(n) : null;
  };
  const amountMinNum = parseIntOrNull(amountMin);
  const amountMaxNum = parseIntOrNull(amountMax);

  const [preview, setPreview] = useState<PreviewResp | null>(null);
  const [previewing, setPreviewing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // プレビュー件数取得 (RuleCreateDialog と同じ debounce + /api/rules/preview)。
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (!pattern) {
      setPreview(null);
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setPreviewing(true);
      try {
        const params = new URLSearchParams({
          pattern,
          isRegex: isRegex ? "1" : "0",
          field,
        });
        if (accountKindFilter) params.set("accountKindFilter", accountKindFilter);
        if (amountMinNum != null) params.set("amountMin", String(amountMinNum));
        if (amountMaxNum != null) params.set("amountMax", String(amountMaxNum));
        const res = await fetch("/api/rules/preview?" + params.toString());
        setPreview((await res.json()) as PreviewResp);
      } finally {
        setPreviewing(false);
      }
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [pattern, isRegex, field, accountKindFilter, amountMinNum, amountMaxNum]);

  const save = async () => {
    if (!pattern || !categoryId) return;
    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch("/api/rules", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: rule.id,
          pattern,
          isRegex,
          field,
          priority,
          accountKindFilter: accountKindFilter || null,
          amountMin: amountMinNum,
          amountMax: amountMaxNum,
          categoryId: Number(categoryId),
          enabled: rule.enabled,
        }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setMessage(`保存に失敗しました: ${err.error ?? res.status}`);
        setBusy(false);
        return;
      }
      onSaved();
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
        <header>
          <h2 className="font-bold">ルールを編集 (#{rule.id})</h2>
        </header>

        <section>
          <h3 className="font-bold mb-1 text-xs">パターン</h3>
          <input
            className="border border-border-app p-2 w-full font-mono text-xs"
            value={pattern}
            onChange={(e) => setPattern(e.target.value)}
            placeholder="マッチさせる文字列。正規表現も可 (例: Amazon|アマゾン)"
          />
          {isRegex && (
            <p className="text-xs text-muted-foreground mt-1">
              正規表現として評価されます (例:{" "}
              <span className="font-mono">^コンビニ</span>、
              <span className="font-mono">電気代$</span>)
            </p>
          )}
        </section>

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
            対象:
            <select
              value={field}
              onChange={(e) =>
                setField(e.target.value === "MEMO" ? "MEMO" : "PAYEE")
              }
              className="border border-border-app p-1 text-xs"
            >
              <option value="PAYEE">摘要</option>
              <option value="MEMO">メモ</option>
            </select>
          </label>
          <label className="flex items-center gap-2 text-xs">
            カテゴリ:
            <select
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="border border-border-app p-1 text-xs"
            >
              {cats.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-xs">
            優先度:
            <input
              type="number"
              value={priority}
              onChange={(e) =>
                setPriority(
                  e.target.value === "" ? 100 : Number(e.target.value),
                )
              }
              className="border border-border-app p-1 w-20 text-xs"
            />
          </label>
          <label className="flex items-center gap-2 text-xs">
            口座種別:
            <select
              value={accountKindFilter}
              onChange={(e) => setAccountKindFilter(e.target.value)}
              className="border border-border-app p-1 text-xs"
            >
              <option value="">制限なし</option>
              {ACCOUNT_KINDS.map((k) => (
                <option key={k} value={k}>
                  {ACCOUNT_KIND_LABELS[k]}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-2 text-xs col-span-2">
            金額条件 (絶対値):
            <input
              type="number"
              placeholder="下限"
              value={amountMin}
              onChange={(e) => setAmountMin(e.target.value)}
              className="border border-border-app p-1 w-24 text-xs"
            />
            <span>〜</span>
            <input
              type="number"
              placeholder="上限"
              value={amountMax}
              onChange={(e) => setAmountMax(e.target.value)}
              className="border border-border-app p-1 w-24 text-xs"
            />
            <span className="text-muted-foreground">空欄なら制限なし</span>
          </label>
        </section>

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
                      <span className="font-mono">
                        {m.occurredAt.slice(0, 10)}
                      </span>{" "}
                      {m.payee}{" "}
                      <span className="opacity-70">@ {m.account}</span>
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <p className="text-muted-foreground">
              パターンを入力するとプレビューが表示されます
            </p>
          )}
        </section>

        {message && <p className="text-xs text-red-500">{message}</p>}

        <footer className="flex flex-wrap gap-2 justify-end pt-2">
          <button
            type="button"
            className="px-3 py-1 text-xs border border-border-app"
            onClick={onClose}
            disabled={busy}
          >
            キャンセル
          </button>
          <button
            type="button"
            className="px-3 py-1 text-xs bg-blue-600 text-white disabled:bg-neutral-400"
            onClick={save}
            disabled={busy || !pattern || !categoryId}
          >
            保存
          </button>
        </footer>
      </div>
    </div>
  );
}
