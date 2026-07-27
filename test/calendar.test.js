import test from "node:test";
import assert from "node:assert/strict";
import { TradingCalendar } from "../src/calendar.js";

test("skips an ordinary weekend", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => Response.json({ data: [] });
  try {
    const calendar = new TradingCalendar({});
    assert.equal(await calendar.isTradingDay(new Date("2026-07-25T05:00:00Z"), "Asia/Kolkata"), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("allows an Upstox-reported special NFO Saturday session", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    Response.json({
      data: [
        {
          date: "2026-07-25",
          closed_exchanges: [],
          open_exchanges: [{ exchange: "NFO" }],
        },
      ],
    });
  try {
    const calendar = new TradingCalendar({});
    assert.equal(await calendar.isTradingDay(new Date("2026-07-25T05:00:00Z"), "Asia/Kolkata"), true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("uses Upstox holiday data for NFO trading days", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    Response.json({
      data: [
        {
          date: "2026-07-27",
          closed_exchanges: ["NFO", "NSE"],
          open_exchanges: [],
        },
      ],
    });
  try {
    const calendar = new TradingCalendar({ accessToken: "analytics-token" });
    assert.equal(await calendar.isTradingDay(new Date("2026-07-27T05:00:00Z"), "Asia/Kolkata"), false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("falls back to weekday logic if the holiday API fails", async () => {
  const originalFetch = globalThis.fetch;
  const warnings = [];
  globalThis.fetch = async () => {
    throw new Error("network unavailable");
  };
  try {
    const calendar = new TradingCalendar({
      logger: { warn: async (event) => warnings.push(event) },
    });
    assert.equal(await calendar.isTradingDay(new Date("2026-07-27T05:00:00Z"), "Asia/Kolkata"), true);
    assert.deepEqual(warnings, ["trading_calendar_unavailable"]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
