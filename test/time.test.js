import test from "node:test";
import assert from "node:assert/strict";
import { msUntilClock, scheduledRunDelay } from "../src/time.js";

test("schedules 09:30:30 precisely in Asia/Kolkata", () => {
  const now = new Date("2026-07-22T03:59:30.000Z"); // 09:29:30 IST
  assert.equal(msUntilClock("09:30:30", "Asia/Kolkata", now), 60_000);
});

test("scheduled job waits before snapshot, starts immediately if late, and skips after close", () => {
  assert.equal(
    scheduledRunDelay("09:30:30", "15:30:00", "Asia/Kolkata", new Date("2026-07-22T03:59:30.000Z")),
    60_000,
  );
  assert.equal(
    scheduledRunDelay("09:30:30", "15:30:00", "Asia/Kolkata", new Date("2026-07-22T04:01:00.000Z")),
    0,
  );
  assert.equal(
    scheduledRunDelay("09:30:30", "15:30:00", "Asia/Kolkata", new Date("2026-07-22T10:01:00.000Z")),
    null,
  );
});
