export interface Level {
  price: number;
  size: number;
}

export interface DecodedMarket {
  header: {
    base_mint: string;
    quote_mint: string;
    base_lot_size: string;
    quote_lot_size: string;
    tick_size: string;
    sequence_number: string;
  };
  bids: Level[];
  asks: Level[];
}

export interface BookSnapshot {
  market: string;
  slot: number;
  sequence: string;
  ts: number;
  top: { bid: Level | null; ask: Level | null; spread: number | null };
  bids: Level[];
  asks: Level[];
}
