import { NextRequest } from "next/server";
import { Wallet, Payment } from "xrpl";
import { getClient } from "@/lib/xrpl/client";
import { resolveNetwork } from "@/lib/xrpl/networks";
import { encodeXrplCurrency } from "@/lib/xrpl/currency";
import { txFailureResponse, apiErrorResponse } from "@/lib/api";
import type { IssueCurrencyRequest, ApiError } from "@/lib/xrpl/types";

export async function POST(request: NextRequest) {
  try {
    const body: IssueCurrencyRequest = await request.json();

    if (!body.issuerSeed || !body.recipientAddress || !body.currencyCode || !body.amount) {
      return Response.json(
        { error: "Missing required fields: issuerSeed, recipientAddress, currencyCode, amount" } satisfies ApiError,
        { status: 400 },
      );
    }

    const client = await getClient(resolveNetwork(body.network));
    const issuerWallet = Wallet.fromSeed(body.issuerSeed);

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
