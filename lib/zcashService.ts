/**
 * lib/zcashService.ts
 * =============================================================================
 * THE BACKEND CONTRACT.
 *
 * Every piece of data and every Zcash-related operation the UI needs lives in
 * this single module. The UI imports only from here and never inlines mock
 * data. Each exported function carries the TypeScript signature the real
 * backend must honour, a JSDoc note describing what the real implementation
 * will do, and a `// TODO: real Zcash` marker.
 *
 * Today this is a frontend-only mock: state is held in memory and mirrored to
 * localStorage so the demo survives navigation and reloads. Swapping in a real
 * implementation means replacing the bodies below — the signatures stay.
 * =============================================================================
 */

import {
  AuditorTx,
  Business,
  CreateInvoiceInput,
  Customer,
  DisclosureItem,
  DisclosurePack,
  DisclosureScope,
  Invoice,
  MonthlyPoint,
  PaymentRequest,
  PublicTx,
  ReconResult,
  ShieldedBalance,
  VerificationResult,
} from "./types";
import { BRAND } from "./brand";

/* -------------------------------------------------------------------------- */
/*  Constants                                                                 */
/* -------------------------------------------------------------------------- */

/** Mocked spot rate. Revenue is assessed in KES, so every ZEC figure gets a
 *  KES equivalent for the books. The real service will pull a live oracle. */
export const ZEC_TO_KES = 4200;

/** Zcash shielded memos carry up to 512 bytes of encrypted data. */
export const MEMO_MAX_BYTES = 512;

const STORAGE_KEY = "arelis_state_v3";

/* -------------------------------------------------------------------------- */
/*  Mock crypto helpers (deterministic where it matters for SSR)              */
/* -------------------------------------------------------------------------- */

function randHex(len: number): string {
  let out = "";
  const chars = "0123456789abcdef";
  for (let i = 0; i < len; i++)
    out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}

function makeUnifiedAddress(): string {
  // Real unified addresses begin "u1" and bech32m-encode multiple receivers.
  const chars = "023456789acdefghjklmnpqrstuvwxyz";
  let body = "";
  for (let i = 0; i < 78; i++)
    body += chars[Math.floor(Math.random() * chars.length)];
  return "u1" + body;
}

function makeTxid(): string {
  return randHex(64);
}

/** Deterministic unified address derived from a seed string — used for seed
 *  data so server and client render identically (no hydration mismatch). */
function seededAddress(seed: string): string {
  const chars = "023456789acdefghjklmnpqrstuvwxyz";
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let out = "";
  for (let i = 0; i < 78; i++) {
    h ^= h << 13;
    h ^= h >>> 17;
    h ^= h << 5;
    out += chars[Math.abs(h) % chars.length];
  }
  return "u1" + out;
}

function makeViewingKey(): string {
  // Real full viewing keys are "uview1..." bech32m strings.
  const chars = "023456789acdefghjklmnpqrstuvwxyz";
  let body = "";
  for (let i = 0; i < 90; i++)
    body += chars[Math.floor(Math.random() * chars.length)];
  return "uview1" + body;
}

/** Build the encrypted memo content that embeds the invoice reference. */
export function buildMemo(invoiceId: string, customerName: string): string {
  return `${BRAND.name} • payment for ${invoiceId} • ${customerName}`;
}

/** UTF-8-safe base64 (used for the ZIP-321 memo param). Works on server + client. */
function base64Utf8(input: string): string {
  const bytes =
    typeof TextEncoder !== "undefined"
      ? new TextEncoder().encode(input)
      : new Uint8Array(Array.from(input, (c) => c.charCodeAt(0) & 0xff));
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  if (typeof btoa !== "undefined") return btoa(binary);
  // Node fallback
  return Buffer.from(input, "utf-8").toString("base64");
}

/** Byte length of a memo, for the "≤ 512-byte memo" indicator in the UI. */
export function memoByteLength(memo: string): number {
  if (typeof TextEncoder !== "undefined")
    return new TextEncoder().encode(memo).length;
  return memo.length;
}

/** Convert a ZEC amount to its mocked KES equivalent. */
export function zecToKes(zec: number): number {
  return Math.round(zec * ZEC_TO_KES);
}

/* -------------------------------------------------------------------------- */
/*  Seed data — one Kenyan business, several customers, mixed-state invoices  */
/* -------------------------------------------------------------------------- */

