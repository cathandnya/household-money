// 明細の payee からカテゴリ自動分類ルールの候補パターンを生成する。
// 候補は score (0..1) 降順で最大 5 件。すべて isRegex=false (includes 判定) を
// 基本にし、ユーザがダイアログで必要なら正規表現に切り替えられる。
// 原文比較するため NFKC 正規化はかけない (DB の payee と完全に同じ文字列であること)。

export type SuggestedKind =
  | "exact"
  | "stripDigits"
  | "stripDateExpr"
  | "stripPrefix"
  | "stripPrefixDigits"
  | "stripPrefixDateExpr"
  | "beforeParen"
  | "beforeSpace";

export type SuggestedPattern = {
  pattern: string;
  isRegex: boolean;
  label: string;
  score: number;
  kind: SuggestedKind;
};

// 既知プレフィックス (長いものを先に並べる)。各機関の payee で頻出する固定文字列。
// 正確な文字 (全角/半角空白) を尊重して書く。
const KNOWN_PREFIXES: string[] = [
  "ＪＣＢ国内利用　JCB ",
  "ＪＣＢ国内利用　QP ",
  "ＪＣＢ海外利用　",
  "振込　",
  "振替　",
  "振込 ",
  "振替 ",
  "ＰＥ ",
  "ＰＥ　",
  "ATM ",
  "ATM　",
  "カード　",
  "カード ",
];

// 「空白の後ろが補足っぽい」キーワード。これを含む後半は店舗名サフィックスと見なし、
// 前半 (空白前) を候補にする。
const SUFFIX_KEYWORDS = [
  "販売",
  "通信販売",
  "本店",
  "支店",
  "オンラ",
  "オンライン",
  "店",
  "決済",
  "サポート",
  "ﾗｸﾃﾝｲﾁﾊﾞ",
];

function looksMostlyDigitOrSymbol(s: string): boolean {
  return /^[\d\s\-_.,/()（）　¥￥]+$/.test(s);
}

function adjustScore(pattern: string, baseScore: number): number {
  let score = baseScore;
  // 漢字を含めば 2 文字でも十分意味があるので減点しない
  const hasKanji = /[一-鿿]/.test(pattern);
  if (pattern.length < 3 && !hasKanji) score *= 0.3;
  if (pattern.length < 2) score *= 0.3;
  if (looksMostlyDigitOrSymbol(pattern)) score *= 0.1;
  // 半角カナ + 英字混在で長さがそこそこなら少しブースト
  if (
    /[ｦ-ﾟ]/.test(pattern) &&
    /[A-Za-zＡ-Ｚａ-ｚ]/.test(pattern) &&
    pattern.length >= 4
  ) {
    score *= 1.1;
  }
  return Math.min(1, score);
}

function pushCandidate(
  out: SuggestedPattern[],
  pattern: string,
  baseScore: number,
  kind: SuggestedKind,
  label: string,
) {
  const trimmed = pattern.trim();
  if (!trimmed) return;
  out.push({
    pattern: trimmed,
    isRegex: false,
    label,
    score: adjustScore(trimmed, baseScore),
    kind,
  });
}

// 末尾の数字 (店舗番号など) を取り除く。長さ 3 桁以上の連続数字 (前後の空白も) を末尾から
// 除去する。例: `ﾗｸﾃﾝｲﾁﾊﾞ703001` → `ﾗｸﾃﾝｲﾁﾊﾞ`、`楽天ｔｏｔｏ        704267` → `楽天ｔｏｔｏ`
function stripTrailingDigits(s: string): string | null {
  const m = s.match(/^(.*?)[\s　]*\d{3,}\s*$/);
  if (!m) return null;
  const head = m[1].replace(/[\s　]+$/, "");
  if (!head) return null;
  return head === s ? null : head;
}

// 末尾の「日付・年月・月」表現を取り除く。月毎に変わる定例取引 (家賃・ローン返済・利息など)
// に対して恒常的なルールを作れるようにする。
// 例:
//   `ﾛｰﾝﾍﾝｻｲ05ｶﾞﾂ`         → `ﾛｰﾝﾍﾝｻｲ`
//   `ローン返済5月`         → `ローン返済`
//   `家賃 2026年04月分`     → `家賃`
//   `利息　08-02-13ﾏﾃﾞ`     → `利息`
//   `RENT 2026/04`          → `RENT`
//   `税引前利息 03/15`      → `税引前利息`
// 末尾の日付・年月表現を最長一致で除去するための候補正規表現群。
// 全マッチのうち最長 (=最も多く食う) ものを採用することで、
// `RENT 2026/04` の `2026/04` 全体を 1 度に削れる (短い `/04` だけ削って残骸を作らない)。
const DATE_EXPR_PATTERNS: RegExp[] = [
  // 半角カナ「YYYYﾈﾝ MMｶﾞﾂ DDﾆﾁ」「YY-MM-DDﾏﾃﾞ」など
  /[\s　]*\d{1,4}ﾈﾝ\d{0,2}ｶﾞﾂ\d{0,2}ﾆﾁ?[ｦ-ﾟ]*$/,
  /[\s　]*\d{1,4}[-/.]\d{1,2}[-/.]\d{1,2}[ｦ-ﾟ]*$/,
  // 一般的な日付表記「YYYY-MM-DD」「YYYY/MM/DD」
  /[\s　]*\d{1,4}[-/.]\d{1,2}[-/.]\d{1,2}$/,
  // 「YYYY/MM」「YYYY-MM」 (年月だけ)
  /[\s　]*\d{4}[-/.]\d{1,2}$/,
  // 「YYYY年MM月DD日?分?」
  /[\s　]*\d{1,4}年\d{1,2}月\d{0,2}日?分?$/,
  // 「MMｶﾞﾂ」「MM月分?」「MM/DD」
  /[\s　]*\d{1,2}ｶﾞﾂ$/,
  /[\s　]*\d{1,2}月分?$/,
  /[\s　]*\d{1,2}\/\d{1,2}$/,
];

