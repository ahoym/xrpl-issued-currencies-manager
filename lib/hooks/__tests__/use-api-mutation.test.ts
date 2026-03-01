import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { useApiMutation } from "../use-api-mutation";

describe("useApiMutation", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("starts with loading=false and no error", () => {
    const { result } = renderHook(() => useApiMutation());

    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it("sends POST with JSON body and returns data on success", async () => {
    const responseData = { id: 1, name: "test" };
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(responseData),
    } as Response);

    const { result } = renderHook(() => useApiMutation<typeof responseData>());

    let mutateResult: typeof responseData | null = null;
    await act(async () => {
      mutateResult = await result.current.mutate("/api/create", {
        name: "test",
      });
    });

    expect(mutateResult).toEqual(responseData);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(globalThis.fetch).toHaveBeenCalledWith("/api/create", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "test" }),
    });
  });

  it("sets error from response on non-ok status", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: "Validation failed" }),
    } as Response);

    const { result } = renderHook(() => useApiMutation());

    let mutateResult: Record<string, unknown> | null;
    await act(async () => {
      mutateResult = await result.current.mutate("/api/create", {});
    });

    expect(mutateResult!).toBeNull();
    expect(result.current.error).toBe("Validation failed");
    expect(result.current.loading).toBe(false);
  });

  it("uses errorFallback when response has no error field", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({}),
    } as Response);

    const { result } = renderHook(() => useApiMutation());

    await act(async () => {
      await result.current.mutate("/api/create", {}, "Custom fallback");
    });

    expect(result.current.error).toBe("Custom fallback");
  });

  it("uses default fallback when no custom one provided", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({}),
    } as Response);

    const { result } = renderHook(() => useApiMutation());

    await act(async () => {
      await result.current.mutate("/api/create", {});
    });

    expect(result.current.error).toBe("Request failed");
  });

  it("sets 'Network error' on fetch rejection", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("ECONNREFUSED"));

    const { result } = renderHook(() => useApiMutation());

    await act(async () => {
      await result.current.mutate("/api/create", {});
    });

    expect(result.current.error).toBe("Network error");
    expect(result.current.loading).toBe(false);
  });

  it("clears error with clearError", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      json: () => Promise.resolve({ error: "oops" }),
    } as Response);

    const { result } = renderHook(() => useApiMutation());

    await act(async () => {
      await result.current.mutate("/api/create", {});
    });
    expect(result.current.error).toBe("oops");

    act(() => {
      result.current.clearError();
    });
    expect(result.current.error).toBeNull();
  });

  it("clears previous error on new mutate call", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: "first error" }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ success: true }),
      } as Response);

    const { result } = renderHook(() => useApiMutation());

    await act(async () => {
      await result.current.mutate("/api/create", {});
    });
    expect(result.current.error).toBe("first error");

    await act(async () => {
      await result.current.mutate("/api/create", {});
    });
    expect(result.current.error).toBeNull();
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });
});
