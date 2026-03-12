mod decoder;
mod types;

use axum::{
    extract::State,
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use base64::{engine::general_purpose::STANDARD, Engine};
use once_cell::sync::Lazy;
use prometheus::{Encoder, HistogramVec, IntCounter, IntCounterVec, Registry, TextEncoder};
use serde_json::json;
use std::{net::SocketAddr, sync::Arc, time::Instant};
use tower_http::trace::TraceLayer;
use tracing::info;
use tracing_subscriber::EnvFilter;

use crate::types::DecodeRequest;

static REGISTRY: Lazy<Registry> = Lazy::new(Registry::new);

static DECODE_OK: Lazy<IntCounter> = Lazy::new(|| {
    let c = IntCounter::new("decoder_decode_ok_total", "Successful decodes").unwrap();
    REGISTRY.register(Box::new(c.clone())).ok();
    c
});

static DECODE_ERR: Lazy<IntCounterVec> = Lazy::new(|| {
    let c = IntCounterVec::new(
        prometheus::opts!("decoder_decode_err_total", "Failed decodes"),
        &["reason"],
    )
    .unwrap();
    REGISTRY.register(Box::new(c.clone())).ok();
    c
});

static DECODE_LATENCY: Lazy<HistogramVec> = Lazy::new(|| {
    let h = HistogramVec::new(
        prometheus::histogram_opts!(
            "decoder_decode_latency_ms",
            "Decode latency (ms)",
            vec![0.1, 0.5, 1.0, 5.0, 10.0, 25.0, 50.0, 100.0]
        ),
        &["outcome"],
    )
    .unwrap();
    REGISTRY.register(Box::new(h.clone())).ok();
    h
});

#[derive(Clone)]
struct AppState;

#[tokio::main]
async fn main() {
    tracing_subscriber::fmt()
        .with_env_filter(EnvFilter::try_from_default_env().unwrap_or_else(|_| EnvFilter::new("info")))
        .init();

    Lazy::force(&DECODE_OK);
    Lazy::force(&DECODE_ERR);
    Lazy::force(&DECODE_LATENCY);

    let app = Router::new()
        .route("/health", get(health))
        .route("/decode", post(decode_handler))
        .route("/metrics", get(metrics))
        .layer(TraceLayer::new_for_http())
        .with_state(Arc::new(AppState));

    let port: u16 = std::env::var("PORT")
        .ok()
        .and_then(|s| s.parse().ok())
        .unwrap_or(9000);
    let addr = SocketAddr::from(([0, 0, 0, 0], port));
    info!(%addr, "decoder listening");
    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await
        .unwrap();
}

async fn shutdown_signal() {
    let _ = tokio::signal::ctrl_c().await;
    info!("shutdown signal");
}

async fn health() -> impl IntoResponse {
    Json(json!({ "ok": true }))
}

async fn decode_handler(
    State(_): State<Arc<AppState>>,
    Json(req): Json<DecodeRequest>,
) -> impl IntoResponse {
    let start = Instant::now();
    let bytes = match STANDARD.decode(req.data_b64.as_bytes()) {
        Ok(b) => b,
        Err(_) => {
            DECODE_ERR.with_label_values(&["base64"]).inc();
            DECODE_LATENCY
                .with_label_values(&["err"])
                .observe(ms(start));
            return (StatusCode::BAD_REQUEST, Json(json!({ "error": "invalid base64" })))
                .into_response();
        }
    };

    match decoder::decode(&bytes) {
        Ok(d) => {
            DECODE_OK.inc();
            DECODE_LATENCY.with_label_values(&["ok"]).observe(ms(start));
            (StatusCode::OK, Json(d)).into_response()
        }
        Err(e) => {
            DECODE_ERR.with_label_values(&[reason(&e)]).inc();
            DECODE_LATENCY
                .with_label_values(&["err"])
                .observe(ms(start));
            (StatusCode::UNPROCESSABLE_ENTITY, Json(json!({ "error": e.to_string() })))
                .into_response()
        }
    }
}

fn ms(t: Instant) -> f64 {
    t.elapsed().as_secs_f64() * 1000.0
}

fn reason(e: &decoder::DecodeError) -> &'static str {
    use decoder::DecodeError::*;
    match e {
        Truncated(_) => "truncated",
        BadDiscriminator => "discriminator",
        TooManyOrders(_) => "too_many",
    }
}

async fn metrics() -> impl IntoResponse {
    let encoder = TextEncoder::new();
    let metric_families = REGISTRY.gather();
    let mut buf = Vec::new();
    encoder.encode(&metric_families, &mut buf).ok();
    (
        StatusCode::OK,
        [("content-type", TextEncoder::new().format_type().to_string())],
        buf,
    )
}