const SEED_BUSINESS: Business = {
  name: "Zira Studio Ltd",
  taxPin: "P051728394Z",
  unifiedAddress:
    "u1zira9q2k4m7x0c8v3n6b1l5j8h2g4f7d9s0a3p6r1t4w7y0e3u6i9o2k5m8q1",
};

const SEED_CUSTOMERS: Customer[] = [
  { id: "cus_acacia", name: "Acacia Digital Ltd", email: "ap@acaciadigital.co.ke", taxPin: "P051110021A" },
  { id: "cus_mara", name: "Mara Coffee Exporters", email: "finance@maracoffee.co.ke", taxPin: "P051220034C" },
  { id: "cus_savannah", name: "Savannah Logistics", email: "accounts@savannahlogistics.co.ke", taxPin: "P051330047L" },
  { id: "cus_nairobi", name: "Nairobi Fintech Hub", email: "ops@nairobifintech.co.ke", taxPin: "P051440058H" },
  { id: "cus_tuga", name: "Tuga Foods Ltd", email: "payables@tugafoods.co.ke", taxPin: "P051550069F" },
];

interface ServiceState {
  business: Business;
  customers: Customer[];
  invoices: Invoice[];
  packs: DisclosurePack[];
  seq: number;
}

function seedInvoice(
  id: string,
  customerId: string,
  desc: string,
  qty: number,
  unitZec: number,
  issueDate: string,
  dueDate: string,
  status: Invoice["status"],
  reconStatus: Invoice["reconStatus"],
  txid?: string,
  paidDate?: string
): Invoice {
  const customer = SEED_CUSTOMERS.find((c) => c.id === customerId)!;
  const amountZec = Number((qty * unitZec).toFixed(8));
  return {
    id,
    customerId,
    customerName: customer.name,
    lineItems: [{ description: desc, quantity: qty, unitPriceZec: unitZec }],
    amountZec,
    amountKes: zecToKes(amountZec),
    issueDate,
    dueDate,
    status,
    reconStatus,
    memo: buildMemo(id, customer.name),
    unifiedAddress: seededAddress(id),
    txid,
    paidDate,
  };
}

function buildSeedState(): ServiceState {
  // Ordered newest-first (matches how createInvoice prepends new invoices).
  // A handful of paid invoices across Feb–Jun gives the dashboard real history.
  const invoices: Invoice[] = [
    seedInvoice("INV-2026-0012", "cus_acacia", "Quarterly retainer — May", 1, 2.0, "2026-05-30", "2026-06-13", "paid", "reconciled", "c3f5eb49086d2cab17341e5f9a8d6c12b4eaf3070d9826b5e4039a1d8c9e67f0", "2026-06-02"),
    seedInvoice("INV-2026-0011", "cus_nairobi", "Investor pitch deck & motion", 1, 1.75, "2026-06-01", "2026-06-15", "draft", "unreconciled"),
    seedInvoice("INV-2026-0010", "cus_tuga", "Packaging refresh — 6 SKUs", 6, 0.65, "2026-05-28", "2026-06-11", "awaiting_payment", "unreconciled"),
    seedInvoice("INV-2026-0009", "cus_savannah", "Fleet tracking dashboard (sprint 1)", 1, 4.8, "2026-05-21", "2026-06-04", "awaiting_payment", "unreconciled"),
    seedInvoice("INV-2026-0008", "cus_acacia", "Brand identity & design system", 1, 2.4, "2026-05-09", "2026-05-23", "paid", "reconciled", "a1f3c9d27e64b0a8f5129c3d7e6b4a90f2c8d1e5b7a604933c2e1f8d0b6a7c45", "2026-05-20"),
    seedInvoice("INV-2026-0007", "cus_mara", "Export landing site + CMS", 1, 3.15, "2026-05-04", "2026-05-18", "paid", "reconciled", "b2e4da38f75c1b9a06230d4e8f7c5b01a3d9e2f6c8b715a44d3f2090c7b8d56e", "2026-05-12"),
    seedInvoice("INV-2026-0006", "cus_acacia", "Design retainer — April", 1, 2.0, "2026-04-18", "2026-05-02", "paid", "reconciled", "d4a6fc5a197e3dbc28452f6a0b9e7d23c5fb04181eac937c6f5140ae9daf7801", "2026-04-26"),
    seedInvoice("INV-2026-0005", "cus_tuga", "Packaging design — 4 SKUs", 4, 0.6, "2026-04-04", "2026-04-18", "paid", "reconciled", "e5b70d6b2a8f4ecd39563a7b1caf8e34d60c15292fbda048d70251bf0 eb0a912".replace(/\s/g, ""), "2026-04-12"),
    seedInvoice("INV-2026-0004", "cus_nairobi", "Investor pitch deck", 1, 1.5, "2026-03-22", "2026-04-05", "paid", "reconciled", "f6c81e7c3b9a05de4a674b8c2dba9f45e71d2630a0cbe159e81362ca1fc1ba23", "2026-03-30"),
    seedInvoice("INV-2026-0003", "cus_savannah", "Logistics dashboard (sprint 0)", 1, 2.6, "2026-03-05", "2026-03-19", "paid", "reconciled", "07d92f8d4cab16ef5b785c9d3ecb0a56f82e3741b1dcf260f924730db2d2cb34", "2026-03-13"),
    seedInvoice("INV-2026-0002", "cus_mara", "Brand photography day", 1, 1.2, "2026-02-20", "2026-03-06", "paid", "reconciled", "18ea309e5dbc27006c896dae4fdc1b67093f4852c2edf371004584 1ec3e3dc45".replace(/\s/g, ""), "2026-02-27"),
    seedInvoice("INV-2026-0001", "cus_acacia", "Website redesign", 1, 1.8, "2026-02-03", "2026-02-17", "paid", "reconciled", "29fb41af6ecd38117d9a6ebf50ed2c78104a5963d3fea482115695afd4f4ed56", "2026-02-11"),
  ];

  return {
    business: SEED_BUSINESS,
    customers: SEED_CUSTOMERS,
    invoices,
    packs: [],
    seq: invoices.length,
  };
}

