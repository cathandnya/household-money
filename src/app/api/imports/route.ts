import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

export const runtime = "nodejs";

export async function GET() {
  const imports = await prisma.import.findMany({
    include: {
      account: { include: { institution: true } },
      _count: {
        select: {
          transactions: true,
          securityTransactions: true,
          holdingSnapshots: true,
        },
      },
    },
    orderBy: { importedAt: "desc" },
  });

  return NextResponse.json(
    imports.map((i) => ({
      id: i.id,
      importedAt: i.importedAt.toISOString(),
      fileName: i.fileName,
      source: i.source,
      status: i.status,
      rowCount: i.rowCount,
      account: { id: i.account.id, name: i.account.name, kind: i.account.kind },
      institution: {
        id: i.account.institution.id,
        code: i.account.institution.code,
        name: i.account.institution.name,
      },
      counts: {
        tx: i._count.transactions,
        secTx: i._count.securityTransactions,
        snapshot: i._count.holdingSnapshots,
      },
    })),
  );
}
