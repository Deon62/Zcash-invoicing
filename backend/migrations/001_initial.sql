-- ── Wallet (one row, always id=1) ────────────────────────────────────────────
-- Stores the AES-256-GCM encrypted BIP-39 seed so the raw seed never
-- appears in env vars, config files, or logs.
CREATE TABLE IF NOT EXISTS wallet (
    id               INTEGER PRIMARY KEY CHECK (id = 1),
    encrypted_seed   BLOB    NOT NULL,   -- AES-256-GCM ciphertext of the 64-byte seed
    nonce            BLOB    NOT NULL,   -- 12-byte GCM nonce used during encryption
    -- The block height at which this wallet was created.
    -- The scanner starts here so it does not scan the entire chain from block 0.
    birthday_height  INTEGER NOT NULL
);

-- ── Business (one row, always id=1) ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS business (
    id               INTEGER PRIMARY KEY CHECK (id = 1),
    name             TEXT NOT NULL,
    tax_pin          TEXT NOT NULL,
    -- The account-level unified address derived from the wallet's UFVK.
    -- Populated on startup after wallet keys are loaded.
    unified_address  TEXT NOT NULL DEFAULT ''
);

-- ── Customers ─────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS customers (
    id       TEXT PRIMARY KEY,
    name     TEXT NOT NULL,
    email    TEXT NOT NULL,
    tax_pin  TEXT
);

-- ── Invoices ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS invoices (
    id               TEXT PRIMARY KEY,
    customer_id      TEXT    NOT NULL REFERENCES customers(id),
    customer_name    TEXT    NOT NULL,
    line_items       TEXT    NOT NULL,   -- JSON: [{description, quantity, unit_price_zec}]
    amount_zec       REAL    NOT NULL,
    amount_kes       INTEGER NOT NULL,   -- KES equivalent captured at issue time
    issue_date       TEXT    NOT NULL,
    due_date         TEXT    NOT NULL,
    status           TEXT    NOT NULL DEFAULT 'awaiting_payment',
    recon_status     TEXT    NOT NULL DEFAULT 'unreconciled',
    memo             TEXT    NOT NULL,   -- embedded in the shielded note (<= 512 bytes)
    unified_address  TEXT    NOT NULL,   -- the diversified address for this invoice
    -- diversifier_index tracks which BIP-32 diversifier was used so we can
    -- re-derive the address later without scanning the key store.
    diversifier_index INTEGER NOT NULL DEFAULT 0,
    txid             TEXT,               -- set once the payment lands on chain
    paid_date        TEXT,
    created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

-- ── Disclosure packs ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS disclosure_packs (
    id             TEXT PRIMARY KEY,
    scope          TEXT NOT NULL,        -- 'viewing_key' | 'payment'
    created_at     TEXT NOT NULL,
    range_start    TEXT,
    range_end      TEXT,
    business_name  TEXT NOT NULL,
    tax_pin        TEXT NOT NULL,
    viewing_key    TEXT,                 -- UFVK string; only present for viewing_key scope
    items          TEXT NOT NULL,        -- JSON: [DisclosureItem]
    total_zec      REAL NOT NULL,
    total_kes      INTEGER NOT NULL
);

-- ── Seed: business profile ────────────────────────────────────────────────────
-- unified_address is filled in on first startup once keys are derived.
INSERT OR IGNORE INTO business (id, name, tax_pin, unified_address)
VALUES (1, 'Zira Studio Ltd', 'P051728394Z', '');

-- ── Seed: customer book ───────────────────────────────────────────────────────
INSERT OR IGNORE INTO customers VALUES
    ('cus_acacia',   'Acacia Digital Ltd',      'ap@acaciadigital.co.ke',           'P051110021A'),
    ('cus_mara',     'Mara Coffee Exporters',   'finance@maracoffee.co.ke',         'P051220034C'),
    ('cus_savannah', 'Savannah Logistics',      'accounts@savannahlogistics.co.ke', 'P051330047L'),
    ('cus_nairobi',  'Nairobi Fintech Hub',     'ops@nairobifintech.co.ke',         'P051440058H'),
    ('cus_tuga',     'Tuga Foods Ltd',          'payables@tugafoods.co.ke',         'P051550069F');
