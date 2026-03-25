import express from "express";
import http from "http";
import { WebSocketServer, WebSocket } from "ws";
import { BookRegistry } from "./orderbook";
import { registry as metricsRegistry, wsClientsGauge } from "./metrics";
import { logger } from "./logger";

export function buildServer(books: BookRegistry, port: number) {
  const app = express();

  app.get("/health", (_req, res) => res.json({ ok: true }));

  app.get("/markets", (_req, res) => res.json({ markets: books.list() }));

  app.get("/book/:market", (req, res) => {
    const book = books.get(req.params.market);
    if (!book) return res.status(404).json({ error: "unknown market" });
    const depth = Math.min(
      Math.max(parseInt((req.query.depth as string) || "10", 10) || 10, 1),
      100,
    );
    res.json(book.snapshot(depth));
  });

  app.get("/top/:market", (req, res) => {
    const book = books.get(req.params.market);
    if (!book) return res.status(404).json({ error: "unknown market" });
    const snap = book.snapshot(1);
    res.json({
      market: snap.market,
      slot: snap.slot,
      sequence: snap.sequence,
      ts: snap.ts,
      top: snap.top,
    });
  });

  app.get("/metrics", async (_req, res) => {
    res.set("Content-Type", metricsRegistry.contentType);
    res.end(await metricsRegistry.metrics());
  });

  const server = http.createServer(app);
  const wss = new WebSocketServer({ server });

  wss.on("connection", (socket: WebSocket, req) => {
    const url = new URL(req.url || "", "http://localhost");
    const match = url.pathname.match(/^\/stream\/([A-Za-z0-9]+)$/);
    if (!match) {
      socket.close(1008, "bad path");
      return;
    }
    const market = match[1];
    const book = books.get(market);
    if (!book) {
      socket.close(1008, "unknown market");
      return;
    }
    wsClientsGauge.inc({ market });

    const send = (snap: any) => {
      if (socket.readyState === WebSocket.OPEN) {
        socket.send(JSON.stringify(snap));
      }
    };

    send(book.snapshot());
    const listener = (snap: any) => send(snap);
    book.on("update", listener);

    socket.on("close", () => {
      book.off("update", listener);
      wsClientsGauge.dec({ market });
    });
    socket.on("error", () => {
      book.off("update", listener);
      wsClientsGauge.dec({ market });
    });
  });

  server.listen(port, () => logger.info({ port }, "API listening"));
  return server;
}
