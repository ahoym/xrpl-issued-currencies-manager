import type { NextRequest } from "next/server";
import type { TxResponse } from "xrpl";
import type { ApiError } from "./xrpl/types";

// ---------------------------------------------------------------------------
// Request helpers
// ---------------------------------------------------------------------------

/** Extract the optional `network` query param from a NextRequest. */
export function getNetworkParam(request: NextRequest): string | undefined {
  return request.nextUrl.searchParams.get("network") ?? undefined;
}

/**
 * Validate that all `fields` are truthy on `data`.
 * Returns a 400 Response listing missing fields, or null if all present.
 */
export function validateRequired(
  data: Record<string, unknown>,
  fields: string[],
): Response | null {
  const missing = fields.filter((f) => !data[f]);
  if (missing.length > 0) {
    return Response.json(
      { error: `Missing required fields: ${missing.join(", ")}` } satisfies ApiError,
      { status: 400 },
    );
  }
  return null;
}

// ---------------------------------------------------------------------------
// Transaction result helpers
// ---------------------------------------------------------------------------

/**
 * Extract the TransactionResult string from an XRPL submit response's meta.
 * Returns undefined if meta is missing or not in the expected shape.
 */
export function getTransactionResult(meta: unknown): string | undefined {
  if (typeof meta === "object" && meta !== null && "TransactionResult" in meta) {
    const value = (meta as Record<string, unknown>).TransactionResult;
    return typeof value === "string" ? value : undefined;
  }
  return undefined;
}

/**
 * Return a 422 error Response if the transaction failed, or null on success.
 * Replaces the common 5-line result-check pattern in API routes.
 */
export function txFailureResponse(result: TxResponse): Response | null {
  const txResult = getTransactionResult(result.result.meta);
  if (txResult && txResult !== "tesSUCCESS") {
    return Response.json(
      { error: `Transaction failed: ${txResult}`, result: result.result },
      { status: 422 },
    );
  }
  return null;
}

/**
 * Build a JSON error Response from a caught error.
 * When checkNotFound is true, returns 404 for XRPL "actNotFound" errors.
 */
export function apiErrorResponse(
  err: unknown,
  fallbackMessage: string,
  { checkNotFound = false } = {},
): Response {
  const message = process.env.NODE_ENV === "production" || !(err instanceof Error)
    ? fallbackMessage
    : err.message;
  const status = checkNotFound && message.includes("actNotFound") ? 404 : 500;
  return Response.json({ error: message } satisfies ApiError, { status });
}
