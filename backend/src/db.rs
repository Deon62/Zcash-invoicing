use sqlx::SqlitePool;

use crate::{
    error::{AppError, Result},
    types::*,
};

// ── sqlx row types ────────────────────────────────────────────────────────────

#[derive(sqlx::FromRow)]
struct BusinessRow {
    id: String,
    name: String,
    tax_pin: String,
    email: String,
    password_hash: String,
    unified_address: String,
}

#[derive(sqlx::FromRow)]
struct CustomerRow {
    id: String,
    name: String,
    email: String,
    tax_pin: Option<String>,
}

#[derive(sqlx::FromRow)]
struct InvoiceRow {
    id: String,
    customer_id: String,
    customer_name: String,
    line_items: String,
    amount_zec: f64,
    amount_kes: i64,
    issue_date: String,
    due_date: String,
    status: String,
    recon_status: String,
    memo: String,
    unified_address: String,
    txid: Option<String>,
    paid_date: Option<String>,
}

#[derive(sqlx::FromRow)]
struct PackRow {
    id: String,
    scope: String,
    created_at: String,
    range_start: Option<String>,
    range_end: Option<String>,
    business_name: String,
    tax_pin: String,
    viewing_key: Option<String>,
    items: String,
    total_zec: f64,
    total_kes: i64,
}

// ── Row → domain type conversions ────────────────────────────────────────────

fn row_to_customer(r: CustomerRow) -> Customer {
    Customer { id: r.id, name: r.name, email: r.email, tax_pin: r.tax_pin }
}

fn row_to_invoice(r: InvoiceRow) -> Result<Invoice> {
    Ok(Invoice {
        id: r.id,
        customer_id: r.customer_id,
        customer_name: r.customer_name,
        line_items: serde_json::from_str(&r.line_items)
            .map_err(|e| AppError::Anyhow(anyhow::anyhow!("line_items: {e}")))?,
        amount_zec: r.amount_zec,
        amount_kes: r.amount_kes,
        issue_date: r.issue_date,
        due_date: r.due_date,
        status: match r.status.as_str() {
            "draft" => InvoiceStatus::Draft,
            "paid" => InvoiceStatus::Paid,
            _ => InvoiceStatus::AwaitingPayment,
        },
        recon_status: match r.recon_status.as_str() {
            "reconciled" => ReconStatus::Reconciled,
            _ => ReconStatus::Unreconciled,
        },
        memo: r.memo,
        unified_address: r.unified_address,
        txid: r.txid,
        paid_date: r.paid_date,
    })
}

fn row_to_pack(r: PackRow) -> Result<DisclosurePack> {
    Ok(DisclosurePack {
        id: r.id,
        scope: match r.scope.as_str() {
            "viewing_key" => DisclosureScope::ViewingKey,
            _ => DisclosureScope::Payment,
        },
        created_at: r.created_at,
        range_start: r.range_start,
        range_end: r.range_end,
        business_name: r.business_name,
        tax_pin: r.tax_pin,
        viewing_key: r.viewing_key,
        items: serde_json::from_str(&r.items)
            .map_err(|e| AppError::Anyhow(anyhow::anyhow!("pack items: {e}")))?,
        total_zec: r.total_zec,
        total_kes: r.total_kes,
    })
}

fn status_str(s: &InvoiceStatus) -> &'static str {
    match s {
        InvoiceStatus::Draft => "draft",
        InvoiceStatus::AwaitingPayment => "awaiting_payment",
        InvoiceStatus::Paid => "paid",
    }
}

fn recon_str(s: &ReconStatus) -> &'static str {
    match s {
        ReconStatus::Unreconciled => "unreconciled",
        ReconStatus::Reconciled => "reconciled",
    }
}

// ── Businesses (auth) ─────────────────────────────────────────────────────────

pub struct BusinessAuthRow {
    pub id: String,
    pub name: String,
    pub tax_pin: String,
    pub email: String,
    pub password_hash: String,
    pub unified_address: String,
}

impl From<BusinessRow> for BusinessAuthRow {
    fn from(r: BusinessRow) -> Self {
        Self {
            id: r.id,
            name: r.name,
            tax_pin: r.tax_pin,
            email: r.email,
            password_hash: r.password_hash,
            unified_address: r.unified_address,
        }
    }
}

pub async fn create_business(
    db: &SqlitePool,
    id: &str,
    name: &str,
    tax_pin: &str,
    email: &str,
    password_hash: &str,
) -> Result<()> {
    sqlx::query(
        "INSERT INTO businesses (id, name, tax_pin, email, password_hash)
         VALUES (?, ?, ?, ?, ?)",
    )
    .bind(id)
    .bind(name)
    .bind(tax_pin)
    .bind(email)
    .bind(password_hash)
    .execute(db)
    .await
    .map_err(|e| match e {
        sqlx::Error::Database(ref db_err) if db_err.message().contains("UNIQUE") => {
            AppError::BadRequest("an account with that email already exists".into())
        }
        other => AppError::Sqlx(other),
    })?;
    Ok(())
}