/* -------------------------------------------------------------------------- */
/*  Store: in-memory state + localStorage persistence + subscriptions         */
/* -------------------------------------------------------------------------- */

let state: ServiceState | null = null;
const listeners = new Set<() => void>();

function loadState(): ServiceState {
  if (state) return state;
  if (typeof window !== "undefined") {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (raw) {
        state = JSON.parse(raw) as ServiceState;
        return state;
      }
    } catch {
      /* ignore corrupt storage */
    }
  }
  state = buildSeedState();
  persist();
  return state;
}

function persist() {
  if (typeof window !== "undefined" && state) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* ignore quota errors */
    }
  }
}

function notify() {
  persist();
  listeners.forEach((l) => l());
}

/** Subscribe to store changes — backs the `useZcash` React hook. */
export function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** A monotonically-increasing snapshot token used by useSyncExternalStore. */
let version = 0;
export function getVersion(): number {
  return version;
}
function bump() {
  version++;
  notify();
}

/** Reset the prototype back to seed data (handy for re-running the demo). */
export function resetDemo(): void {
  state = buildSeedState();
  bump();
}

/* -------------------------------------------------------------------------- */
/*  Read helpers                                                              */
/* -------------------------------------------------------------------------- */

/** Return the business profile (name, tax PIN, account unified address). */
export function getBusiness(): Business {
  return loadState().business;
}

/** Return the customer book. */
export function listCustomers(): Customer[] {
  return loadState().customers;
}

export function getCustomer(id: string): Customer | undefined {
  return loadState().customers.find((c) => c.id === id);
}

/* -------------------------------------------------------------------------- */
/*  CONTRACT: invoices                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Create a new invoice and its shielded payment request.
 *
 * Real Zcash: derive a fresh unified address (or diversified receiver) for the
 * invoice, mint the invoice record, and persist it. The encrypted memo that
 * embeds the invoice reference is sealed into the payment request, not stored
 * on chain until a note is actually received.
 *
 * @param input customer, line items and due date
 * @returns the created Invoice (status: "awaiting_payment")
 */
