-- CreateTable
CREATE TABLE "Institution" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "kind" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Account" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "institutionId" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'JPY',
    "kind" TEXT NOT NULL,
    "credentialRef" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Account_institutionId_fkey" FOREIGN KEY ("institutionId") REFERENCES "Institution" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Import" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "accountId" INTEGER NOT NULL,
    "fileName" TEXT NOT NULL,
    "fileHash" TEXT NOT NULL,
    "source" TEXT NOT NULL DEFAULT 'CSV',
    "importedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "rowCount" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OK',
    CONSTRAINT "Import_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Transaction" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "accountId" INTEGER NOT NULL,
    "importId" INTEGER NOT NULL,
    "occurredAt" DATETIME NOT NULL,
    "amount" INTEGER NOT NULL,
    "balance" INTEGER,
    "payee" TEXT NOT NULL,
    "memo" TEXT,
    "raw" TEXT NOT NULL,
    "rowHash" TEXT NOT NULL,
    "categoryId" INTEGER,
    CONSTRAINT "Transaction_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Transaction_importId_fkey" FOREIGN KEY ("importId") REFERENCES "Import" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Transaction_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SecurityTransaction" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "accountId" INTEGER NOT NULL,
    "importId" INTEGER NOT NULL,
    "tradedAt" DATETIME NOT NULL,
    "ticker" TEXT,
    "name" TEXT NOT NULL,
    "side" TEXT NOT NULL,
    "qty" REAL,
    "price" REAL,
    "amount" INTEGER NOT NULL,
    "fee" INTEGER,
    "raw" TEXT NOT NULL,
    "rowHash" TEXT NOT NULL,
    CONSTRAINT "SecurityTransaction_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "SecurityTransaction_importId_fkey" FOREIGN KEY ("importId") REFERENCES "Import" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "HoldingSnapshot" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "accountId" INTEGER NOT NULL,
    "importId" INTEGER NOT NULL,
    "snapshotDate" DATETIME NOT NULL,
    "sourceFile" TEXT NOT NULL,
    CONSTRAINT "HoldingSnapshot_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "Account" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "HoldingSnapshot_importId_fkey" FOREIGN KEY ("importId") REFERENCES "Import" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Holding" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "snapshotId" INTEGER NOT NULL,
    "ticker" TEXT,
    "name" TEXT NOT NULL,
    "qty" REAL NOT NULL,
    "avgCost" REAL,
    "marketValue" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'JPY',
    CONSTRAINT "Holding_snapshotId_fkey" FOREIGN KEY ("snapshotId") REFERENCES "HoldingSnapshot" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Category" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "name" TEXT NOT NULL,
    "parentId" INTEGER,
    "kind" TEXT NOT NULL,
    CONSTRAINT "Category_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Category" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Rule" (
    "id" INTEGER NOT NULL PRIMARY KEY AUTOINCREMENT,
    "priority" INTEGER NOT NULL DEFAULT 100,
    "pattern" TEXT NOT NULL,
    "isRegex" BOOLEAN NOT NULL DEFAULT false,
    "field" TEXT NOT NULL DEFAULT 'PAYEE',
    "accountKindFilter" TEXT,
    "categoryId" INTEGER NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "Rule_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Institution_code_key" ON "Institution"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Account_institutionId_name_key" ON "Account"("institutionId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "Import_fileHash_key" ON "Import"("fileHash");

-- CreateIndex
CREATE UNIQUE INDEX "Transaction_rowHash_key" ON "Transaction"("rowHash");

-- CreateIndex
CREATE INDEX "Transaction_accountId_occurredAt_idx" ON "Transaction"("accountId", "occurredAt");

-- CreateIndex
CREATE INDEX "Transaction_categoryId_idx" ON "Transaction"("categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "SecurityTransaction_rowHash_key" ON "SecurityTransaction"("rowHash");

-- CreateIndex
CREATE INDEX "SecurityTransaction_accountId_tradedAt_idx" ON "SecurityTransaction"("accountId", "tradedAt");

-- CreateIndex
CREATE UNIQUE INDEX "HoldingSnapshot_accountId_snapshotDate_key" ON "HoldingSnapshot"("accountId", "snapshotDate");

-- CreateIndex
CREATE UNIQUE INDEX "Category_name_key" ON "Category"("name");

-- CreateIndex
CREATE INDEX "Rule_priority_idx" ON "Rule"("priority");
