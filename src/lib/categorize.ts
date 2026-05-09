import { prisma } from "./db";

export type RuleEvalInput = {
  payee: string;
  memo?: string | null;
  accountKind: string;
};

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
    if (rule.accountKindFilter && rule.accountKindFilter !== input.accountKind) continue;
    const target = rule.field === "MEMO" ? input.memo ?? "" : input.payee;
    if (!target) continue;
    if (rule.isRegex) {
      try {
        if (new RegExp(rule.pattern).test(target)) return rule.categoryId;
      } catch {
        continue;
      }
    } else {
      if (target.includes(rule.pattern)) return rule.categoryId;
    }
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