// TODO: real Zcash — derive diversified receiver + persist via wallet backend
export function createInvoice(input: CreateInvoiceInput): Invoice {
  const s = loadState();
  const customer = s.customers.find((c) => c.id === input.customerId);
  if (!customer) throw new Error(`Unknown customer ${input.customerId}`);

  s.seq += 1;
  const id = `INV-2026-${String(s.seq).padStart(4, "0")}`;
  const amountZec = Number(
    input.lineItems
      .reduce((sum, li) => sum + li.quantity * li.unitPriceZec, 0)
      .toFixed(8)
  );

  const invoice: Invoice = {
    id,
    customerId: customer.id,
    customerName: customer.name,
    lineItems: input.lineItems,
    amountZec,
    amountKes: zecToKes(amountZec),
    issueDate: new Date().toISOString().slice(0, 10),
    dueDate: input.dueDate,
    status: "awaiting_payment",
    reconStatus: "unreconciled",
    memo: buildMemo(id, customer.name),
    unifiedAddress: makeUnifiedAddress(),
  };

  s.invoices = [invoice, ...s.invoices];
  bump();
  return invoice;
}

/** Return all invoices, newest first. */
// TODO: real Zcash — read invoice records from the wallet/backend store
export function listInvoices(): Invoice[] {
  return loadState().invoices;
}

export function getInvoice(id: string): Invoice | undefined {
  return loadState().invoices.find((i) => i.id === id);
}

/**
 * Build the shielded payment request for an invoice.
 *
 * Real Zcash: returns the invoice's unified address, the amount, the encrypted
 * memo (≤ 512 bytes) carrying the invoice reference, and a ZIP-321 `zcash:`
 * payment URI the customer's wallet can parse into a shielded send.
 */
// TODO: real Zcash — assemble ZIP-321 URI with shielded receiver + memo
export function getPaymentRequest(invoiceId: string): PaymentRequest {
  const invoice = getInvoice(invoiceId);
  if (!invoice) throw new Error(`Unknown invoice ${invoiceId}`);

  const memo = invoice.memo;
  // ZIP-321 carries the memo as base64 of its UTF-8 bytes. Encode UTF-8-safe so
  // non-Latin1 characters in the memo (e.g. "•") don't break btoa.
  const memoParam = base64Utf8(memo);
  const paymentUri = `zcash:${invoice.unifiedAddress}?amount=${invoice.amountZec}&memo=${memoParam}`;

  return {
    unifiedAddress: invoice.unifiedAddress,
    memo,
    amountZec: invoice.amountZec,
    paymentUri,
  };
}

/**
 * PROTOTYPE ONLY. Simulate the customer's shielded payment landing: flips the
 * invoice to "paid", attaches a txid + paid date, and reconciles it.
 *
 * Real Zcash: there is no "simulate" — the wallet detects an incoming shielded
 * note, decrypts the memo, and reconciliation runs on real chain data.
 */
// TODO: real Zcash — remove; replace with incoming-note detection
export function simulatePaymentReceived(invoiceId: string): void {
  const s = loadState();
  const invoice = s.invoices.find((i) => i.id === invoiceId);
  if (!invoice) throw new Error(`Unknown invoice ${invoiceId}`);
  invoice.status = "paid";
  invoice.reconStatus = "reconciled";
  invoice.txid = makeTxid();
  invoice.paidDate = new Date().toISOString().slice(0, 10);
  bump();
}

/**
 * Match received shielded payments to outstanding invoices via the decrypted
 * memo (invoice reference) and amount, then mark matches reconciled.
 *
 * Real Zcash: scan incoming notes the account can decrypt, read each memo for
 * the invoice reference, compare the note value to the invoiced amount, and
 * record the reconciliation result.
 */
// TODO: real Zcash — scan decryptable incoming notes and match memo + value
export function reconcilePayments(): ReconResult[] {
  const s = loadState();
  const results: ReconResult[] = [];
  for (const inv of s.invoices) {
    if (inv.status !== "paid") continue;
    const memoMatched = inv.memo.includes(inv.id);
    const amountMatched = true; // received note value equals invoiced amount
    if (memoMatched && amountMatched) inv.reconStatus = "reconciled";
    results.push({
      invoiceId: inv.id,
      matched: memoMatched && amountMatched,
      txid: inv.txid,
      amountZec: inv.amountZec,
      memoMatched,
      amountMatched,
    });
  }
  bump();
  return results;
}

/* -------------------------------------------------------------------------- */
/*  CONTRACT: balance                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Return the account's shielded balance with a KES equivalent.
 *
 * Real Zcash: sum the spendable value across the account's shielded notes.
 * Here we derive it from reconciled, paid invoices.
 */
