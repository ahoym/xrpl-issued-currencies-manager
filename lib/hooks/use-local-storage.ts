"use client";

import { useState, useEffect, useCallback } from "react";

export function useLocalStorage<T>(key: string, initialValue: T) {
  const [value, setValue] = useState<T>(initialValue);
  const [hydrated, setHydrated] = useState(false);
  const [prevKey, setPrevKey] = useState(key);

  // Synchronously load stored data when key changes (avoids stale-render flicker)
  if (prevKey !== key) {
    setPrevKey(key);
    try {
      const stored = localStorage.getItem(key);
      setValue(stored ? JSON.parse(stored) : initialValue);
    } catch {
      setValue(initialValue);
    }
  }

  // Initial hydration from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(key);
      setValue(stored ? JSON.parse(stored) : initialValue);
    } catch {
      // localStorage unavailable or corrupt — keep initial value
    }
    setHydrated(true);
  // eslint-disable-next-line react-hooks/exhaustive-deps -- only run on initial mount for hydration
  }, []);

  const set = useCallback(
    (next: T | ((prev: T) => T)) => {
      setValue((prev) => {
        const resolved = next instanceof Function ? next(prev) : next;
        try {
          localStorage.setItem(key, JSON.stringify(resolved));
        } catch (err) {
          console.warn("localStorage setItem failed:", err);
        }
        return resolved;
      });
    },
    [key],
  );

  const remove = useCallback(() => {
    setValue(initialValue);
    try {
      localStorage.removeItem(key);
    } catch (err) {
      console.warn("localStorage removeItem failed:", err);
    }
  }, [key, initialValue]);

  return { value, set, remove, hydrated } as const;
}
