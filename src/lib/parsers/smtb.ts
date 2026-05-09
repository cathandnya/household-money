import type {
  ParsedTxRow,
  PdfParserAdapter,
  ParseResult,
} from "./types";
import { extractPdfItems, groupByLine, type PdfTextItem } from "./pdf";
import { parseAmount, parseJpDate } from "./util";

// 三井住友信託銀行 個人インターネットバンキング (三井住友信託ダイレクト)
// 「普通預金入出金明細」のダウンロード PDF を取り込む。
//
// PDF レイアウト (X 座標):
//   約 38   : お取引日 (YYYY年MM月DD日)
//   約 150-225: 出金金額 列
//   約 265-340: 入金金額 列
//   約 380-470: 差引残高 列
//   約 476+  : 摘要
// 列の中間 (X = 240 前後) で出金 / 入金 を判別できる。

const X_AMOUNT_BOUNDARY = 240; // この X 未満は出金列、以上は入金列

export const smtbAdapter: PdfParserAdapter = {
  format: "pdf",
  code: "smtb",
  institutionCode: "smtb",
  label: "三井住友信託銀行 普通預金入出金明細 (PDF)",
  resultKind: "tx",
  detect(buf: Buffer, fileName: string): number {
    if (!/\.pdf$/i.test(fileName) && !buf.slice(0, 5).toString().includes("%PDF")) {
      return 0;
    }
    // ファイル名にヒントがある場合
    if (/三井住友信託|smtb|sumi|trust/i.test(fileName)) return 0.9;
    // PDF テキスト解析は重いので detect では先頭バイトのみ。
    // ここでは「PDF であれば候補に挙げる」程度に留め、最終判定は parse 後に行う。
    return 0.4;
  },
  async parse(buf: Buffer, fileName: string): Promise<ParseResult> {
    const warnings: string[] = [];
    const items = await extractPdfItems(buf);

    // 「普通預金入出金明細」が含まれているかチェック
    const allText = items.map((i) => i.str).join("");
    if (!/普通預金入出金明細/.test(allText) && !/三井住友信託/.test(allText)) {
      warnings.push("三井住友信託の入出金明細PDFではない可能性があります");
    }

    const lines = groupByLine(items, 2);
    const out: ParsedTxRow[] = [];

    for (const line of lines) {
      // 行のうち先頭 (最も X が小さい) 要素が日付パターンならデータ行
      const sorted = [...line].sort((a, b) => a.x - b.x);
      const first = sorted[0];
      if (!first) continue;
      const date = parseSmtbDate(first.str);
      if (!date) continue;

      // 残りの要素を「金額っぽい」「文字列」に分類
      const moneyItems = sorted
        .slice(1)
        .filter((it) => /^[\d,]+円$/.test(it.str.trim()))
        .map((it) => ({ ...it, num: parseAmount(it.str) }));

      // 摘要 (金額・日付以外の文字列要素を結合)
      const memoItems = sorted
        .slice(1)
        .filter((it) => !/^[\d,]+円$/.test(it.str.trim()) && !parseSmtbDate(it.str));
      const payee = memoItems.map((it) => it.str.trim()).join("").trim();

      if (moneyItems.length === 0) continue;

      // 残高 = 最も X が大きい金額 (差引残高列)
      const balanceItem = moneyItems.reduce((p, c) => (c.x > p.x ? c : p));
      const balance = balanceItem.num;

      // 出金 / 入金 = 残高以外の金額。X が境界より左なら出金、右なら入金。
      let outAmt = 0;
      let inAmt = 0;
      for (const m of moneyItems) {
        if (m === balanceItem) continue;
        if (m.x < X_AMOUNT_BOUNDARY) outAmt += m.num;
        else inAmt += m.num;
      }
      const amount = inAmt - outAmt;
      if (amount === 0 && balance === 0) continue;

      const raw: Record<string, string> = {};
      sorted.forEach((it, i) => (raw[`item${i}`] = it.str));
      out.push({
        occurredAt: date,
        amount,
        balance,
        payee,
        raw,
      });
    }

    return { kind: "tx", rows: out, warnings };
  },
};

// 「2026年05月07日」を Date に変換
function parseSmtbDate(s: string): Date | null {
  const m = s.trim().match(/^(\d{4})年(\d{1,2})月(\d{1,2})日$/);
  if (!m) return parseJpDate(s);
  return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
}
