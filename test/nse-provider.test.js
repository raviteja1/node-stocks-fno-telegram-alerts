import test from "node:test";
import assert from "node:assert/strict";
import { NseProvider } from "../src/providers/nse.js";

test("NSE provider bootstraps cookies and maps F&O mover responses", async () => {
  const originalFetch = globalThis.fetch;
  const calls = [];
  globalThis.fetch = async (url, options) => {
    calls.push({ url: String(url), options });
    if (calls.length === 1) {
      return new Response("<html></html>", { status: 200, headers: { "set-cookie": "nsit=session123; Path=/" } });
    }
    const isGainers = String(url).includes("index=gainers");
    return Response.json({
      FOSec: {
        timestamp: "22-Jul-2026 09:30:30",
        data: [
          {
            symbol: isGainers ? "RELIANCE" : "TCS",
            open_price: isGainers ? "1,410.00" : "3,200.00",
            high_price: isGainers ? "1,425.50" : "3,210.00",
            low_price: isGainers ? "1,405.25" : "3,150.00",
            ltp: isGainers ? "1,421.00" : "3,160.00",
            prev_price: isGainers ? "1,400.00" : "3,250.00",
          },
        ],
      },
    });
  };

  try {
    const provider = new NseProvider();
    const instruments = await provider.getFnoEquities();
    const quotes = await provider.getQuotes(instruments);

    assert.deepEqual(instruments, [
      { key: "RELIANCE", symbol: "RELIANCE" },
      { key: "TCS", symbol: "TCS" },
    ]);
    assert.equal(quotes[0].ltp, 1421);
    assert.equal(quotes[0].high, 1425.5);
    assert.equal(quotes[0].low, 1405.25);
    assert.match(calls[1].options.headers.Cookie, /nsit=session123/);
    assert.equal(calls.length, 3, "the first getQuotes call reuses the two mover snapshots");
  } finally {
    globalThis.fetch = originalFetch;
  }
});
