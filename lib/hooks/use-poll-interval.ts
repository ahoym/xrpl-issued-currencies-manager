"use client";

import { useEffect, useRef } from "react";
import { usePageVisible } from "./use-page-visible";

/**
 * Calls `callback` every `intervalMs` milliseconds when `enabled` is true
 * and the page tab is visible. Uses a ref-based in-flight guard to prevent
 * overlapping async calls.
 *
 * Does NOT trigger an initial call — only periodic ticks.
 */
export function usePollInterval(
  callback: () => Promise<void> | void,
  intervalMs: number,
  enabled: boolean,
) {
  const pageVisible = usePageVisible();
  const callbackRef = useRef(callback);
  const inFlightRef = useRef(false);

  // Always keep callbackRef current so the interval calls the latest
  // callback without restarting.
  useEffect(() => {
    callbackRef.current = callback;
  });

  useEffect(() => {
    // Reset the in-flight guard when the interval restarts.
    inFlightRef.current = false;

    if (!enabled || !pageVisible) return;

    const id = setInterval(() => {
      if (inFlightRef.current) return;
      inFlightRef.current = true;
      Promise.resolve(callbackRef.current()).finally(() => {
        inFlightRef.current = false;
      });
    }, intervalMs);

    return () => clearInterval(id);
  }, [intervalMs, enabled, pageVisible]);
}
