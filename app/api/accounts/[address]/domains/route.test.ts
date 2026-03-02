import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getRequest,
  routeParams,
  TEST_WALLET,
  TEST_WALLET_2,
} from "@/lib/test-helpers";
import { encodeCredentialType } from "@/lib/xrpl/credentials";

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

describe("GET /api/accounts/[address]/domains", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 400 for invalid address", async () => {
    const request = getRequest("/api/accounts/bad/domains");
    const response = await GET(request, routeParams({ address: "bad" }));
    expect(response.status).toBe(400);
    const body = await response.json();
    expect(body.error).toContain("Invalid");
  });

  it("returns domains with decoded credential types on success", async () => {
    const domainID = "A".repeat(64);
    const credTypeHex = encodeCredentialType("KYC");

    mockClient.request.mockResolvedValue({
      result: {
        account_objects: [
          {
            index: domainID,
            Owner: TEST_WALLET.address,
            AcceptedCredentials: [
              {
                Credential: {
                  Issuer: TEST_WALLET_2.address,
                  CredentialType: credTypeHex,
                },
              },
            ],
            Sequence: 42,
          },
        ],
      },
    });

    const request = getRequest(`/api/accounts/${TEST_WALLET.address}/domains`);
    const response = await GET(
      request,
      routeParams({ address: TEST_WALLET.address }),
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.address).toBe(TEST_WALLET.address);
    expect(body.domains).toHaveLength(1);
    expect(body.domains[0]).toEqual({
      domainID,
      owner: TEST_WALLET.address,
      acceptedCredentials: [
        {
          issuer: TEST_WALLET_2.address,
          credentialType: "KYC",
        },
      ],
      sequence: 42,
    });
  });

  it("uses address as owner when Owner field is absent", async () => {
    const domainID = "B".repeat(64);
    mockClient.request.mockResolvedValue({
      result: {
        account_objects: [
          {
            index: domainID,
            AcceptedCredentials: [
              {
                Credential: {
                  Issuer: TEST_WALLET_2.address,
                  CredentialType: encodeCredentialType("AML"),
                },
              },
            ],
            Sequence: 1,
          },
        ],
      },
    });

    const request = getRequest(`/api/accounts/${TEST_WALLET.address}/domains`);
    const response = await GET(
      request,
      routeParams({ address: TEST_WALLET.address }),
    );
    const body = await response.json();
    expect(body.domains[0].owner).toBe(TEST_WALLET.address);
  });

  it("returns empty domains array when none exist", async () => {
    mockClient.request.mockResolvedValue({
      result: { account_objects: [] },
    });

    const request = getRequest(`/api/accounts/${TEST_WALLET.address}/domains`);
    const response = await GET(
      request,
      routeParams({ address: TEST_WALLET.address }),
    );
    const body = await response.json();
    expect(body.domains).toEqual([]);
  });

  it("returns 404 when account is not found", async () => {
    mockClient.request.mockRejectedValue(new Error("actNotFound"));

    const request = getRequest(`/api/accounts/${TEST_WALLET.address}/domains`);
    const response = await GET(
      request,
      routeParams({ address: TEST_WALLET.address }),
    );
    expect(response.status).toBe(404);
  });
});
