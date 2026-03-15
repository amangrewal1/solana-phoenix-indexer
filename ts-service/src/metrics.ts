import client from "prom-client";

export const registry = new client.Registry();
client.collectDefaultMetrics({ register: registry });

export const updatesTotal = new client.Counter({
  name: "orderbook_updates_total",
  help: "Total successful book updates",
  labelNames: ["market"],
  registers: [registry],
});

export const updateErrors = new client.Counter({
  name: "orderbook_update_errors_total",
  help: "Failed book updates",
  labelNames: ["market", "reason"],
  registers: [registry],
});

export const updateLatency = new client.Histogram({
  name: "orderbook_update_latency_ms",
  help: "Latency from WS event to book applied",
  labelNames: ["market"],
  buckets: [1, 5, 10, 25, 50, 100, 250, 500, 1000, 2500],
  registers: [registry],
});

export const decoderLatency = new client.Histogram({
  name: "decoder_latency_ms",
  help: "Rust decoder round-trip latency",
  buckets: [1, 5, 10, 25, 50, 100, 250, 500],
  registers: [registry],
});

export const wsConnected = new client.Gauge({
  name: "solana_ws_connected",
  help: "1 if Solana WS connection is open",
  registers: [registry],
});

export const wsClientsGauge = new client.Gauge({
  name: "api_ws_clients",
  help: "Active WS client subscriptions",
  labelNames: ["market"],
  registers: [registry],
});
