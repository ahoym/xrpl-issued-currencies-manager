import { vi, describe, it, expect, beforeEach } from "vitest";
import {
  postRequest,
  successTxResult,
  TEST_WALLET,
  TEST_WALLET_2,
} from "@/lib/test-helpers";

const mockClient = vi.hoisted(() => ({
  request: vi.fn(),
  submitAndWait: vi.fn(),
  fundWallet: vi.fn(),
  getOrderbook: vi.fn(),
  isConnected: vi.fn().mockReturnValue(true),
  connect: vi.fn(),
  disconnect: vi.fn(),
}));
vi.mock("@/lib/xrpl/client", () => ({
  getClient: vi.fn().mockResolvedValue(mockClient),
}));

import { POST } from "./route";

describe("POST /api/credentials/create", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockClient.submitAndWait.mockResolvedValue(successTxResult());
  });

  it("returns 400 for missing required fields", async () => {
    const req = postRequest("/api/credentials/create", {
      seed: TEST_WALLET.seed,
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain("Missing required fields");
    expect(body.error).toContain("subject");
    expect(body.error).toContain("credentialType");
  });

  it("returns 400 for invalid subject address", async () => {
    const req = postRequest("/api/credentials/create", {
      seed: TEST_WALLET.seed,
      subject: "not-valid",
      credentialType: "KYC",
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain("Invalid subject address");
  });

  it("returns 400 for credential type too long (>128 chars)", async () => {
    const req = postRequest("/api/credentials/create", {
      seed: TEST_WALLET.seed,
      subject: TEST_WALLET_2.address,
      credentialType: "x".repeat(129),
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain("must not exceed");
  });

  it("returns 201 on success", async () => {
    const req = postRequest("/api/credentials/create", {
      seed: TEST_WALLET.seed,
      subject: TEST_WALLET_2.address,
      credentialType: "KYC",
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body).toHaveProperty("result");
    expect(mockClient.submitAndWait).toHaveBeenCalledWith(
      expect.objectContaining({
        TransactionType: "CredentialCreate",
        Account: TEST_WALLET.address,
        Subject: TEST_WALLET_2.address,
      }),
      expect.any(Object),
    );
  });

  it("includes expiration and URI when provided", async () => {
    const req = postRequest("/api/credentials/create", {
      seed: TEST_WALLET.seed,
      subject: TEST_WALLET_2.address,
      credentialType: "KYC",
      expiration: 800000000,
      uri: "https://example.com",
    });
    const res = await POST(req);

    expect(res.status).toBe(201);
    expect(mockClient.submitAndWait).toHaveBeenCalledWith(
      expect.objectContaining({
        TransactionType: "CredentialCreate",
        Expiration: 800000000,
        URI: expect.any(String),
      }),
      expect.any(Object),
    );
  });
});
