import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Node.js でしか動かないネイティブモジュールや、Worker を内部参照するパッケージは
  // バンドルせず Node の require で読み込ませる。
  serverExternalPackages: ["@prisma/adapter-better-sqlite3", "better-sqlite3"],
  allowedDevOrigins: process.env.ALLOWED_DEV_ORIGINS?.split(",").map((s) => s.trim()).filter(Boolean),
};

export default nextConfig;
