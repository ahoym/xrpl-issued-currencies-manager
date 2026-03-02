import { vi, describe, it, expect, beforeEach } from "vitest";
import {
  postRequest,
  routeParams,
  TEST_WALLET,
} from "@/lib/test-helpers";

// The fund route uses fetch() to call the faucet directly (no getClient)
// We need to mock global fetch
const mockFetch = vi.fn();
vi.stubGlobal("fetch", mockFetch);

import { POST } from "./route";

describe("POST /api/accounts/[address]/fund", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns 400 for invalid address", async () => {
    const req = postRequest("/api/accounts/invalid-addr/fund", {});
    const res = await POST(req, routeParams({ address: "invalid-addr" }));
    const body = await res.json();

    expect(res.status).toBe(400);
    expect(body.error).toContain("Invalid");
  });

  it("returns 200 on successful fund", async () => {
    mockFetch.mockResolvedValue({
      ok: true,
      json: async () => ({
        account: { address: TEST_WALLET.address },
        amount: 1000,
      }),
    });

    const req = postRequest(`/api/accounts/${TEST_WALLET.address}/fund`, {});
    const res = await POST(
      req,
      routeParams({ address: TEST_WALLET.address }),
    );
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body.address).toBe(TEST_WALLET.address);
    expect(body.amount).toBe(1000);
  });

  it("returns 502 when faucet request fails", async () => {
    mockFetch.mockResolvedValue({
      ok: false,
      statusText: "Service Unavailable",
      text: async () => "faucet down",
    });

    const req = postRequest(`/api/accounts/${TEST_WALLET.address}/fund`, {});
    const res = await POST(
      req,
      routeParams({ address: TEST_WALLET.address }),
    );
    const body = await res.json();

    expect(res.status).toBe(502);
    expect(body.error).toContain("Faucet request failed");
  });
});
