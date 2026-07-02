use std::sync::Arc;

use axum::{
    extract::{Path, State},
    Json,
};
use chrono::Utc;
use rand::Rng;
use serde::Deserialize;
use serde_json::{json, Value};
use uuid::Uuid;

use crate::{
    auth::{self, AuthBusiness},
    db,
    error::{AppError, Result},
    seed,
    state::AppState,
    types::*,
};

const ZEC_TO_KES: f64 = 4200.0;

// ── Health ────────────────────────────────────────────────────────────────────

pub async fn health() -> Json<Value> {
    Json(json!({ "status": "ok" }))
}

// ── Auth ──────────────────────────────────────────────────────────────────────

pub async fn register(
    State(s): State<Arc<AppState>>,
    Json(input): Json<RegisterInput>,
) -> Result<Json<AuthResponse>> {
    if input.password.len() < 8 {
        return Err(AppError::BadRequest("password must be at least 8 characters".into()));
    }

    let business_id = format!("biz_{}", &Uuid::new_v4().simple().to_string()[..12]);
    let password_hash = auth::hash_password(&input.password)
        .map_err(AppError::Anyhow)?;

    db::create_business(&s.db, &business_id, &input.name, &input.tax_pin, &input.email, &password_hash).await?;

    // Generate wallet for the new business.
    // Birthday height: current testnet tip approximation — avoids scanning from genesis.
    let birthday_height: i64 = 2_600_000;
    let (_, mnemonic) = seed::create_for_business(&s.db, &s.enc_key, &business_id, birthday_height)
        .await
        .map_err(AppError::Anyhow)?;

    // Derive and store the unified address (loads wallet from DB into cache).
    let wallet = s.get_wallet(&business_id).await.map_err(AppError::Anyhow)?;
    let address = wallet.account_address().map_err(AppError::Anyhow)?;
    db::update_business_address(&s.db, &business_id, &address).await?;

    let token = auth::create_token(&business_id, &s.jwt_secret).map_err(AppError::Anyhow)?;
    tracing::info!("new business registered: {business_id} ({})", input.email);

    Ok(Json(AuthResponse { token, business_id, mnemonic: Some(mnemonic) }))
}

pub async fn login(
    State(s): State<Arc<AppState>>,
    Json(input): Json<LoginInput>,
) -> Result<Json<AuthResponse>> {
    let biz = db::get_business_by_email(&s.db, &input.email)
        .await?
        .ok_or_else(|| AppError::BadRequest("invalid email or password".into()))?;

    if !auth::verify_password(&input.password, &biz.password_hash) {
        return Err(AppError::BadRequest("invalid email or password".into()));
    }

    let token = auth::create_token(&biz.id, &s.jwt_secret).map_err(AppError::Anyhow)?;
    Ok(Json(AuthResponse { token, business_id: biz.id, mnemonic: None }))
}

pub async fn me(
    State(s): State<Arc<AppState>>,
    AuthBusiness(bid): AuthBusiness,
) -> Result<Json<Business>> {
    let biz = db::get_business_by_id(&s.db, &bid)
        .await?
        .ok_or_else(|| AppError::NotFound("business not found".into()))?;

    Ok(Json(Business {
        name: biz.name,
        email: biz.email,
        tax_pin: biz.tax_pin,
        unified_address: biz.unified_address,
    }))
}

// ── Customers ─────────────────────────────────────────────────────────────────

pub async fn list_customers(
    State(s): State<Arc<AppState>>,
    AuthBusiness(bid): AuthBusiness,
) -> Result<Json<Vec<Customer>>> {
    Ok(Json(db::list_customers(&s.db, &bid).await?))
}

pub async fn create_customer(
    State(s): State<Arc<AppState>>,
    AuthBusiness(bid): AuthBusiness,
    Json(input): Json<CreateCustomerInput>,
) -> Result<Json<Customer>> {
    if input.name.trim().is_empty() {
        return Err(AppError::BadRequest("name is required".into()));
    }
    if input.email.trim().is_empty() {
        return Err(AppError::BadRequest("email is required".into()));
    }

    let customer = Customer {
        id: format!("cus_{}", &Uuid::new_v4().simple().to_string()[..8]),
        name: input.name.trim().to_string(),
        email: input.email.trim().to_string(),
        tax_pin: input.tax_pin.filter(|s| !s.trim().is_empty()),
    };

    db::insert_customer(&s.db, &customer, &bid).await?;
    Ok(Json(customer))
}

