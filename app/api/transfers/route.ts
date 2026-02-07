import { NextRequest } from "next/server";
import { Wallet, Payment } from "xrpl";
import { getClient } from "@/lib/xrpl/client";
import { resolveNetwork } from "@/lib/xrpl/networks";
import { encodeXrplCurrency } from "@/lib/xrpl/currency";
import type { TransferRequest, ApiError } from "@/lib/xrpl/types";

export async function POST(request: NextRequest) {
  try {
    const body: TransferRequest = await request.json();

    if (
      !body.senderSeed ||
      !body.recipientAddress ||
      !body.issuerAddress ||
      !body.currencyCode ||
      !body.amount
    ) {
      return Response.json(
        {
          error: "Missing required fields: senderSeed, recipientAddress, issuerAddress, currencyCode, amount",
        } satisfies ApiError,
        { status: 400 },
      );
    }

    const client = await getClient(resolveNetwork(body.network));
    const senderWallet = Wallet.fromSeed(body.senderSeed);

    const payment: Payment = {
      TransactionType: "Payment",
      Account: senderWallet.address,
      Destination: body.recipientAddress,
      Amount: {
        currency: encodeXrplCurrency(body.currencyCode),
        issuer: body.issuerAddress,
        value: body.amount,
      },
    };

    const result = await client.submitAndWait(payment, { wallet: senderWallet });

    return Response.json({
      result: result.result,
    }, { status: 201 });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to transfer currency";
    return Response.json({ error: message } satisfies ApiError, { status: 500 });
  }
}
