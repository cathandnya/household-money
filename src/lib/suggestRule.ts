// 明細の payee からカテゴリ自動分類ルールの候補パターンを生成する。
// 候補は score (0..1) 降順で最大 5 件。すべて isRegex=false (includes 判定) を
// 基本にし、ユーザがダイアログで必要なら正規表現に切り替えられる。
// 原文比較するため NFKC 正規化はかけない (DB の payee と完全に同じ文字列であること)。

export type SuggestedKind =
  | "exact"
  | "stripDigits"
  | "stripPrefix"
  | "stripPrefixDigits"
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
  "利息　",
  "利息 ",
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
  if (pattern.length < 3) score *= 0.3;
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
