import test from "node:test";
import assert from "node:assert/strict";
import { formatAlert, formatDataSourceStatus, formatSnapshot } from "../src/format.js";

test("snapshot contains separate high and low mover tables", () => {
  const message = formatSnapshot(
    {
      gainers: [{ symbol: "GAIN", changePercent: 2.5, ltp: 102, high: 103, low: 99 }],
      losers: [{ symbol: "LOSS", changePercent: -2.5, ltp: 98, high: 101, low: 97 }],
    },
    "2026-07-22T04:00:30.000Z",
    "Upstox",
  );

  assert.match(message, /Data source:<\/b> Upstox/);
  assert.match(message, /Top gainers/);
  assert.match(message, /Top losers/);
  assert.match(message, /HIGH/);
  assert.match(message, /103\.00/);
  assert.match(message, /LOW/);
  assert.match(message, /97\.00/);
});

test("formats positive and negative alerts with the frozen day level", () => {
  const positive = formatAlert({
    side: "gainer",
    symbol: "GAIN",
    reference: 103,
    currentPrice: 103.05,
    timestamp: "2026-07-22T05:00:30.000Z",
    dataSource: "Upstox",
  });
  const negative = formatAlert({
    side: "loser",
    symbol: "LOSS",
    reference: 97,
    currentPrice: 96.95,
    timestamp: "2026-07-22T05:30:30.000Z",
    dataSource: "NSE",
  });

  assert.match(positive, /🟢 <b>POSITIVE BREAKOUT<\/b>/);
  assert.match(positive, /Stock: <b>GAIN<\/b>/);
  assert.match(positive, /Captured High \(09:30:01\): ₹103\.00/);
  assert.match(positive, /Current Price: ₹103\.05/);
  assert.match(positive, /Data Source: <b>Upstox<\/b>/);
  assert.match(positive, /Time: 10:30:30 AM IST/);
  assert.match(negative, /🔴 <b>NEGATIVE BREAKDOWN<\/b>/);
  assert.match(negative, /Stock: <b>LOSS<\/b>/);
  assert.match(negative, /Captured Low \(09:30:01\): ₹97\.00/);
  assert.match(negative, /Current Price: ₹96\.95/);
  assert.match(negative, /Data Source: <b>NSE<\/b>/);
  assert.match(negative, /Time: 11:00:30 AM IST/);
});

test("formats provider status changes", () => {
  assert.match(formatDataSourceStatus("NSE"), /NSE fallback/);
  assert.match(formatDataSourceStatus("NSE"), /next poll will retry Upstox/i);
  assert.match(formatDataSourceStatus("Upstox"), /Upstox is active again/);
});
