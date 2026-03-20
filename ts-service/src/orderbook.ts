import { EventEmitter } from "events";
import { BookSnapshot, DecodedMarket, Level } from "./types";

export class OrderBook extends EventEmitter {
  private bids: Level[] = [];
  private asks: Level[] = [];
  private slot = 0;
  private sequence = "0";
  private ts = 0;

  constructor(public readonly market: string) {
    super();
  }

  apply(decoded: DecodedMarket, slot: number): void {
    this.bids = [...decoded.bids].sort((a, b) => b.price - a.price);
    this.asks = [...decoded.asks].sort((a, b) => a.price - b.price);
    this.slot = slot;
    this.sequence = decoded.header.sequence_number;
    this.ts = Date.now();
    this.emit("update", this.snapshot());
  }

  snapshot(depth = 25): BookSnapshot {
    const bid = this.bids[0] ?? null;
    const ask = this.asks[0] ?? null;
    const spread = bid && ask ? ask.price - bid.price : null;
    return {
      market: this.market,
      slot: this.slot,
      sequence: this.sequence,
      ts: this.ts,
      top: { bid, ask, spread },
      bids: this.bids.slice(0, depth),
      asks: this.asks.slice(0, depth),
    };
  }
}

export class BookRegistry {
  private books = new Map<string, OrderBook>();

  getOrCreate(market: string): OrderBook {
    let b = this.books.get(market);
    if (!b) {
      b = new OrderBook(market);
      this.books.set(market, b);
    }
    return b;
  }

  get(market: string): OrderBook | undefined {
    return this.books.get(market);
  }

  list(): string[] {
    return Array.from(this.books.keys());
  }
}
