import type { ParserAdapter } from "./types";
import { rakutenBankAdapter } from "./rakutenBank";
import { shinseiAdapter } from "./shinsei";
import { yuchoAdapter } from "./yucho";
import { smtbAdapter } from "./smtb";
import { smccAdapter } from "./smcc";
import { rakutenCardAdapter } from "./rakutenCard";
import {
  rakutenSecTxAdapter,
  rakutenSecHoldingAdapter,
  rakutenSecJnisaAdapter,
} from "./rakutenSec";
import { sbiBenefitAdapter } from "./sbiBenefit";
import { resonaAdapter } from "./resona";

export const adapters: ParserAdapter[] = [
  rakutenBankAdapter,
  shinseiAdapter,
  yuchoAdapter,
  smtbAdapter,
  smccAdapter,
  rakutenCardAdapter,
  rakutenSecTxAdapter,
  rakutenSecHoldingAdapter,
  rakutenSecJnisaAdapter,
  sbiBenefitAdapter,
  resonaAdapter,
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
  rakuten_sec_jnisa: ["rakuten_sec_jnisa"],
  sbi_benefit: ["sbi_benefit"],
  resona: ["resona"],
};
