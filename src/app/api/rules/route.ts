import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

const toIntOrNull = (v: unknown) => {
  if (v == null || v === "") return null;
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
};

const normField = (v: unknown) => (v === "MEMO" ? "MEMO" : "PAYEE");

// 数値に変換できれば整数を、できなければ null を返す。id / categoryId の検証用。
const toIntStrict = (v: unknown): number | null => {
  const n = Number(v);
  return Number.isFinite(n) ? Math.trunc(n) : null;
};

export async function GET() {
  const rules = await prisma.rule.findMany({
    include: { category: true },
    orderBy: { priority: "asc" },
  });
  return NextResponse.json(rules);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const {
    pattern,
    isRegex,
    field,
    priority,
    accountKindFilter,
    amountMin,
    amountMax,
    categoryId,
    enabled,
  } = body ?? {};
  if (!pattern || !categoryId) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const rule = await prisma.rule.create({
    data: {
      pattern: String(pattern),
      isRegex: !!isRegex,
      field: normField(field),
      priority: Number(priority ?? 100),
      accountKindFilter: accountKindFilter || null,
      amountMin: toIntOrNull(amountMin),
      amountMax: toIntOrNull(amountMax),
      categoryId: Number(categoryId),
      enabled: enabled ?? true,
    },
  });
  return NextResponse.json(rule);
}

export async function PATCH(req: NextRequest) {
  const body = await req.json();
  const {
    id,
    pattern,
    isRegex,
    field,
    priority,
    accountKindFilter,
    amountMin,
    amountMax,
    categoryId,
    enabled,
  } = body ?? {};
  const ruleId = toIntStrict(id);
  const catId = toIntStrict(categoryId);
  if (ruleId == null) return NextResponse.json({ error: "id required" }, { status: 400 });
  if (!pattern || catId == null) return NextResponse.json({ error: "invalid" }, { status: 400 });
  const rule = await prisma.rule.update({
    where: { id: ruleId },
    data: {
      pattern: String(pattern),
      isRegex: !!isRegex,
      field: normField(field),
      priority: Number(priority ?? 100),
      accountKindFilter: accountKindFilter || null,
      amountMin: toIntOrNull(amountMin),
      amountMax: toIntOrNull(amountMax),
      categoryId: catId,
      // enabled が未指定なら既存値を保持する (更新APIなので強制的に true にしない)
      ...(enabled === undefined ? {} : { enabled: !!enabled }),
    },
    include: { category: true },
  });
  return NextResponse.json(rule);
}

export async function DELETE(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
  await prisma.rule.delete({ where: { id: Number(id) } });
  return NextResponse.json({ ok: true });
}
