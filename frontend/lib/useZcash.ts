"use client";

import { useEffect } from "react";
import { useSyncExternalStore } from "react";
import { getVersion, initFromBackend, subscribe } from "./zcashService";

/**
 * Subscribe a component to the zcash service store and kick off the one-time
 * backend fetch on first mount. Returns a version token that increments on
 * every mutation so any component that calls useZcash() re-renders with fresh
 * cache data automatically.
 *
 * Usage:
 *   useZcash();                      // re-render on any store change
 *   const invoices = listInvoices(); // then read fresh data from the service
 */
export function useZcash(): number {
  useEffect(() => {
    initFromBackend();
  }, []);

  return useSyncExternalStore(
    subscribe,
    getVersion,
    () => 0 // server snapshot (deterministic)
  );
}
