# Metrics

Prometheus metrics exposed at `GET /metrics`:

- `indexer_updates_total{market}` — counter of account updates per market
- `indexer_decode_duration_seconds` — histogram of decoder round-trip time
- `indexer_book_depth{market,side}` — current aggregate depth on each side
- `indexer_ws_subscribers{market}` — current WS stream subscriber count
