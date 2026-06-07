"use client";

import { useSyncExternalStore } from "react";
import { getVersion, subscribe } from "./zcashService";

/**
 * Subscribe a component to the zcash service store. Returns a version token
 * that changes on every mutation, forcing a re-read of service data after
 * actions like createInvoice / simulatePaymentReceived.
 *
 * Usage:
 *   useZcash();                      // re-render on any store change
 *   const invoices = listInvoices(); // then read fresh data from the service
 */
export function useZcash(): number {
  return useSyncExternalStore(
    subscribe,
    getVersion,
    () => 0 // server snapshot (deterministic)
  );
}
