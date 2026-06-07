//! JWT authentication and password hashing.

use argon2::{
    password_hash::{rand_core::OsRng, PasswordHash, PasswordHasher, PasswordVerifier, SaltString},
    Argon2,
};
use axum::{
    async_trait,
    extract::FromRequestParts,
    http::{StatusCode, request::Parts},
    Json,
};
use jsonwebtoken::{decode, encode, DecodingKey, EncodingKey, Header, Validation};
use serde::{Deserialize, Serialize};
use serde_json::json;

// ── Password ──────────────────────────────────────────────────────────────────

/// Hash a plaintext password using argon2id. Returns a PHC-format string.
pub fn hash_password(password: &str) -> anyhow::Result<String> {
    let salt = SaltString::generate(&mut OsRng);
    Argon2::default()
        .hash_password(password.as_bytes(), &salt)
        .map(|h| h.to_string())
        .map_err(|e| anyhow::anyhow!("password hashing failed: {e}"))
}

/// Verify a plaintext password against a stored argon2id hash.
pub fn verify_password(password: &str, hash: &str) -> bool {
    PasswordHash::new(hash)
        .map(|h| Argon2::default().verify_password(password.as_bytes(), &h).is_ok())
        .unwrap_or(false)
}

// ── JWT ───────────────────────────────────────────────────────────────────────

#[derive(Debug, Serialize, Deserialize)]
pub struct Claims {
    pub sub: String, // business_id
    pub exp: usize,  // unix timestamp
}

pub fn create_token(business_id: &str, secret: &str) -> anyhow::Result<String> {
    let exp = (chrono::Utc::now() + chrono::Duration::days(30)).timestamp() as usize;
    let claims = Claims { sub: business_id.to_string(), exp };
    encode(
        &Header::default(),
        &claims,
        &EncodingKey::from_secret(secret.as_bytes()),
    )
    .map_err(|e| anyhow::anyhow!("JWT creation failed: {e}"))
}

pub fn validate_token(token: &str, secret: &str) -> Option<String> {
    decode::<Claims>(
        token,
        &DecodingKey::from_secret(secret.as_bytes()),
        &Validation::default(),
    )
    .ok()
    .map(|d| d.claims.sub)
}

// ── Axum extractor ────────────────────────────────────────────────────────────

/// Reads `Authorization: Bearer <token>` from the request, validates the JWT,
/// and resolves to the authenticated `business_id`. Rejects with 401 otherwise.
pub struct AuthBusiness(pub String);

#[async_trait]
impl<S> FromRequestParts<S> for AuthBusiness
where
    S: Send + Sync,
{
    type Rejection = (StatusCode, Json<serde_json::Value>);

    async fn from_request_parts(parts: &mut Parts, _state: &S) -> Result<Self, Self::Rejection> {
        let secret = std::env::var("JWT_SECRET")
            .unwrap_or_else(|_| "change-me-in-production".into());

        let header = parts
            .headers
            .get(axum::http::header::AUTHORIZATION)
            .and_then(|v| v.to_str().ok())
            .ok_or_else(|| {
                (StatusCode::UNAUTHORIZED, Json(json!({ "error": "missing Authorization header" })))
            })?;

        let token = header.strip_prefix("Bearer ").ok_or_else(|| {
            (StatusCode::UNAUTHORIZED, Json(json!({ "error": "Authorization must be Bearer <token>" })))
        })?;

        let business_id = validate_token(token, &secret).ok_or_else(|| {
            (StatusCode::UNAUTHORIZED, Json(json!({ "error": "invalid or expired token" })))
        })?;

        Ok(AuthBusiness(business_id))
    }
}
