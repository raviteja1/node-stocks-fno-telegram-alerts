import test from "node:test";
import assert from "node:assert/strict";
import { AlertService } from "../src/service.js";

test("resumes today's frozen watchlist instead of taking a new snapshot", async () => {
  const saved = {
    day: "2026-07-22",
    capturedAt: "2026-07-22T04:00:00.000Z",
    watchlist: [{ key: "A", symbol: "A", side: "gainer", reference: 110, previousPrice: 109 }],
  };
  const service = new AlertService({
    config: {
      timezone: "Asia/Kolkata",
      snapshotTime: "09:30:00",
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
  assert.equal(resumed.watchlist[0].reference, 110);
});
