import { createWatchlist, detectCrossings, selectMovers } from "./strategy.js";
import { formatAlert, formatSnapshot } from "./format.js";
import { clockValue, dateKey, isWeekday, msUntilClock, scheduledRunDelay } from "./time.js";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const escapeHtml = (value) => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

export class AlertService {
  constructor({ config, provider, notifier, store }) {
    Object.assign(this, { config, provider, notifier, store });
    this.running = false;
  }

  async scanAndMonitor({ force = false } = {}) {
    const now = new Date();
    if (!force && !isWeekday(now, this.config.timezone)) {
      return;
    }

    this.running = true;
    const day = dateKey(now, this.config.timezone);
    const instruments = await this.provider.getFnoEquities();
    if (instruments.length === 0) throw new Error("F&O equity universe is empty");
    const quotes = await this.provider.getQuotes(instruments);
    const movers = selectMovers(quotes, this.config.topCount);
    if (!movers.gainers.length || !movers.losers.length) throw new Error("Could not produce both mover lists from the quote response");

    const state = { day, capturedAt: new Date().toISOString(), watchlist: createWatchlist(movers) };
    await this.store.save(state);
    await this.notifier.send(formatSnapshot(movers, state.capturedAt));
    await this.monitorState(state, { force });
  }

  async monitorState(state, { force = false } = {}) {
    this.running = true;

    while (this.running && (force || clockValue(new Date(), this.config.timezone) < this.config.marketCloseTime)) {
      await sleep(this.config.pollIntervalMs);
      try {
        const current = await this.provider.getQuotes(state.watchlist);
        const alerts = detectCrossings(state.watchlist, current);
        for (const alert of alerts) await this.notifier.send(formatAlert(alert));
        if (alerts.length) await this.store.save(state);
      } catch {
        await sleep(Math.min(this.config.pollIntervalMs * 2, 30_000));
      }
      if (force && process.env.ONE_POLL === "true") this.running = false;
    }
  }

  async runScheduler() {
    const saved = await this.store.load();
    const now = new Date();
    const today = dateKey(now, this.config.timezone);
    const clock = clockValue(now, this.config.timezone);
    if (
      saved?.day === today &&
      Array.isArray(saved.watchlist) &&
      saved.watchlist.length > 0 &&
      isWeekday(now, this.config.timezone) &&
      clock >= this.config.snapshotTime &&
      clock < this.config.marketCloseTime
    ) {
      await this.monitorState(saved);
    }

    for (;;) {
      const delay = msUntilClock(this.config.snapshotTime, this.config.timezone);
      await sleep(delay);
      try {
        await this.scanAndMonitor();
      } catch (error) {
        try {
          await this.notifier.send(`<b>Alert service error</b>\n${escapeHtml(error.message).slice(0, 500)}`);
        } catch {
          // The next scheduled run will retry; fatal startup errors still print in index.js.
        }
      }
      await sleep(1_100);
    }
  }

  async runOnce() {
    const now = new Date();
    if (!isWeekday(now, this.config.timezone)) return;
    const delay = scheduledRunDelay(
      this.config.snapshotTime,
      this.config.marketCloseTime,
      this.config.timezone,
      now,
    );
    if (delay === null) return;
    if (delay > 0) await sleep(delay);
    await this.scanAndMonitor();
  }
}
