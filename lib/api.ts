import type { ApiError } from "./xrpl/types";

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
 * Build a JSON error Response from a caught error.
 * When checkNotFound is true, returns 404 for XRPL "actNotFound" errors.
 */
export function apiErrorResponse(
  err: unknown,
  fallbackMessage: string,
  { checkNotFound = false } = {},
): Response {
  const message = err instanceof Error ? err.message : fallbackMessage;
  const status = checkNotFound && message.includes("actNotFound") ? 404 : 500;
  return Response.json({ error: message } satisfies ApiError, { status });
}
