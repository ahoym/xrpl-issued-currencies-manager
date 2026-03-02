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

describe("POST /api/credentials/accept", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockClient.submitAndWait.mockResolvedValue(successTxResult());
  });

  it("returns 400 for missing required fields", async () => {
    const req = postRequest("/api/credentials/accept", {
      seed: TEST_WALLET.seed });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain("Missing required fields");
    expect(body.error).toContain("issuer");
    expect(body.error).toContain("credentialType");
  });

  it("returns 400 for invalid issuer address", async () => {
    const req = postRequest("/api/credentials/accept", {
      seed: TEST_WALLET.seed,
      issuer: "not-an-address",
      credentialType: "KYC" });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain("Invalid issuer address");
  });

  it("returns 400 for invalid seed", async () => {
    const req = postRequest("/api/credentials/accept", {
      seed: "bad-seed",
      issuer: TEST_WALLET_2.address,
      credentialType: "KYC" });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain("Invalid seed");
  });

  it("returns 400 for credential type too long", async () => {
    const req = postRequest("/api/credentials/accept", {
      seed: TEST_WALLET.seed,
      issuer: TEST_WALLET_2.address,
      credentialType: "x".repeat(129) });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain("must not exceed");
  });

  it("returns 201 on success", async () => {
    const req = postRequest("/api/credentials/accept", {
      seed: TEST_WALLET.seed,
      issuer: TEST_WALLET_2.address,
      credentialType: "KYC" });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body).toHaveProperty("result");
    expect(mockClient.submitAndWait).toHaveBeenCalledWith(
      expect.objectContaining({
        TransactionType: "CredentialAccept",
        Account: TEST_WALLET.address,
        Issuer: TEST_WALLET_2.address }),
      expect.any(Object),
    );
  });

  it("returns 422 on transaction failure", async () => {
    mockClient.submitAndWait.mockResolvedValue(
      failedTxResult("tecNO_ENTRY"),
    );

    const req = postRequest("/api/credentials/accept", {
      seed: TEST_WALLET.seed,
      issuer: TEST_WALLET_2.address,
      credentialType: "KYC" });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(422);
    expect(body.error).toContain("tecNO_ENTRY");
  });
});
