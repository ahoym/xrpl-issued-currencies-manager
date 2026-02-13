import type { NetworkId } from "./xrpl/networks";

/** Common asset/currency code constants used across the app. */
export const Assets = {
  XRP: "XRP",
  RLUSD: "RLUSD",
} as const;

/** Map of well-known currency codes to their issuer addresses, keyed by network. */
export const WELL_KNOWN_CURRENCIES: Record<NetworkId, Record<string, string>> = {
  testnet: {
    RLUSD: "rQhWct2fv4Vc4KRjRgMrxa8xPN9Zx9iLKV",
  },
  devnet: {},
};
