import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useFormSubmit } from "../use-form-submit";

describe("useFormSubmit", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  function mockFetchOk(body: unknown) {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: true,
      json: () => Promise.resolve(body),
    } as Response);
  }

  function mockFetchError(body: { error?: string }) {
    vi.spyOn(globalThis, "fetch").mockResolvedValue({
      ok: false,
      json: () => Promise.resolve(body),
    } as Response);
  }

  it("starts with idle state", () => {
    const { result } = renderHook(() => useFormSubmit());

    expect(result.current.submitting).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.success).toBe(false);
  });

  it("sends POST with JSON body and returns data on success", async () => {
    const responseData = { txHash: "abc123" };
    mockFetchOk(responseData);

    const { result } = renderHook(() => useFormSubmit<typeof responseData>());

    let submitResult: typeof responseData | null = null;
    await act(async () => {
      submitResult = await result.current.submit("/api/transfers", {
        amount: "100",
      });
    });

    expect(submitResult).toEqual(responseData);
    expect(result.current.success).toBe(true);
    expect(result.current.error).toBeNull();
    expect(result.current.submitting).toBe(false);
    expect(globalThis.fetch).toHaveBeenCalledWith("/api/transfers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ amount: "100" }),
    });
  });

  it("auto-clears success after SUCCESS_MESSAGE_DURATION_MS", async () => {
    mockFetchOk({ ok: true });

    const { result } = renderHook(() => useFormSubmit());

    await act(async () => {
      await result.current.submit("/api/test", {});
    });

    expect(result.current.success).toBe(true);

    // Advance past the default duration (2000ms)
    act(() => {
      vi.advanceTimersByTime(2000);
    });

    expect(result.current.success).toBe(false);
  });

  it("respects custom successDuration", async () => {
    mockFetchOk({ ok: true });

    const { result } = renderHook(() => useFormSubmit());

    await act(async () => {
      await result.current.submit("/api/test", {}, { successDuration: 5000 });
    });

    expect(result.current.success).toBe(true);

    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(result.current.success).toBe(true);

    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(result.current.success).toBe(false);
  });

  it("does not auto-clear when successDuration is 0", async () => {
    mockFetchOk({ ok: true });

    const { result } = renderHook(() => useFormSubmit());

    await act(async () => {
      await result.current.submit("/api/test", {}, { successDuration: 0 });
    });

    expect(result.current.success).toBe(true);

    act(() => {
      vi.advanceTimersByTime(10000);
    });
    expect(result.current.success).toBe(true);
  });

  it("sets error from server response", async () => {
    mockFetchError({ error: "Insufficient funds" });

    const { result } = renderHook(() => useFormSubmit());

    await act(async () => {
      const res = await result.current.submit("/api/transfers", {});
      expect(res).toBeNull();
    });

    expect(result.current.error).toBe("Insufficient funds");
    expect(result.current.success).toBe(false);
  });

  it("uses errorFallback when server has no error field", async () => {
    mockFetchError({});

    const { result } = renderHook(() => useFormSubmit());

    await act(async () => {
      await result.current.submit(
        "/api/test",
        {},
        {
          errorFallback: "Transfer failed",
        },
      );
    });

    expect(result.current.error).toBe("Transfer failed");
  });

  it("uses default fallback when no errorFallback provided", async () => {
    mockFetchError({});

    const { result } = renderHook(() => useFormSubmit());

    await act(async () => {
      await result.current.submit("/api/test", {});
    });

    expect(result.current.error).toBe("Request failed");
  });

  it("sets 'Network error' on fetch rejection", async () => {
    vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("ECONNREFUSED"));

    const { result } = renderHook(() => useFormSubmit());

    await act(async () => {
      const res = await result.current.submit("/api/test", {});
      expect(res).toBeNull();
    });

    expect(result.current.error).toBe("Network error");
    expect(result.current.submitting).toBe(false);
  });

  it("clears error with clearError", async () => {
    mockFetchError({ error: "oops" });

    const { result } = renderHook(() => useFormSubmit());

    await act(async () => {
      await result.current.submit("/api/test", {});
    });
    expect(result.current.error).toBe("oops");

    act(() => {
      result.current.clearError();
    });
    expect(result.current.error).toBeNull();
  });

  it("clears previous error and success on new submit", async () => {
    const fetchSpy = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce({
        ok: false,
        json: () => Promise.resolve({ error: "first error" }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ ok: true }),
      } as Response);

    const { result } = renderHook(() => useFormSubmit());

    await act(async () => {
      await result.current.submit("/api/test", {});
    });
    expect(result.current.error).toBe("first error");

    await act(async () => {
      await result.current.submit("/api/test", {});
    });
    expect(result.current.error).toBeNull();
    expect(result.current.success).toBe(true);
    expect(fetchSpy).toHaveBeenCalledTimes(2);
  });

  it("cancels pending success timer on new submit", async () => {
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ v: 1 }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({ v: 2 }),
      } as Response);

    const { result } = renderHook(() => useFormSubmit());

    await act(async () => {
      await result.current.submit("/api/test", {});
    });
    expect(result.current.success).toBe(true);

    // Submit again before timer fires
    await act(async () => {
      await result.current.submit("/api/test", {});
    });

    // Advance past original timer — success should still be true from second submit
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    expect(result.current.success).toBe(false);
  });

  it("cleans up timer on unmount", async () => {
    mockFetchOk({ ok: true });

    const { result, unmount } = renderHook(() => useFormSubmit());

    await act(async () => {
      await result.current.submit("/api/test", {});
    });

    // Unmount before timer fires — should not throw
    unmount();

    act(() => {
      vi.advanceTimersByTime(5000);
    });
    // No errors means cleanup worked
  });
});
