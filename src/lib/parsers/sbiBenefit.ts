import { parse as parseHtml } from "node-html-parser";
import type { ParsedHoldingRow, TextParserAdapter, ParseResult } from "./types";
import { parseAmount, parseFloatJp } from "./util";

// SBIベネフィット・システムズ (確定拠出年金) の「資産状況」ページを保存した
// HTML ファイルを取り込む。加入者画面には CSV ダウンロード機能が提供されて
// いないため、ブラウザで該当ページを保存して取り込む運用にする。
//
// 期待するページ構造 (Shift_JIS):
//   <h2>現在の資産状況 <span>YYYY/MM/DD　現在</span></h2>
//   <table id="grdSyouhinzangaku">
//     <tr class="tableHeader">商品タイプ / 運用商品名 / 時価単価 / 残高数量 /
//        資産残高 / 購入金額 / 損益 / -</tr>
//     <tr class="even-row"|"odd-row"> ... 商品 1 行 ... </tr>
//   </table>

export const sbiBenefitAdapter: TextParserAdapter = {
  format: "text",
  code: "sbi_benefit",
  institutionCode: "sbi_benefit",
  label: "SBIベネフィット 資産状況 (HTML)",
  encoding: "sjis",
  resultKind: "snapshot",
  detect(text: string): number {
    if (/grdSyouhinzangaku/.test(text) || /JP_D_Financial_AssetState/.test(text)) return 1;
    if (/SBIベネフィット/.test(text) && /資産状況/.test(text)) return 0.7;
    return 0;
  },
  parse(text: string, fileName: string): ParseResult {
    const warnings: string[] = [];
    const root = parseHtml(text);

    // スナップショット日付: 「YYYY/MM/DD 現在」を本文から抽出
    let snapshotDate: Date;
    const dateMatch = text.match(/(\d{4})\/(\d{1,2})\/(\d{1,2})\s*[　 ]*現在/);
    if (dateMatch) {
      snapshotDate = new Date(Date.UTC(+dateMatch[1], +dateMatch[2] - 1, +dateMatch[3]));
    } else {
      const m = fileName.match(/(\d{4})[-_]?(\d{2})[-_]?(\d{2})/);
      if (m) snapshotDate = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
      else {
        snapshotDate = new Date();
        snapshotDate.setUTCHours(0, 0, 0, 0);
        warnings.push("資産状況ページから日付を抽出できなかったため本日を採用");
      }
    }

    const table = root.querySelector("#grdSyouhinzangaku");
    if (!table) {
      return {
        kind: "snapshot",
        snapshot: { snapshotDate, holdings: [] },
        warnings: [...warnings, "商品テーブル (id=grdSyouhinzangaku) が見つかりません"],
      };
    }

    const holdings: ParsedHoldingRow[] = [];
    for (const tr of table.querySelectorAll("tr")) {
      if (tr.classList.contains("tableHeader")) continue;
      const tds = tr.querySelectorAll("td");
      if (tds.length < 7) continue;

      // 運用商品名は <span class="prod-formal"> を優先
      const formal = tds[1].querySelector(".prod-formal")?.text?.trim();
      const name = formal || tds[1].text.trim();
      if (!name) continue;

      // td2 の「時価単価 (1万口当り)」を平均取得単価相当として保持。
      // SBI ベネフィットの DC では「1 口当たりの取得単価」は表示されないため、
      // 1万口当たりの時価単価を流用する (Money Forward の挙動と同様)。
      const price = parseFloatJp(tds[2].text);
      const qty = parseFloatJp(tds[3].text) ?? 0;
      const value = parseAmount(tds[4].text);

      holdings.push({
        name,
        qty,
        avgCost: price,
        marketValue: value,
      });
    }

    return { kind: "snapshot", snapshot: { snapshotDate, holdings }, warnings };
  },
};
