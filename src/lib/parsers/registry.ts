import type { ParserAdapter } from "./types";
import { rakutenBankAdapter } from "./rakutenBank";
import { shinseiAdapter } from "./shinsei";
import { yuchoAdapter } from "./yucho";
import { smtbAdapter } from "./smtb";
import { smccAdapter } from "./smcc";
import { rakutenCardAdapter } from "./rakutenCard";
import { rakutenSecTxAdapter, rakutenSecHoldingAdapter } from "./rakutenSec";
import { sbiBenefitAdapter } from "./sbiBenefit";

export const adapters: ParserAdapter[] = [
  rakutenBankAdapter,
  shinseiAdapter,
  yuchoAdapter,
  smtbAdapter,
  smccAdapter,
  rakutenCardAdapter,
  rakutenSecTxAdapter,
  rakutenSecHoldingAdapter,
  sbiBenefitAdapter,
];

export function getAdapter(code: string): ParserAdapter | undefined {
  return adapters.find((a) => a.code === code);
}

// institution code → 紐づくアダプタ候補
export const institutionAdapterMap: Record<string, string[]> = {
  shinsei: ["shinsei"],
  rakuten_bank: ["rakuten_bank"],
  smtb: ["smtb"],
  yucho: ["yucho"],
  smcc: ["smcc"],
  rakuten_card: ["rakuten_card"],
  rakuten_sec: ["rakuten_sec_tx", "rakuten_sec_holding"],
  sbi_benefit: ["sbi_benefit"],
};