// TODO: real Zcash — sum spendable shielded note value for the account
export function getAccountBalanceShielded(): ShieldedBalance {
  const s = loadState();
  const zec = Number(
    s.invoices
      .filter((i) => i.status === "paid")
      .reduce((sum, i) => sum + i.amountZec, 0)
      .toFixed(8)
  );
  return { zec, kesEquivalent: zecToKes(zec) };
}

/** Months shown on the dashboard revenue overview (fixed window for the demo). */
const SUMMARY_MONTHS: { key: string; label: string }[] = [
  { key: "2026-01", label: "Jan" },
  { key: "2026-02", label: "Feb" },
  { key: "2026-03", label: "Mar" },
  { key: "2026-04", label: "Apr" },
  { key: "2026-05", label: "May" },
  { key: "2026-06", label: "Jun" },
];

/**
 * Monthly revenue overview: collected (paid) and invoiced (issued) totals per
 * month, for the dashboard charts.
 *
 * Real Zcash: derive collected amounts from decrypted incoming notes grouped by
 * settlement date; invoiced amounts come from the invoice records.
 */
// TODO: real Zcash — group decrypted receipts by month for the account
export function getMonthlySummary(): MonthlyPoint[] {
  const s = loadState();
  return SUMMARY_MONTHS.map(({ key, label }) => {
    let collectedZec = 0;
    let invoicedKes = 0;
    for (const inv of s.invoices) {
      if (inv.status === "paid" && inv.paidDate?.startsWith(key))
        collectedZec += inv.amountZec;
      if (inv.issueDate.startsWith(key)) invoicedKes += inv.amountKes;
    }
    collectedZec = Number(collectedZec.toFixed(8));
    return {
      key,
      label,
      collectedZec,
      collectedKes: zecToKes(collectedZec),
      invoicedKes,
    };
  });
}

/* -------------------------------------------------------------------------- */
/*  CONTRACT: the reveal — public vs auditor ledgers                          */
/* -------------------------------------------------------------------------- */

/**
 * The PUBLIC view of the account's transactions, as a block explorer sees them.
 * Everything sensitive is shielded: no sender, receiver, amount or memo.
 *
 * Real Zcash: this is literally what a public explorer shows for shielded
 * (Orchard/Sapling) activity — opaque transactions with no readable detail.
 */
// TODO: real Zcash — derive from public chain data for the account's txs
export function getPublicLedger(): PublicTx[] {
  const s = loadState();
  let height = 2_540_118;
  return s.invoices
    .filter((i) => i.status === "paid" && i.txid)
    .map((i, idx) => ({
      txid: i.txid!,
      blockHeight: height + idx * 37,
      timestamp: (i.paidDate ?? i.issueDate) + "T10:24:00Z",
      type: "shielded" as const,
    }));
}

/**
 * The AUDITOR view of the SAME transactions, decrypted: invoice, customer,
 * amount, memo and reconciliation status. This is what a disclosed viewing key
 * unlocks.
 */
// TODO: real Zcash — decrypt notes with the disclosed viewing key
export function getAuditorLedger(): AuditorTx[] {
  const s = loadState();
  let height = 2_540_118;
  return s.invoices
    .filter((i) => i.status === "paid" && i.txid)
    .map((i, idx) => ({
      txid: i.txid!,
      blockHeight: height + idx * 37,
      timestamp: (i.paidDate ?? i.issueDate) + "T10:24:00Z",
      invoiceId: i.id,
      customerName: i.customerName,
      amountZec: i.amountZec,
      amountKes: i.amountKes,
      memo: i.memo,
      reconStatus: i.reconStatus,
    }));
}

/* -------------------------------------------------------------------------- */
/*  CONTRACT: disclosure                                                      */
/* -------------------------------------------------------------------------- */

/**
 * Generate a FULL VIEWING KEY disclosure pack scoped to a date range.
 *
 * Privacy is the default — this is an explicit, holder-initiated action. The
 * business chooses the period; the recipient receives a viewing key granting
 * read access to exactly those transactions, plus a clean revenue statement.
 *
 * Real Zcash: derive a Unified Full Viewing Key (or a time-bounded capability)
 * and package it with the decrypted, in-range transaction set.
 */
