//! Wallet seed lifecycle — per-business edition.
//!
//! Each registered business gets its own BIP-39 seed, encrypted with the same
//! WALLET_KEY and stored in the `wallets` table (keyed by `business_id`).
//!
//! Recovery: the 24-word mnemonic re-derives the identical seed (and therefore
//! the identical keys and addresses) if the database is ever lost.

use aes_gcm::{
    aead::{Aead, AeadCore, KeyInit, OsRng},
    Aes256Gcm, Key, Nonce,
};
use bip39::Mnemonic;
use rand::RngCore;
use sqlx::SqlitePool;
use zeroize::Zeroizing;

// ── Encryption key ────────────────────────────────────────────────────────────

/// Read WALLET_KEY from the environment and decode it as a 32-byte hex string.
pub fn load_encryption_key() -> anyhow::Result<[u8; 32]> {
    let hex_str = std::env::var("WALLET_KEY").map_err(|_| {
        anyhow::anyhow!(
            "WALLET_KEY is not set.\n\
             Generate one with:  openssl rand -hex 32\n\
             Then add it to your .env file."
        )
    })?;

    let bytes = hex::decode(hex_str.trim())
        .map_err(|e| anyhow::anyhow!("WALLET_KEY must be 64 hex characters (32 bytes): {e}"))?;

    if bytes.len() != 32 {
        return Err(anyhow::anyhow!(
            "WALLET_KEY must be 32 bytes (64 hex chars), got {}",
            bytes.len()
        ));
    }

    let mut key = [0u8; 32];
    key.copy_from_slice(&bytes);
    Ok(key)
}

// ── Per-business wallet operations ────────────────────────────────────────────

/// Generate a fresh BIP-39 seed for a new business, print the mnemonic banner,
/// encrypt the seed, and store it in `wallets`.
///
/// Returns the 64-byte seed so the caller can immediately derive wallet keys.
/// Returns (seed_bytes, mnemonic_phrase). The phrase is returned so the caller
/// can include it once in the HTTP registration response — the user must write
/// it down before it disappears.
pub async fn create_for_business(
    db: &SqlitePool,
    enc_key: &[u8; 32],
    business_id: &str,
    birthday_height: i64,
) -> anyhow::Result<(Zeroizing<Vec<u8>>, String)> {
    let mut entropy = [0u8; 32];
    OsRng.fill_bytes(&mut entropy);
    let mnemonic = Mnemonic::from_entropy(&entropy)
        .map_err(|e| anyhow::anyhow!("BIP-39 generation failed: {e}"))?;

    let phrase = mnemonic.to_string();
    let seed = Zeroizing::new(mnemonic.to_seed("").to_vec());
    print_mnemonic_banner(&phrase, business_id);

    let (ciphertext, nonce) = encrypt(enc_key, &seed)?;

    sqlx::query(
        "INSERT INTO wallets (business_id, encrypted_seed, nonce, birthday_height, last_scanned_height)
         VALUES (?, ?, ?, ?, ?)",
    )
    .bind(business_id)
    .bind(&ciphertext)
    .bind(&nonce)
    .bind(birthday_height)
    .bind(birthday_height)
    .execute(db)
    .await?;

    tracing::info!("new wallet created for business {business_id}");
    Ok((seed, phrase))
}

/// Load and decrypt the seed for an existing business.
pub async fn load_for_business(
    db: &SqlitePool,
    enc_key: &[u8; 32],
    business_id: &str,
) -> anyhow::Result<Zeroizing<Vec<u8>>> {
    let row: Option<(Vec<u8>, Vec<u8>)> =
        sqlx::query_as("SELECT encrypted_seed, nonce FROM wallets WHERE business_id = ?")
            .bind(business_id)
            .fetch_optional(db)
            .await?;

    let (ciphertext, nonce) = row.ok_or_else(|| {
        anyhow::anyhow!("no wallet found for business {business_id}")
    })?;

    let seed = decrypt(enc_key, &ciphertext, &nonce)?;
    Ok(Zeroizing::new(seed))
}

/// The last block height this business's wallet has fully scanned.
pub async fn last_scanned_height_for(db: &SqlitePool, business_id: &str) -> anyhow::Result<u64> {
    let h: Option<i64> =
        sqlx::query_scalar("SELECT last_scanned_height FROM wallets WHERE business_id = ?")
            .bind(business_id)
            .fetch_optional(db)
            .await?;
    Ok(h.unwrap_or(0) as u64)
}

/// Advance the stored scan height after processing a batch of blocks.
pub async fn set_scanned_height_for(
    db: &SqlitePool,
    business_id: &str,
    height: u64,
) -> anyhow::Result<()> {
    sqlx::query("UPDATE wallets SET last_scanned_height = ? WHERE business_id = ?")
        .bind(height as i64)
        .bind(business_id)
        .execute(db)
        .await?;
    Ok(())
}

// ── AES-256-GCM helpers ───────────────────────────────────────────────────────

fn encrypt(key: &[u8; 32], plaintext: &[u8]) -> anyhow::Result<(Vec<u8>, Vec<u8>)> {
    let cipher = Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(key));
    let nonce = Aes256Gcm::generate_nonce(&mut OsRng);
    let ciphertext = cipher
        .encrypt(&nonce, plaintext)
        .map_err(|_| anyhow::anyhow!("seed encryption failed"))?;
    Ok((ciphertext, nonce.to_vec()))
}

fn decrypt(key: &[u8; 32], ciphertext: &[u8], nonce: &[u8]) -> anyhow::Result<Vec<u8>> {
    let cipher = Aes256Gcm::new(Key::<Aes256Gcm>::from_slice(key));
    let nonce = Nonce::from_slice(nonce);
    cipher.decrypt(nonce, ciphertext).map_err(|_| {
        anyhow::anyhow!(
            "Seed decryption failed — is WALLET_KEY the same value used when the wallet was created?"
        )
    })
}

fn print_mnemonic_banner(phrase: &str, business_id: &str) {
    eprintln!();
    eprintln!("╔══════════════════════════════════════════════════════════════════╗");
    eprintln!("║              NEW WALLET CREATED — WRITE THIS DOWN               ║");
    eprintln!("║  Business: {:<55}║", business_id);
    eprintln!("║  These 24 words are the only backup of this wallet.             ║");
    eprintln!("║  You will NOT see this again.                                   ║");
    eprintln!("╠══════════════════════════════════════════════════════════════════╣");
    eprintln!();
    for (i, word) in phrase.split_whitespace().enumerate() {
        eprint!("  {:2}. {:<12}", i + 1, word);
        if (i + 1) % 4 == 0 {
            eprintln!();
        }
    }
    eprintln!();
    eprintln!("╚══════════════════════════════════════════════════════════════════╝");
    eprintln!();
}
