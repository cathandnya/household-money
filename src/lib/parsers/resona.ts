import Papa from "papaparse";
import type { ParsedTxRow, TextParserAdapter, ParseResult } from "./types";
import { parseAmount } from "./util";

// りそな銀行 マイゲート 入出金明細 CSV (Shift_JIS)
// ヘッダ (21列):
//   レコード区分, 年, 月, 日, 時, 分, 連絡先名, 金融機関名, 支店名,
//   口座番号区分, 口座種別, 口座番号, 再送表示, 取引名,
//   取扱日付　年, 取扱日付　月, 取扱日付　日, 金額, 取引後残高, 摘要, コメント
//
// 特徴:
// - 取引日は「取扱日付　年 / 取扱日付　月 / 取扱日付　日」の 3 カラムに分かれる
// - 入出金は「取引名」カラム ("入金" | "支払") で判別、金額は常に符号なしの正数
// - 全レコード末尾までヘッダ + データ行のみ (フッターなし)
export const resonaAdapter: TextParserAdapter = {
  format: "text",
  code: "resona",
  institutionCode: "resona",
  label: "りそな銀行 入出金明細",
  encoding: "sjis",
  resultKind: "tx",
  detect(text: string): number {
    const head = text.slice(0, 1500);
    if (/レコード区分/.test(head) && /取扱日付/.test(head) && /取引後残高/.test(head)) {
      return 1;
    }
    if (/りそな銀行/.test(head)) return 0.7;
    return 0;
  },
  parse(text: string): ParseResult {
    const warnings: string[] = [];
    const parsed = Papa.parse<string[]>(text.trim(), { skipEmptyLines: true });
    const rows = parsed.data as string[][];
    if (rows.length === 0) return { kind: "tx", rows: [], warnings: ["empty"] };

    const headerIdx = rows.findIndex(
      (r) =>
        r.some((c) => /レコード区分/.test(c)) &&
        r.some((c) => /取扱日付/.test(c)) &&
        r.some((c) => /取引後残高/.test(c)),
    );
    if (headerIdx < 0) {
      return { kind: "tx", rows: [], warnings: ["ヘッダー行が見つかりません"] };
    }
    const header = rows[headerIdx].map((s) => s.trim());
    const dataRows = rows.slice(headerIdx + 1);

    const idx = (re: RegExp) => header.findIndex((h) => re.test(h));
    // 「取扱日付」を含む列を 末尾の文字 (年/月/日) で判別する。
    // 「取扱日付」自体に「日」が含まれるため、末尾アンカーで区別が必要。
    const dateCols = header
      .map((h, i) => ({ h, i }))
      .filter((x) => /取扱日付/.test(x.h));
    const iY = dateCols.find((x) => /年$/.test(x.h))?.i ?? -1;
    const iM = dateCols.find((x) => /月$/.test(x.h))?.i ?? -1;
    const iD = dateCols.find((x) => /日$/.test(x.h))?.i ?? -1;
    const iSide = idx(/^取引名$/);
    const iAmount = idx(/^金額$/);
    const iBalance = idx(/取引後残高/);
    const iPayee = idx(/^摘要$/);
    const iMemo = idx(/^コメント$/);
    const iBank = idx(/金融機関名/);
    const iBranch = idx(/支店名/);
    const iAccount = idx(/^口座番号$/);

    if (iY < 0 || iM < 0 || iD < 0 || iSide < 0 || iAmount < 0) {
      return { kind: "tx", rows: [], warnings: ["必須列なし"] };
    }

    const out: ParsedTxRow[] = [];
    for (const r of dataRows) {
      if (!r || r.every((c) => !c?.trim())) continue;
      const y = r[iY]?.trim();
      const m = r[iM]?.trim();
      const d = r[iD]?.trim();
      if (!y || !m || !d) continue;
      const yy = +y;
      const mm = +m;
      const dd = +d;
      if (!Number.isFinite(yy) || !Number.isFinite(mm) || !Number.isFinite(dd)) continue;
      const date = new Date(Date.UTC(yy, mm - 1, dd));
      if (isNaN(date.getTime())) continue;

      const sideRaw = (r[iSide] ?? "").trim();
      const amountAbs = parseAmount(r[iAmount]);
      const amount = /入金|入/.test(sideRaw) && !/支払|出金/.test(sideRaw)
        ? amountAbs
        : -amountAbs;

      const balance = iBalance >= 0 ? parseAmount(r[iBalance]) : undefined;
      let payee = iPayee >= 0 ? (r[iPayee] ?? "").trim() : "";
      // 全角スペースを半角に揃える (検索性のため)
      payee = payee.replace(/　/g, " ");
      const memoRaw = iMemo >= 0 ? (r[iMemo] ?? "").trim() : "";
      const memo = memoRaw || undefined;

      const raw: Record<string, string> = {};
      header.forEach((h, i) => (raw[h] = r[i] ?? ""));
      // 取引名と金融機関名・支店名・口座番号も raw に入っているのでそのまま記録
      // (将来 CSV 内の口座情報で口座を自動判別したいときの取っかかり)
      void iBank;
      void iBranch;
      void iAccount;

      out.push({ occurredAt: date, amount, balance, payee, memo, raw });
    }
    return { kind: "tx", rows: out, warnings };
  },
};
