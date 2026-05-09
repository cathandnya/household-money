import Papa from "papaparse";
import type { ParsedTxRow, ParserAdapter, ParseResult } from "./types";
import { parseAmount, parseJpDate } from "./util";

// SBI 新生銀行 入出金明細
// ヘッダ例: 取引日,摘要,お支払金額,お預り金額,残高
export const shinseiAdapter: ParserAdapter = {
  code: "shinsei",
  institutionCode: "shinsei",
  label: "SBI新生銀行 入出金明細",
  encoding: "auto",
  resultKind: "tx",
  detect(text: string): number {
    const head = text.slice(0, 500);
    // 出金金額/入金金額 という独特な見出しの組み合わせは新生銀行に近い
    if (/取引日/.test(head) && /出金金額/.test(head) && /入金金額/.test(head)) return 1;
    if (/取引日/.test(head) && /お支払金額/.test(head) && /お預り金額/.test(head)) return 0.9;
    return 0;
  },
  parse(text: string): ParseResult {
    const warnings: string[] = [];
    const parsed = Papa.parse<string[]>(text.trim(), { skipEmptyLines: true });
    const rows = parsed.data as string[][];
    if (rows.length === 0) return { kind: "tx", rows: [], warnings: ["empty"] };

    const headerIdx = rows.findIndex(
      (r) => r.some((c) => /取引日|日付/.test(c)) && r.some((c) => /摘要|内容/.test(c)),
    );
    const header = rows[Math.max(headerIdx, 0)].map((s) => s.trim());
    const dataRows = rows.slice(Math.max(headerIdx, 0) + 1);

    const idx = (re: RegExp) => header.findIndex((h) => re.test(h));
    const iDate = idx(/取引日|日付/);
    const iPayee = idx(/摘要|内容/);
    const iOut = idx(/お支払|出金/);
    const iIn = idx(/お預り|入金/);
    const iBalance = idx(/残高/);
    if (iDate < 0 || iPayee < 0 || (iOut < 0 && iIn < 0)) {
      return { kind: "tx", rows: [], warnings: ["必須列なし"] };
    }

    const out: ParsedTxRow[] = [];
    for (const r of dataRows) {
      if (!r || r.every((c) => !c?.trim())) continue;
      const date = parseJpDate(r[iDate] ?? "");
      if (!date) continue;
      const out_ = iOut >= 0 ? parseAmount(r[iOut]) : 0;
      const in_ = iIn >= 0 ? parseAmount(r[iIn]) : 0;
      const amount = in_ - out_;
      const balance = iBalance >= 0 ? parseAmount(r[iBalance]) : undefined;
      const payee = (r[iPayee] ?? "").trim();
      const raw: Record<string, string> = {};
      header.forEach((h, i) => (raw[h] = r[i] ?? ""));
      out.push({ occurredAt: date, amount, balance, payee, raw });
    }
    return { kind: "tx", rows: out, warnings };
  },
};
