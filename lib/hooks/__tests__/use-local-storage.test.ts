import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useLocalStorage } from "../use-local-storage";

describe("useLocalStorage", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("returns initial value when nothing stored", () => {
    const { result } = renderHook(() => useLocalStorage("test-key", "default"));

    expect(result.current.value).toBe("default");
  });

  it("hydrates from localStorage on mount", async () => {
    localStorage.setItem("test-key", JSON.stringify("stored-value"));

    const { result } = renderHook(() => useLocalStorage("test-key", "default"));

    // After hydration effect runs
    await vi.waitFor(() => {
      expect(result.current.value).toBe("stored-value");
    });
    expect(result.current.hydrated).toBe(true);
  });

  it("persists value to localStorage on set", () => {
    const { result } = renderHook(() => useLocalStorage("test-key", "default"));

    act(() => {
      result.current.set("new-value");
    });

    expect(result.current.value).toBe("new-value");
    expect(JSON.parse(localStorage.getItem("test-key")!)).toBe("new-value");
  });

  it("supports functional updater", () => {
    const { result } = renderHook(() => useLocalStorage("count", 0));

    act(() => {
      result.current.set((prev) => prev + 1);
    });

    expect(result.current.value).toBe(1);
    expect(JSON.parse(localStorage.getItem("count")!)).toBe(1);
  });

  it("stores complex objects", () => {
    const initial = { items: [] as string[], count: 0 };
    const { result } = renderHook(() => useLocalStorage("obj-key", initial));

    const updated = { items: ["a", "b"], count: 2 };
    act(() => {
      result.current.set(updated);
    });

    expect(result.current.value).toEqual(updated);
    expect(JSON.parse(localStorage.getItem("obj-key")!)).toEqual(updated);
  });

  it("removes value and resets to initial", () => {
    localStorage.setItem("test-key", JSON.stringify("stored"));

    const { result } = renderHook(() => useLocalStorage("test-key", "default"));

    act(() => {
      result.current.remove();
    });

    expect(result.current.value).toBe("default");
    expect(localStorage.getItem("test-key")).toBeNull();
  });

  it("re-reads from localStorage when key changes", () => {
    localStorage.setItem("key-a", JSON.stringify("value-a"));
    localStorage.setItem("key-b", JSON.stringify("value-b"));

    const { result, rerender } = renderHook(
      ({ key }: { key: string }) => useLocalStorage(key, "default"),
      { initialProps: { key: "key-a" } },
    );

    expect(result.current.value).toBe("value-a");

    rerender({ key: "key-b" });

    expect(result.current.value).toBe("value-b");
  });

  it("returns initial value when stored JSON is corrupt", () => {
    localStorage.setItem("bad-key", "not-json{{{");

    const { result } = renderHook(() => useLocalStorage("bad-key", "fallback"));

    expect(result.current.value).toBe("fallback");
  });

  it("sets hydrated to true after mount", async () => {
    const { result } = renderHook(() => useLocalStorage("test-key", "default"));

    await vi.waitFor(() => {
      expect(result.current.hydrated).toBe(true);
    });
  });
});
