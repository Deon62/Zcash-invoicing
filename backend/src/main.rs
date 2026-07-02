use std::str::FromStr;
use std::sync::Arc;

use axum::{
    routing::{get, post, put},
    Router,
};
use dashmap::DashMap;
use sqlx::SqlitePool;
use sqlx::sqlite::SqliteConnectOptions;
use tower_http::cors::CorsLayer;
use tracing_subscriber::{layer::SubscriberExt, util::SubscriberInitExt};

mod api;
mod auth;
mod db;
mod error;
mod grpc;
mod seed;
mod state;
mod types;
mod wallet;
mod worker;

use state::AppState;

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    dotenvy::dotenv().ok();

    tracing_subscriber::registry()
        .with(tracing_subscriber::EnvFilter::new(
            std::env::var("RUST_LOG")
                .unwrap_or_else(|_| "arelis_backend=info,tower_http=info".into()),
        ))
        .with(tracing_subscriber::fmt::layer())
        .init();

    // ── Database ──────────────────────────────────────────────────────────────
    let database_url =
        std::env::var("DATABASE_URL").unwrap_or_else(|_| "sqlite:arelis.db".into());

    let opts = SqliteConnectOptions::from_str(&database_url)?.create_if_missing(true);
    let pool = SqlitePool::connect_with(opts).await?;
    sqlx::migrate!("./migrations").run(&pool).await?;
    tracing::info!("database ready");

    // ── Shared state ──────────────────────────────────────────────────────────
    let enc_key = seed::load_encryption_key()?;
    let jwt_secret = std::env::var("JWT_SECRET")
        .unwrap_or_else(|_| "change-me-in-production-please".into());

    let network = wallet::network_from_env()?;
    let lightwalletd_url = std::env::var("LIGHTWALLETD_URL")
        .unwrap_or_else(|_| "https://lightwalletd.testnet.electriccoin.co:9067".into());

    let state = Arc::new(AppState {
        db: pool,
        enc_key: Arc::new(enc_key),
        network,
        lightwalletd_url,
        jwt_secret,
        wallets: Arc::new(DashMap::new()),
    });

    // Pre-warm wallets for all businesses that already have one, so their
    // unified addresses are up to date in the database on every restart.
    let prewarm_state = state.clone();
    tokio::spawn(async move {
        match db::list_business_ids_with_wallets(&prewarm_state.db).await {
            Ok(ids) => {
                for id in ids {
                    match prewarm_state.get_wallet(&id).await {
                        Ok(w) => {
                            if let Ok(addr) = w.account_address() {
                                let _ = db::update_business_address(&prewarm_state.db, &id, &addr).await;
                                tracing::info!("wallet ready for {id}: {addr}");
                            }
                        }
                        Err(e) => tracing::warn!("could not load wallet for {id}: {e}"),
                    }
                }
            }
            Err(e) => tracing::error!("could not pre-warm wallets: {e}"),
        }
    });

    // Background note-scanner — runs per-business every 30 seconds.
    tokio::spawn(worker::run_all(state.clone()));

    // ── HTTP server ───────────────────────────────────────────────────────────
    let app = Router::new()
        .route("/api/health", get(api::health))
        // Auth (no JWT required)
        .route("/api/auth/register", post(api::register))
        .route("/api/auth/login", post(api::login))
        // All routes below require a valid JWT
        .route("/api/auth/me", get(api::me))
        // Customers
        .route("/api/customers", get(api::list_customers).post(api::create_customer))
        .route("/api/customers/:id", put(api::update_customer).delete(api::delete_customer))
        // Invoices
        .route("/api/invoices", get(api::list_invoices).post(api::create_invoice))
        .route("/api/invoices/:id", get(api::get_invoice))
        .route("/api/invoices/:id/payment-request", get(api::get_payment_request))
        .route("/api/invoices/:id/simulate-payment", post(api::simulate_payment))
        // Reconciliation, balance, summary
        .route("/api/reconcile", post(api::reconcile_payments))
        .route("/api/balance", get(api::get_balance))
        .route("/api/monthly-summary", get(api::get_monthly_summary))
        // The reveal
        .route("/api/ledger/public", get(api::get_public_ledger))
        .route("/api/ledger/auditor", get(api::get_auditor_ledger))
        // Disclosure
        .route("/api/disclosure/viewing-key", post(api::generate_viewing_key_disclosure))
        .route("/api/disclosure/payment-pack", post(api::generate_payment_disclosure_pack))
        .route("/api/disclosure", get(api::list_disclosure_packs))
        .route("/api/disclosure/:id", get(api::get_disclosure_pack))
        .route("/api/disclosure/:id/verify", post(api::verify_disclosure))
        .layer(CorsLayer::permissive())
        .with_state(state);

    let addr = std::env::var("BIND_ADDR").unwrap_or_else(|_| "0.0.0.0:8081".into());
    let listener = tokio::net::TcpListener::bind(&addr).await?;
    tracing::info!("listening on {addr}");
    axum::serve(listener, app).await?;

    Ok(())
}
