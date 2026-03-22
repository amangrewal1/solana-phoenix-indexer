# Architecture

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

The Rust decoder is isolated to parse the Phoenix market account layout
without pulling the Solana SDK into the TS service — keeps deploy artifacts
lean.