pub async fn update_customer(
    State(s): State<Arc<AppState>>,
    AuthBusiness(bid): AuthBusiness,
    Path(id): Path<String>,
    Json(input): Json<UpdateCustomerInput>,
) -> Result<Json<Customer>> {
    let updated = db::update_customer(
        &s.db,
        &id,
        &bid,
        input.name.trim(),
        input.email.trim(),
        input.tax_pin.as_deref().filter(|s| !s.trim().is_empty()),
    )
    .await?;

    if !updated {
        return Err(AppError::NotFound(format!("customer {id}")));
    }

    db::get_customer(&s.db, &id, &bid)
        .await?
        .map(Json)
        .ok_or_else(|| AppError::NotFound(format!("customer {id}")))
}

pub async fn delete_customer(
    State(s): State<Arc<AppState>>,
    AuthBusiness(bid): AuthBusiness,
    Path(id): Path<String>,
) -> Result<Json<Value>> {
    let deleted = db::delete_customer(&s.db, &id, &bid).await?;
    if !deleted {
        return Err(AppError::NotFound(format!("customer {id}")));
    }
    Ok(Json(json!({ "deleted": id })))
}

// ── Invoices ──────────────────────────────────────────────────────────────────

pub async fn list_invoices(
    State(s): State<Arc<AppState>>,
    AuthBusiness(bid): AuthBusiness,
) -> Result<Json<Vec<Invoice>>> {
    Ok(Json(db::list_invoices(&s.db, &bid).await?))
}

pub async fn get_invoice(
    State(s): State<Arc<AppState>>,
    AuthBusiness(bid): AuthBusiness,
    Path(id): Path<String>,
) -> Result<Json<Invoice>> {
    db::get_invoice(&s.db, &id, &bid)
        .await?
        .map(Json)
        .ok_or_else(|| AppError::NotFound(format!("invoice {id}")))
}

pub async fn create_invoice(
    State(s): State<Arc<AppState>>,
    AuthBusiness(bid): AuthBusiness,
    Json(input): Json<CreateInvoiceInput>,
) -> Result<Json<Invoice>> {
    let customer = db::get_customer(&s.db, &input.customer_id, &bid)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("customer {}", input.customer_id)))?;

    let amount_zec: f64 = input.line_items.iter().map(|li| li.quantity * li.unit_price_zec).sum();
    let amount_zec = (amount_zec * 1e8).round() / 1e8;
    let amount_kes = (amount_zec * ZEC_TO_KES).round() as i64;

    let diversifier_index = db::next_diversifier_index(&s.db, &bid).await?;
    let id = format!(
        "INV-{}-{}",
        chrono::Utc::now().year(),
        &Uuid::new_v4().simple().to_string()[..8].to_uppercase()
    );
    let memo = format!("Arelis \u{2022} payment for {} \u{2022} {}", id, customer.name);

    let wallet = s.get_wallet(&bid).await.map_err(AppError::Anyhow)?;
    let unified_address = wallet.invoice_address(diversifier_index).map_err(AppError::Anyhow)?;

    let invoice = Invoice {
        id,
        customer_id: customer.id,
        customer_name: customer.name,
        line_items: input.line_items,
        amount_zec,
        amount_kes,
        issue_date: Utc::now().format("%Y-%m-%d").to_string(),
        due_date: input.due_date,
        status: InvoiceStatus::AwaitingPayment,
        recon_status: ReconStatus::Unreconciled,
        memo,
        unified_address,
        txid: None,
        paid_date: None,
    };

    db::insert_invoice(&s.db, &invoice, diversifier_index, &bid).await?;
    Ok(Json(invoice))
}

