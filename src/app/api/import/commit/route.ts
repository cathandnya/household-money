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
  if (existing) {
    return NextResponse.json({ error: "duplicate file", importId: existing.id }, { status: 409 });
  }

  const result =
    adapter.format === "pdf"
      ? await adapter.parse(buf, file.name)
      : adapter.parse(decodeBuffer(buf, adapter.encoding), file.name);
  const rules = await loadActiveRules();

  if (result.kind === "tx") {
    const importRec = await prisma.import.create({
      data: {
        accountId,
        fileName: file.name,
        fileHash,
        rowCount: result.rows.length,
        status: "OK",
      },
    });
    let inserted = 0;
    let skipped = 0;
    const seqOf = makeSeqAssigner<string>();
    for (const r of result.rows) {
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
      try {
        await prisma.transaction.create({
          data: {
            accountId,
            importId: importRec.id,
            occurredAt: r.occurredAt,
            amount: r.amount,
            balance: r.balance ?? null,
            payee: r.payee,
            memo: r.memo ?? null,
            raw: JSON.stringify(r.raw),
            rowHash,
            categoryId,
          },
        });
        inserted++;
      } catch {
        skipped++;
      }
    }
    return NextResponse.json({ importId: importRec.id, inserted, skipped, kind: "tx" });
  }

  if (result.kind === "sec_tx") {
    const importRec = await prisma.import.create({
      data: { accountId, fileName: file.name, fileHash, rowCount: result.rows.length },
    });
    let inserted = 0;
    let skipped = 0;
    const seqOf = makeSeqAssigner<string>();
    for (const r of result.rows) {
      const baseKey = `${r.tradedAt.toISOString().slice(0, 10)}|${r.side}|${r.ticker ?? ""}|${r.name.trim()}|${r.amount}|${r.qty ?? ""}`;
      const seq = seqOf(baseKey);
      const rowHash = secTxRowHash({
        accountId,
        tradedAt: r.tradedAt,
        side: r.side,
        name: r.name,
        ticker: r.ticker,
        amount: r.amount,
        qty: r.qty,
        seq,
      });
      try {
        await prisma.securityTransaction.create({
          data: {
            accountId,
            importId: importRec.id,
            tradedAt: r.tradedAt,
            ticker: r.ticker ?? null,
            name: r.name,
            side: r.side,
            qty: r.qty ?? null,
            price: r.price ?? null,
            amount: r.amount,
            fee: r.fee ?? null,
            raw: JSON.stringify(r.raw),
            rowHash,
          },
        });
        inserted++;
      } catch {
        skipped++;
      }
    }
    return NextResponse.json({ importId: importRec.id, inserted, skipped, kind: "sec_tx" });
  }

  // snapshot
  const snap = result.snapshot;
  const existingSnap = await prisma.holdingSnapshot.findUnique({
    where: { accountId_snapshotDate: { accountId, snapshotDate: snap.snapshotDate } },
  });
  if (existingSnap) {
    return NextResponse.json(
      { error: "duplicate snapshot", snapshotId: existingSnap.id },
      { status: 409 },
    );
  }
  // Import と HoldingSnapshot をアトミックに作成 (途中失敗で孤児 Import が残らないように)
  const [importRec, snapshot] = await prisma.$transaction(async (tx) => {
    const ir = await tx.import.create({
      data: { accountId, fileName: file.name, fileHash, rowCount: snap.holdings.length },
    });
    const sn = await tx.holdingSnapshot.create({
      data: {
        accountId,
        importId: ir.id,
        snapshotDate: snap.snapshotDate,
        sourceFile: file.name,
        holdings: {
          create: snap.holdings.map((h) => ({
            ticker: h.ticker ?? null,
            name: h.name,
            qty: h.qty,
            avgCost: h.avgCost ?? null,
            cost: h.cost != null ? Math.round(h.cost) : null,
            marketValue: h.marketValue,
            currency: h.currency ?? "JPY",
          })),
        },
      },
    });
    return [ir, sn];
  });
  return NextResponse.json({
    importId: importRec.id,
    snapshotId: snapshot.id,
    inserted: snap.holdings.length,
    kind: "snapshot",
  });
}
