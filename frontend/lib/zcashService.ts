/**
 * lib/zcashService.ts
 *
 * The single service layer between the UI and the Rust backend.
 *
 * Architecture:
 *   - An in-memory cache is populated once from the backend on app load.
 *   - Read functions (getBusiness, listInvoices, …) are synchronous — they
 *     return from the cache so React renders stay fast.
 *   - Mutation functions (createInvoice, simulatePaymentReceived, …) are
 *     async — they POST to the backend, then refresh the cache and notify
 *     subscribers so every component re-renders with fresh data.
 */

import { api, AuthError } from "./api";
import { BRAND } from "./brand";
import type {
  AuthResponse,
  AuditorTx,
  Business,
  CreateCustomerInput,
  CreateInvoiceInput,
  Customer,
  DisclosurePack,
  Invoice,
  LoginInput,
  MonthlyPoint,
  PaymentRequest,
  PublicTx,
  RegisterInput,
  ReconResult,
  ShieldedBalance,
  UpdateCustomerInput,
  VerificationResult,
} from "./types";

/* -------------------------------------------------------------------------- */
/*  Constants re-exported for UI components                                   */
/* -------------------------------------------------------------------------- */

export const ZEC_TO_KES = 4200;
export const MEMO_MAX_BYTES = 512;

export function zecToKes(zec: number): number {
  return Math.round(zec * ZEC_TO_KES);
}

/** Build the encrypted memo content that embeds the invoice reference. */
export function buildMemo(invoiceId: string, customerName: string): string {
  return `${BRAND.name} • payment for ${invoiceId} • ${customerName}`;
}

/** Byte length of a memo string (UTF-8 aware). */
export function memoByteLength(memo: string): number {
  if (typeof TextEncoder !== "undefined")
    return new TextEncoder().encode(memo).length;
  return memo.length;
}

/* -------------------------------------------------------------------------- */
/*  Internal store                                                             */
/* -------------------------------------------------------------------------- */

interface CachedState {
  business: Business;
  customers: Customer[];
  invoices: Invoice[];
  packs: DisclosurePack[];
  balance: ShieldedBalance;
  monthly: MonthlyPoint[];
  publicLedger: PublicTx[];
  auditorLedger: AuditorTx[];
}

const EMPTY: CachedState = {
  business: { name: BRAND.name, email: "", taxPin: "", unifiedAddress: "" },
  customers: [],
  invoices: [],
  packs: [],
  balance: { zec: 0, kesEquivalent: 0 },
  monthly: [],
  publicLedger: [],
  auditorLedger: [],
};

let cache: CachedState = EMPTY;
let initPromise: Promise<void> | null = null;
let initialized = false;

const listeners = new Set<() => void>();
let version = 0;

function bump() {
  version++;
  listeners.forEach((l) => l());
}

export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getVersion(): number {
  return version;
}

/* -------------------------------------------------------------------------- */
/*  Initialisation                                                             */
/* -------------------------------------------------------------------------- */

/** Fetch all data from the backend once and populate the cache.
 *  Subsequent calls are no-ops until resetDemo() clears the flag. */
export async function initFromBackend(): Promise<void> {
  if (initialized) return;
  if (initPromise) return initPromise;

  initPromise = (async () => {
    try {
      const [
        business,
        customers,
        invoices,
        packs,
        balance,
        monthly,
        publicLedger,
        auditorLedger,
      ] = await Promise.all([
        api.getBusiness(),
        api.listCustomers(),
        api.listInvoices(),
        api.listDisclosurePacks(),
        api.getBalance(),
        api.getMonthlySummary(),
        api.getPublicLedger(),
        api.getAuditorLedger(),
      ]);
      cache = { business, customers, invoices, packs, balance, monthly, publicLedger, auditorLedger };
      initialized = true;
    } catch (err) {
      if (err instanceof AuthError) {
        api.logout();
        if (typeof window !== "undefined") window.location.replace("/login");
        return;
      }
      console.warn("Arelis: could not reach backend —", err);
    }
    bump();
  })();

  return initPromise;
}

/** Re-fetch everything from the backend. Called after every mutation. */
async function refreshAll(): Promise<void> {
  const [invoices, packs, balance, monthly, publicLedger, auditorLedger] =
    await Promise.all([
      api.listInvoices(),
      api.listDisclosurePacks(),
      api.getBalance(),
      api.getMonthlySummary(),
      api.getPublicLedger(),
      api.getAuditorLedger(),
    ]);
  cache = { ...cache, invoices, packs, balance, monthly, publicLedger, auditorLedger };
  bump();
}

/* -------------------------------------------------------------------------- */
/*  Synchronous reads (served from cache)                                     */
/* -------------------------------------------------------------------------- */

export function getBusiness(): Business {
  return cache.business;
}

export function listCustomers(): Customer[] {
  return cache.customers;
}

