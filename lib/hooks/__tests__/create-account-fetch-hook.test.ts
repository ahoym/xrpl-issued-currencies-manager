import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { createAccountFetchHook } from "../create-account-fetch-hook";

describe("createAccountFetchHook", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("creates a hook that fetches from the correct URL", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ items: [{ id: 1 }, { id: 2 }] }),
    } as Response);

    const useItems = createAccountFetchHook<{ id: number }>("items", "items");

    const { result } = renderHook(() => useItems("rAddr123", "testnet"));

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.data).toEqual([{ id: 1 }, { id: 2 }]);
    expect(globalThis.fetch).toHaveBeenCalledWith(
      "/api/accounts/rAddr123/items?network=testnet",
    );
  });

  it("returns empty data when address is null", () => {
    const useItems = createAccountFetchHook<{ id: number }>("items", "items");

    const { result } = renderHook(() => useItems(null, "testnet"));

    expect(result.current.data).toEqual([]);
    expect(result.current.loading).toBe(false);
  });

  it("returns empty data when address is undefined", () => {
    const useItems = createAccountFetchHook<{ id: number }>("items", "items");

    const { result } = renderHook(() => useItems(undefined, "testnet"));

    expect(result.current.data).toEqual([]);
    expect(result.current.loading).toBe(false);
  });

  it("encodes the address in the URL", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ data: [] }),
    } as Response);

    const useItems = createAccountFetchHook<unknown>("path", "data");

    renderHook(() => useItems("addr/special&chars", "devnet"));

    await waitFor(() =>
      expect(globalThis.fetch).toHaveBeenCalledWith(
        "/api/accounts/addr%2Fspecial%26chars/path?network=devnet",
      ),
    );
  });

  it("extracts data from the specified JSON field", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: () =>
        Promise.resolve({
          trustLines: [{ currency: "USD" }],
          otherField: "ignored",
        }),
    } as Response);

    const useTL = createAccountFetchHook<{ currency: string }>(
      "trustlines",
      "trustLines",
    );

    const { result } = renderHook(() => useTL("rAddr", "testnet"));

    await waitFor(() =>
      expect(result.current.data).toEqual([{ currency: "USD" }]),
    );
  });
});
