//! Background note-scanner — one scan loop per registered business.

use std::{sync::Arc, time::Duration};

use anyhow::Context;
use chrono::Utc;
use sapling_crypto::note_encryption::{
    CompactOutputDescription, PreparedIncomingViewingKey, Zip212Enforcement,
    try_sapling_compact_note_decryption, try_sapling_note_decryption,
};
use sapling_crypto::note::ExtractedNoteCommitment;
use tokio::time;
use zcash_note_encryption::EphemeralKeyBytes;
use zcash_protocol::memo::Memo;
use zip32::Scope;

use crate::{
    db,
    grpc::{proto::CompactSaplingOutput, LightwalletdClient},
    seed,
    state::AppState,
    wallet::Wallet,
};

/// Entry point: runs forever, scanning all businesses every 30 seconds.
pub async fn run_all(state: Arc<AppState>) {
    let mut interval = time::interval(Duration::from_secs(30));
    loop {
        interval.tick().await;

        let business_ids = match db::list_business_ids_with_wallets(&state.db).await {
            Ok(ids) => ids,
            Err(e) => {
                tracing::error!("worker: failed to list businesses: {e}");
                continue;
            }
        };

        for business_id in business_ids {
            let wallet = match state.get_wallet(&business_id).await {
                Ok(w) => w,
                Err(e) => {
                    tracing::warn!("worker: could not load wallet for {business_id}: {e}");
                    continue;
                }
            };

            if let Err(e) = scan_once(&state.db, &wallet, &business_id).await {
                tracing::error!("note scanner error for {business_id}: {e:#}");
            }
        }
    }
}

async fn scan_once(
    db: &sqlx::SqlitePool,
    wallet: &Wallet,
    business_id: &str,
) -> anyhow::Result<()> {
    let mut client = LightwalletdClient::connect(&wallet.lightwalletd_url)
        .await
        .context("could not connect to lightwalletd")?;

    let tip = client.get_latest_height().await?;
    let from = seed::last_scanned_height_for(db, business_id).await?;

    if from >= tip {
        tracing::debug!("scanner [{business_id}]: at tip ({tip}), nothing to do");
        return Ok(());
    }

    let sapling_dfvk = wallet
        .ufvk
        .sapling()
        .context("wallet has no Sapling component")?;
    let sapling_ivk = sapling_dfvk.to_ivk(Scope::External);
    let prepared_ivk = PreparedIncomingViewingKey::new(&sapling_ivk);

    tracing::info!("scanner [{business_id}]: scanning blocks {from}..{tip}");

    let mut cursor = from + 1;
    while cursor <= tip {
        let batch_end = (cursor + 99).min(tip);
        let blocks = client.get_block_range(cursor, batch_end).await?;

        for block in &blocks {
            for compact_tx in &block.vtx {
                for (output_idx, compact_output) in compact_tx.outputs.iter().enumerate() {
                    let desc = match parse_compact_output(compact_output) {
                        Ok(d) => d,
                        Err(e) => {
                            tracing::warn!("skipping malformed compact output: {e}");
                            continue;
                        }
                    };

                    if let Some((note, _recipient)) = try_sapling_compact_note_decryption(
                        &prepared_ivk,
                        &desc,
                        Zip212Enforcement::On,
                    ) {
                        let txid_hex = hex::encode(&compact_tx.hash);
                        tracing::info!(
                            "scanner [{business_id}]: received note in tx {txid_hex} at block {}",
                            block.height
                        );

                        let raw_tx = client.get_transaction(&txid_hex).await?;
                        let memo_text =
                            decrypt_memo_from_tx(&raw_tx, output_idx, &prepared_ivk)?;

                        let note_zec = note.value().inner() as f64 / 1e8;
                        let paid_date = Utc::now().format("%Y-%m-%d").to_string();

                        reconcile_note(db, business_id, &txid_hex, note_zec, &memo_text, &paid_date)
                            .await?;
                    }
                }
            }
        }

        seed::set_scanned_height_for(db, business_id, batch_end).await?;
        cursor = batch_end + 1;
    }

    Ok(())
}

fn parse_compact_output(co: &CompactSaplingOutput) -> anyhow::Result<CompactOutputDescription> {
    let ephemeral_key: [u8; 32] = co
        .ephemeral_key
        .as_slice()
        .try_into()
        .map_err(|_| anyhow::anyhow!("ephemeral key must be 32 bytes"))?;

    let cmu_bytes: [u8; 32] = co
        .cmu
        .as_slice()
        .try_into()
        .map_err(|_| anyhow::anyhow!("note commitment must be 32 bytes"))?;

    let cmu = ExtractedNoteCommitment::from_bytes(&cmu_bytes)
        .into_option()
        .ok_or_else(|| anyhow::anyhow!("cmu is not a valid field element"))?;

    let enc_ciphertext: [u8; 52] = co
        .ciphertext
        .as_slice()
        .try_into()
        .map_err(|_| anyhow::anyhow!("ciphertext must be 52 bytes"))?;

    Ok(CompactOutputDescription {
        ephemeral_key: EphemeralKeyBytes(ephemeral_key),
        cmu,
        enc_ciphertext,
    })
}

fn decrypt_memo_from_tx(
    raw_tx: &[u8],
    output_index: usize,
    prepared_ivk: &PreparedIncomingViewingKey,
) -> anyhow::Result<String> {
    use std::io::Cursor;
    use zcash_primitives::transaction::Transaction;
    use zcash_protocol::consensus::BranchId;

    let tx = Transaction::read(Cursor::new(raw_tx), BranchId::Nu5)
        .context("failed to parse raw transaction")?;

    let bundle = tx.sapling_bundle().context("transaction has no Sapling bundle")?;

    let output = bundle
        .shielded_outputs()
        .get(output_index)
        .context("output index out of range")?;

    let (_, _, raw_memo) =
        try_sapling_note_decryption(prepared_ivk, output, Zip212Enforcement::On)
            .context("could not decrypt full Sapling note")?;

    let memo = Memo::from_bytes(&raw_memo).context("invalid memo bytes")?;
    match memo {
        Memo::Text(t) => Ok(t.to_string()),
        _ => Err(anyhow::anyhow!("memo is not text")),
    }
}

async fn reconcile_note(
    db: &sqlx::SqlitePool,
    business_id: &str,
    txid: &str,
    note_zec: f64,
    memo_text: &str,
    paid_date: &str,
) -> anyhow::Result<()> {
    let invoice_id = memo_text
        .split("payment for ")
        .nth(1)
        .and_then(|s| s.split(" \u{2022}").next())
        .map(str::trim)
        .context("memo does not contain a recognisable invoice reference")?;

    let inv = db::get_invoice(db, invoice_id, business_id)
        .await?
        .context(format!("invoice {invoice_id} not found for business {business_id}"))?;

    let expected_zatoshi = (inv.amount_zec * 1e8).round() as u64;
    let received_zatoshi = (note_zec * 1e8).round() as u64;

    if received_zatoshi != expected_zatoshi {
        tracing::warn!(
            "scanner [{business_id}]: memo matches {invoice_id} but amount mismatch \
             (expected {expected_zatoshi}, got {received_zatoshi} zatoshi)"
        );
        return Ok(());
    }

    db::mark_invoice_paid(db, invoice_id, txid, paid_date).await?;
    tracing::info!("scanner [{business_id}]: invoice {invoice_id} marked paid (tx {txid})");
    Ok(())
}