pub async fn get_business_by_id(db: &SqlitePool, id: &str) -> Result<Option<BusinessAuthRow>> {
    Ok(sqlx::query_as::<_, BusinessRow>(
        "SELECT id, name, tax_pin, email, password_hash, unified_address
         FROM businesses WHERE id = ?",
    )
    .bind(id)
    .fetch_optional(db)
    .await?
    .map(Into::into))
}

pub async fn get_business_by_email(
    db: &SqlitePool,
    email: &str,
) -> Result<Option<BusinessAuthRow>> {
    Ok(sqlx::query_as::<_, BusinessRow>(
        "SELECT id, name, tax_pin, email, password_hash, unified_address
         FROM businesses WHERE email = ?",
    )
    .bind(email)
    .fetch_optional(db)
    .await?
    .map(Into::into))
}

pub async fn update_business_address(db: &SqlitePool, id: &str, address: &str) -> Result<()> {
    sqlx::query("UPDATE businesses SET unified_address = ? WHERE id = ?")
        .bind(address)
        .bind(id)
        .execute(db)
        .await?;
    Ok(())
}

/// Returns all business IDs that have a wallet (used by the background scanner).
pub async fn list_business_ids_with_wallets(db: &SqlitePool) -> Result<Vec<String>> {
    let rows: Vec<(String,)> =
        sqlx::query_as("SELECT business_id FROM wallets")
            .fetch_all(db)
            .await?;
    Ok(rows.into_iter().map(|(id,)| id).collect())
}

// ── Customers ─────────────────────────────────────────────────────────────────

pub async fn list_customers(db: &SqlitePool, business_id: &str) -> Result<Vec<Customer>> {
    let rows = sqlx::query_as::<_, CustomerRow>(
        "SELECT id, name, email, tax_pin FROM customers
         WHERE business_id = ? ORDER BY name",
    )
    .bind(business_id)
    .fetch_all(db)
    .await?;
    Ok(rows.into_iter().map(row_to_customer).collect())
}

pub async fn get_customer(
    db: &SqlitePool,
    id: &str,
    business_id: &str,
) -> Result<Option<Customer>> {
    Ok(
        sqlx::query_as::<_, CustomerRow>(
            "SELECT id, name, email, tax_pin FROM customers
             WHERE id = ? AND business_id = ?",
        )
        .bind(id)
        .bind(business_id)
        .fetch_optional(db)
        .await?
        .map(row_to_customer),
    )
}

pub async fn insert_customer(
    db: &SqlitePool,
    customer: &Customer,
    business_id: &str,
) -> Result<()> {
    sqlx::query(
        "INSERT INTO customers (id, name, email, tax_pin, business_id)
         VALUES (?, ?, ?, ?, ?)",
    )
    .bind(&customer.id)
    .bind(&customer.name)
    .bind(&customer.email)
    .bind(&customer.tax_pin)
    .bind(business_id)
    .execute(db)
    .await?;
    Ok(())
}

pub async fn update_customer(
    db: &SqlitePool,
    id: &str,
    business_id: &str,
    name: &str,
    email: &str,
    tax_pin: Option<&str>,
) -> Result<bool> {
    let rows = sqlx::query(
        "UPDATE customers SET name = ?, email = ?, tax_pin = ?
         WHERE id = ? AND business_id = ?",
    )
    .bind(name)
    .bind(email)
    .bind(tax_pin)
    .bind(id)
    .bind(business_id)
    .execute(db)
    .await?
    .rows_affected();
    Ok(rows > 0)
}

pub async fn delete_customer(db: &SqlitePool, id: &str, business_id: &str) -> Result<bool> {
    let rows = sqlx::query("DELETE FROM customers WHERE id = ? AND business_id = ?")
        .bind(id)
        .bind(business_id)
        .execute(db)
        .await?
        .rows_affected();
    Ok(rows > 0)
}

// ── Invoices ──────────────────────────────────────────────────────────────────

pub async fn list_invoices(db: &SqlitePool, business_id: &str) -> Result<Vec<Invoice>> {
    sqlx::query_as::<_, InvoiceRow>(
        "SELECT id, customer_id, customer_name, line_items, amount_zec, amount_kes,
         issue_date, due_date, status, recon_status, memo, unified_address, txid, paid_date
         FROM invoices WHERE business_id = ? ORDER BY created_at DESC",
    )
    .bind(business_id)
    .fetch_all(db)
    .await?
    .into_iter()
    .map(row_to_invoice)
    .collect()
}