// TODO: real Zcash — derive UFVK / bounded viewing capability for the range
export function generateViewingKeyDisclosure(range: {
  start: string;
  end: string;
}): DisclosurePack {
  const s = loadState();
  const inRange = s.invoices.filter(
    (i) =>
      i.status === "paid" &&
      i.paidDate &&
      i.paidDate >= range.start &&
      i.paidDate <= range.end
  );

  const items: DisclosureItem[] = inRange.map(toDisclosureItem);
  const totalZec = Number(
    items.reduce((sum, it) => sum + it.amountZec, 0).toFixed(8)
  );

  const pack: DisclosurePack = {
    id: `DISC-VK-${randHex(6).toUpperCase()}`,
    scope: "viewing_key",
    createdAt: new Date().toISOString(),
    rangeStart: range.start,
    rangeEnd: range.end,
    businessName: s.business.name,
    taxPin: s.business.taxPin,
    viewingKey: makeViewingKey(),
    items,
    totalZec,
    totalKes: zecToKes(totalZec),
  };

  s.packs = [pack, ...s.packs];
  bump();
  return pack;
}

/**
 * Generate a PAYMENT DISCLOSURE for a single invoice — a one-transaction proof.
 *
 * Real Zcash: produce a payment disclosure for the specific note, revealing
 * only that transaction (amount, memo, recipient) and nothing else.
 */
// TODO: real Zcash — emit single-note payment disclosure proof
export function generatePaymentDisclosure(invoiceId: string): DisclosureItem {
  const invoice = getInvoice(invoiceId);
  if (!invoice) throw new Error(`Unknown invoice ${invoiceId}`);
  if (invoice.status !== "paid" || !invoice.txid)
    throw new Error(`Invoice ${invoiceId} has no on-chain payment to disclose`);
  return toDisclosureItem(invoice);
}

/**
 * Build a per-invoice disclosure pack from a chosen set of paid invoices.
 * Convenience wrapper around `generatePaymentDisclosure` that the UI uses when
 * the holder picks specific invoices rather than a date range.
 */
// TODO: real Zcash — bundle individual payment disclosures into one pack
export function generatePaymentDisclosurePack(
  invoiceIds: string[]
): DisclosurePack {
  const s = loadState();
  const items = invoiceIds
    .map((id) => getInvoice(id))
    .filter((i): i is Invoice => !!i && i.status === "paid" && !!i.txid)
    .map(toDisclosureItem);

  const totalZec = Number(
    items.reduce((sum, it) => sum + it.amountZec, 0).toFixed(8)
  );

  const pack: DisclosurePack = {
    id: `DISC-PD-${randHex(6).toUpperCase()}`,
    scope: "payment",
    createdAt: new Date().toISOString(),
    businessName: s.business.name,
    taxPin: s.business.taxPin,
    items,
    totalZec,
    totalKes: zecToKes(totalZec),
  };

  s.packs = [pack, ...s.packs];
  bump();
  return pack;
}

function toDisclosureItem(invoice: Invoice): DisclosureItem {
  return {
    invoiceId: invoice.id,
    customerName: invoice.customerName,
    date: invoice.paidDate ?? invoice.issueDate,
    amountZec: invoice.amountZec,
    amountKes: invoice.amountKes,
    memo: invoice.memo,
    txid: invoice.txid ?? makeTxid(),
    proof: `zkproof:${randHex(32)}`,
  };
}

export function listDisclosurePacks(): DisclosurePack[] {
  return loadState().packs;
}

export function getDisclosurePack(id: string): DisclosurePack | undefined {
  return loadState().packs.find((p) => p.id === id);
}

/**
 * AUDITOR SIDE. Verify each disclosed item against the chain: confirm the
 * transaction exists and its on-chain value equals the declared amount.
 *
 * Real Zcash: use the disclosed viewing key / payment disclosure to locate the
 * note on chain and check the committed value against the declared figure.
 */
// TODO: real Zcash — verify each note/payment-disclosure against the chain
export function verifyDisclosure(pack: DisclosurePack): VerificationResult[] {
  return pack.items.map((it) => ({
    invoiceId: it.invoiceId,
    txid: it.txid,
    declaredZec: it.amountZec,
    onChainZec: it.amountZec, // mock: declared always equals on-chain
    status: "verified" as const,
    verifiedAt: new Date().toISOString(),
  }));
}
