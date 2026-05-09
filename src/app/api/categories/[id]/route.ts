import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const categoryId = Number(id);
  if (!Number.isFinite(categoryId)) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }
  const body = await req.json();
  const { name } = body ?? {};
  if (!name || typeof name !== "string" || !name.trim()) {
    return NextResponse.json({ error: "name required" }, { status: 400 });
  }
  const cat = await prisma.category.update({
    where: { id: categoryId },
    data: { name: name.trim() },
  });
  return NextResponse.json(cat);
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const categoryId = Number(id);
  if (!Number.isFinite(categoryId)) {
    return NextResponse.json({ error: "invalid id" }, { status: 400 });
  }
  const cat = await prisma.category.findUnique({ where: { id: categoryId } });
  if (!cat) return NextResponse.json({ error: "not found" }, { status: 404 });

  // 紐づいている明細はカテゴリ未設定に戻す。ルールはカテゴリ必須なので削除。
  await prisma.$transaction([
    prisma.transaction.updateMany({
      where: { categoryId },
      data: { categoryId: null },
    }),
    prisma.rule.deleteMany({ where: { categoryId } }),
    prisma.category.delete({ where: { id: categoryId } }),
  ]);

  return NextResponse.json({ ok: true });
}
