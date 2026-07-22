import test from "node:test";
import assert from "node:assert/strict";
import { FallbackProvider } from "../src/providers/fallback.js";

const instruments = [{ key: "RELIANCE", symbol: "RELIANCE" }];
const quotes = [{ key: "RELIANCE", symbol: "RELIANCE", ltp: 100 }];

test("uses Upstox when the initial NSE request fails", async () => {
  const primary = { getFnoEquities: async () => { throw new Error("NSE request failed (403)"); } };
  const fallback = { getFnoEquities: async () => instruments, getQuotes: async () => quotes };
  const provider = new FallbackProvider(primary, fallback);

  assert.deepEqual(await provider.getFnoEquities(), instruments);
  assert.deepEqual(await provider.getQuotes(instruments), quotes);
});

test("switches an existing symbol watchlist to Upstox after an NSE poll failure", async () => {
  const primary = {
    getFnoEquities: async () => instruments,
    getQuotes: async () => { throw new Error("NSE request failed (404)"); },
  };
  const fallback = { getQuotes: async (received) => received.map((item) => ({ ...item, ltp: 101 })) };
  const provider = new FallbackProvider(primary, fallback);

  await provider.getFnoEquities();
  const result = await provider.getQuotes(instruments);
  assert.equal(result[0].key, "RELIANCE");
  assert.equal(result[0].ltp, 101);
});

test("does not hide the NSE error when no Upstox token/provider is configured", async () => {
  const primary = { getFnoEquities: async () => { throw new Error("NSE unavailable"); } };
  const provider = new FallbackProvider(primary);
  await assert.rejects(provider.getFnoEquities(), /NSE unavailable/);
});