pub async fn get_invoice(
    db: &SqlitePool,
    id: &str,
    business_id: &str,
) -> Result<Option<Invoice>> {
    sqlx::query_as::<_, InvoiceRow>(
        "SELECT id, customer_id, customer_name, line_items, amount_zec, amount_kes,
         issue_date, due_date, status, recon_status, memo, unified_address, txid, paid_date
         FROM invoices WHERE id = ? AND business_id = ?",
    )
    .bind(id)
    .bind(business_id)
    .fetch_optional(db)
    .await?
    .map(row_to_invoice)
    .transpose()
}

pub async fn next_diversifier_index(db: &SqlitePool, business_id: &str) -> Result<u32> {
    let count: i64 =
        sqlx::query_scalar("SELECT COUNT(*) FROM invoices WHERE business_id = ?")
            .bind(business_id)
            .fetch_one(db)
            .await?;
    Ok(count as u32)
}

pub async fn insert_invoice(
    db: &SqlitePool,
    inv: &Invoice,
    diversifier_index: u32,
    business_id: &str,
) -> Result<()> {
    let line_items = serde_json::to_string(&inv.line_items)
        .map_err(|e| AppError::Anyhow(anyhow::anyhow!("{e}")))?;

    sqlx::query(
        "INSERT INTO invoices
         (id, customer_id, customer_name, line_items, amount_zec, amount_kes,
          issue_date, due_date, status, recon_status, memo, unified_address,
          diversifier_index, txid, paid_date, business_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&inv.id)
    .bind(&inv.customer_id)
    .bind(&inv.customer_name)
    .bind(&line_items)
    .bind(inv.amount_zec)
    .bind(inv.amount_kes)
    .bind(&inv.issue_date)
    .bind(&inv.due_date)
    .bind(status_str(&inv.status))
    .bind(recon_str(&inv.recon_status))
    .bind(&inv.memo)
    .bind(&inv.unified_address)
    .bind(diversifier_index)
    .bind(&inv.txid)
    .bind(&inv.paid_date)
    .bind(business_id)
    .execute(db)
    .await?;
    Ok(())
}

pub async fn mark_invoice_paid(
    db: &SqlitePool,
    id: &str,
    txid: &str,
    paid_date: &str,
) -> Result<()> {
    sqlx::query(
        "UPDATE invoices SET status = 'paid', recon_status = 'reconciled',
         txid = ?, paid_date = ? WHERE id = ?",
    )
    .bind(txid)
    .bind(paid_date)
    .bind(id)
    .execute(db)
    .await?;
    Ok(())
}

pub async fn mark_invoice_reconciled(db: &SqlitePool, id: &str) -> Result<()> {
    sqlx::query("UPDATE invoices SET recon_status = 'reconciled' WHERE id = ?")
        .bind(id)
        .execute(db)
        .await?;
    Ok(())
}

// ── Disclosure packs ──────────────────────────────────────────────────────────

pub async fn list_disclosure_packs(
    db: &SqlitePool,
    business_id: &str,
) -> Result<Vec<DisclosurePack>> {
    sqlx::query_as::<_, PackRow>(
        "SELECT id, scope, created_at, range_start, range_end, business_name, tax_pin,
         viewing_key, items, total_zec, total_kes
         FROM disclosure_packs WHERE business_id = ? ORDER BY created_at DESC",
    )
    .bind(business_id)
    .fetch_all(db)
    .await?
    .into_iter()
    .map(row_to_pack)
    .collect()
}

pub async fn get_disclosure_pack(
    db: &SqlitePool,
    id: &str,
    business_id: &str,
) -> Result<Option<DisclosurePack>> {
    sqlx::query_as::<_, PackRow>(
        "SELECT id, scope, created_at, range_start, range_end, business_name, tax_pin,
         viewing_key, items, total_zec, total_kes
         FROM disclosure_packs WHERE id = ? AND business_id = ?",
    )
    .bind(id)
    .bind(business_id)
    .fetch_optional(db)
    .await?
    .map(row_to_pack)
    .transpose()
}

pub async fn insert_disclosure_pack(
    db: &SqlitePool,
    pack: &DisclosurePack,
    business_id: &str,
) -> Result<()> {
    let scope = match pack.scope {
        DisclosureScope::ViewingKey => "viewing_key",
        DisclosureScope::Payment => "payment",
    };
    let items = serde_json::to_string(&pack.items)
        .map_err(|e| AppError::Anyhow(anyhow::anyhow!("{e}")))?;

    sqlx::query(
        "INSERT INTO disclosure_packs
         (id, scope, created_at, range_start, range_end, business_name, tax_pin,
          viewing_key, items, total_zec, total_kes, business_id)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    )
    .bind(&pack.id)
    .bind(scope)
    .bind(&pack.created_at)
    .bind(&pack.range_start)
    .bind(&pack.range_end)
    .bind(&pack.business_name)
    .bind(&pack.tax_pin)
    .bind(&pack.viewing_key)
    .bind(&items)
    .bind(pack.total_zec)
    .bind(pack.total_kes)
    .bind(business_id)
    .execute(db)
    .await?;
    Ok(())
}
