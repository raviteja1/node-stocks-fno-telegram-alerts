import { gunzipSync } from "node:zlib";

const INSTRUMENTS_URL = "https://assets.upstox.com/market-quote/instruments/exchange/NSE.json.gz";
const QUOTES_URL = "https://api.upstox.com/v2/market-quote/quotes";

async function checkedFetch(url, options = {}) {
  const response = await fetch(url, { ...options, signal: AbortSignal.timeout(20_000) });
  if (!response.ok) {
    const body = await response.text();
    throw new Error(`Upstox request failed (${response.status}): ${body.slice(0, 200)}`);
  }
  return response;
}

export class UpstoxProvider {
  constructor(accessToken) {
    this.accessToken = accessToken;
    this.instruments = null;
    this.bySymbol = null;
  }

  async ensureInstruments() {
    if (this.instruments) return;
    const response = await checkedFetch(INSTRUMENTS_URL);
    const master = JSON.parse(gunzipSync(Buffer.from(await response.arrayBuffer())).toString("utf8"));
    const equityByKey = new Map(
      master
        .filter((item) => item.segment === "NSE_EQ" && item.instrument_type === "EQ")
        .map((item) => [item.instrument_key, item]),
    );
    const underlyingKeys = new Set(
      master
        .filter(
          (item) =>
            item.segment === "NSE_FO" &&
            item.instrument_type === "FUT" &&
            item.underlying_type === "EQUITY" &&
            item.underlying_key,
        )
        .map((item) => item.underlying_key),
    );

    this.instruments = [...underlyingKeys]
      .map((underlyingKey) => equityByKey.get(underlyingKey))
      .filter(Boolean)
      .map((item) => ({ key: item.trading_symbol, symbol: item.trading_symbol, instrumentKey: item.instrument_key }))
      .sort((a, b) => a.symbol.localeCompare(b.symbol));
    this.bySymbol = new Map(this.instruments.map((item) => [item.symbol, item]));
  }

  async getFnoEquities() {
    await this.ensureInstruments();
    return this.instruments.map(({ key, symbol }) => ({ key, symbol }));
  }

  async getQuotes(instruments) {
    await this.ensureInstruments();
    const requested = [...new Set(instruments.map((item) => item.symbol ?? item.key))]
      .map((symbol) => this.bySymbol.get(symbol))
      .filter(Boolean);
    const quotes = [];

    for (let offset = 0; offset < requested.length; offset += 500) {
      const batch = requested.slice(offset, offset + 500);
      const url = new URL(QUOTES_URL);
      url.searchParams.set("instrument_key", batch.map((item) => item.instrumentKey).join(","));
      const response = await checkedFetch(url, {
        headers: { Accept: "application/json", Authorization: `Bearer ${this.accessToken}` },
      });
      const payload = await response.json();
      const batchBySymbol = new Map(batch.map((item) => [item.symbol, item]));
      const batchByToken = new Map(batch.map((item) => [item.instrumentKey, item]));

      for (const raw of Object.values(payload.data ?? {})) {
        const instrument = batchByToken.get(raw.instrument_token) ?? batchBySymbol.get(raw.symbol);
        const ltp = Number(raw.last_price);
        const previousClose = Number(raw.ohlc?.close);
        const high = Number(raw.ohlc?.high);
        const low = Number(raw.ohlc?.low);
        if (
          !instrument ||
          !Number.isFinite(ltp) ||
          !Number.isFinite(previousClose) ||
          previousClose <= 0 ||
          !Number.isFinite(high) ||
          !Number.isFinite(low)
        ) {
          continue;
        }
        quotes.push({
          key: instrument.symbol,
          symbol: instrument.symbol,
          ltp,
          open: Number(raw.ohlc?.open),
          high,
          low,
          previousClose,
          timestamp: raw.timestamp ?? new Date().toISOString(),
        });
      }
    }
    return quotes;
  }
}
