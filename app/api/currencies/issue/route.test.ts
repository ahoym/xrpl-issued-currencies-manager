import { vi, describe, it, expect, beforeEach } from "vitest";
import {
  postRequest,
  successTxResult,
  failedTxResult,
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

describe("POST /api/currencies/issue", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockClient.submitAndWait.mockResolvedValue(successTxResult());
    // Default: recipient has a matching trust line
    mockClient.request.mockResolvedValue({
      result: {
        lines: [
          {
            currency: "USD",
            account: TEST_WALLET.address,
            limit: "1000000" },
        ] } });
  });

  it("returns 400 for missing required fields", async () => {
    const req = postRequest("/api/currencies/issue", {
      issuerSeed: TEST_WALLET.seed });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain("Missing required fields");
  });

  it("returns 400 for invalid recipientAddress", async () => {
    const req = postRequest("/api/currencies/issue", {
      issuerSeed: TEST_WALLET.seed,
      recipientAddress: "not-valid",
      currencyCode: "USD",
      amount: "100" });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain("Invalid recipientAddress");
  });

  it("returns 400 for invalid amount (zero)", async () => {
    const req = postRequest("/api/currencies/issue", {
      issuerSeed: TEST_WALLET.seed,
      recipientAddress: TEST_WALLET_2.address,
      currencyCode: "USD",
      amount: "0" });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain("must be a positive number");
  });

  it("returns 400 for negative amount", async () => {
    const req = postRequest("/api/currencies/issue", {
      issuerSeed: TEST_WALLET.seed,
      recipientAddress: TEST_WALLET_2.address,
      currencyCode: "USD",
      amount: "-5" });
    const res = await POST(req);

    expect(res.status).toBe(400);
  });

  it("returns 400 when recipient has no trust line", async () => {
    mockClient.request.mockResolvedValue({
      result: { lines: [] } });

    const req = postRequest("/api/currencies/issue", {
      issuerSeed: TEST_WALLET.seed,
      recipientAddress: TEST_WALLET_2.address,
      currencyCode: "USD",
      amount: "100" });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain("does not have a trust line");
  });

  it("returns 201 on success", async () => {
    const req = postRequest("/api/currencies/issue", {
      issuerSeed: TEST_WALLET.seed,
      recipientAddress: TEST_WALLET_2.address,
      currencyCode: "USD",
      amount: "100" });
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

  it("returns 422 on transaction failure (tecPATH_DRY)", async () => {
    mockClient.submitAndWait.mockResolvedValue(
      failedTxResult("tecPATH_DRY"),
    );

    const req = postRequest("/api/currencies/issue", {
      issuerSeed: TEST_WALLET.seed,
      recipientAddress: TEST_WALLET_2.address,
      currencyCode: "USD",
      amount: "100" });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(422);
    expect(body.error).toContain("tecPATH_DRY");
  });
});
