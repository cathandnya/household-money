import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { decodeBuffer } from "@/lib/parsers/encoding";
import { getAdapter } from "@/lib/parsers/registry";
import { sha256, txRowHash, secTxRowHash, makeSeqAssigner } from "@/lib/dedupe";
import { applyRules, loadActiveRules } from "@/lib/categorize";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const form = await req.formData();
  const accountIdStr = form.get("accountId");
  const adapterCode = form.get("adapterCode");
  const file = form.get("file");
  if (typeof accountIdStr !== "string" || typeof adapterCode !== "string" || !(file instanceof File)) {
    return NextResponse.json({ error: "invalid params" }, { status: 400 });
  }
  const accountId = Number(accountIdStr);
  const adapter = getAdapter(adapterCode);
  if (!adapter) return NextResponse.json({ error: "unknown adapter" }, { status: 400 });

  const account = await prisma.account.findUnique({ where: { id: accountId } });
  if (!account) return NextResponse.json({ error: "account not found" }, { status: 404 });

  const buf = Buffer.from(await file.arrayBuffer());
  const fileHash = sha256(buf);
  const existing = await prisma.import.findUnique({ where: { fileHash } });
  const result =
    adapter.format === "pdf"
      ? await adapter.parse(buf, file.name)
      : adapter.parse(decodeBuffer(buf, adapter.encoding), file.name);

  const rules = await loadActiveRules();

  if (result.kind === "tx") {
    const seqOf = makeSeqAssigner<string>();
    const previewRows = result.rows.map((r) => {
      const baseKey = `${r.occurredAt.toISOString().slice(0, 10)}|${r.amount}|${r.payee.trim()}|${r.balance ?? ""}`;
      const seq = seqOf(baseKey);
      const rowHash = txRowHash({
        accountId,
        occurredAt: r.occurredAt,
        amount: r.amount,
        payee: r.payee,
        balance: r.balance ?? null,
        seq,
      });
      const categoryId = applyRules(rules, {
        payee: r.payee,
        memo: r.memo,
        accountKind: account.kind,
      });
      return {
        rowHash,
        occurredAt: r.occurredAt.toISOString(),
        amount: r.amount,
        balance: r.balance,
        payee: r.payee,
        memo: r.memo,
        suggestedCategoryId: categoryId,
      };
    });
    const existingHashes = new Set(
      (
        await prisma.transaction.findMany({
          where: { rowHash: { in: previewRows.map((p) => p.rowHash) } },
          select: { rowHash: true },
        })
      ).map((t) => t.rowHash),
    );
    return NextResponse.json({
      kind: "tx",
      fileHash,
      fileName: file.name,
      duplicateFile: !!existing,
      duplicateImportId: existing?.id ?? null,
      warnings: result.warnings,
      total: previewRows.length,
      duplicateRows: previewRows.filter((p) => existingHashes.has(p.rowHash)).length,
      rows: previewRows.map((p) => ({ ...p, duplicate: existingHashes.has(p.rowHash) })),
    });
  }

  if (result.kind === "sec_tx") {
    const seqOf = makeSeqAssigner<string>();
    const previewRows = result.rows.map((r) => {
      const baseKey = `${r.tradedAt.toISOString().slice(0, 10)}|${r.side}|${r.ticker ?? ""}|${r.name.trim()}|${r.amount}|${r.qty ?? ""}`;
      const seq = seqOf(baseKey);
      return {
        rowHash: secTxRowHash({
          accountId,
          tradedAt: r.tradedAt,
          side: r.side,
          name: r.name,
          ticker: r.ticker,
          amount: r.amount,
          qty: r.qty,
          seq,
        }),
        tradedAt: r.tradedAt.toISOString(),
        ticker: r.ticker,
        name: r.name,
        side: r.side,
        qty: r.qty,
        price: r.price,
        amount: r.amount,
        fee: r.fee,
      };
    });
    const existingHashes = new Set(
      (
        await prisma.securityTransaction.findMany({
          where: { rowHash: { in: previewRows.map((p) => p.rowHash) } },
          select: { rowHash: true },
        })
      ).map((t) => t.rowHash),
    );
    return NextResponse.json({
      kind: "sec_tx",
      fileHash,
      fileName: file.name,
      duplicateFile: !!existing,
      warnings: result.warnings,
      total: previewRows.length,
      duplicateRows: previewRows.filter((p) => existingHashes.has(p.rowHash)).length,
      rows: previewRows.map((p) => ({ ...p, duplicate: existingHashes.has(p.rowHash) })),
    });
  }

  // snapshot
  const snap = result.snapshot;
  const existingSnap = await prisma.holdingSnapshot.findUnique({
    where: { accountId_snapshotDate: { accountId, snapshotDate: snap.snapshotDate } },
  });
  return NextResponse.json({
    kind: "snapshot",
    fileHash,
    fileName: file.name,
    duplicateFile: !!existing,
    duplicateSnapshot: !!existingSnap,
    warnings: result.warnings,
    snapshotDate: snap.snapshotDate.toISOString(),
    holdings: snap.holdings,
    totalValue: snap.holdings.reduce((s, h) => s + h.marketValue, 0),
  });
}
