import { prisma } from "./db";
import { matchRule, type RuleEvalInput } from "./matchRule";

// matchRule 系の純関数はクライアントでも使うため別ファイルに分離。
// 既存の import パスとの互換のためここから re-export する。
export { matchRule, type RuleLike, type RuleEvalInput } from "./matchRule";

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
    select: {
      id: true,
      payee: true,
      memo: true,
      amount: true,
      account: { select: { kind: true } },
    },
  });
  let updated = 0;
  for (const t of txs) {
    const cat = applyRules(rules, {
      payee: t.payee,
      memo: t.memo,
      amount: t.amount,
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
