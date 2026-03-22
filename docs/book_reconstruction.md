# Order Book Reconstruction

The decoder returns the raw Phoenix order list. The TS service reconstructs
the book by:

1. Sorting bids descending by price, asks ascending
2. Aggregating size per price level
3. Truncating to requested depth (default 10 levels each side)
4. Serving via `GET /book/:market?depth=N`

Reconstruction is idempotent — the entire book is rebuilt on each update,
not diffed. This is simpler and safe against missed updates.