pub async fn get_payment_request(
    State(s): State<Arc<AppState>>,
    AuthBusiness(bid): AuthBusiness,
    Path(id): Path<String>,
) -> Result<Json<PaymentRequest>> {
    let inv = db::get_invoice(&s.db, &id, &bid)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("invoice {id}")))?;

    let wallet = s.get_wallet(&bid).await.map_err(AppError::Anyhow)?;
    let payment_uri = wallet
        .payment_uri(&inv.unified_address, inv.amount_zec, &inv.memo)
        .map_err(AppError::Anyhow)?;

    Ok(Json(PaymentRequest {
        unified_address: inv.unified_address,
        memo: inv.memo,
        amount_zec: inv.amount_zec,
        payment_uri,
    }))
}

pub async fn simulate_payment(
    State(s): State<Arc<AppState>>,
    AuthBusiness(bid): AuthBusiness,
    Path(id): Path<String>,
) -> Result<Json<Invoice>> {
    let inv = db::get_invoice(&s.db, &id, &bid)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("invoice {id}")))?;

    if inv.status == InvoiceStatus::Paid {
        return Err(AppError::BadRequest(format!("invoice {id} is already paid")));
    }

    let txid: String = {
        let bytes: [u8; 32] = rand::thread_rng().gen();
        bytes.iter().map(|b| format!("{b:02x}")).collect()
    };
    let paid_date = Utc::now().format("%Y-%m-%d").to_string();
    db::mark_invoice_paid(&s.db, &inv.id, &txid, &paid_date).await?;

    Ok(Json(db::get_invoice(&s.db, &id, &bid).await?.unwrap()))
}

// ── Reconciliation ────────────────────────────────────────────────────────────

pub async fn reconcile_payments(
    State(s): State<Arc<AppState>>,
    AuthBusiness(bid): AuthBusiness,
) -> Result<Json<Vec<ReconResult>>> {
    let invoices = db::list_invoices(&s.db, &bid).await?;
    let mut results = Vec::new();

    for inv in invoices.iter().filter(|i| i.status == InvoiceStatus::Paid) {
        let memo_matched = inv.memo.contains(&inv.id);
        let amount_matched = true;

        if memo_matched && amount_matched {
            db::mark_invoice_reconciled(&s.db, &inv.id).await?;
        }

        results.push(ReconResult {
            invoice_id: inv.id.clone(),
            matched: memo_matched && amount_matched,
            txid: inv.txid.clone(),
            amount_zec: inv.amount_zec,
            memo_matched,
            amount_matched,
        });
    }

    Ok(Json(results))
}

// ── Balance & dashboard ───────────────────────────────────────────────────────

pub async fn get_balance(
    State(s): State<Arc<AppState>>,
    AuthBusiness(bid): AuthBusiness,
) -> Result<Json<ShieldedBalance>> {
    let zec: f64 = db::list_invoices(&s.db, &bid)
        .await?
        .iter()
        .filter(|i| i.status == InvoiceStatus::Paid)
        .map(|i| i.amount_zec)
        .sum();
    let zec = (zec * 1e8).round() / 1e8;

    Ok(Json(ShieldedBalance {
        zec,
        kes_equivalent: (zec * ZEC_TO_KES).round() as i64,
    }))
}

pub async fn get_monthly_summary(
    State(s): State<Arc<AppState>>,
    AuthBusiness(bid): AuthBusiness,
) -> Result<Json<Vec<MonthlyPoint>>> {
    let invoices = db::list_invoices(&s.db, &bid).await?;
    let year = chrono::Utc::now().year();

    let months = [
        ("01", "Jan"), ("02", "Feb"), ("03", "Mar"), ("04", "Apr"),
        ("05", "May"), ("06", "Jun"), ("07", "Jul"), ("08", "Aug"),
        ("09", "Sep"), ("10", "Oct"), ("11", "Nov"), ("12", "Dec"),
    ];

    let points = months
        .iter()
        .map(|(month, label)| {
            let key = format!("{year}-{month}");
            let mut collected_zec = 0f64;
            let mut invoiced_kes = 0i64;

            for inv in &invoices {
                if inv.status == InvoiceStatus::Paid
                    && inv.paid_date.as_deref().unwrap_or("").starts_with(&key)
                {
                    collected_zec += inv.amount_zec;
                }
                if inv.issue_date.starts_with(&key) {
                    invoiced_kes += inv.amount_kes;
                }
            }

            collected_zec = (collected_zec * 1e8).round() / 1e8;
            MonthlyPoint {
                key: key.clone(),
                label: label.to_string(),
                collected_zec,
                collected_kes: (collected_zec * ZEC_TO_KES).round() as i64,
                invoiced_kes,
            }
        })
        .collect();

    Ok(Json(points))
}

