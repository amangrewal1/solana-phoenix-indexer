# Decoder HTTP Protocol

The Rust decoder exposes:

**POST /decode**
```
Request:  { "data_b64": "..." }
Response: { "header": {...}, "bids": [...], "asks": [...] }
```

**GET /health**
```
Response: { "status": "ok" }
```

The decoder is stateless — every request is independent. Scale horizontally
by running multiple instances behind a load balancer if throughput matters.