export function getCustomer(id: string): Customer | undefined {
  return cache.customers.find((c) => c.id === id);
}

export function listInvoices(): Invoice[] {
  return cache.invoices;
}

export function getInvoice(id: string): Invoice | undefined {
  return cache.invoices.find((i) => i.id === id);
}

/** Build the payment request synchronously from the cached invoice.
 *  The ZIP-321 URI is derived locally — no extra round trip needed. */
export function getPaymentRequest(invoiceId: string): PaymentRequest {
  const invoice = getInvoice(invoiceId);
  if (!invoice) throw new Error(`Unknown invoice ${invoiceId}`);

  const memo = invoice.memo;
  const memoParam = base64Utf8(memo);
  const paymentUri = `zcash:${invoice.unifiedAddress}?amount=${invoice.amountZec}&memo=${memoParam}`;

  return {
    unifiedAddress: invoice.unifiedAddress,
    memo,
    amountZec: invoice.amountZec,
    paymentUri,
  };
}

export function getAccountBalanceShielded(): ShieldedBalance {
  return cache.balance;
}

export function getMonthlySummary(): MonthlyPoint[] {
  return cache.monthly;
}

export function getPublicLedger(): PublicTx[] {
  return cache.publicLedger;
}

export function getAuditorLedger(): AuditorTx[] {
  return cache.auditorLedger;
}

export function listDisclosurePacks(): DisclosurePack[] {
  return cache.packs;
}

export function getDisclosurePack(id: string): DisclosurePack | undefined {
  return cache.packs.find((p) => p.id === id);
}

/* -------------------------------------------------------------------------- */
/*  Async mutations (call backend, then refresh cache)                        */
/* -------------------------------------------------------------------------- */

export async function createInvoice(input: CreateInvoiceInput): Promise<Invoice> {
  const invoice = await api.createInvoice(input);
  await refreshAll();
  return invoice;
}

export async function simulatePaymentReceived(invoiceId: string): Promise<void> {
  await api.simulatePayment(invoiceId);
  await refreshAll();
}

export async function reconcilePayments(): Promise<ReconResult[]> {
  const results = await api.reconcile();
  await refreshAll();
  return results;
}

export async function generateViewingKeyDisclosure(range: {
  start: string;
  end: string;
}): Promise<DisclosurePack> {
  const pack = await api.generateViewingKeyDisclosure(range);
  await refreshAll();
  return pack;
}

export async function generatePaymentDisclosurePack(
  invoiceIds: string[]
): Promise<DisclosurePack> {
  const pack = await api.generatePaymentDisclosurePack(invoiceIds);
  await refreshAll();
  return pack;
}

export async function verifyDisclosure(
  pack: DisclosurePack
): Promise<VerificationResult[]> {
  return api.verifyDisclosure(pack.id);
}

/** Re-fetch from the backend (replaces the old in-memory resetDemo). */
export async function resetDemo(): Promise<void> {
  initialized = false;
  initPromise = null;
  await initFromBackend();
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export async function register(input: RegisterInput): Promise<AuthResponse> {
  const result = await api.register(input);
  initialized = false;
  initPromise = null;
  await initFromBackend();
  return result;
}

export async function login(input: LoginInput): Promise<AuthResponse> {
  const result = await api.login(input);
  initialized = false;
  initPromise = null;
  await initFromBackend();
  return result;
}

export function logout(): void {
  api.logout();
  cache = EMPTY;
  initialized = false;
  initPromise = null;
  bump();
}

export { isLoggedIn } from "./api";

// ── Customer CRUD ─────────────────────────────────────────────────────────────

export async function createCustomer(input: CreateCustomerInput): Promise<Customer> {
  const customer = await api.createCustomer(input);
  cache = { ...cache, customers: [...cache.customers, customer].sort((a, b) => a.name.localeCompare(b.name)) };
  bump();
  return customer;
}

export async function updateCustomer(id: string, input: UpdateCustomerInput): Promise<Customer> {
  const updated = await api.updateCustomer(id, input);
  cache = { ...cache, customers: cache.customers.map((c) => (c.id === id ? updated : c)) };
  bump();
  return updated;
}

export async function deleteCustomer(id: string): Promise<void> {
  await api.deleteCustomer(id);
  cache = { ...cache, customers: cache.customers.filter((c) => c.id !== id) };
  bump();
}

/* -------------------------------------------------------------------------- */
/*  Helpers                                                                   */
/* -------------------------------------------------------------------------- */

function base64Utf8(input: string): string {
  const bytes =
    typeof TextEncoder !== "undefined"
      ? new TextEncoder().encode(input)
      : new Uint8Array(Array.from(input, (c) => c.charCodeAt(0) & 0xff));
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  if (typeof btoa !== "undefined") return btoa(binary);
  return Buffer.from(input, "utf-8").toString("base64");
}
