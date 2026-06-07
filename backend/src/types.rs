use serde::{Deserialize, Serialize};

// ── Auth ──────────────────────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct RegisterInput {
    pub name: String,
    pub tax_pin: String,
    pub email: String,
    pub password: String,
}

#[derive(Debug, Deserialize)]
pub struct LoginInput {
    pub email: String,
    pub password: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AuthResponse {
    pub token: String,
    pub business_id: String,
    /// Only present on registration. Show this to the user ONCE — it is the
    /// 24-word BIP-39 mnemonic they need to recover their wallet.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub mnemonic: Option<String>,
}

// ── Customer management ───────────────────────────────────────────────────────

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateCustomerInput {
    pub name: String,
    pub email: String,
    pub tax_pin: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct UpdateCustomerInput {
    pub name: String,
    pub email: String,
    pub tax_pin: Option<String>,
}

// ── Invoice lifecycle ─────────────────────────────────────────────────────────

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum InvoiceStatus {
    Draft,
    AwaitingPayment,
    Paid,
}

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum ReconStatus {
    Unreconciled,
    Reconciled,
}

// ── Core domain types (mirror lib/types.ts in the frontend) ──────────────────
// All structs use camelCase JSON so field names match TypeScript conventions.

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Customer {
    pub id: String,
    pub name: String,
    pub email: String,
    pub tax_pin: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Business {
    pub name: String,
    pub email: String,
    pub tax_pin: String,
    pub unified_address: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LineItem {
    pub description: String,
    pub quantity: f64,
    pub unit_price_zec: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Invoice {
    pub id: String,
    pub customer_id: String,
    pub customer_name: String,
    pub line_items: Vec<LineItem>,
    pub amount_zec: f64,
    pub amount_kes: i64,
    pub issue_date: String,
    pub due_date: String,
    pub status: InvoiceStatus,
    pub recon_status: ReconStatus,
    /// The text embedded in the shielded payment memo (<=512 bytes).
    pub memo: String,
    /// The diversified unified address the customer pays to for this invoice.
    pub unified_address: String,
    pub txid: Option<String>,
    pub paid_date: Option<String>,
}

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateInvoiceInput {
    pub customer_id: String,
    pub line_items: Vec<LineItem>,
    pub due_date: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PaymentRequest {
    pub unified_address: String,
    pub memo: String,
    pub amount_zec: f64,
    /// ZIP-321 `zcash:` URI — encode this as the QR code.
    pub payment_uri: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ReconResult {
    pub invoice_id: String,
    pub matched: bool,
    pub txid: Option<String>,
    pub amount_zec: f64,
    pub memo_matched: bool,
    pub amount_matched: bool,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ShieldedBalance {
    pub zec: f64,
    pub kes_equivalent: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct MonthlyPoint {
    pub key: String,
    pub label: String,
    pub collected_zec: f64,
    pub collected_kes: i64,
    pub invoiced_kes: i64,
}

// ── Disclosure & audit ────────────────────────────────────────────────────────

#[derive(Debug, Clone, PartialEq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum DisclosureScope {
    ViewingKey,
    Payment,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DisclosureItem {
    pub invoice_id: String,
    pub customer_name: String,
    pub date: String,
    pub amount_zec: f64,
    pub amount_kes: i64,
    pub memo: String,
    pub txid: String,
    /// Opaque proof the auditor passes to verifyDisclosure.
    pub proof: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct DisclosurePack {
    pub id: String,
    pub scope: DisclosureScope,
    pub created_at: String,
    pub range_start: Option<String>,
    pub range_end: Option<String>,
    pub business_name: String,
    pub tax_pin: String,
    /// UFVK string — only present for viewing_key scope.
    pub viewing_key: Option<String>,
    pub items: Vec<DisclosureItem>,
    pub total_zec: f64,
    pub total_kes: i64,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "snake_case")]
pub enum VerificationStatus {
    #[allow(dead_code)]
    Pending,
    Verified,
    Failed,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct VerificationResult {
    pub invoice_id: String,
    pub txid: String,
    pub declared_zec: f64,
    pub on_chain_zec: f64,
    pub status: VerificationStatus,
    pub verified_at: Option<String>,
}

// ── The reveal: two views of the same transactions ───────────────────────────

/// What a block explorer sees: opaque shielded transactions.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PublicTx {
    pub txid: String,
    pub block_height: i64,
    pub timestamp: String,
    #[serde(rename = "type")]
    pub tx_type: String, // always "shielded"
}

/// What the auditor sees after you share your viewing key: decrypted details.
#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AuditorTx {
    pub txid: String,
    pub block_height: i64,
    pub timestamp: String,
    pub invoice_id: String,
    pub customer_name: String,
    pub amount_zec: f64,
    pub amount_kes: i64,
    pub memo: String,
    pub recon_status: ReconStatus,
}
