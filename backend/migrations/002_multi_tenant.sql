-- ── Multi-tenant schema ───────────────────────────────────────────────────────
-- Each registered business gets its own row here.
-- The `business` table (singular) from migration 001 remains but is no longer
-- used by new code — it holds the legacy seed business.

CREATE TABLE IF NOT EXISTS businesses (
    id               TEXT PRIMARY KEY,          -- "biz_<uuid_short>"
    name             TEXT NOT NULL,
    tax_pin          TEXT NOT NULL DEFAULT '',
    email            TEXT NOT NULL UNIQUE,
    password_hash    TEXT NOT NULL,             -- argon2id PHC string
    unified_address  TEXT NOT NULL DEFAULT '',  -- filled in once wallet is derived
    created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Per-business wallet. Each business gets its own encrypted BIP-39 seed.
-- Replaces the single-row `wallet` table from migration 001.
CREATE TABLE IF NOT EXISTS wallets (
    business_id         TEXT    PRIMARY KEY REFERENCES businesses(id) ON DELETE CASCADE,
    encrypted_seed      BLOB    NOT NULL,
    nonce               BLOB    NOT NULL,
    birthday_height     INTEGER NOT NULL,
    last_scanned_height INTEGER NOT NULL DEFAULT 0
);

-- Extend existing tables with business_id.
-- SQLite requires a DEFAULT for ADD COLUMN on non-empty tables.
-- Rows created before this migration get 'biz_legacy' which is never in
-- `businesses` — those rows are orphaned seed data and can be ignored.
ALTER TABLE customers        ADD COLUMN business_id TEXT NOT NULL DEFAULT 'biz_legacy';
ALTER TABLE invoices         ADD COLUMN business_id TEXT NOT NULL DEFAULT 'biz_legacy';
ALTER TABLE disclosure_packs ADD COLUMN business_id TEXT NOT NULL DEFAULT 'biz_legacy';

-- Indexes for the common WHERE business_id = ? filter.
CREATE INDEX IF NOT EXISTS idx_customers_biz ON customers(business_id);
CREATE INDEX IF NOT EXISTS idx_invoices_biz  ON invoices(business_id);
CREATE INDEX IF NOT EXISTS idx_packs_biz     ON disclosure_packs(business_id);
