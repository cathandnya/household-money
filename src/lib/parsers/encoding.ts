import iconv from "iconv-lite";

export type Encoding = "utf8" | "sjis" | "jis" | "auto";

export function decodeBuffer(buf: Buffer, encoding: Encoding): string {
  if (encoding === "auto") return decodeAuto(buf);
  if (encoding === "utf8") return stripBom(buf.toString("utf8"));
  if (encoding === "sjis") return iconv.decode(buf, "Shift_JIS");
  if (encoding === "jis") return iconv.decode(buf, "ISO2022JP");
  return buf.toString("utf8");
}

function stripBom(s: string): string {
  return s.charCodeAt(0) === 0xfeff ? s.slice(1) : s;
}

// 簡易自動判定: BOM があれば UTF-8、ESC があれば JIS、
// それ以外は SJIS と UTF-8 でデコードして「不正バイト数」が少ない方を採用。
function decodeAuto(buf: Buffer): string {
  if (buf.length >= 3 && buf[0] === 0xef && buf[1] === 0xbb && buf[2] === 0xbf) {
    return buf.slice(3).toString("utf8");
  }
  // ESC 単発はバイナリ (PDF など) でも普通に出るので、JIS の開始シーケンス
  // (ESC '$' 'B' 等) を厳密にチェックする
  if (
    buf.indexOf(Buffer.from([0x1b, 0x24, 0x42])) >= 0 ||
    buf.indexOf(Buffer.from([0x1b, 0x24, 0x40])) >= 0 ||
    buf.indexOf(Buffer.from([0x1b, 0x28, 0x42])) >= 0
  ) {
    return iconv.decode(buf, "ISO2022JP");
  }
  const utf8 = buf.toString("utf8");
  const utf8Replacement = (utf8.match(/�/g) ?? []).length;
  const sjis = iconv.decode(buf, "Shift_JIS");
  const sjisReplacement = (sjis.match(/�/g) ?? []).length;
  return utf8Replacement <= sjisReplacement ? utf8 : sjis;
}
