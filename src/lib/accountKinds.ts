// 口座種別 (Account.kind) の一覧とラベル。
// accounts ページや RuleEditDialog など複数箇所で参照するため共有する。
export const ACCOUNT_KIND_LABELS: Record<string, string> = {
  CHECKING: "普通預金",
  SAVINGS: "貯蓄預金",
  CREDIT_CARD: "クレジットカード",
  BROKERAGE: "証券総合口座",
  DC: "確定拠出年金",
  MANUAL: "手動入力",
};

export const ACCOUNT_KINDS = Object.keys(ACCOUNT_KIND_LABELS);

// 資産内訳の分類。ダッシュボードで口座種別 (Account.kind) をまとめる際に使う。
// CREDIT_CARD は資産ではないため総資産・内訳いずれからも除外する。
export type AssetGroup = "CASH" | "FUND" | "PENSION";

export const ASSET_GROUP_LABELS: Record<AssetGroup, string> = {
  CASH: "現金",
  FUND: "投資信託",
  PENSION: "年金",
};

// 内訳カードの表示順
export const ASSET_GROUP_ORDER: AssetGroup[] = ["CASH", "FUND", "PENSION"];

// 口座種別 → 資産グループ。ここに無い種別 (CREDIT_CARD 等) は資産集計の対象外。
const KIND_TO_ASSET_GROUP: Record<string, AssetGroup> = {
  CHECKING: "CASH",
  SAVINGS: "CASH",
  BROKERAGE: "FUND",
  MANUAL: "FUND",
  DC: "PENSION",
};

export function assetGroupOf(kind: string): AssetGroup | null {
  return KIND_TO_ASSET_GROUP[kind] ?? null;
}
