/**
 * Shared test utilities for vitest route handler and lib tests.
 * Provides mock XRPL clients, NextRequest factories, and stable test wallets.
 */
import { vi } from "vitest";
import { Wallet } from "xrpl";
import { NextRequest } from "next/server";

// ---------------------------------------------------------------------------
// Stable test wallets (generated once, reused across tests)
// ---------------------------------------------------------------------------

export const TEST_WALLET = Wallet.generate();
export const TEST_WALLET_2 = Wallet.generate();
export const TEST_WALLET_3 = Wallet.generate();

// ---------------------------------------------------------------------------
// Mock XRPL client factory
// ---------------------------------------------------------------------------

export function createMockClient(overrides: Record<string, unknown> = {}) {
  return {
    request: vi.fn(),
    submitAndWait: vi.fn(),
    fundWallet: vi.fn(),
    getOrderbook: vi.fn(),
    isConnected: vi.fn().mockReturnValue(true),
    connect: vi.fn(),
    disconnect: vi.fn(),
    ...overrides,
  };
}

/**
 * Standard mock for a successful submitAndWait result.
 */
export function successTxResult(extra: Record<string, unknown> = {}) {
  return {
    result: {
      meta: { TransactionResult: "tesSUCCESS" },
      ...extra,
    },
  };
}

/**
 * Standard mock for a failed submitAndWait result.
 */
export function failedTxResult(code: string) {
  return {
    result: {
      meta: { TransactionResult: code },
    },
  };
}

// ---------------------------------------------------------------------------
// NextRequest factories
// ---------------------------------------------------------------------------

/** Create a POST NextRequest with a JSON body. */
export function postRequest(path: string, body: unknown): NextRequest {
  return new NextRequest(new URL(path, "http://localhost:3000"), {
    method: "POST",
    body: JSON.stringify(body),
    headers: { "Content-Type": "application/json" },
  });
}

/** Create a GET NextRequest with optional query parameters. */
export function getRequest(
  path: string,
  params?: Record<string, string>,
): NextRequest {
  const url = new URL(path, "http://localhost:3000");
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      url.searchParams.set(k, v);
    }
  }
  return new NextRequest(url);
}

/** Create the `{ params }` second argument for dynamic route handlers. */
export function routeParams<T extends Record<string, string>>(values: T) {
  return { params: Promise.resolve(values) };
}
