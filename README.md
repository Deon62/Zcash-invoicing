# Arelis

**Shielded invoicing & compliance on Zcash.** Invoice and get paid in private
(shielded) ZEC, then selectively disclose records to an auditor on demand.
Private from competitors by default; provable to an auditor on the holder's
terms.

> **Status:** This repository is a **clickable frontend prototype** with mock
> data — there is **no live Zcash integration yet**. It is fully functional as a
> demo (create invoices, request payment, "receive" a payment, reveal the
> auditor view, generate and verify disclosure packs) but every Zcash operation
> is simulated in the browser. The prototype doubles as the **blueprint and
> contract for the backend** described in this document.

---

## Table of contents

1. [Who this document is for](#who-this-document-is-for)
2. [Run it locally](#run-it-locally)
3. [Tech stack](#tech-stack)
4. [How the app is wired](#how-the-app-is-wired)
5. [Repository map](#repository-map)
6. [The demo flow, end to end](#the-demo-flow-end-to-end)
7. [The backend contract](#the-backend-contract) ← **start here if you're the backend dev**
8. [Function reference](#function-reference)
9. [Domain types](#domain-types)
10. [Zcash primer (just enough)](#zcash-primer-just-enough)
11. [Proposed real backend architecture](#proposed-real-backend-architecture)
12. [Backend onboarding checklist](#backend-onboarding-checklist)
13. [Open questions / decisions to make](#open-questions--decisions-to-make)
14. [Conventions](#conventions)

---

## Who this document is for

A **backend developer** picking up the project to replace the mocked Zcash layer
with a real implementation. The single most important thing to understand is
that the entire backend surface is already defined — as TypeScript function
signatures and types — in **one file**:

```
lib/zcashService.ts
```

The UI only ever calls the functions exported from that module. It never inlines
mock data and never talks to Zcash directly. **Your job is to keep those
signatures and replace the bodies** with real wallet/chain logic (most likely by
turning the in-process functions into calls to a real backend service). If the
signatures hold, the entire frontend keeps working untouched.

---

## Run it locally

Requires **Node.js 18+** (Node 20 LTS recommended) and npm.

```bash
npm install
npm run dev
```

Open <http://localhost:3000>.

| Script          | What it does                          |
| --------------- | ------------------------------------- |
| `npm run dev`   | Start the Next.js dev server (HMR)    |
| `npm run build` | Production build                      |
| `npm run start` | Serve the production build            |
| `npm run lint`  | Run `next lint`                       |

> **State lives in the browser.** Invoices, payments and disclosure packs are
> held in memory and mirrored to `localStorage` (key `arelis_state_v3`), so the
> demo survives navigation and reloads. There is no server database yet. Use
> **Reset demo** in the sidebar to return to seed data.

---

## Tech stack

Next.js 16 (App Router) · React 18 · TypeScript 5 · Tailwind CSS 3 ·
shadcn-style UI components · `lucide-react` (icons) · `qrcode.react` (payment
QR) · `recharts` (dashboard charts).

Path alias: `@/` → repository root (see `tsconfig.json`), e.g.
`import { listInvoices } from "@/lib/zcashService"`.

---

## How the app is wired

```
┌──────────────────────────────────────────────────────────────┐
│  app/  (Next.js App Router pages — the UI)                    │
│    • Render screens, capture input                            │
│    • Call ONLY lib/zcashService.ts functions                  │
│    • Subscribe to changes via the useZcash() hook             │
└───────────────────────────┬──────────────────────────────────┘
                            │  imports
                            ▼
┌──────────────────────────────────────────────────────────────┐
│  lib/zcashService.ts  ── THE BACKEND CONTRACT                 │
│    • Every function the UI needs, with a real signature       │
│    • JSDoc describing the real behaviour + `// TODO: real     │
│      Zcash` markers on each method that must be replaced      │
│    • Today: in-memory store + localStorage persistence        │
│    • Tomorrow: calls to a real wallet/indexer backend         │
└───────────────────────────┬──────────────────────────────────┘
                            │  uses
                            ▼
┌──────────────────────────────────────────────────────────────┐
│  lib/types.ts   — domain types (the data half of the contract)│
│  lib/brand.ts   — product naming (single source of truth)     │
│  lib/useZcash.ts— React store subscription (useSyncExternalStore)│
│  lib/utils.ts   — cn() classname helper                       │
└──────────────────────────────────────────────────────────────┘
```

The store in `zcashService.ts` is a tiny external store: mutations call `bump()`
which increments a version and notifies subscribers; `useZcash()` wraps
`useSyncExternalStore` so components re-render after actions like
`createInvoice` or `simulatePaymentReceived`. When you move the backend
server-side, this subscription model is what you'll swap for data fetching
(see [Proposed real backend architecture](#proposed-real-backend-architecture)).

---

## Repository map

```
app/
  layout.tsx                 Root layout (fonts, globals)
  page.tsx                   Marketing landing page ("/")
  globals.css                Tailwind base + theme tokens
  (app)/                     Authenticated app route group (sidebar shell)
    layout.tsx               Wraps every dashboard route in <AppShell>
    dashboard/page.tsx       Revenue overview, balance, recent activity
    invoices/page.tsx        Invoice list
    invoices/new/page.tsx    Create-invoice form  → createInvoice()
    invoices/[id]/page.tsx   Invoice detail + payment request (QR)
    reveal/page.tsx          THE REVEAL: public vs auditor ledger toggle
    disclosure/page.tsx      Generate disclosure packs
    compliance/page.tsx      Compliance overview (privacy/share/verify panels)
    auditor/page.tsx         Auditor inbox of disclosure packs
    auditor/[packId]/page.tsx Auditor verifies one pack  → verifyDisclosure()
    profile/page.tsx         Business profile
    settings/page.tsx        Settings + Reset demo

components/
  AppShell.tsx               Sidebar + top bar shell
  BusinessMenu.tsx, Logo.tsx, PageHeader.tsx, StatusBadge.tsx, CopyButton.tsx
  compliance/                PrivacyPanel, SharePanel, VerifyPanel
  ui/                        shadcn-style primitives (button, card, table, …)

lib/
  zcashService.ts            ★ THE BACKEND CONTRACT (read this first)
  types.ts                   Domain types
  useZcash.ts                React store subscription hook
  brand.ts                   Product naming
  utils.ts                   cn() helper
```

---

## The demo flow, end to end

This is the product narrative every backend function exists to support:

1. **Create invoice** → customer, line items, due date; live KES equivalent.
   (`createInvoice`)
2. **Payment request** → QR code for a ZIP-321 `zcash:` URI carrying a shielded
   unified address, amount, and an encrypted memo embedding the invoice
   reference. (`getPaymentRequest`)
3. **Payment received** → the invoice flips to *paid* and auto-reconciles.
   In the prototype this is a button (`simulatePaymentReceived`); in production
   it's the wallet detecting an incoming shielded note.
4. **The reveal** → toggle **Public view** (everything shielded — the chain shows
   opaque transactions) vs **Auditor view** (the same transactions, decrypted).
   This contrast is the entire point of the product.
   (`getPublicLedger` / `getAuditorLedger`)
5. **Generate disclosure pack** → pick a date range *or* specific invoices, and
   choose **full viewing key** (period scope) vs **per-invoice payment
   disclosure**. (`generateViewingKeyDisclosure` / `generatePaymentDisclosurePack`)
6. **Auditor verification** → the auditor opens the pack and verifies each
   receipt against the chain, proving declared revenue equals real receipts.
   (`verifyDisclosure`)

---

## The backend contract

Everything you need to implement is an exported function in
`lib/zcashService.ts`. Each one already carries:

- the **TypeScript signature** the UI depends on (do not change it),
- a **JSDoc** note describing what the real implementation must do, and
- a `// TODO: real Zcash` marker.

Grep for the work:

```bash
grep -n "TODO: real Zcash" lib/zcashService.ts
```

The functions split into three buckets:

| Bucket             | Functions                                                                                          | Replace with                                            |
| ------------------ | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |
| **Must implement** | `createInvoice`, `getPaymentRequest`, `reconcilePayments`, `getAccountBalanceShielded`, `getMonthlySummary`, `getPublicLedger`, `getAuditorLedger`, `generateViewingKeyDisclosure`, `generatePaymentDisclosure`, `generatePaymentDisclosurePack`, `verifyDisclosure`, `listInvoices` | real wallet + indexer + storage                         |
| **Remove/replace** | `simulatePaymentReceived`                                                                           | incoming-note detection (there is no "simulate" in prod)|
| **Keep as-is**     | `buildMemo`, `memoByteLength`, `zecToKes`*, the store plumbing (`subscribe`, `getVersion`, `resetDemo`) | pure helpers / client glue (*`zecToKes` needs a live rate oracle) |

The golden rule: **swapping in the real backend means replacing the function
bodies, not the signatures.** If you need new data on an object, extend the
types in `lib/types.ts` additively so the UI keeps compiling.

---

## Function reference

What each contract function does today vs. what "real Zcash" means. Signatures
are in `lib/zcashService.ts`; types are in `lib/types.ts`.

### Invoices

| Function | Now (mock) | Real Zcash implementation |
| --- | --- | --- |
| `createInvoice(input): Invoice` | Mints an invoice record, generates a random `u1…` address, builds the memo. | Derive a fresh **unified address** (or a diversified receiver) for the invoice, persist the invoice record, seal the encrypted memo into the payment request. |
| `listInvoices(): Invoice[]` | Returns in-memory invoices, newest first. | Read invoice records from the backend store. |
| `getInvoice(id)` / `getCustomer(id)` / `listCustomers()` / `getBusiness()` | Read from the store. | Read from the backend store. |
| `getPaymentRequest(invoiceId): PaymentRequest` | Builds a `zcash:` URI with the address, amount, and base64 memo. | Assemble a **ZIP-321** payment URI with the shielded receiver + encrypted memo (≤ 512 bytes). |
| `simulatePaymentReceived(invoiceId): void` | **Prototype only.** Flips invoice to paid, attaches a fake txid + paid date. | **Delete this.** Replace with the wallet detecting an incoming shielded note, decrypting its memo, and updating the invoice. |
| `reconcilePayments(): ReconResult[]` | Marks paid invoices reconciled if the memo contains the invoice id. | Scan **decryptable incoming notes**, read each memo for the invoice reference, compare note value to the invoiced amount, record the reconciliation result. |

### Balance & dashboard

| Function | Now (mock) | Real Zcash implementation |
| --- | --- | --- |
| `getAccountBalanceShielded(): ShieldedBalance` | Sums paid invoice amounts. | Sum spendable value across the account's shielded notes. |
| `getMonthlySummary(): MonthlyPoint[]` | Groups invoices by issue/paid month over a fixed window. | Group decrypted incoming receipts by settlement date; invoiced totals come from invoice records. |
| `zecToKes(zec)` / `ZEC_TO_KES` | Fixed mock rate (`4200`). | Pull a **live ZEC→KES rate** from a price oracle; capture KES at issue time for the books. |

### The reveal (public vs auditor)

| Function | Now (mock) | Real Zcash implementation |
| --- | --- | --- |
| `getPublicLedger(): PublicTx[]` | Returns opaque rows (txid, height, timestamp, `type: "shielded"`). | Derive from **public chain data** for the account's transactions — exactly what a block explorer shows for shielded (Orchard/Sapling) activity: no sender/receiver/amount/memo. |
| `getAuditorLedger(): AuditorTx[]` | Returns the same rows, decrypted (invoice, customer, amount, memo). | **Decrypt notes with the disclosed viewing key** to reveal invoice, customer, amount, memo, recon status. |

### Disclosure & verification

| Function | Now (mock) | Real Zcash implementation |
| --- | --- | --- |
| `generateViewingKeyDisclosure(range): DisclosurePack` | Bundles in-range paid invoices + a fake `uview1…` key. | Derive a **Unified Full Viewing Key** (or a time-bounded viewing capability) scoped to the range; package it with the decrypted in-range transaction set. |
| `generatePaymentDisclosure(invoiceId): DisclosureItem` | Returns one disclosure item. | Produce a **payment disclosure** for that specific note, revealing only that transaction (amount, memo, recipient). |
| `generatePaymentDisclosurePack(ids): DisclosurePack` | Bundles per-invoice items into one pack. | Bundle individual payment disclosures into one pack. |
| `verifyDisclosure(pack): VerificationResult[]` | Returns `verified` for every item (declared == on-chain by construction). | **Auditor side.** Use the disclosed viewing key / payment disclosure to locate each note on chain and check the committed value against the declared amount. |

> **Privacy is always the default.** Disclosure is an explicit,
> holder-initiated action — never automatic. Preserve that invariant in the
> real backend: nothing should leak a viewing key or decrypt data for a third
> party without an explicit disclosure action.

---

## Domain types

All in `lib/types.ts`. These are the data half of the contract — extend them
additively; don't break existing fields.

- **`Customer`**, **`Business`** — directory + account profile (incl. `taxPin`).
- **`LineItem`**, **`Invoice`**, **`CreateInvoiceInput`** — invoicing.
  `Invoice.status`: `draft | awaiting_payment | paid`;
  `reconStatus`: `unreconciled | reconciled`; `memo` is the ≤512-byte encrypted
  memo; `unifiedAddress` is the shielded receiver; `txid`/`paidDate` appear once paid.
- **`PaymentRequest`** — unified address, memo, amount, and the ZIP-321 `zcash:` URI for the QR.
- **`ReconResult`** — per-invoice match outcome (`memoMatched`, `amountMatched`).
- **`ShieldedBalance`**, **`MonthlyPoint`** — balance + dashboard series.
- **`PublicTx`** vs **`AuditorTx`** — the two sides of the reveal (opaque vs decrypted).
- **`DisclosureScope`** (`viewing_key | payment`), **`DisclosureItem`**, **`DisclosurePack`**, **`VerificationResult`** — disclosure + audit.

---

## Zcash primer (just enough)

If you're new to Zcash, these are the concepts the contract leans on:

- **Shielded ZEC / unified addresses.** Payments are shielded notes sent to a
  **unified address** (starts `u1…`, bech32m-encoding one or more receivers,
  e.g. Orchard/Sapling). Shielded transactions are opaque on the public chain —
  no visible sender, receiver, amount, or memo.
- **Encrypted memos.** Each shielded payment can carry up to **512 bytes** of
  encrypted memo, decryptable only by parties with the right key. Arelis embeds
  the **invoice reference** in the memo so payments can be reconciled to
  invoices. (`MEMO_MAX_BYTES = 512`; `memoByteLength()` backs the UI counter.)
- **ZIP-321 payment URIs.** A standard `zcash:<address>?amount=…&memo=…` URI a
  customer's wallet parses into a shielded send. The memo travels base64-encoded.
- **Viewing keys.** A **Full Viewing Key (UFVK)** grants *read-only* visibility
  into an account's transactions — the basis of the **viewing-key disclosure**.
  A **payment disclosure** reveals exactly one transaction. Both are explicit,
  holder-initiated capabilities; neither lets the recipient spend.
- **KES.** Revenue is assessed in Kenyan Shillings, so every ZEC figure carries
  a KES equivalent captured at issue time.

Useful references for implementation: the Zcash docs, the
[ZIP-321](https://zips.z.cash/zip-0321) payment-request spec, and a Rust wallet
SDK such as `librustzcash` / `zcash_client_backend` (with a light-wallet server
like `lightwalletd`).

---

## Proposed real backend architecture

This is a **suggestion**, not a constraint — adapt to what fits the team. The
contract is designed so the UI doesn't care which of these you choose.

**Shape of the work:**

1. **Wallet + chain access.** Stand up a Zcash wallet capable of generating
   unified addresses, detecting incoming shielded notes, decrypting memos, and
   exporting viewing keys / payment disclosures. Practical options: a Rust
   service around `librustzcash`/`zcash_client_backend` talking to `lightwalletd`,
   or `zcashd`/`zebra` + a wallet layer.
2. **Application API.** Wrap the wallet in an HTTP/RPC API exposing the contract
   operations (create invoice, get payment request, list/reconcile, balance,
   ledgers, disclosure, verify). Persist invoices, customers, packs, and
   captured KES rates in a real database.
3. **Note-detection worker.** A background job that scans incoming notes,
   matches memo + value to outstanding invoices, and flips them to paid +
   reconciled — this is what replaces `simulatePaymentReceived`.
4. **Wire the frontend to the API.** Replace the bodies in `zcashService.ts`
   with calls to your API. Two clean options:
   - **Keep the module client-side** and `fetch()` your API from inside each
     function (smallest diff; keep the `useZcash` store, or move reads to a data
     library), or
   - **Move reads to Next.js server components / route handlers** and call the
     wallet service server-side (better for secrets and key custody).

**Key custody is the sensitive part.** Spending keys and viewing keys must never
reach the browser. Whichever option you choose, keep key material and
disclosure generation server-side.

---

## Backend onboarding checklist

1. `npm install && npm run dev`, click through the whole [demo flow](#the-demo-flow-end-to-end) so the product is in your head.
2. Read `lib/zcashService.ts` top to bottom — it's commented as a spec.
3. Read `lib/types.ts` — the data contract.
4. `grep -n "TODO: real Zcash" lib/zcashService.ts` — that's your task list.
5. Decide the backend shape ([above](#proposed-real-backend-architecture)) and where keys live.
6. Implement the wallet/indexer + storage; replace function bodies, **not signatures**.
7. Replace `simulatePaymentReceived` with real incoming-note detection.
8. Wire `zecToKes` to a live rate oracle.
9. Verify the UI still works unchanged at each step.

---

## Open questions / decisions to make

These aren't answered by the prototype — flag them early with the team:

- **Key custody model** — custodial wallet vs. user-held keys; where the
  account spending key and viewing keys live.
- **Network** — testnet first vs. mainnet; which light-wallet infra.
- **Persistence** — database choice and multi-tenant model (one business today;
  seed data is a single Kenyan business, "Zira Studio Ltd").
- **Auth** — there is no authentication in the prototype; the app assumes one
  signed-in business. Real auth/session handling is out of scope here and needs
  designing.
- **Price oracle** — source and caching policy for ZEC→KES; the rate is captured
  at invoice issue time for the books.
- **Auditor delivery** — how disclosure packs reach an external auditor (the
  prototype shows an in-app auditor inbox; production may need export/links).

---

## Conventions

- **The product name lives in one place:** `lib/brand.ts` (`BRAND.name`).
  Rename there and it updates across the UI.
- **The UI never inlines mock data** and never imports Zcash logic directly — it
  goes through `lib/zcashService.ts`. Keep it that way.
- **Extend types additively** (`lib/types.ts`) so the frontend keeps compiling.
- **Domain accuracy matters** — keep the Zcash terminology correct (shielded
  notes, unified addresses, encrypted memos, viewing keys, ZIP-321). Privacy is
  the default; disclosure is always explicit and holder-initiated.
