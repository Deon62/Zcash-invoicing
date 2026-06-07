//! Zcash wallet operations using real librustzcash crates.
//!
//! Everything in this module is deterministic: given the same seed and the
//! same diversifier index you always get the same address.  No randomness is
//! introduced here — randomness only enters in seed.rs when the seed is first
//! generated.

use anyhow::Context;
use base64::{engine::general_purpose::STANDARD, Engine};
use zcash_keys::keys::{UnifiedAddressRequest, UnifiedFullViewingKey, UnifiedSpendingKey};
use zcash_protocol::{
    consensus::Network,
    memo::{Memo, MemoBytes},
    value::Zatoshis,
};
use zip32::{AccountId, DiversifierIndex};

pub struct Wallet {
    pub ufvk: UnifiedFullViewingKey,
    pub network: Network,
    pub lightwalletd_url: String,
}

impl Wallet {
    /// Derive the wallet from a BIP-39 seed.
    ///
    /// - `seed`    — 64-byte output of `Mnemonic::to_seed("")`
    /// - `network` — `Network::TestNetwork` or `Network::MainNetwork`
    ///
    /// The spending key is derived at the account 0 path.
    /// We store only the UFVK (read-only) in `AppState`; the USK is dropped
    /// after key derivation so the spending key is not held in memory longer
    /// than necessary.
    pub fn from_seed(seed: &[u8], network: Network, lightwalletd_url: String) -> anyhow::Result<Self> {
        let usk = UnifiedSpendingKey::from_seed(&network, seed, AccountId::ZERO)
            .map_err(|e| anyhow::anyhow!("spending key derivation failed: {e:?}"))?;

        let ufvk = usk.to_unified_full_viewing_key();

        Ok(Self { ufvk, network, lightwalletd_url })
    }

    /// Derive the account-level unified address (used as the business profile address).
    pub fn account_address(&self) -> anyhow::Result<String> {
        let (addr, _) = self
            .ufvk
            .find_address(DiversifierIndex::new(), UnifiedAddressRequest::AllAvailableKeys)
            .context("failed to derive default address")?;
        Ok(addr.encode(&self.network))
    }

    /// Derive a unique unified address for a specific invoice.
    ///
    /// Each invoice gets its own diversified address.  Diversification means
    /// the addresses look completely unrelated on-chain even though they all
    /// belong to the same wallet.  We use the invoice sequence number
    /// (0, 1, 2, …) as the diversifier index so addresses are reproducible.
    pub fn invoice_address(&self, diversifier_index: u32) -> anyhow::Result<String> {
        // DiversifierIndex is an 11-byte counter; u32 gives us 4 billion invoices.
        let di = DiversifierIndex::from(diversifier_index);

        let (addr, _) = self
            .ufvk
            .find_address(di, UnifiedAddressRequest::AllAvailableKeys)
            .context("diversifier exhausted")?;

        Ok(addr.encode(&self.network))
    }

    /// Build the ZIP-321 `zcash:` payment URI.
    ///
    /// ZIP-321 is the standard that Zcash wallets use to parse payment
    /// requests — it's what the QR code encodes.  The memo is base64-encoded
    /// so it survives URL encoding in the URI.
    pub fn payment_uri(&self, address: &str, amount_zec: f64, memo_text: &str) -> anyhow::Result<String> {
        // Validate memo length (Zcash memos are at most 512 bytes).
        let memo: Memo = memo_text
            .parse()
            .map_err(|_| anyhow::anyhow!("memo exceeds 512 bytes"))?;

        // Convert ZEC to zatoshi (1 ZEC = 100_000_000 zatoshi) and validate.
        let zatoshi = (amount_zec * 1e8).round() as u64;
        let _amount = Zatoshis::from_u64(zatoshi)
            .map_err(|_| anyhow::anyhow!("invalid amount: {amount_zec} ZEC"))?;

        // Encode memo as base64 for the URI's `memo=` parameter.
        let memo_b64 = STANDARD.encode(MemoBytes::from(&memo).as_slice());

        // Single-payment ZIP-321 URI.
        Ok(format!("zcash:{address}?amount={amount_zec}&memo={memo_b64}"))
    }

    /// Returns the Unified Full Viewing Key as a bech32m string (`uview1…`).
    ///
    /// Sharing this with an auditor gives them read-only access to all
    /// transactions the wallet has received.  They can see amounts, memos, and
    /// sender addresses — but cannot spend a single zatoshi.
    pub fn viewing_key_string(&self) -> String {
        self.ufvk.encode(&self.network)
    }

    /// Verify that a specific transaction exists on-chain and that the value
    /// the auditor declared matches what the chain recorded.
    ///
    /// This calls lightwalletd's `GetTransaction` RPC to fetch the raw
    /// transaction, then decrypts the shielded output using the UFVK to read
    /// the actual committed value.
    pub async fn verify_transaction(
        &self,
        txid_hex: &str,
        declared_zec: f64,
    ) -> anyhow::Result<(f64, bool)> {
        use crate::grpc::LightwalletdClient;
        use sapling_crypto::note_encryption::{
            PreparedIncomingViewingKey, Zip212Enforcement, try_sapling_note_decryption,
        };
        use std::io::Cursor;
        use zcash_primitives::transaction::Transaction;
        use zcash_protocol::consensus::BranchId;
        use zip32::Scope;

        let mut client = LightwalletdClient::connect(&self.lightwalletd_url).await?;
        let raw_tx = client.get_transaction(txid_hex).await?;

        let tx = Transaction::read(Cursor::new(&raw_tx), BranchId::Nu5)
            .context("failed to parse raw transaction")?;

        // Derive the Sapling incoming viewing key for note decryption.
        let sapling_ivk = self
            .ufvk
            .sapling()
            .map(|fvk| fvk.to_ivk(Scope::External));

        if let (Some(bundle), Some(ivk)) = (tx.sapling_bundle(), sapling_ivk) {
            let prepared_ivk = PreparedIncomingViewingKey::new(&ivk);
            for output in bundle.shielded_outputs() {
                if let Some((note, _addr, _memo)) =
                    try_sapling_note_decryption(&prepared_ivk, output, Zip212Enforcement::On)
                {
                    let on_chain_zec = note.value().inner() as f64 / 1e8;
                    let declared_zatoshi = (declared_zec * 1e8).round() as u64;
                    let matches = note.value().inner() == declared_zatoshi;
                    return Ok((on_chain_zec, matches));
                }
            }
        }

        // No output decrypted to us — treat as unverified.
        Ok((0.0, false))
    }
}

/// Parse the network from the `ZCASH_NETWORK` environment variable.
pub fn network_from_env() -> anyhow::Result<Network> {
    match std::env::var("ZCASH_NETWORK")
        .unwrap_or_else(|_| "testnet".into())
        .to_lowercase()
        .as_str()
    {
        "mainnet" => Ok(Network::MainNetwork),
        "testnet" => Ok(Network::TestNetwork),
        other => Err(anyhow::anyhow!(
            "Unknown ZCASH_NETWORK '{other}'. Use 'mainnet' or 'testnet'."
        )),
    }
}
