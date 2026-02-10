import { useState, useEffect } from "react";
import { decodeCurrency } from "@/lib/xrpl/decode-currency-client";
import { LSF_DEFAULT_RIPPLE } from "@/lib/xrpl/constants";
import { Assets } from "@/lib/assets";
import type { BalanceEntry } from "@/lib/types";

interface TrustLineValidationParams {
  /** The selected balance entry to transfer (null when none selected). */
  selectedBalance: BalanceEntry | null;
  /** The destination address (empty string when none selected). */
  destinationAddress: string;
  /** Current XRPL network. */
  network: string;
  /** The sender's address (used to determine if sender is the issuer). */
  senderAddress: string;
}

interface TrustLineValidationResult {
  /** Whether the recipient has a matching trust line. null = not checked yet or N/A. */
  trustLineOk: boolean | null;
  /** Whether the async trust-line check is in progress. */
  checkingTrustLine: boolean;
  /** Whether the issuer has DefaultRipple enabled. null = not checked yet or N/A. */
  ripplingOk: boolean | null;
}

/**
 * Validates that the recipient has a trust line for the selected issued currency,
 * and that the issuer has rippling enabled (when the sender is not the issuer).
 *
 * For XRP transfers or burns (sending back to issuer), validation is skipped.
 */
export function useTrustLineValidation({
  selectedBalance,
  destinationAddress,
  network,
  senderAddress,
}: TrustLineValidationParams): TrustLineValidationResult {
  const [trustLineOk, setTrustLineOk] = useState<boolean | null>(null);
  const [checkingTrustLine, setCheckingTrustLine] = useState(false);
  const [ripplingOk, setRipplingOk] = useState<boolean | null>(null);

  useEffect(() => {
    if (
      !selectedBalance ||
      selectedBalance.currency === Assets.XRP ||
      !destinationAddress
    ) {
      setTrustLineOk(null);
      setRipplingOk(null);
      return;
    }

    // Sending back to the issuer (burn) — no trust line needed
    if (destinationAddress === selectedBalance.issuer) {
      setTrustLineOk(true);
      setRipplingOk(null);
      setCheckingTrustLine(false);
      return;
    }

    let cancelled = false;
    setCheckingTrustLine(true);
    setTrustLineOk(null);
    setRipplingOk(null);

    (async () => {
      try {
        const res = await fetch(
          `/api/accounts/${encodeURIComponent(destinationAddress)}/trustlines?network=${network}`,
        );
        if (!res.ok || cancelled) {
          if (!cancelled) setTrustLineOk(null);
          return;
        }
        const data = await res.json();
        const lines: { currency: string; account: string }[] =
          data.trustLines ?? [];
        const match = lines.some(
          (l) =>
            l.account === selectedBalance.issuer &&
            (l.currency === selectedBalance.currency ||
              // handle hex-encoded currency codes
              decodeCurrency(l.currency) === selectedBalance.currency),
        );
        if (!cancelled) setTrustLineOk(match);

        // If trust line exists and sender is not the issuer, check rippling
        if (
          match &&
          selectedBalance.issuer &&
          senderAddress !== selectedBalance.issuer
        ) {
          try {
            const issuerRes = await fetch(
              `/api/accounts/${encodeURIComponent(selectedBalance.issuer)}?network=${network}`,
            );
            if (issuerRes.ok && !cancelled) {
              const issuerData = await issuerRes.json();
              const flags: number = issuerData.account_data?.Flags ?? 0;
              if (!cancelled)
                setRipplingOk((flags & LSF_DEFAULT_RIPPLE) !== 0);
            }
          } catch {
            // non-fatal — leave as null
          }
        }
      } catch {
        if (!cancelled) setTrustLineOk(null);
      } finally {
        if (!cancelled) setCheckingTrustLine(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [selectedBalance, destinationAddress, network, senderAddress]);

  return { trustLineOk, checkingTrustLine, ripplingOk };
}
