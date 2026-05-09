import "dotenv/config";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import { PrismaClient } from "../src/generated/prisma/client";

const dbUrl = process.env.DATABASE_URL ?? "file:../data/money.db";
const adapter = new PrismaBetterSqlite3({ url: dbUrl });
const prisma = new PrismaClient({ adapter });

const institutions = [
  { code: "shinsei", name: "SBI新生銀行", kind: "BANK" },
  { code: "rakuten_bank", name: "楽天銀行", kind: "BANK" },
  { code: "smtb", name: "三井住友信託銀行", kind: "BANK" },
  { code: "yucho", name: "ゆうちょ銀行", kind: "BANK" },
  { code: "smcc", name: "三井住友カード", kind: "CARD" },
  { code: "rakuten_card", name: "楽天カード", kind: "CARD" },
  { code: "rakuten_sec", name: "楽天証券", kind: "SECURITIES" },
  { code: "sbi_benefit", name: "SBIベネフィットシステムズ", kind: "DC" },
  { code: "resona", name: "りそな銀行", kind: "BANK" },
];

const categories: { name: string; kind: "EXPENSE" | "INCOME" | "TRANSFER" }[] = [
  { name: "食費", kind: "EXPENSE" },
  { name: "外食", kind: "EXPENSE" },
  { name: "日用品", kind: "EXPENSE" },
  { name: "交通", kind: "EXPENSE" },
  { name: "通信", kind: "EXPENSE" },
  { name: "光熱・水道", kind: "EXPENSE" },
  { name: "住居", kind: "EXPENSE" },
  { name: "趣味・娯楽", kind: "EXPENSE" },
  { name: "医療", kind: "EXPENSE" },
  { name: "保険", kind: "EXPENSE" },
  { name: "税・社会保険", kind: "EXPENSE" },
  { name: "クレジットカード引落", kind: "TRANSFER" },
  { name: "口座振替", kind: "TRANSFER" },
  { name: "ATM入出金", kind: "TRANSFER" },
  { name: "給与", kind: "INCOME" },
  { name: "賞与", kind: "INCOME" },
  { name: "配当", kind: "INCOME" },
  { name: "利息", kind: "INCOME" },
  { name: "その他収入", kind: "INCOME" },
  { name: "未分類", kind: "EXPENSE" },
];

async function main() {
  for (const inst of institutions) {
    await prisma.institution.upsert({
      where: { code: inst.code },
      update: { name: inst.name, kind: inst.kind },
      create: inst,
    });
  }
  for (const cat of categories) {
    await prisma.category.upsert({
      where: { name: cat.name },
      update: { kind: cat.kind },
      create: cat,
    });
  }
  console.log("seed: institutions=%d categories=%d", institutions.length, categories.length);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
