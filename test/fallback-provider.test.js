import test from "node:test";
import assert from "node:assert/strict";
import { FallbackProvider } from "../src/providers/fallback.js";

const instruments = [{ key: "RELIANCE", symbol: "RELIANCE" }];
const quotes = [{ key: "RELIANCE", symbol: "RELIANCE", ltp: 100 }];

test("uses NSE when the initial Upstox request fails", async () => {
  const primary = { getFnoEquities: async () => { throw new Error("Upstox request failed (503)"); } };
  const fallback = { getFnoEquities: async () => instruments, getQuotes: async () => quotes };
  const provider = new FallbackProvider(primary, fallback, { primaryName: "Upstox", fallbackName: "NSE" });

  assert.deepEqual(await provider.getFnoEquities(), instruments);
  assert.deepEqual(await provider.getQuotes(instruments), quotes);
});

test("switches an existing symbol watchlist to NSE after an Upstox poll failure", async () => {
  const primary = {
    getFnoEquities: async () => instruments,
    getQuotes: async () => { throw new Error("Upstox request failed (503)"); },
  };
  const fallback = { getQuotes: async (received) => received.map((item) => ({ ...item, ltp: 101 })) };
  const provider = new FallbackProvider(primary, fallback, { primaryName: "Upstox", fallbackName: "NSE" });

  await provider.getFnoEquities();
  const result = await provider.getQuotes(instruments);
  assert.equal(result[0].key, "RELIANCE");
  assert.equal(result[0].ltp, 101);
});

test("does not hide the primary error when no fallback is configured", async () => {
  const primary = { getFnoEquities: async () => { throw new Error("Upstox unavailable"); } };
  const provider = new FallbackProvider(primary);
  await assert.rejects(provider.getFnoEquities(), /Upstox unavailable/);
});

test("identifies both providers when primary and fallback fail", async () => {
  const primary = { getFnoEquities: async () => { throw new Error("timeout"); } };
  const fallback = { getFnoEquities: async () => { throw new Error("403"); } };
  const provider = new FallbackProvider(primary, fallback, { primaryName: "Upstox", fallbackName: "NSE" });

  await assert.rejects(provider.getFnoEquities(), /Upstox failed: timeout; NSE fallback failed: 403/);
});
