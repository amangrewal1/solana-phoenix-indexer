# Solana On-Chain Order Book Indexer

Indexes Phoenix order books on Solana. TypeScript subscriber + in-memory book + REST/WS API, Rust decoder microservice for on-chain account data.

## Architecture

```
Solana RPC ──WS──▶ TS Subscriber ──HTTP──▶ Rust Decoder
                         │
                         ▼
                    In-memory book
                         │
                         ├──▶ REST  /book/:market
                         ├──▶ WS    /stream/:market
                         └──▶ /metrics (Prometheus)
```

- **ts-service**: subscribes to Phoenix market accounts via `accountSubscribe`, forwards raw base64 to the decoder, rebuilds the book in memory, serves snapshots.
- **rust-decoder**: axum HTTP service that parses Phoenix market account layout into structured JSON (bids/asks/header).

## Run

```bash
docker compose up --build
```

Env:
- `SOLANA_WS_URL` (default `wss://api.mainnet-beta.solana.com`)
- `MARKETS` comma-separated Phoenix market pubkeys
- `DECODER_URL` (default `http://decoder:9000`)
- `PORT` (default `8080`)

## Endpoints

- `GET /health`
- `GET /markets`
- `GET /book/:market?depth=10` — top-of-book + depth snapshot
- `GET /top/:market` — best bid/ask
- `WS  /stream/:market` — pushes full snapshot on every update
- `GET /metrics` — Prometheus

## Decoder endpoints

- `POST /decode` `{ "data_b64": "..." }` → market snapshot JSON
- `GET /health`
