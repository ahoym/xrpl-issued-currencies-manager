/**
 * Helper utilities for building XRPL AMM transaction objects.
 */

import type { Currency } from "xrpl";
import { Assets } from "@/lib/assets";
import { encodeXrplCurrency } from "./currency";

/**
 * Build XRPL Currency spec (no amount) for AMM Asset/Asset2 fields.
 * This constructs the identifier-only form needed in AMMCreate and AMMDeposit transactions.
 *
 * XRP → { currency: "XRP" }
 * Issued → { currency: "<encoded>", issuer: "rXXX" }
 */
export function buildCurrencySpec(
  asset: { currency: string; issuer?: string },
): Currency {
  if (asset.currency === Assets.XRP) {
    return { currency: "XRP" };
  }
  return {
    currency: encodeXrplCurrency(asset.currency),
    issuer: asset.issuer!,
  };
}
