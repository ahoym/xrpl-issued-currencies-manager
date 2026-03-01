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

const validBody = {
  seed: TEST_WALLET.seed!,
  takerGets: { currency: "XRP", value: "100" },
  takerPays: { currency: "USD", issuer: TEST_WALLET_2.address, value: "50" } };

describe("POST /api/dex/offers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ---------------------------------------------------------------------------
  // Validation
  // ---------------------------------------------------------------------------

  it("returns 400 when seed is missing", async () => {
    const res = await POST(
      postRequest("/api/dex/offers", { takerGets: validBody.takerGets, takerPays: validBody.takerPays }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/seed/i);
  });

  it("returns 400 when takerGets is missing", async () => {
    const res = await POST(
      postRequest("/api/dex/offers", { seed: validBody.seed, takerPays: validBody.takerPays }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/takerGets/i);
  });

  it("returns 400 when takerPays is missing", async () => {
    const res = await POST(
      postRequest("/api/dex/offers", { seed: validBody.seed, takerGets: validBody.takerGets }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/takerPays/i);
  });

  it("returns 400 when takerGets.currency is missing", async () => {
    const res = await POST(
      postRequest("/api/dex/offers", {
        ...validBody,
        takerGets: { value: "100" } }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/takerGets must include currency and value/);
  });

  it("returns 400 when takerGets.value is missing", async () => {
    const res = await POST(
      postRequest("/api/dex/offers", {
        ...validBody,
        takerGets: { currency: "XRP" } }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/takerGets must include currency and value/);
  });

  it("returns 400 when takerPays.currency is missing", async () => {
    const res = await POST(
      postRequest("/api/dex/offers", {
        ...validBody,
        takerPays: { value: "50" } }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/takerPays must include currency and value/);
  });

  it("returns 400 when non-XRP takerGets has no issuer", async () => {
    const res = await POST(
      postRequest("/api/dex/offers", {
        ...validBody,
        takerGets: { currency: "USD", value: "100" } }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/takerGets\.issuer is required/);
  });

  it("returns 400 when non-XRP takerPays has no issuer", async () => {
    const res = await POST(
      postRequest("/api/dex/offers", {
        ...validBody,
        takerPays: { currency: "EUR", value: "50" } }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/takerPays\.issuer is required/);
  });

  it("returns 400 for invalid takerGets issuer address", async () => {
    const res = await POST(
      postRequest("/api/dex/offers", {
        ...validBody,
        takerGets: { currency: "USD", issuer: "notAnAddress", value: "100" } }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/invalid.*takerGets\.issuer/i);
  });

  it("returns 400 for invalid takerPays issuer address", async () => {
    const res = await POST(
      postRequest("/api/dex/offers", {
        ...validBody,
        takerPays: { currency: "USD", issuer: "notAnAddress", value: "50" } }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/invalid.*takerPays\.issuer/i);
  });

  it("returns 400 for non-positive takerGets.value", async () => {
    const res = await POST(
      postRequest("/api/dex/offers", {
        ...validBody,
        takerGets: { currency: "XRP", value: "0" } }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/takerGets\.value must be a positive number/);
  });

  it("returns 400 for non-positive takerPays.value", async () => {
    const res = await POST(
      postRequest("/api/dex/offers", {
        ...validBody,
        takerPays: { currency: "USD", issuer: TEST_WALLET_2.address, value: "-1" } }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/takerPays\.value must be a positive number/);
  });

  it("returns 400 for invalid expiration (not positive integer)", async () => {
    const res = await POST(
      postRequest("/api/dex/offers", { ...validBody, expiration: -5 }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/expiration must be a positive integer/);
  });

  it("returns 400 for invalid expiration (zero)", async () => {
    const res = await POST(
      postRequest("/api/dex/offers", { ...validBody, expiration: 0 }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/expiration must be a positive integer/);
  });

  it("returns 400 for invalid offerSequence (negative)", async () => {
    const res = await POST(
      postRequest("/api/dex/offers", { ...validBody, offerSequence: -1 }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/offerSequence must be a non-negative integer/);
  });

  it("returns 400 for invalid offerSequence (float)", async () => {
    const res = await POST(
      postRequest("/api/dex/offers", { ...validBody, offerSequence: 1.5 }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/offerSequence must be a non-negative integer/);
  });

  it("returns 400 for unknown offer flags", async () => {
    const res = await POST(
      postRequest("/api/dex/offers", {
        ...validBody,
        flags: ["badFlag"] }),
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toMatch(/Unknown offer flags.*badFlag/);
  });

  // ---------------------------------------------------------------------------
  // Success
  // ---------------------------------------------------------------------------

  it("returns 201 on successful offer creation (XRP/issued currency)", async () => {
    mockClient.submitAndWait.mockResolvedValueOnce(successTxResult());

    const res = await POST(postRequest("/api/dex/offers", validBody));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.result).toBeDefined();
    expect(body.result.meta.TransactionResult).toBe("tesSUCCESS");
  });

  it("passes offerSequence=0 as valid (non-negative)", async () => {
    mockClient.submitAndWait.mockResolvedValueOnce(successTxResult());

    const res = await POST(
      postRequest("/api/dex/offers", { ...validBody, offerSequence: 0 }),
    );
    expect(res.status).toBe(201);
  });

  it("passes valid flags through to transaction", async () => {
    mockClient.submitAndWait.mockResolvedValueOnce(successTxResult());

    const res = await POST(
      postRequest("/api/dex/offers", { ...validBody, flags: ["sell"] }),
    );
    expect(res.status).toBe(201);
    expect(mockClient.submitAndWait).toHaveBeenCalledWith(
      expect.objectContaining({ Flags: expect.any(Number) }),
      expect.any(Object),
    );
  });

  // ---------------------------------------------------------------------------
  // Transaction failure
  // ---------------------------------------------------------------------------

  it("returns 422 on transaction failure", async () => {
    mockClient.submitAndWait.mockResolvedValueOnce(
      failedTxResult("tecUNFUNDED_OFFER"),
    );

    const res = await POST(postRequest("/api/dex/offers", validBody));
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body.error).toMatch(/tecUNFUNDED_OFFER/);
  });
});
