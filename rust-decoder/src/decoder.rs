use crate::types::{DecodedMarket, Level, MarketHeader};
use thiserror::Error;

const DISCRIMINATOR_LEN: usize = 8;
const HEADER_LEN: usize = 32 + 32 + 8 + 8 + 8 + 8;
const ORDER_LEN: usize = 8 + 8 + 32;

#[derive(Debug, Error)]
pub enum DecodeError {
    #[error("truncated at {0}")]
    Truncated(&'static str),
    #[error("invalid discriminator")]
    BadDiscriminator,
    #[error("count {0} exceeds sane limit")]
    TooManyOrders(u32),
}

pub fn decode(bytes: &[u8]) -> Result<DecodedMarket, DecodeError> {
    if bytes.len() < DISCRIMINATOR_LEN + HEADER_LEN + 8 {
        return Err(DecodeError::Truncated("preamble"));
    }
    let disc = &bytes[..DISCRIMINATOR_LEN];
    if disc == [0u8; DISCRIMINATOR_LEN] {
        return Err(DecodeError::BadDiscriminator);
    }

    let mut c = Cursor::new(&bytes[DISCRIMINATOR_LEN..]);
    let base_mint = c.take_pubkey()?;
    let quote_mint = c.take_pubkey()?;
    let base_lot_size = c.take_u64()?;
    let quote_lot_size = c.take_u64()?;
    let tick_size = c.take_u64()?;
    let sequence_number = c.take_u64()?;

    let tick = tick_size.max(1) as f64;
    let base_lot = base_lot_size.max(1) as f64;

    let bids = read_side(&mut c, tick, base_lot)?;
    let asks = read_side(&mut c, tick, base_lot)?;

    Ok(DecodedMarket {
        header: MarketHeader {
            base_mint: bs58::encode(base_mint).into_string(),
            quote_mint: bs58::encode(quote_mint).into_string(),
            base_lot_size: base_lot_size.to_string(),
            quote_lot_size: quote_lot_size.to_string(),
            tick_size: tick_size.to_string(),
            sequence_number: sequence_number.to_string(),
        },
        bids,
        asks,
    })
}

fn read_side(c: &mut Cursor, tick: f64, base_lot: f64) -> Result<Vec<Level>, DecodeError> {
    let count = c.take_u32()?;
    if count > 10_000 {
        return Err(DecodeError::TooManyOrders(count));
    }
    let mut levels = Vec::with_capacity(count as usize);
    for _ in 0..count {
        let price_ticks = c.take_u64()?;
        let size_lots = c.take_u64()?;
        let _maker = c.take_pubkey()?;
        levels.push(Level {
            price: (price_ticks as f64) * tick / 1e9,
            size: (size_lots as f64) * base_lot / 1e9,
        });
    }
    Ok(levels)
}

struct Cursor<'a> {
    buf: &'a [u8],
    pos: usize,
}

impl<'a> Cursor<'a> {
    fn new(buf: &'a [u8]) -> Self {
        Self { buf, pos: 0 }
    }
    fn take(&mut self, n: usize, ctx: &'static str) -> Result<&'a [u8], DecodeError> {
        if self.pos + n > self.buf.len() {
            return Err(DecodeError::Truncated(ctx));
        }
        let s = &self.buf[self.pos..self.pos + n];
        self.pos += n;
        Ok(s)
    }
    fn take_u32(&mut self) -> Result<u32, DecodeError> {
        let s = self.take(4, "u32")?;
        Ok(u32::from_le_bytes(s.try_into().unwrap()))
    }
    fn take_u64(&mut self) -> Result<u64, DecodeError> {
        let s = self.take(8, "u64")?;
        Ok(u64::from_le_bytes(s.try_into().unwrap()))
    }
    fn take_pubkey(&mut self) -> Result<[u8; 32], DecodeError> {
        let s = self.take(32, "pubkey")?;
        let mut out = [0u8; 32];
        out.copy_from_slice(s);
        Ok(out)
    }
}

#[allow(dead_code)]
pub fn encode_fixture(
    base_mint: [u8; 32],
    quote_mint: [u8; 32],
    tick_size: u64,
    base_lot: u64,
    quote_lot: u64,
    seq: u64,
    bids: &[(u64, u64)],
    asks: &[(u64, u64)],
) -> Vec<u8> {
    let mut v = Vec::new();
    v.extend_from_slice(&[1u8; DISCRIMINATOR_LEN]);
    v.extend_from_slice(&base_mint);
    v.extend_from_slice(&quote_mint);
    v.extend_from_slice(&base_lot.to_le_bytes());
    v.extend_from_slice(&quote_lot.to_le_bytes());
    v.extend_from_slice(&tick_size.to_le_bytes());
    v.extend_from_slice(&seq.to_le_bytes());
    v.extend_from_slice(&(bids.len() as u32).to_le_bytes());
    for (p, s) in bids {
        v.extend_from_slice(&p.to_le_bytes());
        v.extend_from_slice(&s.to_le_bytes());
        v.extend_from_slice(&[0u8; 32]);
    }
    v.extend_from_slice(&(asks.len() as u32).to_le_bytes());
    for (p, s) in asks {
        v.extend_from_slice(&p.to_le_bytes());
        v.extend_from_slice(&s.to_le_bytes());
        v.extend_from_slice(&[0u8; 32]);
    }
    v
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn roundtrip() {
        let data = encode_fixture(
            [1u8; 32],
            [2u8; 32],
            100,
            1_000,
            1,
            42,
            &[(100, 5), (99, 10)],
            &[(101, 7), (102, 3)],
        );
        let d = decode(&data).unwrap();
        assert_eq!(d.header.sequence_number, "42");
        assert_eq!(d.bids.len(), 2);
        assert_eq!(d.asks.len(), 2);
    }

    #[test]
    fn truncated() {
        let data = encode_fixture([1u8; 32], [2u8; 32], 1, 1, 1, 0, &[], &[]);
        assert!(decode(&data[..10]).is_err());
    }

    #[test]
    fn zero_discriminator_rejected() {
        let mut data = encode_fixture([1u8; 32], [2u8; 32], 1, 1, 1, 0, &[], &[]);
        for b in &mut data[..DISCRIMINATOR_LEN] {
            *b = 0;
        }
        assert!(matches!(decode(&data), Err(DecodeError::BadDiscriminator)));
    }

    #[test]
    fn order_len_matches_constant() {
        assert_eq!(ORDER_LEN, 48);
    }
}
