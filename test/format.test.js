import test from "node:test";
import assert from "node:assert/strict";
import { formatAlert, formatSnapshot } from "../src/format.js";

test("snapshot contains separate high and low mover tables", () => {
  const message = formatSnapshot(
    {
      gainers: [{ symbol: "GAIN", changePercent: 2.5, ltp: 102, high: 103, low: 99 }],
      losers: [{ symbol: "LOSS", changePercent: -2.5, ltp: 98, high: 101, low: 97 }],
    },
    "2026-07-22T04:00:30.000Z",
  );

  assert.match(message, /Top gainers/);
  assert.match(message, /Top losers/);
  assert.match(message, /HIGH/);
  assert.match(message, /103\.00/);
  assert.match(message, /LOW/);
  assert.match(message, /97\.00/);
});

test("formats positive and negative alerts with the frozen day level", () => {
  const positive = formatAlert({ side: "gainer", symbol: "GAIN", reference: 103, currentPrice: 103.05 });
  const negative = formatAlert({ side: "loser", symbol: "LOSS", reference: 97, currentPrice: 96.95 });

  assert.match(positive, /Positive side/);
  assert.match(positive, /Stock name: <b>GAIN<\/b>/);
  assert.match(positive, /Day high: ₹103\.00/);
  assert.match(positive, /Current price: ₹103\.05/);
  assert.match(negative, /Negative side/);
  assert.match(negative, /Stock name: <b>LOSS<\/b>/);
  assert.match(negative, /Day low: ₹97\.00/);
  assert.match(negative, /Current price: ₹96\.95/);
});
