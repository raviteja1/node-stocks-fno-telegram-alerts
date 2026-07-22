import test from "node:test";
import assert from "node:assert/strict";
import { createWatchlist, detectCrossings, selectMovers } from "../src/strategy.js";

const quote = (key, ltp, close, high = ltp, low = ltp) => ({ key, symbol: key, ltp, previousClose: close, high, low });

test("selectMovers ranks positive and negative percentage changes", () => {
  const result = selectMovers([quote("A", 110, 100), quote("B", 105, 100), quote("C", 80, 100), quote("D", 90, 100)], 1);
  assert.equal(result.gainers[0].key, "A");
  assert.equal(result.losers[0].key, "C");
});

test("gainer alerts only on a strict crossing and only once", () => {
  const watchlist = createWatchlist({ gainers: [{ ...quote("A", 109, 100, 110), changePercent: 9 }], losers: [] });
  assert.equal(detectCrossings(watchlist, [{ key: "A", ltp: 110 }]).length, 0);
  assert.equal(detectCrossings(watchlist, [{ key: "A", ltp: 110.05 }]).length, 1);
  assert.equal(detectCrossings(watchlist, [{ key: "A", ltp: 111 }]).length, 0);
});

test("loser alerts only after price crosses below the snapshot low", () => {
  const watchlist = createWatchlist({ gainers: [], losers: [{ ...quote("A", 91, 100, 92, 90), changePercent: -9 }] });
  assert.equal(detectCrossings(watchlist, [{ key: "A", ltp: 90 }]).length, 0);
  const alerts = detectCrossings(watchlist, [{ key: "A", ltp: 89.95 }]);
  assert.equal(alerts.length, 1);
  assert.equal(alerts[0].currentPrice, 89.95);
});