function stripDateExpr(s: string): string | null {
  // 最長マッチを採用 (短い候補が先に当たって残骸を残さないように)
  let bestLen = 0;
  for (const re of DATE_EXPR_PATTERNS) {
    const m = s.match(re);
    if (m && m[0].length > bestLen) bestLen = m[0].length;
  }
  if (bestLen === 0) return null;
  const head = s.slice(0, s.length - bestLen).replace(/[\s　]+$/, "");
  if (!head || head === s || head.length < 2) return null;
  return head;
}

function stripKnownPrefix(s: string): string[] {
  const results: string[] = [];
  for (const prefix of KNOWN_PREFIXES) {
    if (s.startsWith(prefix)) {
      const rest = s.slice(prefix.length).trim();
      if (rest && rest !== s) results.push(rest);
    }
  }
  return results;
}

function beforeParen(s: string): string | null {
  const m = s.match(/^([^（(]+)[（(]/);
  if (!m) return null;
  const head = m[1].trim();
  if (head.length < 2) return null;
  return head === s ? null : head;
}

function beforeSpaceWithSuffix(s: string): string | null {
  const m = s.match(/^([^\s　]+)[\s　]+(.+)$/);
  if (!m) return null;
  const head = m[1];
  const tail = m[2];
  if (head.length < 2) return null;
  const tailHasKeyword = SUFFIX_KEYWORDS.some((k) => tail.includes(k));
  const tailHasDigits = /\d/.test(tail);
  if (!tailHasKeyword && !tailHasDigits) return null;
  return head;
}

export function suggestRulePatterns(payee: string): SuggestedPattern[] {
  const base = payee.trim();
  if (!base) return [];
  const out: SuggestedPattern[] = [];

  // (a) 完全一致は最後の砦
  pushCandidate(out, base, 0.4, "exact", "完全一致");

  // (b) 末尾の数字を除去
  const stripped = stripTrailingDigits(base);
  if (stripped) {
    pushCandidate(out, stripped, 0.85, "stripDigits", "末尾の数字を除去");
  }

  // (b') 末尾の日付・年月表現を除去 (`ﾛｰﾝﾍﾝｻｲ05ｶﾞﾂ` → `ﾛｰﾝﾍﾝｻｲ` 等)
  const noDate = stripDateExpr(base);
  if (noDate) {
    pushCandidate(out, noDate, 0.9, "stripDateExpr", "末尾の日付・月表現を除去");
  }

  // (c) 既知プレフィックス除去
  const noPrefixCandidates = stripKnownPrefix(base);
  for (const np of noPrefixCandidates) {
    pushCandidate(out, np, 0.8, "stripPrefix", "プレフィックスを除去");

    // (b)+(c) 複合: プレフィックス除去後にさらに末尾数字も削る
    const combined = stripTrailingDigits(np);
    if (combined && combined !== np) {
      pushCandidate(
        out,
        combined,
        0.9,
        "stripPrefixDigits",
        "プレフィックスと末尾の数字を除去",
      );
    }
    // (b')+(c) 複合: プレフィックス除去後に末尾の日付・月表現も削る
    const combinedDate = stripDateExpr(np);
    if (combinedDate && combinedDate !== np) {
      pushCandidate(
        out,
        combinedDate,
        0.92,
        "stripPrefixDateExpr",
        "プレフィックスと末尾の日付・月表現を除去",
      );
    }
  }

  // (d) 括弧前まで
  const bp = beforeParen(base);
  if (bp) pushCandidate(out, bp, 0.7, "beforeParen", "括弧の前まで");

  // (e) 最初の空白で前半カット (補足っぽい後半のときだけ)
  const bs = beforeSpaceWithSuffix(base);
  if (bs) pushCandidate(out, bs, 0.65, "beforeSpace", "空白の前まで");

  // dedupe (pattern 同一なら高スコア側を残す)
  const map = new Map<string, SuggestedPattern>();
  for (const c of out) {
    const ex = map.get(c.pattern);
    if (!ex || c.score > ex.score) map.set(c.pattern, c);
  }

  return [...map.values()].sort((a, b) => b.score - a.score).slice(0, 5);
}
