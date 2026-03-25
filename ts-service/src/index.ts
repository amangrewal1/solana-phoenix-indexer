import { config } from "./config";
import { logger } from "./logger";
import { BookRegistry } from "./orderbook";
import { PhoenixSubscriber } from "./phoenix-subscriber";
import { buildServer } from "./api";

async function main() {
  if (config.markets.length === 0) {
    logger.warn("no MARKETS configured; API will serve empty registry");
  }
  const books = new BookRegistry();
  for (const m of config.markets) books.getOrCreate(m);

  const sub = new PhoenixSubscriber(config.markets, books);
  sub.start();

  const server = buildServer(books, config.port);

  const shutdown = (sig: string) => {
    logger.info({ sig }, "shutting down");
    sub.stop();
    server.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 5000).unref();
  };
  process.on("SIGINT", () => shutdown("SIGINT"));
  process.on("SIGTERM", () => shutdown("SIGTERM"));
}

main().catch((err) => {
  logger.error({ err: err.message, stack: err.stack }, "fatal");
  process.exit(1);
});
