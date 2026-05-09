// 日本のCSV共通パース補助

export function parseJpDate(s: string): Date | null {
  const t = s.trim();
  if (!t) return null;
  // 2026/05/09 / 2026-05-09 / 20260509 / 2026.05.09 / 2026年5月9日
  let m = t.match(/^(\d{4})[/.\-年](\d{1,2})[/.\-月](\d{1,2})/);
  if (m) {
    return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  }
  m = t.match(/^(\d{4})(\d{2})(\d{2})$/);
  if (m) {
    return new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  }
  return null;
}

export function parseAmount(s: string | undefined | null): number {
  if (s == null) return 0;
  const cleaned = s
    .replace(/[",¥￥円\s]/g, "")
    .replace(/△/g, "-") // 三角記号を負号扱い
    .trim();
  if (!cleaned || cleaned === "-") return 0;
  const n = Number(cleaned);
  return Number.isFinite(n) ? Math.trunc(n) : 0;
}

export function parseFloatJp(s: string | undefined | null): number | undefined {
  if (s == null) return undefined;
  // 数値以外の単位 (円・口・株・％・パーセント・，など) を除去してから Number 化
  const cleaned = s.replace(/[",¥￥円口株％%\s]/g, "").trim();
  if (!cleaned) return undefined;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : undefined;
}
