/**
 * lib/api.ts
 * Raw async fetch wrappers for every backend endpoint.
 * All authenticated requests automatically attach the stored JWT.
 */

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

const BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8081";

// ── Token storage ─────────────────────────────────────────────────────────────

const TOKEN_KEY = "arelis_token";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

export function isLoggedIn(): boolean {
  return getToken() !== null;
}

// ── HTTP helpers ──────────────────────────────────────────────────────────────

function authHeaders(extra?: Record<string, string>): Record<string, string> {
  const token = getToken();
  return {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: authHeaders(),
    cache: "no-store",
  });
  if (res.status === 401) throw new AuthError();
  if (!res.ok) throw new Error(`GET ${path} → HTTP ${res.status}`);
  return res.json() as Promise<T>;
}

async function post<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "POST",
    headers: authHeaders(body !== undefined ? { "Content-Type": "application/json" } : {}),
    body: body !== undefined ? JSON.stringify(body) : undefined,
    cache: "no-store",
  });
  if (res.status === 401) throw new AuthError();
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "unknown error" }));
    throw new Error((err as { error: string }).error ?? `POST ${path} → HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

async function put<T>(path: string, body: unknown): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    method: "PUT",
    headers: authHeaders({ "Content-Type": "application/json" }),
    body: JSON.stringify(body),
    cache: "no-store",
  });
  if (res.status === 401) throw new AuthError();
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: "unknown error" }));
    throw new Error((err as { error: string }).error ?? `PUT ${path} → HTTP ${res.status}`);
  }
  return res.json() as Promise<T>;
}

async function del(path: string): Promise<void> {
  const res = await fetch(`${BASE}${path}`, {
    method: "DELETE",
    headers: authHeaders(),
    cache: "no-store",
  });
  if (res.status === 401) throw new AuthError();
  if (!res.ok) throw new Error(`DELETE ${path} → HTTP ${res.status}`);
}

/** Thrown when the server returns 401 — the caller should redirect to login. */
export class AuthError extends Error {
  constructor() {
    super("Not authenticated");
    this.name = "AuthError";
  }
}

// ── API surface ───────────────────────────────────────────────────────────────

export const api = {
  // Auth (no token required)
  register: (input: RegisterInput) =>
    post<AuthResponse>("/api/auth/register", input).then((r) => {
      setToken(r.token);
      return r;
    }),
  login: (input: LoginInput) =>
    post<AuthResponse>("/api/auth/login", input).then((r) => {
      setToken(r.token);
      return r;
    }),
  logout: () => clearToken(),
  me: () => get<Business>("/api/auth/me"),

  // Business & customers
  getBusiness: () => get<Business>("/api/auth/me"),
  listCustomers: () => get<Customer[]>("/api/customers"),
  createCustomer: (input: CreateCustomerInput) =>
    post<Customer>("/api/customers", input),
  updateCustomer: (id: string, input: UpdateCustomerInput) =>
    put<Customer>(`/api/customers/${id}`, input),
  deleteCustomer: (id: string) => del(`/api/customers/${id}`),

  // Invoices
  listInvoices: () => get<Invoice[]>("/api/invoices"),
  getInvoice: (id: string) => get<Invoice>(`/api/invoices/${id}`),
  createInvoice: (input: CreateInvoiceInput) =>
    post<Invoice>("/api/invoices", input),
  getPaymentRequest: (id: string) =>
    get<PaymentRequest>(`/api/invoices/${id}/payment-request`),
  simulatePayment: (id: string) =>
    post<Invoice>(`/api/invoices/${id}/simulate-payment`),

  // Reconciliation, balance, summary
  reconcile: () => post<ReconResult[]>("/api/reconcile"),
  getBalance: () => get<ShieldedBalance>("/api/balance"),
  getMonthlySummary: () => get<MonthlyPoint[]>("/api/monthly-summary"),

  // The reveal
  getPublicLedger: () => get<PublicTx[]>("/api/ledger/public"),
  getAuditorLedger: () => get<AuditorTx[]>("/api/ledger/auditor"),

  // Disclosure
  generateViewingKeyDisclosure: (range: { start: string; end: string }) =>
    post<DisclosurePack>("/api/disclosure/viewing-key", range),
  generatePaymentDisclosurePack: (invoiceIds: string[]) =>
    post<DisclosurePack>("/api/disclosure/payment-pack", { invoiceIds }),
  listDisclosurePacks: () => get<DisclosurePack[]>("/api/disclosure"),
  getDisclosurePack: (id: string) =>
    get<DisclosurePack>(`/api/disclosure/${id}`),
  verifyDisclosure: (id: string) =>
    post<VerificationResult[]>(`/api/disclosure/${id}/verify`),
};
