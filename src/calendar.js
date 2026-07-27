import { dateKey, isWeekday } from "./time.js";

const HOLIDAYS_URL = "https://api.upstox.com/v2/market/holidays";

export class TradingCalendar {
  constructor({ accessToken, logger }) {
    this.accessToken = accessToken;
    this.logger = logger;
    this.holidays = null;
    this.holidaysYear = null;
  }

  async loadHolidays(year) {
    if (this.holidays && this.holidaysYear === year) return this.holidays;
    const headers = { Accept: "application/json" };
    if (this.accessToken) headers.Authorization = `Bearer ${this.accessToken}`;
    const response = await fetch(HOLIDAYS_URL, {
      headers,
      signal: AbortSignal.timeout(20_000),
    });
    if (!response.ok) throw new Error(`Upstox market-holidays request failed (${response.status})`);
    const payload = await response.json();
    if (!Array.isArray(payload.data)) throw new Error("Upstox market-holidays response did not contain data");
    this.holidays = payload.data;
    this.holidaysYear = year;
    return this.holidays;
  }

  async isTradingDay(now, timezone) {
    const weekday = isWeekday(now, timezone);
    const day = dateKey(now, timezone);
    try {
      const holidays = await this.loadHolidays(day.slice(0, 4));
      const holiday = holidays.find((item) => item.date === day);
      if (!holiday) return weekday;

      const open = new Set(
        (holiday.open_exchanges ?? []).map((item) => (typeof item === "string" ? item : item.exchange)),
      );
      const closed = new Set(holiday.closed_exchanges ?? []);
      if (open.has("NFO")) return true;
      if (closed.has("NFO")) return false;
      if (open.has("NSE")) return true;
      if (closed.has("NSE")) return false;
      return weekday;
    } catch (error) {
      await this.logger?.warn("trading_calendar_unavailable", {
        day,
        error,
        fallback: "weekday-only",
      });
      return weekday;
    }
  }
}
