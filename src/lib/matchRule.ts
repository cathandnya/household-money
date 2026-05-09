// Rule マッチ判定の純関数。
// サーバ (categorize.ts) とクライアント (取込プレビュー) の両方から呼ぶため、
// Prisma などサーバ専用依存を持たない場所に分離している。

export type RuleLike = {
  pattern: string;
  isRegex: boolean;
  field: string;
  accountKindFilter: string | null;
  // 絶対値で比較する金額条件 (null は無制限)
  amountMin?: number | null;
  amountMax?: number | null;
};

export type RuleEvalInput = {
  payee: string;
  memo?: string | null;
  accountKind: string;
  // 取引金額 (符号付き)。matchRule 内で Math.abs して amountMin/Max と比較する。
  // 未指定 (undefined) のときは金額条件があるルールはマッチしない。
  amount?: number;
};

export function matchRule(rule: RuleLike, input: RuleEvalInput): boolean {
  if (rule.accountKindFilter && rule.accountKindFilter !== input.accountKind) {
    return false;
  }
  // 金額条件があるルールで amount が来ていなければ false
  if ((rule.amountMin != null || rule.amountMax != null) && input.amount == null) {
    return false;
  }
  if (input.amount != null) {
    const abs = Math.abs(input.amount);
    if (rule.amountMin != null && abs < rule.amountMin) return false;
    if (rule.amountMax != null && abs > rule.amountMax) return false;
  }
  const target = rule.field === "MEMO" ? input.memo ?? "" : input.payee;
  if (!target) return false;
  if (rule.isRegex) {
    try {
      return new RegExp(rule.pattern).test(target);
    } catch {
      return false;
    }
  }
  return target.includes(rule.pattern);
}
