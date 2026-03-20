import WebSocket from "ws";
import { config } from "./config";
import { logger } from "./logger";
import { BookRegistry } from "./orderbook";
import { decodeMarket } from "./decoder-client";
import {
  updatesTotal,
  updateErrors,
  updateLatency,
  wsConnected,
} from "./metrics";

interface SubMsg {
  jsonrpc: "2.0";
  id: number;
  method: "accountSubscribe";
  params: [string, { encoding: "base64"; commitment: "confirmed" }];
}

export class PhoenixSubscriber {
  private ws?: WebSocket;
  private reqId = 1;
  private subIdByMarket = new Map<number, string>();
  private pendingByReqId = new Map<number, string>();
  private reconnectMs = config.reconnectMs;
  private stopped = false;

  constructor(
    private readonly markets: string[],
    private readonly registry: BookRegistry,
  ) {}

  start(): void {
    this.connect();
  }

  stop(): void {
    this.stopped = true;
    this.ws?.close();
  }

  private connect(): void {
    logger.info({ url: config.wsUrl }, "connecting to Solana WS");
    const ws = new WebSocket(config.wsUrl, { handshakeTimeout: 10_000 });
    this.ws = ws;

    ws.on("open", () => {
      logger.info("WS connected");
      wsConnected.set(1);
      this.reconnectMs = config.reconnectMs;
      for (const market of this.markets) this.subscribe(market);
    });

    ws.on("message", (buf) => this.onMessage(buf));

    ws.on("close", (code, reason) => {
      logger.warn({ code, reason: reason.toString() }, "WS closed");
      wsConnected.set(0);
      this.subIdByMarket.clear();
      this.pendingByReqId.clear();
      if (!this.stopped) this.scheduleReconnect();
    });

    ws.on("error", (err) => {
      logger.error({ err: err.message }, "WS error");
    });
  }

  private scheduleReconnect(): void {
    const delay = this.reconnectMs;
    this.reconnectMs = Math.min(this.reconnectMs * 2, config.maxReconnectMs);
    setTimeout(() => this.connect(), delay);
  }

  private subscribe(market: string): void {
    const id = this.reqId++;
    const msg: SubMsg = {
      jsonrpc: "2.0",
      id,
      method: "accountSubscribe",
      params: [market, { encoding: "base64", commitment: "confirmed" }],
    };
    this.pendingByReqId.set(id, market);
    this.ws?.send(JSON.stringify(msg));
    this.registry.getOrCreate(market);
    logger.info({ market, id }, "subscribing");
  }

  private onMessage(buf: WebSocket.RawData): void {
    let msg: any;
    try {
      msg = JSON.parse(buf.toString());
    } catch {
      return;
    }

    if (msg.id && this.pendingByReqId.has(msg.id)) {
      const market = this.pendingByReqId.get(msg.id)!;
      this.pendingByReqId.delete(msg.id);
      if (typeof msg.result === "number") {
        this.subIdByMarket.set(msg.result, market);
        logger.info({ market, sub: msg.result }, "subscribed");
      } else {
        logger.error({ market, err: msg.error }, "subscribe failed");
      }
      return;
    }

    if (msg.method === "accountNotification") {
      const subId: number = msg.params?.subscription;
      const market = this.subIdByMarket.get(subId);
      if (!market) return;
      const value = msg.params?.result?.value;
      const slot: number = msg.params?.result?.context?.slot ?? 0;
      if (!value?.data?.[0]) return;
      const dataB64: string = value.data[0];
      this.applyUpdate(market, dataB64, slot).catch((err) => {
        updateErrors.inc({ market, reason: "apply" });
        logger.error({ market, err: err.message }, "apply failed");
      });
    }
  }

  private async applyUpdate(
    market: string,
    dataB64: string,
    slot: number,
  ): Promise<void> {
    const start = Date.now();
    try {
      const decoded = await decodeMarket(dataB64);
      const book = this.registry.getOrCreate(market);
      book.apply(decoded, slot);
      updatesTotal.inc({ market });
      updateLatency.observe({ market }, Date.now() - start);
    } catch (err: any) {
      updateErrors.inc({ market, reason: "decode" });
      throw err;
    }
  }
}
