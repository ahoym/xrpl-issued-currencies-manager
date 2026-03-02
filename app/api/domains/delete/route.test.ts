import { vi, describe, it, expect, beforeEach } from "vitest";
import {
  postRequest,
  successTxResult,
  failedTxResult,
  TEST_WALLET } from "@/lib/test-helpers";

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

const VALID_DOMAIN_ID = "A".repeat(64);

describe("POST /api/domains/delete", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockClient.submitAndWait.mockResolvedValue(successTxResult());
  });

  it("returns 400 for missing required fields", async () => {
    const req = postRequest("/api/domains/delete", {});
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain("Missing required fields");
    expect(body.error).toContain("seed");
    expect(body.error).toContain("domainID");
  });

  it("returns 400 for invalid domainID format (not 64-char hex)", async () => {
    const req = postRequest("/api/domains/delete", {
      seed: TEST_WALLET.seed,
      domainID: "too-short" });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain("64-character hex");
  });

  it("returns 400 for domainID with non-hex characters", async () => {
    const req = postRequest("/api/domains/delete", {
      seed: TEST_WALLET.seed,
      domainID: "G".repeat(64), // G is not valid hex
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain("64-character hex");
  });

  it("returns 400 for invalid seed", async () => {
    const req = postRequest("/api/domains/delete", {
      seed: "bad-seed",
      domainID: VALID_DOMAIN_ID });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain("Invalid seed");
  });

  it("returns 201 on success", async () => {
    const req = postRequest("/api/domains/delete", {
      seed: TEST_WALLET.seed,
      domainID: VALID_DOMAIN_ID });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body).toHaveProperty("result");
    expect(mockClient.submitAndWait).toHaveBeenCalledWith(
      expect.objectContaining({
        TransactionType: "PermissionedDomainDelete",
        Account: TEST_WALLET.address,
        DomainID: VALID_DOMAIN_ID }),
      expect.any(Object),
    );
  });

  it("returns 422 on transaction failure", async () => {
    mockClient.submitAndWait.mockResolvedValue(
      failedTxResult("tecNO_ENTRY"),
    );

    const req = postRequest("/api/domains/delete", {
      seed: TEST_WALLET.seed,
      domainID: VALID_DOMAIN_ID });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(422);
    expect(body.error).toContain("tecNO_ENTRY");
  });
});
