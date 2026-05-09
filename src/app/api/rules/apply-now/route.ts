import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { matchRule } from "@/lib/categorize";

export const runtime = "nodejs";

// POST /api/rules/apply-now { ruleId: number }
// 指定ルールに対して、未分類 (categoryId=null) で pattern + accountKindFilter に
// 一致する明細だけを一括で categoryId 更新する。recategorizeAll とは独立。
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const ruleId = body?.ruleId;
  if (!ruleId || typeof ruleId !== "number") {
    return NextResponse.json({ error: "ruleId required" }, { status: 400 });
  }
  const rule = await prisma.rule.findUnique({ where: { id: Number(ruleId) } });
  if (!rule) return NextResponse.json({ error: "rule not found" }, { status: 404 });

  const where: Record<string, unknown> = { categoryId: null };
  if (rule.accountKindFilter) {
    where.account = { kind: rule.accountKindFilter };
  }

  const rows = await prisma.transaction.findMany({
    where: where as Parameters<typeof prisma.transaction.findMany>[0] extends { where?: infer W }
      ? W
      : never,
    select: {
      id: true,
      payee: true,
      memo: true,
      account: { select: { kind: true } },
    },
  });

  const ids: number[] = [];
  for (const t of rows) {
    if (
      matchRule(rule, { payee: t.payee, memo: t.memo, accountKind: t.account.kind })
    ) {
      ids.push(t.id);
    }
  }

  if (ids.length === 0) {
    return NextResponse.json({ updated: 0 });
  }

  const result = await prisma.transaction.updateMany({
    where: { id: { in: ids } },
    data: { categoryId: rule.categoryId },
  });

  return NextResponse.json({ updated: result.count });
}
