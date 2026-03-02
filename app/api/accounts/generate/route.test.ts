import { vi, describe, it, expect, beforeEach } from "vitest";
import {
  postRequest,
  successTxResult,
  failedTxResult } from "@/lib/test-helpers";

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

describe("POST /api/accounts/generate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockClient.fundWallet.mockResolvedValue({ balance: 1000 });
    mockClient.submitAndWait.mockResolvedValue(successTxResult());
  });

  it("returns 201 with wallet info", async () => {
    const req = postRequest("/api/accounts/generate", {});
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body).toHaveProperty("address");
    expect(body).toHaveProperty("seed");
    expect(body).toHaveProperty("publicKey");
    expect(body).toHaveProperty("balance");
    expect(body.balance).toBe("1000");
    expect(mockClient.fundWallet).toHaveBeenCalledTimes(1);
  });

  it("enables DefaultRipple when isIssuer=true", async () => {
    const req = postRequest("/api/accounts/generate", { isIssuer: true });
    const res = await POST(req);

    expect(res.status).toBe(201);
    expect(mockClient.submitAndWait).toHaveBeenCalledTimes(1);
    expect(mockClient.submitAndWait).toHaveBeenCalledWith(
      expect.objectContaining({
        TransactionType: "AccountSet",
        SetFlag: expect.any(Number) }),
      expect.objectContaining({ wallet: expect.any(Object) }),
    );
  });

  it("does not call submitAndWait when isIssuer is false", async () => {
    const req = postRequest("/api/accounts/generate", { isIssuer: false });
    const res = await POST(req);

    expect(res.status).toBe(201);
    expect(mockClient.submitAndWait).not.toHaveBeenCalled();
  });

  it("returns 422 when DefaultRipple transaction fails", async () => {
    mockClient.submitAndWait.mockResolvedValue(
      failedTxResult("tecINTERNAL"),
    );
    const req = postRequest("/api/accounts/generate", { isIssuer: true });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(422);
    expect(body.error).toContain("Failed to enable DefaultRipple");
  });
});
