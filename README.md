# Arelis

**Shielded invoicing & compliance on Zcash.** Invoice and get paid in private
(shielded) ZEC, then selectively disclose records to an auditor on demand.
Private from competitors by default; provable to an auditor on the holder's
terms.

> **Status:** Working prototype with a real Rust backend. Authentication, invoice
> management, customer CRUD, disclosure packs, and wallet address derivation are
> all live. Zcash payments are simulated (no live lightwalletd sync yet) — the
> architecture is built so a real on-chain scanner drops in behind the same API.

---

## Table of contents

1. [Run it locally](#run-it-locally)
2. [Environment variables](#environment-variables)
3. [Tech stack](#tech-stack)
4. [Architecture](#architecture)
5. [Repository map](#repository-map)
6. [API reference](#api-reference)
7. [The demo flow, end to end](#the-demo-flow-end-to-end)
8. [Domain types](#domain-types)
9. [Zcash primer (just enough)](#zcash-primer-just-enough)
10. [Conventions](#conventions)

---

## Run it locally

### Prerequisites

| Tool | Version |
| ---- | ------- |
| Rust | latest stable (`rustup update stable`) |
| Node.js | 18+ (20 LTS recommended) |
| npm | bundled with Node |

### 1 — Backend (Rust / Axum)

```bash
cd backend

# The repo ships a ready-to-use .env — review and edit if needed (see below).
# For a fresh clone, copy the example:
#   cp .env.example .env   # if .env.example exists; otherwise the defaults below apply

cargo run
```

The server starts on **http://localhost:8081** and creates `arelis.db` (SQLite)
on first run. Migrations run automatically at startup.

To rebuild after a code change just run `cargo run` again, or use
`cargo watch -x run` for auto-reload (install with `cargo install cargo-watch`).

### 2 — Frontend (Next.js)

In a separate terminal:

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:3000**.

| Script | What it does |
| ------ | ------------ |
| `npm run dev` | Start Next.js dev server with HMR |
| `npm run build` | Production build |
| `npm run start` | Serve the production build |
| `npm run lint` | Run `next lint` |

---

## Environment variables

The backend reads its config from `backend/.env` (loaded automatically via
[`dotenvy`](https://crates.io/crates/dotenvy)). All variables have safe
defaults for local development — only `WALLET_KEY` must be set before first
run if you want wallet address derivation to work.

```dotenv
# SQLite database file path
DATABASE_URL=sqlite:arelis.db

# HTTP bind address
BIND_ADDR=0.0.0.0:8081

# JWT signing secret — change this in any shared/production environment
JWT_SECRET=arelis-jwt-secret-change-in-production

# Log level
RUST_LOG=arelis_backend=debug,tower_http=debug

# AES key used to encrypt wallet seeds at rest.
# Generate once with:  openssl rand -hex 32
# Keep this safe — losing it means you can't decrypt stored seeds.
# (You can still recover funds from the 24-word mnemonic printed on first run.)
WALLET_KEY=<hex-encoded-32-byte-key>

# Zcash network: 'testnet' | 'mainnet'
ZCASH_NETWORK=testnet

# lightwalletd endpoint (used for future on-chain scanning)
LIGHTWALLETD_URL=https://lightwalletd.testnet.electriccoin.co:9067
```

The frontend reads one variable from `frontend/.env.local`:

```dotenv
NEXT_PUBLIC_API_URL=http://localhost:8081   # default if unset
```

---

## Tech stack

**Backend**

| Layer | Technology |
| ----- | ---------- |
| Language | Rust (edition 2021) |
| HTTP framework | Axum |
| Database | SQLite via sqlx (async, compile-time checked queries) |
| Migrations | sqlx-migrate (`backend/migrations/`) |
| Auth | JWT (HS256) via `jsonwebtoken`; passwords hashed with `argon2` |
| Wallet | `zcash_client_backend` / `librustzcash` (testnet, Orchard) |
| Async runtime | Tokio |

**Frontend**

| Layer | Technology |
| ----- | ---------- |
| Framework | Next.js (App Router) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS + shadcn-style UI components |
| Icons | lucide-react |
| Charts | recharts |
| QR codes | qrcode.react |

---

## Architecture

```
Browser (Next.js)
  └─ app/(app)/**          authenticated route group
  └─ lib/zcashService.ts   service layer — all backend calls go through here
  └─ lib/api.ts            raw fetch wrappers; attaches JWT; throws AuthError on 401
  └─ lib/useZcash.ts       useSyncExternalStore hook; re-renders on every mutation

        │  HTTP (JSON) on :8081
        ▼

Rust backend (Axum)
  └─ api.rs                route handlers
  └─ auth.rs               JWT middleware + password hashing
  └─ db.rs                 sqlx queries (businesses, customers, invoices, packs)
  └─ wallet.rs             zcash_client_backend wrapper (address derivation, keys)
  └─ worker.rs             background note-scanner (runs every 30 s, per business)
  └─ seed.rs               wallet seed creation + AES-GCM encryption at rest
  └─ state.rs              shared AppState (db pool, wallet cache, config)

        │  sqlx
        ▼

SQLite (arelis.db)
  └─ businesses            accounts + hashed passwords + unified addresses
  └─ wallets               AES-encrypted seed phrases, per business
  └─ customers             per-business customer directory
  └─ invoices              per-business invoices, diversifier indices
  └─ disclosure_packs      generated audit packs
```

**Auth flow:** register or login → receive JWT → store in `localStorage`
(`arelis_token`) → every API request sends `Authorization: Bearer <token>` →
backend middleware validates and extracts `business_id` → 401 redirects the
frontend to `/login`.

---

## Repository map

```
backend/
  src/
    main.rs              Server bootstrap, router, migration runner
    api.rs               Route handlers (all business logic)
    auth.rs              JWT creation/validation, password hashing
    db.rs                All sqlx queries
    wallet.rs            zcash_client_backend wrapper
    worker.rs            Background payment scanner
    seed.rs              Seed phrase generation + encryption
    state.rs             AppState struct
    types.rs             Shared domain types (mirrors frontend types.ts)
    error.rs             AppError enum → HTTP response mapping
  migrations/
    001_initial.sql
    002_multi_tenant.sql
  .env                   Local environment config (not committed in production)
  Cargo.toml

frontend/
  app/
    layout.tsx           Root layout
    page.tsx             Marketing landing page ("/")
    (app)/               Authenticated app routes (wrapped in AppShell)
      layout.tsx
      dashboard/         Revenue overview, balance, recent activity
      invoices/          Invoice list, create, detail + payment QR
      customers/         Customer directory
      compliance/        Privacy / share / verify panels
      auditor/           Auditor inbox + pack verification
      profile/           Business profile
      settings/          Settings
    login/               Login page
    register/            Registration page
  components/
    AppShell.tsx         Sidebar + auth guard
    BusinessMenu.tsx     Business switcher (sign-out lives here)
    ui/                  shadcn-style primitives
    compliance/          PrivacyPanel, SharePanel, VerifyPanel
  lib/
    api.ts               ★ Raw fetch wrappers + token storage
    zcashService.ts      ★ Service layer (cache + mutations)
    types.ts             Domain types
    useZcash.ts          React store hook
    brand.ts             Product naming (single source of truth)
```

---

## API reference

All endpoints are prefixed `/api/`. Authenticated routes require
`Authorization: Bearer <token>`.

| Method | Path | Auth | Description |
| ------ | ---- | ---- | ----------- |
| GET | `/health` | — | Liveness check |
| POST | `/auth/register` | — | Create account, returns JWT + mnemonic |
| POST | `/auth/login` | — | Returns JWT |
| GET | `/auth/me` | ✓ | Current business profile |
| GET | `/customers` | ✓ | List customers |
| POST | `/customers` | ✓ | Create customer |
| PUT | `/customers/:id` | ✓ | Update customer |
| DELETE | `/customers/:id` | ✓ | Delete customer |
| GET | `/invoices` | ✓ | List invoices (newest first) |
| POST | `/invoices` | ✓ | Create invoice |
| GET | `/invoices/:id` | ✓ | Get invoice |
| GET | `/invoices/:id/payment-request` | ✓ | ZIP-321 payment URI + QR data |
| POST | `/invoices/:id/simulate-payment` | ✓ | Mark invoice paid (demo only) |
| POST | `/reconcile` | ✓ | Reconcile paid invoices by memo |
| GET | `/balance` | ✓ | Shielded balance (sum of paid invoices) |
| GET | `/monthly-summary` | ✓ | Per-month revenue series |
| GET | `/ledger/public` | ✓ | Opaque on-chain transaction view |
| GET | `/ledger/auditor` | ✓ | Decrypted transaction view |
| POST | `/disclosure/viewing-key` | ✓ | Generate viewing-key disclosure pack |
| POST | `/disclosure/payment-pack` | ✓ | Generate per-invoice disclosure pack |
| GET | `/disclosure` | ✓ | List disclosure packs |
| GET | `/disclosure/:id` | ✓ | Get disclosure pack |
| POST | `/disclosure/:id/verify` | ✓ | Verify disclosure pack |

---

## The demo flow, end to end

1. **Register** — create a business account; a Zcash testnet wallet is derived
   and a 24-word mnemonic is returned once (save it).
2. **Create a customer** — name, email, optional tax PIN.
3. **Create an invoice** — line items with ZEC amounts, due date; a diversified
   unified address is derived for this invoice.
4. **Payment request** — a ZIP-321 `zcash:` QR code with the address, amount,
   and encrypted memo embedding the invoice reference.
5. **Simulate payment** — flips the invoice to paid (replaces live note detection
   in the prototype).
6. **Reconcile** — backend matches the memo + amount to the open invoice.
7. **The reveal** — toggle Public view (opaque) vs Auditor view (decrypted) to
   see both perspectives on the same transactions.
8. **Generate disclosure pack** — scoped to a date range (viewing key) or
   specific invoices (payment disclosure).
9. **Auditor verification** — verifies each receipt in the pack against the
   declared amounts.

---

## Domain types

Defined in `backend/src/types.rs` (Rust) and mirrored in
`frontend/lib/types.ts` (TypeScript). Extend additively — don't remove or
rename existing fields.

- **`Business`** — account profile: name, email, tax PIN, unified address.
- **`Customer`** — directory entry: name, email, optional tax PIN.
- **`Invoice`** / **`LineItem`** / **`CreateInvoiceInput`** — invoicing.
  `status`: `draft | awaiting_payment | paid`;
  `recon_status`: `unreconciled | reconciled`;
  `memo`: the ≤ 512-byte encrypted memo; `unified_address`: shielded receiver.
- **`PaymentRequest`** — unified address, memo, amount, ZIP-321 `zcash:` URI.
- **`ReconResult`** — per-invoice match outcome.
- **`ShieldedBalance`**, **`MonthlyPoint`** — balance + dashboard series.
- **`PublicTx`** vs **`AuditorTx`** — opaque vs decrypted ledger rows.
- **`DisclosurePack`** / **`DisclosureItem`** / **`VerificationResult`** —
  disclosure and audit.

---

## Zcash primer (just enough)

- **Unified addresses** (`u1…`) encode one or more shielded receivers (Orchard,
  Sapling). Payments to them are opaque on the public chain — no visible sender,
  receiver, amount, or memo.
- **Diversified addresses.** Each invoice gets its own diversified address
  derived from the same account key, so payments can be linked back to the
  correct invoice without a separate wallet.
- **Encrypted memos.** Each shielded payment carries up to **512 bytes** of
  encrypted memo (decryptable only with the right key). Arelis embeds the
  invoice ID so payments reconcile automatically.
- **ZIP-321 payment URIs.** `zcash:<address>?amount=…&memo=…` — a standard
  the customer's wallet parses into a shielded send. The memo travels
  base64-encoded.
- **Viewing keys (UFVK).** A Full Viewing Key grants read-only visibility into
  an account's transactions. Disclosure packs use this to let an auditor verify
  revenue without access to spending keys.
- **KES.** Revenue is assessed in Kenyan Shillings; every ZEC figure carries a
  KES equivalent captured at invoice issue time.

---

## Conventions

- **Product name lives in one place:** `frontend/lib/brand.ts` (`BRAND.name`).
  Rename there and it updates across the UI.
- **The frontend never talks to Zcash directly** — all backend calls go through
  `lib/zcashService.ts` → `lib/api.ts`.
- **Extend types additively** so both the Rust and TypeScript sides keep
  compiling.
- **Key custody:** spending keys and seed phrases never leave the backend;
  the frontend only ever holds a JWT.
- **Domain accuracy matters** — keep Zcash terminology correct (shielded notes,
  unified addresses, encrypted memos, viewing keys, ZIP-321). Privacy is the
  default; disclosure is always explicit and holder-initiated.
