import test from "node:test";
import assert from "node:assert/strict";
import { formatSnapshot } from "../src/format.js";

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
