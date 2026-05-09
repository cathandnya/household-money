// Rule マッチ判定の純関数。
// サーバ (categorize.ts) とクライアント (取込プレビュー) の両方から呼ぶため、
// Prisma などサーバ専用依存を持たない場所に分離している。

export type RuleLike = {
  pattern: string;
  isRegex: boolean;
  field: string;
  accountKindFilter: string | null;
};

export type RuleEvalInput = {
  payee: string;
  memo?: string | null;
  accountKind: string;
};

export function matchRule(rule: RuleLike, input: RuleEvalInput): boolean {
  if (rule.accountKindFilter && rule.accountKindFilter !== input.accountKind) {
    return false;
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
