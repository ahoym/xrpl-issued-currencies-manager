import { NextRequest } from "next/server";
import { Payment } from "xrpl";
import { getClient } from "@/lib/xrpl/client";
import { resolveNetwork } from "@/lib/xrpl/networks";
import { encodeXrplCurrency } from "@/lib/xrpl/currency";
import { validateRequired, walletFromSeed, validateAddress, validatePositiveAmount, txFailureResponse, apiErrorResponse } from "@/lib/api";
import type { IssueCurrencyRequest, ApiError } from "@/lib/xrpl/types";

export async function POST(request: NextRequest) {
  try {
    const body: IssueCurrencyRequest = await request.json();

    const invalid = validateRequired(body as unknown as Record<string, unknown>, ["issuerSeed", "recipientAddress", "currencyCode", "amount"]);
    if (invalid) return invalid;

    const seedResult = walletFromSeed(body.issuerSeed);
    if ("error" in seedResult) return seedResult.error;
    const issuerWallet = seedResult.wallet;

    const badRecipient = validateAddress(body.recipientAddress, "recipientAddress");
    if (badRecipient) return badRecipient;

    const badAmount = validatePositiveAmount(body.amount, "amount");
    if (badAmount) return badAmount;

    const client = await getClient(resolveNetwork(body.network));

    // Verify recipient has a trust line to the issuer for this currency
    const accountLines = await client.request({
      command: "account_lines",
      account: body.recipientAddress,
      peer: issuerWallet.address,
      ledger_index: "validated",
    });

    const encoded = encodeXrplCurrency(body.currencyCode);
    const hasTrustLine = accountLines.result.lines.some(
      (line) => line.currency === encoded,
    );

    if (!hasTrustLine) {
      return Response.json(
        {
          error: `Recipient ${body.recipientAddress} does not have a trust line for ${body.currencyCode} issued by ${issuerWallet.address}`,
        } satisfies ApiError,
        { status: 400 },
      );
    }

    const payment: Payment = {
      TransactionType: "Payment",
      Account: issuerWallet.address,
      Destination: body.recipientAddress,
      Amount: {
        currency: encoded,
        issuer: issuerWallet.address,
        value: body.amount,
      },
    };

    const result = await client.submitAndWait(payment, { wallet: issuerWallet });

    const failure = txFailureResponse(result);
    if (failure) return failure;

    return Response.json({
      result: result.result,
    }, { status: 201 });
  } catch (err) {
    return apiErrorResponse(err, "Failed to issue currency");
  }
}
