use std::sync::Arc;

use dashmap::DashMap;
use sqlx::SqlitePool;
use zcash_protocol::consensus::Network;
use zeroize::Zeroizing;

use crate::{seed, wallet::Wallet};

/// Shared state injected into every route handler via axum's State extractor.
#[derive(Clone)]
pub struct AppState {
    pub db: SqlitePool,
    /// AES-256-GCM key used to encrypt/decrypt all wallet seeds in the database.
    pub enc_key: Arc<[u8; 32]>,
    pub network: Network,
    pub lightwalletd_url: String,
    pub jwt_secret: String,
    /// Cache of loaded wallets — avoids re-deriving keys on every request.
    pub wallets: Arc<DashMap<String, Arc<Wallet>>>,
}

impl AppState {
    /// Return the wallet for `business_id`, loading and caching it on first call.
    pub async fn get_wallet(&self, business_id: &str) -> anyhow::Result<Arc<Wallet>> {
        if let Some(entry) = self.wallets.get(business_id) {
            return Ok(entry.value().clone());
        }
        let seed: Zeroizing<Vec<u8>> =
            seed::load_for_business(&self.db, &self.enc_key, business_id).await?;
        let wallet = Arc::new(Wallet::from_seed(
            &seed,
            self.network,
            self.lightwalletd_url.clone(),
        )?);
        self.wallets.insert(business_id.to_string(), wallet.clone());
        Ok(wallet)
    }
}
