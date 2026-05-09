import Papa from "papaparse";
import type { ParsedTxRow, TextParserAdapter, ParseResult } from "./types";
import { parseAmount, parseJpDate } from "./util";

// 楽天銀行 入出金明細 CSV
// ヘッダ例: 取引日,入出金(円),取引後残高(円),入出金先内容
export const rakutenBankAdapter: TextParserAdapter = {
  format: "text",
  code: "rakuten_bank",
  institutionCode: "rakuten_bank",
  label: "楽天銀行 入出金明細",
  encoding: "auto",
  resultKind: "tx",
  detect(text: string): number {
    const head = text.slice(0, 500);
    if (/取引日/.test(head) && /入出金\(円\)/.test(head) && /取引後残高\(円\)/.test(head)) return 1;
    if (/取引日/.test(head) && /入出金/.test(head) && /残高/.test(head)) return 0.6;
    return 0;
  },
  parse(text: string): ParseResult {
    const warnings: string[] = [];
    const parsed = Papa.parse<string[]>(text.trim(), { skipEmptyLines: true });
    const rows = parsed.data as string[][];
    if (rows.length === 0) {
      return { kind: "tx", rows: [], warnings: ["empty file"] };
    }
    // ヘッダー行検出
    const headerIdx = rows.findIndex((r) =>
      r.some((c) => /取引日/.test(c)) && r.some((c) => /入出金/.test(c)),
    );
    if (headerIdx < 0) {
      warnings.push("ヘッダー行が見つからないため1行目をヘッダとみなします");
    }
    const header = rows[Math.max(headerIdx, 0)].map((s) => s.trim());
    const dataRows = rows.slice(Math.max(headerIdx, 0) + 1);

    const idx = (key: RegExp) => header.findIndex((h) => key.test(h));
    const iDate = idx(/取引日/);
    const iAmount = idx(/入出金/);
    const iBalance = idx(/残高/);
    const iPayee = idx(/(入出金先内容|内容|摘要)/);

    if (iDate < 0 || iAmount < 0) {
      return {
        kind: "tx",
        rows: [],
        warnings: [...warnings, "必須列(取引日/入出金)が見つかりません"],
      };
    }

    const out: ParsedTxRow[] = [];
    for (const r of dataRows) {
      if (!r || r.every((c) => !c?.trim())) continue;
      const date = parseJpDate(r[iDate] ?? "");
      if (!date) continue;
      const amount = parseAmount(r[iAmount]);
      const balance = iBalance >= 0 ? parseAmount(r[iBalance]) : undefined;
      const payee = (iPayee >= 0 ? r[iPayee] : "")?.trim() ?? "";
      const raw: Record<string, string> = {};
      header.forEach((h, i) => (raw[h] = r[i] ?? ""));
      out.push({
        occurredAt: date,
        amount,
        balance: Number.isFinite(balance) ? balance : undefined,
        payee,
        raw,
      });
    }
    return { kind: "tx", rows: out, warnings };
  },
};
