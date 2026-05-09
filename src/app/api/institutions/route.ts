import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { institutionAdapterMap, getAdapter } from "@/lib/parsers/registry";

export const runtime = "nodejs";

export async function GET() {
  const insts = await prisma.institution.findMany({ orderBy: { id: "asc" } });
  return NextResponse.json(
    insts.map((i) => ({
      ...i,
      adapters: (institutionAdapterMap[i.code] ?? []).map((c) => {
        const a = getAdapter(c);
        return a ? { code: a.code, label: a.label, resultKind: a.resultKind } : null;
      }).filter(Boolean),
    })),
  );
}
