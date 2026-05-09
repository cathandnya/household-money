import { prisma } from "./db";

export type RuleEvalInput = {
  payee: string;
  memo?: string | null;
  accountKind: string;
};

// applyRules / preview / apply-now で共通利用する判定基準。
// 完全な Rule モデルでなくても OK なように Pick したフィールド集合を要求する。
export type RuleLike = {
  pattern: string;
  isRegex: boolean;
  field: string;
  accountKindFilter: string | null;
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

export async function loadActiveRules() {
  return prisma.rule.findMany({
    where: { enabled: true },
    orderBy: { priority: "asc" },
  });
}

export function applyRules(
  rules: Awaited<ReturnType<typeof loadActiveRules>>,
  input: RuleEvalInput,
): number | null {
  for (const rule of rules) {
    if (matchRule(rule, input)) return rule.categoryId;
  }
  return null;
}

export async function recategorizeAll(): Promise<number> {
  const rules = await loadActiveRules();
  const txs = await prisma.transaction.findMany({
    select: { id: true, payee: true, memo: true, account: { select: { kind: true } } },
  });
  let updated = 0;
  for (const t of txs) {
    const cat = applyRules(rules, {
      payee: t.payee,
      memo: t.memo,
      accountKind: t.account.kind,
    });
    await prisma.transaction.update({
      where: { id: t.id },
      data: { categoryId: cat },
    });
    if (cat != null) updated++;
  }
  return updated;
}
