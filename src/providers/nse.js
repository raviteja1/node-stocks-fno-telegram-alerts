const BASE_URL = "https://www.nseindia.com";
const PAGE_URL = `${BASE_URL}/market-data/top-gainers-losers`;
const GAINERS_URL = `${BASE_URL}/api/live-analysis-variations?index=gainers`;
// NSE's route intentionally uses the historical spelling "loosers".
const LOSERS_URL = `${BASE_URL}/api/live-analysis-variations?index=loosers`;

const BASE_HEADERS = {
  Accept: "application/json, text/plain, */*",
  "Accept-Language": "en-IN,en;q=0.9",
  "Cache-Control": "no-cache",
  Pragma: "no-cache",
  Referer: PAGE_URL,
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/136.0.0.0 Safari/537.36",
};

function numeric(value) {
  const parsed = Number(String(value ?? "").replaceAll(",", ""));
  return Number.isFinite(parsed) ? parsed : Number.NaN;
}

function setCookieValues(headers) {
  if (typeof headers.getSetCookie === "function") return headers.getSetCookie();
  const combined = headers.get("set-cookie");
  return combined ? [...combined.matchAll(/(?:^|,\s*)([A-Za-z0-9_-]+)=([^;,]*)/g)].map((match) => `${match[1]}=${match[2]}`) : [];
}

export class NseProvider {
  constructor() {
    this.cookies = new Map();
    this.initialQuotes = null;
  }

  updateCookies(headers) {
    for (const value of setCookieValues(headers)) {
      const pair = value.split(";", 1)[0];
      const separator = pair.indexOf("=");
      if (separator > 0) this.cookies.set(pair.slice(0, separator), pair.slice(separator + 1));
    }
  }

  cookieHeader() {
    return [...this.cookies].map(([name, value]) => `${name}=${value}`).join("; ");
  }

  async bootstrap() {
    const response = await fetch(PAGE_URL, {
      headers: { ...BASE_HEADERS, Accept: "text/html,application/xhtml+xml" },
      signal: AbortSignal.timeout(20_000),
    });
    this.updateCookies(response.headers);
    if (!response.ok) throw new Error(`NSE session bootstrap failed (${response.status})`);
  }

  async fetchDirection(url, label, retry = true) {
    if (this.cookies.size === 0) await this.bootstrap();
    const response = await fetch(url, {
      headers: { ...BASE_HEADERS, Cookie: this.cookieHeader() },
      signal: AbortSignal.timeout(20_000),
    });
    this.updateCookies(response.headers);

    if ([401, 403].includes(response.status) && retry) {
      this.cookies.clear();
      await this.bootstrap();
      return this.fetchDirection(url, label, false);
    }
    if (!response.ok) throw new Error(`NSE ${label} request failed (${response.status})`);

    const body = await response.text();
    let payload;
    try {
      payload = JSON.parse(body);
    } catch {
      throw new Error(`NSE ${label} response was not JSON`);
    }
    const section = payload.FOSec;
    if (!Array.isArray(section?.data)) throw new Error(`NSE ${label} response did not contain FOSec data`);
    const timestamp = section.timestamp ?? new Date().toISOString();
    return section.data
      .filter((item) => item.symbol)
      .map((item) => ({
        key: item.symbol,
        symbol: item.symbol,
        ltp: numeric(item.ltp),
        open: numeric(item.open_price),
        high: numeric(item.high_price),
        low: numeric(item.low_price),
        previousClose: numeric(item.prev_price),
        timestamp,
      }))
      .filter(
        (quote) =>
          Number.isFinite(quote.ltp) &&
          Number.isFinite(quote.previousClose) &&
          quote.previousClose > 0 &&
          Number.isFinite(quote.high) &&
          Number.isFinite(quote.low),
      );
  }

  async fetchAllQuotes() {
    const gainers = await this.fetchDirection(GAINERS_URL, "gainers");
    const losers = await this.fetchDirection(LOSERS_URL, "losers");
    const unique = new Map([...gainers, ...losers].map((quote) => [quote.key, quote]));
    return [...unique.values()];
  }

  async getFnoEquities() {
    this.initialQuotes = await this.fetchAllQuotes();
    return this.initialQuotes.map(({ key, symbol }) => ({ key, symbol }));
  }

  async getQuotes(instruments) {
    const quotes = this.initialQuotes ?? (await this.fetchAllQuotes());
    this.initialQuotes = null;
    const requested = new Set(instruments.map((item) => item.key));
    return quotes.filter((quote) => requested.has(quote.key));
  }
}
