/**
 * Domain types for Arelis — shielded invoicing & compliance on Zcash.
 *
 * These types, together with the function signatures in `lib/zcashService.ts`,
 * form the contract the real backend must implement. The UI imports types from
 * here and only ever talks to the service module — never to mock data directly.
 */

// ── Auth ──────────────────────────────────────────────────────────────────────

export interface RegisterInput {
  name: string;
  taxPin: string;
  email: string;
  password: string;
}

export interface LoginInput {
  email: string;
  password: string;
}

export interface AuthResponse {
  token: string;
  businessId: string;
  /** Present only on registration — the 24-word BIP-39 mnemonic. Show once, then discard. */
  mnemonic?: string;
}

// ── Customer management ───────────────────────────────────────────────────────

export interface CreateCustomerInput {
  name: string;
  email: string;
  taxPin?: string;
}

export interface UpdateCustomerInput {
  name: string;
  email: string;
  taxPin?: string;
}

// ── Invoice lifecycle ─────────────────────────────────────────────────────────

export type InvoiceStatus = "draft" | "awaiting_payment" | "paid";

export type ReconStatus = "unreconciled" | "reconciled";

export interface Customer {
  id: string;
  name: string;
  email: string;
  /** Tax identification number — used on disclosure statements. */
  taxPin?: string;
}

export interface Business {
  name: string;
  email: string;
  taxPin: string;
  unifiedAddress: string;
}

export interface LineItem {
  description: string;
  quantity: number;
  /** Unit price denominated in ZEC. */
  unitPriceZec: number;
}

export interface Invoice {
  /** Human invoice reference, e.g. INV-2026-0007. Also embedded in the memo. */
  id: string;
  customerId: string;
  customerName: string;
  lineItems: LineItem[];
  amountZec: number;
  /** KES equivalent captured at issue time (revenue is assessed in KES). */
  amountKes: number;
  issueDate: string;
  dueDate: string;
  status: InvoiceStatus;
  reconStatus: ReconStatus;
  /** The encrypted memo content carried in the shielded note (<= 512 bytes). */
  memo: string;
  /** Unified address the customer pays — shielded receiver. */
  unifiedAddress: string;
  /** Shielded transaction id, present once paid. */
  txid?: string;
  paidDate?: string;
}

export interface CreateInvoiceInput {
  customerId: string;
  lineItems: LineItem[];
  dueDate: string;
}

export interface PaymentRequest {
  unifiedAddress: string;
  /** Encrypted memo content embedding the invoice reference. */
  memo: string;
  amountZec: number;
  /** ZIP-321 style zcash: payment URI used to build the QR code. */
  paymentUri: string;
}

export interface ReconResult {
  invoiceId: string;
  matched: boolean;
  txid?: string;
  amountZec: number;
  /** Did the decrypted memo reference the invoice? */
  memoMatched: boolean;
  /** Did the received amount equal the invoiced amount? */
  amountMatched: boolean;
}

export interface ShieldedBalance {
  zec: number;
  kesEquivalent: number;
}

/** One month of the revenue overview shown on the dashboard. */
export interface MonthlyPoint {
  /** Month key, e.g. "2026-03". */
  key: string;
  /** Short label for the axis, e.g. "Mar". */
  label: string;
  /** Revenue collected (paid) that month. */
  collectedZec: number;
  collectedKes: number;
  /** Total invoiced (issued) that month, in KES. */
  invoicedKes: number;
}

/** Disclosure can be scoped to a viewing key (period) or a single payment. */
export type DisclosureScope = "viewing_key" | "payment";

export interface DisclosureItem {
  invoiceId: string;
  customerName: string;
  date: string;
  amountZec: number;
  amountKes: number;
  memo: string;
  txid: string;
  /** Opaque proof blob the auditor checks against the chain (mocked). */
  proof: string;
}

export interface DisclosurePack {
  id: string;
  scope: DisclosureScope;
  createdAt: string;
  rangeStart?: string;
  rangeEnd?: string;
  businessName: string;
  taxPin: string;
  /** Present only for full viewing-key scope — grants period-wide read access. */
  viewingKey?: string;
  items: DisclosureItem[];
  totalZec: number;
  totalKes: number;
}

export type VerificationStatus = "pending" | "verified" | "failed";

export interface VerificationResult {
  invoiceId: string;
  txid: string;
  declaredZec: number;
  onChainZec: number;
  status: VerificationStatus;
  verifiedAt?: string;
}

/** A row in the public (block-explorer) view — everything sensitive is shielded. */
export interface PublicTx {
  txid: string;
  blockHeight: number;
  timestamp: string;
  /** Always "shielded" in the public view — no sender/receiver/amount/memo. */
  type: "shielded";
}

/** A row in the auditor view — the same transactions, decrypted. */
export interface AuditorTx {
  txid: string;
  blockHeight: number;
  timestamp: string;
  invoiceId: string;
  customerName: string;
  amountZec: number;
  amountKes: number;
  memo: string;
  reconStatus: ReconStatus;
}
