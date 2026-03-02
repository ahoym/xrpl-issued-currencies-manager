import { vi, describe, it, expect, beforeEach } from "vitest";
import {
  postRequest,
  successTxResult,
  failedTxResult,
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

const VALID_DOMAIN_ID = "A".repeat(64);

describe("POST /api/domains/create", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Mock a successful submit that includes a CreatedNode for the domain
    mockClient.submitAndWait.mockResolvedValue({
      result: {
        meta: {
          TransactionResult: "tesSUCCESS",
          AffectedNodes: [
            {
              CreatedNode: {
                LedgerEntryType: "PermissionedDomain",
                LedgerIndex: VALID_DOMAIN_ID,
              },
            },
          ],
        },
      },
    });
  });

  it("returns 400 for missing seed", async () => {
    const req = postRequest("/api/domains/create", {});
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain("Missing required fields");
    expect(body.error).toContain("seed");
  });

  it("returns 400 for missing acceptedCredentials", async () => {
    const req = postRequest("/api/domains/create", {
      seed: TEST_WALLET.seed,
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain("acceptedCredentials");
    expect(body.error).toContain("at least");
  });

  it("returns 400 for empty acceptedCredentials array", async () => {
    const req = postRequest("/api/domains/create", {
      seed: TEST_WALLET.seed,
      acceptedCredentials: [],
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain("at least");
  });

  it("returns 400 for too many credentials (>10)", async () => {
    const creds = Array.from({ length: 11 }, () => ({
      issuer: TEST_WALLET_2.address,
      credentialType: "KYC",
    }));

    const req = postRequest("/api/domains/create", {
      seed: TEST_WALLET.seed,
      acceptedCredentials: creds,
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain("at most");
  });

  it("returns 400 for invalid issuer in acceptedCredentials", async () => {
    const req = postRequest("/api/domains/create", {
      seed: TEST_WALLET.seed,
      acceptedCredentials: [
        { issuer: "not-valid-address", credentialType: "KYC" },
      ],
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain("Invalid");
  });

  it("returns 201 on success and returns domainID", async () => {
    const req = postRequest("/api/domains/create", {
      seed: TEST_WALLET.seed,
      acceptedCredentials: [
        { issuer: TEST_WALLET_2.address, credentialType: "KYC" },
      ],
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(201);
    expect(body).toHaveProperty("result");
    expect(body.domainID).toBe(VALID_DOMAIN_ID);
    expect(mockClient.submitAndWait).toHaveBeenCalledWith(
      expect.objectContaining({
        TransactionType: "PermissionedDomainSet",
        Account: TEST_WALLET.address,
        AcceptedCredentials: expect.arrayContaining([
          expect.objectContaining({
            Credential: expect.objectContaining({
              Issuer: TEST_WALLET_2.address,
            }),
          }),
        ]),
      }),
      expect.any(Object),
    );
  });

  it("includes domainID in tx when updating existing domain", async () => {
    const req = postRequest("/api/domains/create", {
      seed: TEST_WALLET.seed,
      acceptedCredentials: [
        { issuer: TEST_WALLET_2.address, credentialType: "KYC" },
      ],
      domainID: VALID_DOMAIN_ID,
    });
    const res = await POST(req);

    expect(res.status).toBe(201);
    expect(mockClient.submitAndWait).toHaveBeenCalledWith(
      expect.objectContaining({
        DomainID: VALID_DOMAIN_ID,
      }),
      expect.any(Object),
    );
  });

  it("returns 422 on transaction failure", async () => {
    mockClient.submitAndWait.mockResolvedValue(
      failedTxResult("tecNO_PERMISSION"),
    );

    const req = postRequest("/api/domains/create", {
      seed: TEST_WALLET.seed,
      acceptedCredentials: [
        { issuer: TEST_WALLET_2.address, credentialType: "KYC" },
      ],
    });
    const res = await POST(req);
    const body = await res.json();

    expect(res.status).toBe(422);
    expect(body.error).toContain("tecNO_PERMISSION");
  });
});
