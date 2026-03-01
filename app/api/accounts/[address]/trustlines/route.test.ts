import { vi, describe, it, expect, beforeEach } from "vitest";
import {
  postRequest,
  successTxResult,
  failedTxResult,
  routeParams,
  TEST_WALLET,
  TEST_WALLET_2 } from "@/lib/test-helpers";

const mockClient = vi.hoisted(() => ({
  request: vi.fn(),
  submitAndWait: vi.fn(),
  fundWallet: vi.fn(),
  getOrderbook: vi.fn(),
  isConnected: vi.fn().mockReturnValue(true),
  connect: vi.fn(),
  disconnect: vi.fn() }));
vi.mock("@/lib/xrpl/client", () => ({
  getClient: vi.fn().mockResolvedValue(mockClient) }));

import { POST } from "./route";

describe("POST /api/accounts/[address]/trustlines", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockClient.submitAndWait.mockResolvedValue(successTxResult());
  });

  it("returns 400 for missing required fields", async () => {
    const req = postRequest(
      `/api/accounts/${TEST_WALLET.address}/trustlines`,
      { seed: TEST_WALLET.seed },
    );
    const res = await POST(
      req,
      routeParams({ address: TEST_WALLET.address }),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain("Missing required fields");
    expect(body.error).toContain("currency");
    expect(body.error).toContain("issuer");
    expect(body.error).toContain("limit");
  });

  it("returns 400 for invalid seed", async () => {
    const req = postRequest(
      `/api/accounts/${TEST_WALLET.address}/trustlines`,
      {
        seed: "bad-seed",
        currency: "USD",
        issuer: TEST_WALLET_2.address,
        limit: "1000" },
    );
    const res = await POST(
      req,
      routeParams({ address: TEST_WALLET.address }),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain("Invalid seed");
  });

  it("returns 400 when seed does not match address param", async () => {
    const req = postRequest(
      `/api/accounts/${TEST_WALLET_2.address}/trustlines`,
      {
        seed: TEST_WALLET.seed,
        currency: "USD",
        issuer: TEST_WALLET_2.address,
        limit: "1000" },
    );
    const res = await POST(
      req,
      routeParams({ address: TEST_WALLET_2.address }),
    );
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain("does not match");
  });

  it("returns 201 on success", async () => {
    const req = postRequest(
      `/api/accounts/${TEST_WALLET.address}/trustlines`,
      {
        seed: TEST_WALLET.seed,
        currency: "USD",
        issuer: TEST_WALLET_2.address,
        limit: "1000" },
    );
    const res = await POST(
      req,
      routeParams({ address: TEST_WALLET.address }),
    );
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body).toHaveProperty("result");
    expect(mockClient.submitAndWait).toHaveBeenCalledWith(
      expect.objectContaining({
        TransactionType: "TrustSet",
        Account: TEST_WALLET.address }),
      expect.objectContaining({ wallet: expect.any(Object) }),
    );
  });

  it("returns 422 on transaction failure", async () => {
    mockClient.submitAndWait.mockResolvedValue(
      failedTxResult("tecNO_DST"),
    );
    const req = postRequest(
      `/api/accounts/${TEST_WALLET.address}/trustlines`,
      {
        seed: TEST_WALLET.seed,
        currency: "USD",
        issuer: TEST_WALLET_2.address,
        limit: "1000" },
    );
    const res = await POST(
      req,
      routeParams({ address: TEST_WALLET.address }),
    );
    const body = await res.json();

    expect(res.status).toBe(422);
    expect(body.error).toContain("tecNO_DST");
  });
});
