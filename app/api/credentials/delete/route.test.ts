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

describe("POST /api/credentials/delete", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockClient.submitAndWait.mockResolvedValue(successTxResult());
  });

  it("returns 400 for missing seed and credentialType", async () => {
    const req = postRequest("/api/credentials/delete", {});
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain("Missing required fields");
    expect(body.error).toContain("seed");
    expect(body.error).toContain("credentialType");
  });

  it("returns 400 when neither subject nor issuer is provided", async () => {
    const req = postRequest("/api/credentials/delete", {
      seed: TEST_WALLET.seed,
      credentialType: "KYC" });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain("At least one of subject or issuer");
  });

  it("returns 400 for invalid seed", async () => {
    const req = postRequest("/api/credentials/delete", {
      seed: "bad-seed",
      credentialType: "KYC",
      subject: TEST_WALLET_2.address });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain("Invalid seed");
  });

  it("returns 201 on success with subject", async () => {
    const req = postRequest("/api/credentials/delete", {
      seed: TEST_WALLET.seed,
      credentialType: "KYC",
      subject: TEST_WALLET_2.address });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body).toHaveProperty("result");
    expect(mockClient.submitAndWait).toHaveBeenCalledWith(
      expect.objectContaining({
        TransactionType: "CredentialDelete",
        Account: TEST_WALLET.address,
        Subject: TEST_WALLET_2.address }),
      expect.any(Object),
    );
  });

  it("returns 201 on success with issuer", async () => {
    const req = postRequest("/api/credentials/delete", {
      seed: TEST_WALLET.seed,
      credentialType: "KYC",
      issuer: TEST_WALLET_2.address });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body).toHaveProperty("result");
    expect(mockClient.submitAndWait).toHaveBeenCalledWith(
      expect.objectContaining({
        TransactionType: "CredentialDelete",
        Account: TEST_WALLET.address,
        Issuer: TEST_WALLET_2.address }),
      expect.any(Object),
    );
  });

  it("returns 422 on transaction failure", async () => {
    mockClient.submitAndWait.mockResolvedValue(
      failedTxResult("tecNO_ENTRY"),
    );

    const req = postRequest("/api/credentials/delete", {
      seed: TEST_WALLET.seed,
      credentialType: "KYC",
      subject: TEST_WALLET_2.address });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(422);
    expect(body.error).toContain("tecNO_ENTRY");
  });
});
