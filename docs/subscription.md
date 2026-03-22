# Subscription Flow

1. TS service opens WebSocket to the RPC endpoint
2. For each market in `MARKETS`, it sends `accountSubscribe` with base64
   encoding
3. Every account update arrives as a notification with the raw account data
4. TS forwards the base64 to the Rust decoder via HTTP POST `/decode`
5. Rust returns structured JSON (bids/asks/header)
6. TS updates the in-memory book and pushes to WebSocket subscribers
