use serde::{Deserialize, Serialize};

#[derive(Debug, Serialize)]
pub struct Level {
    pub price: f64,
    pub size: f64,
}

#[derive(Debug, Serialize)]
pub struct MarketHeader {
    pub base_mint: String,
    pub quote_mint: String,
    pub base_lot_size: String,
    pub quote_lot_size: String,
    pub tick_size: String,
    pub sequence_number: String,
}

#[derive(Debug, Serialize)]
pub struct DecodedMarket {
    pub header: MarketHeader,
    pub bids: Vec<Level>,
    pub asks: Vec<Level>,
}

#[derive(Debug, Deserialize)]
pub struct DecodeRequest {
    pub data_b64: String,
}
