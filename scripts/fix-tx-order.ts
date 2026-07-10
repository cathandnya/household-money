import "dotenv/config";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client";

// 一部の金融機関はCSV/PDFで取引を「新→古」の順に出力するため、
// 過去の取り込みでは同日タイの取引が id ASC = 時系列 DESC で入ってしまっている。
// aggregate 側は id ASC = 時系列 ASC を前提としているので、
// このスクリプトで同日タイ行の内容を id 順に reverse して不変条件を回復する。
// 検証: グループが時系列 DESC で並んでいるか、残高チェーンで裏取りする。
//   同日タイ [r0, r1, ..., rN] が時系列 DESC のとき、
//   時系列で先行する r_{i+1} と後続の r_i の間で
//     r_{i+1}.balance + r_i.amount == r_i.balance
//   が成立する。全ペアで成立したグループのみ入れ替える。
//
// 使い方:
//   npx tsx scripts/fix-tx-order.ts <institution-code>           # dry-run
//   npx tsx scripts/fix-tx-order.ts <institution-code> --apply   # 実際に更新
//
// 例:  npx tsx scripts/fix-tx-order.ts smtb --apply

const dbUrl = process.env.DATABASE_URL ?? "file:./data/money.db";
const adapter = new PrismaBetterSqlite3({ url: dbUrl });
const prisma = new PrismaClient({ adapter });

type TxRow = {
  id: number;
  accountId: number;
  importId: number;
  occurredAt: Date;
  amount: number;
  balance: number | null;
  payee: string;
  memo: string | null;
  raw: string;
  rowHash: string;
  categoryId: number | null;
};

function dayKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

async function main() {
  const apply = process.argv.includes("--apply");
  const code = process.argv.find((a, i) => i >= 2 && !a.startsWith("--"));
  if (!code) {
    console.error("usage: npx tsx scripts/fix-tx-order.ts <institution-code> [--apply]");
    process.exit(1);
  }

  const inst = await prisma.institution.findFirst({ where: { code } });
  if (!inst) {
    console.log(`institution '${code}' not found`);
    return;
  }
  const accounts = await prisma.account.findMany({ where: { institutionId: inst.id } });

  let totalGroups = 0;
  let totalReversed = 0;
  let totalSkipped = 0;

  for (const acc of accounts) {
    const txs: TxRow[] = await prisma.transaction.findMany({
      where: { accountId: acc.id, balance: { not: null } },
      orderBy: [{ occurredAt: "asc" }, { id: "asc" }],
    });

    const groups = new Map<string, TxRow[]>();
    for (const t of txs) {
      const k = dayKey(t.occurredAt);
      const arr = groups.get(k) ?? [];
      arr.push(t);
      groups.set(k, arr);
    }

    for (const [day, rows] of groups) {
      if (rows.length < 2) continue;
      totalGroups++;

      // 現状 (id ASC) が時系列 DESC = 新→古 になっているか検証
      // rows[i] が rows[i+1] より新しい前提。
      // 直前 (時系列で先行) = rows[i+1]、直後 = rows[i]。
      //   rows[i+1].balance + rows[i].amount == rows[i].balance
      let chainOk = true;
      for (let i = 0; i < rows.length - 1; i++) {
        const later = rows[i];
        const earlier = rows[i + 1];
        if (later.balance == null || earlier.balance == null) {
          chainOk = false;
          break;
        }
        if (earlier.balance + later.amount !== later.balance) {
          chainOk = false;
          break;
        }
      }

      if (!chainOk) {
        // 既に時系列 ASC で入っている、または壊れているなど、reverse すべきか判定できない
        console.log(
          `[skip] account=${acc.id}(${acc.name}) ${day} rows=${rows.length}: balance chain not consistent with newest-first order`,
        );
        for (const r of rows) {
          console.log(`  id=${r.id} amount=${r.amount} balance=${r.balance} payee=${r.payee}`);
        }
        totalSkipped++;
        continue;
      }

      // id 順に content を reverse する。id と occurredAt は動かさない。
      const idsAsc = rows.map((r) => r.id);
      const contentReversed = [...rows].reverse();
      const plan: Array<{ id: number; from: TxRow; to: TxRow }> = idsAsc.map((id, i) => ({
        id,
        from: rows[i],
        to: contentReversed[i],
      }));

      console.log(`[fix ] account=${acc.id}(${acc.name}) ${day} rows=${rows.length}`);
      for (const p of plan) {
        console.log(
          `  id=${p.id}: amount ${p.from.amount}→${p.to.amount}  balance ${p.from.balance}→${p.to.balance}  payee "${p.from.payee}"→"${p.to.payee}"`,
        );
      }

      if (apply) {
        await prisma.$transaction(async (tx) => {
          // rowHash に UNIQUE 制約があるため 2 段階で更新する。
          for (const p of plan) {
            await tx.transaction.update({
              where: { id: p.id },
              data: { rowHash: `__tmp__${p.id}__${p.from.rowHash}` },
            });
          }
          for (const p of plan) {
            await tx.transaction.update({
              where: { id: p.id },
              data: {
                importId: p.to.importId,
                amount: p.to.amount,
                balance: p.to.balance,
                payee: p.to.payee,
                memo: p.to.memo,
                raw: p.to.raw,
                rowHash: p.to.rowHash,
                categoryId: p.to.categoryId,
              },
            });
          }
        });
      }

      totalReversed++;
    }
  }

  console.log("");
  console.log(`groups scanned  : ${totalGroups}`);
  console.log(`groups reversed : ${totalReversed}${apply ? "" : " (dry-run)"}`);
  console.log(`groups skipped  : ${totalSkipped}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
