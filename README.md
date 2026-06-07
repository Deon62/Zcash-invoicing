# Arelis

**Shielded invoicing & compliance on Zcash.** Invoice and get paid in private
(shielded) ZEC, then selectively disclose records to an auditor on demand.
Private from competitors by default; provable to an auditor on the holder's
terms.

This is a **clickable frontend prototype** with mock data — no live Zcash
integration yet. It doubles as the blueprint for the backend.

## Run

```bash
npm install
npm run dev
```

Then open http://localhost:3000.

> State (invoices, payments, disclosure packs) is held in the browser via
> `localStorage`. Use **Reset demo** in the sidebar to return to seed data.

## The demo flow (end to end)

1. **Create invoice** → customer, line items, live KES equivalent.
2. **Payment request** → QR code, shielded unified address, encrypted memo.
3. **Simulate payment received** → invoice flips to paid and auto-reconciles.
4. **The reveal** → toggle Public view (everything shielded) vs Auditor view
   (decrypted) of the same transactions. This contrast is the point.
5. **Generate disclosure pack** → pick a date range or specific invoices, choose
   full viewing key vs per-invoice payment disclosure.
6. **Auditor verification** → the auditor opens the pack and verifies each
   receipt on-chain, proving declared revenue equals real receipts.

## Architecture: the backend contract

All data and every Zcash operation are isolated behind a single module:

```
lib/zcashService.ts
```

Every function the UI needs lives there with a TypeScript signature, a JSDoc
note describing what the real implementation will do, and a `// TODO: real Zcash`
marker. **The UI only ever calls these functions and never inlines mock data.**
These signatures are the contract the real backend must implement.

Key functions: `createInvoice`, `getPaymentRequest`, `simulatePaymentReceived`,
`listInvoices`, `reconcilePayments`, `getAccountBalanceShielded`,
`generateViewingKeyDisclosure`, `generatePaymentDisclosure`, `verifyDisclosure`,
plus the dual-view ledgers `getPublicLedger` / `getAuditorLedger`.

## Renaming

The product name lives in one place: `lib/brand.ts` (`BRAND.name`).

## Tech

Next.js (App Router) · TypeScript · Tailwind CSS · shadcn-style components ·
lucide-react · qrcode.react · recharts.

## Zcash notes (kept domain-accurate)

- Payments are **shielded ZEC** sent to a **unified address**.
- Each payment request embeds the invoice reference in the **encrypted memo**
  (≤ 512 bytes).
- Disclosure has two modes: a **full viewing key** (account / date-range scope)
  and a **payment disclosure** (single invoice). Privacy is the default;
  disclosure is always an explicit, holder-initiated action — never automatic.
- ZEC amounts show a mocked **KES** equivalent, since revenue is assessed in KES.