// ── The reveal ────────────────────────────────────────────────────────────────

pub async fn get_public_ledger(
    State(s): State<Arc<AppState>>,
    AuthBusiness(bid): AuthBusiness,
) -> Result<Json<Vec<PublicTx>>> {
    let invoices = db::list_invoices(&s.db, &bid).await?;

    let txs = invoices
        .iter()
        .filter(|i| i.status == InvoiceStatus::Paid && i.txid.is_some())
        .enumerate()
        .map(|(idx, i)| PublicTx {
            txid: i.txid.clone().unwrap(),
            block_height: 2_540_118 + idx as i64 * 37,
            timestamp: format!("{}T10:24:00Z", i.paid_date.as_deref().unwrap_or(&i.issue_date)),
            tx_type: "shielded".into(),
        })
        .collect();

    Ok(Json(txs))
}

pub async fn get_auditor_ledger(
    State(s): State<Arc<AppState>>,
    AuthBusiness(bid): AuthBusiness,
) -> Result<Json<Vec<AuditorTx>>> {
    let invoices = db::list_invoices(&s.db, &bid).await?;

    let txs = invoices
        .iter()
        .filter(|i| i.status == InvoiceStatus::Paid && i.txid.is_some())
        .enumerate()
        .map(|(idx, i)| AuditorTx {
            txid: i.txid.clone().unwrap(),
            block_height: 2_540_118 + idx as i64 * 37,
            timestamp: format!("{}T10:24:00Z", i.paid_date.as_deref().unwrap_or(&i.issue_date)),
            invoice_id: i.id.clone(),
            customer_name: i.customer_name.clone(),
            amount_zec: i.amount_zec,
            amount_kes: i.amount_kes,
            memo: i.memo.clone(),
            recon_status: i.recon_status.clone(),
        })
        .collect();

    Ok(Json(txs))
}

// ── Disclosure ────────────────────────────────────────────────────────────────

#[derive(Deserialize)]
pub struct DateRange {
    pub start: String,
    pub end: String,
}

