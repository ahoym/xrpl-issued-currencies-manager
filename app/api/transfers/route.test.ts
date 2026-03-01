import { vi, describe, it, expect, beforeEach } from "vitest";
import {
  postRequest,
  successTxResult,
  failedTxResult,
  TEST_WALLET,
  TEST_WALLET_2,
  TEST_WALLET_3 } from "@/lib/test-helpers";

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

describe("POST /api/transfers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockClient.submitAndWait.mockResolvedValue(successTxResult());
  });

  it("returns 400 for missing required fields", async () => {
    const req = postRequest("/api/transfers", {
      senderSeed: TEST_WALLET.seed });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain("Missing required fields");
  });

  it("returns 400 for invalid recipientAddress", async () => {
    const req = postRequest("/api/transfers", {
      senderSeed: TEST_WALLET.seed,
      recipientAddress: "invalid",
      currencyCode: "XRP",
      amount: "10" });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain("Invalid recipientAddress");
  });

  it("returns 400 for non-XRP without issuerAddress", async () => {
    const req = postRequest("/api/transfers", {
      senderSeed: TEST_WALLET.seed,
      recipientAddress: TEST_WALLET_2.address,
      currencyCode: "USD",
      amount: "100" });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain("issuerAddress is required");
  });

  it("returns 201 on success for XRP transfer", async () => {
    const req = postRequest("/api/transfers", {
      senderSeed: TEST_WALLET.seed,
      recipientAddress: TEST_WALLET_2.address,
      currencyCode: "XRP",
      amount: "10" });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body).toHaveProperty("result");
    expect(mockClient.submitAndWait).toHaveBeenCalledWith(
      expect.objectContaining({
        TransactionType: "Payment",
        Account: TEST_WALLET.address,
        Destination: TEST_WALLET_2.address }),
      expect.any(Object),
    );
  });

  it("returns 201 on success for issued currency transfer", async () => {
    const req = postRequest("/api/transfers", {
      senderSeed: TEST_WALLET.seed,
      recipientAddress: TEST_WALLET_2.address,
      currencyCode: "USD",
      amount: "100",
      issuerAddress: TEST_WALLET_3.address });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body).toHaveProperty("result");
  });

  it("returns 400 with friendly message on tecPATH_DRY", async () => {
    mockClient.submitAndWait.mockResolvedValue(
      failedTxResult("tecPATH_DRY"),
    );

    const req = postRequest("/api/transfers", {
      senderSeed: TEST_WALLET.seed,
      recipientAddress: TEST_WALLET_2.address,
      currencyCode: "XRP",
      amount: "10" });
    const res = await POST(req);
    const body = await res.json();

    // Transfer route uses inline tecMessages map and returns 400, not 422
    expect(res.status).toBe(400);
    expect(body.error).toContain("tecPATH_DRY");
    expect(body.error).toContain("No payment path found");
  });

  it("returns 400 with friendly message for tecUNFUNDED_PAYMENT", async () => {
    mockClient.submitAndWait.mockResolvedValue(
      failedTxResult("tecUNFUNDED_PAYMENT"),
    );

    const req = postRequest("/api/transfers", {
      senderSeed: TEST_WALLET.seed,
      recipientAddress: TEST_WALLET_2.address,
      currencyCode: "XRP",
      amount: "10" });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain("does not have enough balance");
  });
});
