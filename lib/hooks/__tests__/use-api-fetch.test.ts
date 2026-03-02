import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useApiFetch } from "../use-api-fetch";

describe("useApiFetch", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function mockFetchOk(body: unknown) {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(body),
    } as Response);
  }

  function mockFetchError(status: number, body: { error?: string }) {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      status,
      json: () => Promise.resolve(body),
    } as Response);
  }

  function mockFetchNetworkError() {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("net down"));
  }

  it("returns empty data when buildUrl returns null", async () => {
    const { result } = renderHook(() =>
      useApiFetch<string>(
        () => null,
        (json) => (json.items as string[]) ?? [],
      ),
    );

    expect(result.current.data).toEqual([]);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("fetches data and extracts via extractData", async () => {
    mockFetchOk({ items: ["a", "b", "c"] });

    const { result } = renderHook(() =>
      useApiFetch<string>(
        () => "/api/test",
        (json) => (json.items as string[]) ?? [],
      ),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.data).toEqual(["a", "b", "c"]);
    expect(result.current.error).toBeNull();
    expect(globalThis.fetch).toHaveBeenCalledWith("/api/test");
  });

  it("sets error on non-ok response", async () => {
    mockFetchError(400, { error: "Bad Request" });

    const { result } = renderHook(() =>
      useApiFetch<string>(
        () => "/api/fail",
        (json) => (json.items as string[]) ?? [],
      ),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.data).toEqual([]);
    expect(result.current.error).toBe("Bad Request");
  });

  it("uses fallback error when server error has no message", async () => {
    mockFetchError(500, {});

    const { result } = renderHook(() =>
      useApiFetch<string>(
        () => "/api/fail",
        (json) => (json.items as string[]) ?? [],
      ),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe("Request failed");
  });

  it("sets error on network failure", async () => {
    mockFetchNetworkError();

    const { result } = renderHook(() =>
      useApiFetch<string>(
        () => "/api/down",
        (json) => (json.items as string[]) ?? [],
      ),
    );

    await waitFor(() => expect(result.current.loading).toBe(false));

    expect(result.current.error).toBe("net down");
  });

  it("re-fetches when refresh is called", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ items: ["first"] }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ items: ["second"] }),
      } as Response);

    const { result } = renderHook(() =>
      useApiFetch<string>(
        () => "/api/data",
        (json) => (json.items as string[]) ?? [],
      ),
    );

    await waitFor(() => expect(result.current.data).toEqual(["first"]));

    act(() => {
      result.current.refresh();
    });

    await waitFor(() => expect(result.current.data).toEqual(["second"]));
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("re-fetches when externalRefreshKey changes", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ items: ["v1"] }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ items: ["v2"] }),
      } as Response);

    const { result, rerender } = renderHook(
      ({ refreshKey }: { refreshKey: number }) =>
        useApiFetch<string>(
          () => "/api/data",
          (json) => (json.items as string[]) ?? [],
          refreshKey,
        ),
      { initialProps: { refreshKey: 0 } },
    );

    await waitFor(() => expect(result.current.data).toEqual(["v1"]));

    rerender({ refreshKey: 1 });

    await waitFor(() => expect(result.current.data).toEqual(["v2"]));
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("clears data when URL becomes null", async () => {
    mockFetchOk({ items: ["data"] });

    let url: string | null = "/api/data";
    const { result, rerender } = renderHook(() =>
      useApiFetch<string>(
        () => url,
        (json) => (json.items as string[]) ?? [],
      ),
    );

    await waitFor(() => expect(result.current.data).toEqual(["data"]));

    url = null;
    rerender();

    await waitFor(() => expect(result.current.data).toEqual([]));
  });
});
