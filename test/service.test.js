import test from "node:test";
import assert from "node:assert/strict";
import { AlertService } from "../src/service.js";

test("resumes today's frozen watchlist instead of taking a new snapshot", async () => {
  const saved = {
    day: "2026-07-22",
    snapshotTime: "09:30:01",
    snapshotRequestedAt: "2026-07-22T04:00:01.000Z",
    capturedAt: "2026-07-22T04:00:02.000Z",
    officialSnapshot: true,
    watchlist: [{ key: "A", symbol: "A", side: "gainer", reference: 110, previousPrice: 109 }],
  };
  const service = new AlertService({
    config: {
      timezone: "Asia/Kolkata",
      snapshotTime: "09:30:01",
      marketCloseTime: "15:30:00",
    },
    provider: {},
    notifier: {},
    store: { load: async () => saved },
  });
  let resumed = null;
  service.monitorState = async (state) => {
    resumed = state;
  };

  const result = await service.resumeSavedState(new Date("2026-07-22T05:30:00.000Z"));

  assert.equal(result, true);
  assert.equal(resumed.watchlist[0].capturedHigh, 110);
  assert.equal(resumed.watchlist[0].currentPrice, 109);
  assert.equal(resumed.watchlist[0].alertTime, null);
});

test("does not resume a same-day state captured outside 09:30:01", async () => {
  const warnings = [];
  const saved = {
    day: "2026-07-22",
    snapshotTime: "09:30:01",
    snapshotRequestedAt: "2026-07-22T09:12:42.000Z",
    capturedAt: "2026-07-22T09:12:43.000Z",
    officialSnapshot: false,
    watchlist: [{ key: "A", symbol: "A", side: "gainer", capturedHigh: 110 }],
  };
  const service = new AlertService({
    config: {
      timezone: "Asia/Kolkata",
      snapshotTime: "09:30:01",
      marketCloseTime: "15:30:00",
    },
    provider: {},
    notifier: {},
    store: { load: async () => saved },
    logger: { warn: async (event) => warnings.push(event) },
  });
  service.monitorState = async () => {
    throw new Error("invalid state must not be monitored");
  };

  const result = await service.resumeSavedState(new Date("2026-07-22T09:15:00.000Z"));

  assert.equal(result, false);
  assert.deepEqual(warnings, ["saved_state_ignored"]);
});
