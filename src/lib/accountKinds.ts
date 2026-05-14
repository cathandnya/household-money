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
