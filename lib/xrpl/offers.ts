import { OfferCreateFlags } from "xrpl";
import type { OfferFlag } from "./types";

const FLAG_MAP: Record<OfferFlag, number> = {
  passive: OfferCreateFlags.tfPassive,
  immediateOrCancel: OfferCreateFlags.tfImmediateOrCancel,
  fillOrKill: OfferCreateFlags.tfFillOrKill,
  sell: OfferCreateFlags.tfSell,
  hybrid: OfferCreateFlags.tfHybrid,
};

export const VALID_OFFER_FLAGS = Object.keys(FLAG_MAP) as OfferFlag[];

export function resolveOfferFlags(flags?: OfferFlag[]): number | undefined {
  if (!flags || flags.length === 0) return undefined;
  return flags.reduce((acc, f) => acc | FLAG_MAP[f], 0);
}
