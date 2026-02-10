import { Assets } from "@/lib/assets";

export function buildDexAmount(
  currency: string,
  issuer: string | undefined,
  value: string,
) {
  if (currency === Assets.XRP) {
    return { currency: Assets.XRP, value };
  }
  return { currency, issuer, value };
}
