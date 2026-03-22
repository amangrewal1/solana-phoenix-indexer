# WebSocket Streaming API

Connect to `ws://host:PORT/stream/:market` to receive snapshots:

```json
{
  "market": "...",
  "timestamp": 1711234567,
  "bids": [[price, size], ...],
  "asks": [[price, size], ...]
}
```

A full snapshot is pushed on every account update. No diffs; consumers
can replace their local state wholesale each message.
