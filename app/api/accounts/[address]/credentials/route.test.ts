import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getRequest,
  routeParams,
  TEST_WALLET,
  TEST_WALLET_2,
} from "@/lib/test-helpers";
import { encodeCredentialType } from "@/lib/xrpl/credentials";
import { LSF_ACCEPTED } from "@/lib/xrpl/constants";

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

import { GET } from "./route";

describe("GET /api/accounts/[address]/credentials", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 400 for invalid address", async () => {
    const request = getRequest("/api/accounts/bad/credentials");
    const response = await GET(request, routeParams({ address: "bad" }));
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toContain("Invalid");
  });

  it("returns decoded credentials on success", async () => {
    const credTypeHex = encodeCredentialType("KYC");
    mockClient.request.mockResolvedValue({
      result: {
        account_objects: [
          {
            Issuer: TEST_WALLET.address,
            Subject: TEST_WALLET_2.address,
            CredentialType: credTypeHex,
            Flags: LSF_ACCEPTED,
            Expiration: 780000000,
          },
        ],
      },
    });

    const request = getRequest(
      `/api/accounts/${TEST_WALLET.address}/credentials`,
    );
    const response = await GET(
      request,
      routeParams({ address: TEST_WALLET.address }),
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.address).toBe(TEST_WALLET.address);
    expect(body.credentials).toHaveLength(1);
    expect(body.credentials[0]).toMatchObject({
      issuer: TEST_WALLET.address,
      subject: TEST_WALLET_2.address,
      credentialType: "KYC",
      accepted: true,
      expiration: 780000000,
    });
  });

  it("decodes URI from hex when present", async () => {
    const uriHex = Buffer.from("https://example.com", "utf-8")
      .toString("hex")
      .toUpperCase();
    mockClient.request.mockResolvedValue({
      result: {
        account_objects: [
          {
            Issuer: TEST_WALLET.address,
            Subject: TEST_WALLET_2.address,
            CredentialType: encodeCredentialType("AML"),
            Flags: 0,
            URI: uriHex,
          },
        ],
      },
    });

    const request = getRequest(
      `/api/accounts/${TEST_WALLET.address}/credentials`,
    );
    const response = await GET(
      request,
      routeParams({ address: TEST_WALLET.address }),
    );
    const body = await response.json();
    expect(body.credentials[0].uri).toBe("https://example.com");
    expect(body.credentials[0].accepted).toBe(false);
  });

  it("filters by role=issuer", async () => {
    mockClient.request.mockResolvedValue({
      result: {
        account_objects: [
          {
            Issuer: TEST_WALLET.address,
            Subject: TEST_WALLET_2.address,
            CredentialType: encodeCredentialType("KYC"),
            Flags: 0,
          },
          {
            Issuer: TEST_WALLET_2.address,
            Subject: TEST_WALLET.address,
            CredentialType: encodeCredentialType("AML"),
            Flags: 0,
          },
        ],
      },
    });

    const request = getRequest(
      `/api/accounts/${TEST_WALLET.address}/credentials`,
      { role: "issuer" },
    );
    const response = await GET(
      request,
      routeParams({ address: TEST_WALLET.address }),
    );
    const body = await response.json();
    expect(body.credentials).toHaveLength(1);
    expect(body.credentials[0].credentialType).toBe("KYC");
  });

  it("filters by role=subject", async () => {
    mockClient.request.mockResolvedValue({
      result: {
        account_objects: [
          {
            Issuer: TEST_WALLET.address,
            Subject: TEST_WALLET_2.address,
            CredentialType: encodeCredentialType("KYC"),
            Flags: 0,
          },
          {
            Issuer: TEST_WALLET_2.address,
            Subject: TEST_WALLET.address,
            CredentialType: encodeCredentialType("AML"),
            Flags: 0,
          },
        ],
      },
    });

    const request = getRequest(
      `/api/accounts/${TEST_WALLET.address}/credentials`,
      { role: "subject" },
    );
    const response = await GET(
      request,
      routeParams({ address: TEST_WALLET.address }),
    );
    const body = await response.json();
    expect(body.credentials).toHaveLength(1);
    expect(body.credentials[0].credentialType).toBe("AML");
  });

  it("returns 404 when account is not found", async () => {
    mockClient.request.mockRejectedValue(new Error("actNotFound"));

    const request = getRequest(
      `/api/accounts/${TEST_WALLET.address}/credentials`,
    );
    const response = await GET(
      request,
      routeParams({ address: TEST_WALLET.address }),
    );
    expect(response.status).toBe(404);
  });
});
