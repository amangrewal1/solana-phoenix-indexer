export const config = {
  port: parseInt(process.env.PORT || "8080", 10),
  wsUrl: process.env.SOLANA_WS_URL || "wss://api.mainnet-beta.solana.com",
  httpUrl: process.env.SOLANA_HTTP_URL || "https://api.mainnet-beta.solana.com",
  decoderUrl: process.env.DECODER_URL || "http://localhost:9000",
  markets: (process.env.MARKETS || "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
  logLevel: process.env.LOG_LEVEL || "info",
  reconnectMs: parseInt(process.env.RECONNECT_MS || "2000", 10),
  maxReconnectMs: parseInt(process.env.MAX_RECONNECT_MS || "30000", 10),
};
