import test from "node:test";
import assert from "node:assert/strict";
import { gzipSync } from "node:zlib";
import { UpstoxProvider } from "../src/providers/upstox.js";

test("derives F&O equities and returns quotes with symbol-based keys", async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  const master = [
    {
      segment: "NSE_EQ",
      instrument_type: "EQ",
      instrument_key: "NSE_EQ|INE002A01018",
      trading_symbol: "RELIANCE",
    },
    {
      segment: "NSE_FO",
      instrument_type: "FUT",
      underlying_type: "EQUITY",
      underlying_key: "NSE_EQ|INE002A01018",
    },
  ];

  globalThis.fetch = async (url, options = {}) => {
    calls.push({ url: String(url), options });
    if (calls.length === 1) return new Response(gzipSync(JSON.stringify(master)));
    return Response.json({
      data: {
        "NSE_EQ:RELIANCE": {
          instrument_token: "NSE_EQ|INE002A01018",
          symbol: "RELIANCE",
          last_price: 1421,
          timestamp: "2026-07-22T09:30:30+05:30",
          ohlc: { open: 1410, high: 1425.5, low: 1405.25, close: 1400 },
        },
      },
    });
  };

  try {
    const provider = new UpstoxProvider("analytics-token");
    const instruments = await provider.getFnoEquities();
    const result = await provider.getQuotes(instruments);

    assert.deepEqual(instruments, [{ key: "RELIANCE", symbol: "RELIANCE" }]);
    assert.equal(result[0].key, "RELIANCE");
    assert.equal(result[0].high, 1425.5);
    assert.equal(calls[1].options.headers.Authorization, "Bearer analytics-token");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