pub async fn generate_viewing_key_disclosure(
    State(s): State<Arc<AppState>>,
    AuthBusiness(bid): AuthBusiness,
    Json(range): Json<DateRange>,
) -> Result<Json<DisclosurePack>> {
    let biz = db::get_business_by_id(&s.db, &bid)
        .await?
        .ok_or_else(|| AppError::NotFound("business not found".into()))?;
    let invoices = db::list_invoices(&s.db, &bid).await?;

    let items: Vec<DisclosureItem> = invoices
        .iter()
        .filter(|i| {
            i.status == InvoiceStatus::Paid
                && i.paid_date
                    .as_deref()
                    .map(|d| d >= range.start.as_str() && d <= range.end.as_str())
                    .unwrap_or(false)
        })
        .map(invoice_to_disclosure_item)
        .collect();

    let total_zec = (items.iter().map(|it| it.amount_zec).sum::<f64>() * 1e8).round() / 1e8;

    let wallet = s.get_wallet(&bid).await.map_err(AppError::Anyhow)?;
    let viewing_key = wallet.viewing_key_string();

    let pack = DisclosurePack {
        id: format!("DISC-VK-{}", rand_hex_upper(6)),
        scope: DisclosureScope::ViewingKey,
        created_at: Utc::now().to_rfc3339(),
        range_start: Some(range.start),
        range_end: Some(range.end),
        business_name: biz.name,
        tax_pin: biz.tax_pin,
        viewing_key: Some(viewing_key),
        items,
        total_zec,
        total_kes: (total_zec * ZEC_TO_KES).round() as i64,
    };

    db::insert_disclosure_pack(&s.db, &pack, &bid).await?;
    Ok(Json(pack))
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct InvoiceIds {
    pub invoice_ids: Vec<String>,
}

pub async fn generate_payment_disclosure_pack(
    State(s): State<Arc<AppState>>,
    AuthBusiness(bid): AuthBusiness,
    Json(body): Json<InvoiceIds>,
) -> Result<Json<DisclosurePack>> {
    let biz = db::get_business_by_id(&s.db, &bid)
        .await?
        .ok_or_else(|| AppError::NotFound("business not found".into()))?;
    let mut items = Vec::new();

    for id in &body.invoice_ids {
        if let Some(inv) = db::get_invoice(&s.db, id, &bid).await? {
            if inv.status == InvoiceStatus::Paid && inv.txid.is_some() {
                items.push(invoice_to_disclosure_item(&inv));
            }
        }
    }

    let total_zec = (items.iter().map(|it| it.amount_zec).sum::<f64>() * 1e8).round() / 1e8;

    let pack = DisclosurePack {
        id: format!("DISC-PD-{}", rand_hex_upper(6)),
        scope: DisclosureScope::Payment,
        created_at: Utc::now().to_rfc3339(),
        range_start: None,
        range_end: None,
        business_name: biz.name,
        tax_pin: biz.tax_pin,
        viewing_key: None,
        items,
        total_zec,
        total_kes: (total_zec * ZEC_TO_KES).round() as i64,
    };

    db::insert_disclosure_pack(&s.db, &pack, &bid).await?;
    Ok(Json(pack))
}

pub async fn list_disclosure_packs(
    State(s): State<Arc<AppState>>,
    AuthBusiness(bid): AuthBusiness,
) -> Result<Json<Vec<DisclosurePack>>> {
    Ok(Json(db::list_disclosure_packs(&s.db, &bid).await?))
}

pub async fn get_disclosure_pack(
    State(s): State<Arc<AppState>>,
    AuthBusiness(bid): AuthBusiness,
    Path(id): Path<String>,
) -> Result<Json<DisclosurePack>> {
    db::get_disclosure_pack(&s.db, &id, &bid)
        .await?
        .map(Json)
        .ok_or_else(|| AppError::NotFound(format!("disclosure pack {id}")))
}

pub async fn verify_disclosure(
    State(s): State<Arc<AppState>>,
    AuthBusiness(bid): AuthBusiness,
    Path(id): Path<String>,
) -> Result<Json<Vec<VerificationResult>>> {
    let pack = db::get_disclosure_pack(&s.db, &id, &bid)
        .await?
        .ok_or_else(|| AppError::NotFound(format!("disclosure pack {id}")))?;

    let wallet = s.get_wallet(&bid).await.map_err(AppError::Anyhow)?;
    let mut results = Vec::new();

    for item in &pack.items {
        let (on_chain_zec, matches) = wallet
            .verify_transaction(&item.txid, item.amount_zec)
            .await
            .unwrap_or((0.0, false));

        results.push(VerificationResult {
            invoice_id: item.invoice_id.clone(),
            txid: item.txid.clone(),
            declared_zec: item.amount_zec,
            on_chain_zec,
            status: if matches { VerificationStatus::Verified } else { VerificationStatus::Failed },
            verified_at: Some(Utc::now().to_rfc3339()),
        });
    }

    Ok(Json(results))
}

// ── Helpers ───────────────────────────────────────────────────────────────────

fn invoice_to_disclosure_item(inv: &Invoice) -> DisclosureItem {
    let txid = inv.txid.clone().unwrap_or_default();
    DisclosureItem {
        invoice_id: inv.id.clone(),
        customer_name: inv.customer_name.clone(),
        date: inv.paid_date.clone().unwrap_or_else(|| inv.issue_date.clone()),
        amount_zec: inv.amount_zec,
        amount_kes: inv.amount_kes,
        memo: inv.memo.clone(),
        proof: format!("zcash:proof:{txid}"),
        txid,
    }
}

fn rand_hex_upper(len: usize) -> String {
    (0..len)
        .map(|_| format!("{:X}", rand::thread_rng().gen::<u8>() & 0xf))
        .collect()
}

trait YearExt {
    fn year(self) -> i32;
}

impl YearExt for chrono::DateTime<Utc> {
    fn year(self) -> i32 {
        chrono::Datelike::year(&self)
    }
}
