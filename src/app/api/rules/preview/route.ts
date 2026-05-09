import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { matchRule } from "@/lib/categorize";

export const runtime = "nodejs";

const SAMPLE_LIMIT = 5;
const SCAN_LIMIT = 1000; // 母集合の上限。これを超えたら truncated:true

// GET /api/rules/preview?pattern=...&isRegex=0|1&field=PAYEE|MEMO&accountKindFilter=CREDIT_CARD
// 与えられたルール候補が、未分類 (categoryId=null) の明細にいくつマッチするか
// と先頭サンプルを返す。
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const pattern = searchParams.get("pattern")?.trim() ?? "";
  const isRegex = searchParams.get("isRegex") === "1";
  const field = searchParams.get("field") === "MEMO" ? "MEMO" : "PAYEE";
  const accountKindFilter = searchParams.get("accountKindFilter") || null;
  const parseIntOrNull = (s: string | null) => {
    if (s == null || s === "") return null;
    const n = Number(s);
    return Number.isFinite(n) ? Math.trunc(n) : null;
  };
  const amountMin = parseIntOrNull(searchParams.get("amountMin"));
  const amountMax = parseIntOrNull(searchParams.get("amountMax"));

  if (!pattern) {
    return NextResponse.json(
      { matchCount: 0, sampleMatches: [], truncated: false },
      { status: 200 },
    );
  }

  const where: Record<string, unknown> = { categoryId: null };
  if (accountKindFilter) {
    where.account = { kind: accountKindFilter };
  }

  const rows = await prisma.transaction.findMany({
    where: where as Parameters<typeof prisma.transaction.findMany>[0] extends { where?: infer W }
      ? W
      : never,
    select: {
      id: true,
      occurredAt: true,
      payee: true,
      memo: true,
      amount: true,
      account: { select: { kind: true, name: true, institution: { select: { name: true } } } },
    },
    orderBy: [{ occurredAt: "desc" }, { id: "desc" }],
    take: SCAN_LIMIT,
  });

  const ruleLike = { pattern, isRegex, field, accountKindFilter, amountMin, amountMax };
  const sample: Array<{
    id: number;
    occurredAt: string;
    payee: string;
    memo: string | null;
    amount: number;
    account: string;
  }> = [];
  let matchCount = 0;
  for (const t of rows) {
    if (
      matchRule(ruleLike, {
        payee: t.payee,
        memo: t.memo,
        accountKind: t.account.kind,
        amount: t.amount,
      })
    ) {
      matchCount++;
      if (sample.length < SAMPLE_LIMIT) {
        sample.push({
          id: t.id,
          occurredAt: t.occurredAt.toISOString(),
          payee: t.payee,
          memo: t.memo,
          amount: t.amount,
          account: `${t.account.institution.name}/${t.account.name}`,
        });
      }
    }
  }

  return NextResponse.json({
    matchCount,
    sampleMatches: sample,
    truncated: rows.length >= SCAN_LIMIT,
  });
}
