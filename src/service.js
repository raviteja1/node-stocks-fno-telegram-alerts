import { createWatchlist, detectCrossings, markAlertSent, normalizeWatchlist, selectMovers } from "./strategy.js";
import { formatAlert, formatDataSourceStatus, formatSnapshot } from "./format.js";
import { clockValue, dateKey, isWeekday, msUntilClock, scheduledRunDelay } from "./time.js";

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const escapeHtml = (value) => String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");

export class AlertService {
  constructor({ config, provider, notifier, store, calendar = null, logger = null }) {
    Object.assign(this, { config, provider, notifier, store, calendar, logger });
    this.running = false;
    this.lastDataSource = null;
  }

  dataSource() {
    return this.provider.source ?? "Unknown";
  }

  async notifyDataSourceChange() {
    const source = this.dataSource();
    if (source === this.lastDataSource) return;
    await this.notifier.send(formatDataSourceStatus(source));
    this.lastDataSource = source;
  }

  async isTradingDay(now) {
    if (!isWeekday(now, this.config.timezone)) return false;
    return this.calendar ? this.calendar.isTradingDay(now, this.config.timezone) : true;
  }

  async scanAndMonitor({ force = false } = {}) {
    const now = new Date();
    if (!force && !(await this.isTradingDay(now))) {
      await this.logger?.info("non_trading_day_skipped", {
        day: dateKey(now, this.config.timezone),
      });
      return;
    }

    this.running = true;
    const day = dateKey(now, this.config.timezone);
    const snapshotRequestedAt = now.toISOString();
    const snapshotRequestTime = clockValue(now, this.config.timezone);
    if (!force && snapshotRequestTime !== this.config.snapshotTime) {
      throw new Error(
        `Official snapshot must start at ${this.config.snapshotTime} IST; request started at ${snapshotRequestTime} IST`,
      );
    }
    const instruments = await this.provider.getFnoEquities();
    if (instruments.length === 0) throw new Error("F&O equity universe is empty");
    const quotes = await this.provider.getQuotes(instruments);
    const movers = selectMovers(quotes, this.config.topCount);
    if (!movers.gainers.length || !movers.losers.length) {
      throw new Error(
        `Could not produce both mover lists from ${quotes.length} usable quotes ` +
          `(${movers.gainers.length} gainers, ${movers.losers.length} losers)`,
      );
    }

    const state = {
      day,
      snapshotTime: this.config.snapshotTime,
      snapshotRequestedAt,
      capturedAt: new Date().toISOString(),
      officialSnapshot: !force,
      watchlist: createWatchlist(movers),
    };
    if (!force) await this.store.save(state);
    await this.logger?.info("watchlist_created", {
      day,
      capturedAt: state.capturedAt,
      source: this.dataSource(),
      gainers: movers.gainers.map((item) => item.symbol),
      losers: movers.losers.map((item) => item.symbol),
      countPerSide: this.config.topCount,
      officialSnapshot: state.officialSnapshot,
      snapshotRequestTime,
    });
    this.lastDataSource = this.dataSource();
    await this.notifier.send(formatSnapshot(movers, state.capturedAt, this.lastDataSource, force));
    await this.monitorState(state, { force, persistState: !force });
  }

  async monitorState(state, { force = false, persistState = true } = {}) {
    this.running = true;
    normalizeWatchlist(state.watchlist);
    await this.logger?.info("monitoring_started", {
      day: state.day,
      watchlistSize: state.watchlist.length,
      pollIntervalMs: this.config.pollIntervalMs,
      marketCloseTime: this.config.marketCloseTime,
      manual: force,
    });

    while (this.running && clockValue(new Date(), this.config.timezone) < this.config.marketCloseTime) {
      await sleep(this.config.pollIntervalMs);
      try {
        const current = await this.provider.getQuotes(state.watchlist);
        await this.notifyDataSourceChange();
        await this.logger?.info("price_poll", {
          day: state.day,
          source: this.dataSource(),
          requested: state.watchlist.length,
          received: current.length,
        });
        const alerts = detectCrossings(state.watchlist, current);
        for (const alert of alerts) {
          try {
            const referenceTime = state.officialSnapshot
              ? state.snapshotTime
              : clockValue(new Date(state.snapshotRequestedAt), this.config.timezone);
            await this.notifier.send(
              formatAlert(
                {
                  ...alert,
                  dataSource: this.dataSource(),
                  officialSnapshot: state.officialSnapshot === true,
                  referenceTime,
                },
                this.config.timezone,
              ),
            );
            markAlertSent(alert);
            if (persistState) await this.store.save(state);
            await this.logger?.info("alert_generated", {
              day: state.day,
              side: alert.side,
              symbol: alert.symbol,
              capturedLevel: alert.reference,
              currentPrice: alert.currentPrice,
              alertTime: alert.timestamp,
              officialSnapshot: state.officialSnapshot,
              referenceTime,
            });
          } catch (error) {
            await this.logger?.error("alert_delivery_failed", {
              symbol: alert.symbol,
              error,
            });
            throw error;
          }
        }
      } catch (error) {
        await this.logger?.error("monitoring_error", {
          day: state.day,
          source: this.dataSource(),
          error,
        });
        await sleep(Math.min(this.config.pollIntervalMs * 2, 30_000));
      }
      if (force && process.env.ONE_POLL === "true") this.running = false;
    }
    await this.logger?.info("monitoring_stopped", {
      day: state.day,
      reason: this.running ? "market_close" : "requested",
    });
  }

  async resumeSavedState(now = new Date()) {
    const saved = await this.store.load();
    const today = dateKey(now, this.config.timezone);
    const clock = clockValue(now, this.config.timezone);
    const requestedAt = saved?.snapshotRequestedAt ? new Date(saved.snapshotRequestedAt) : null;
    const validRequestedAt =
      requestedAt &&
      !Number.isNaN(requestedAt.getTime()) &&
      clockValue(requestedAt, this.config.timezone) === this.config.snapshotTime;
    const validOfficialSnapshot =
      saved?.officialSnapshot === true &&
      saved?.snapshotTime === this.config.snapshotTime &&
      validRequestedAt;
    if (saved?.day === today && !validOfficialSnapshot) {
      await this.logger?.warn("saved_state_ignored", {
        day: today,
        reason: "not-an-official-09:30:01-snapshot",
        capturedAt: saved.capturedAt,
        snapshotRequestedAt: saved.snapshotRequestedAt,
      });
    }
    if (
      saved?.day === today &&
      validOfficialSnapshot &&
      Array.isArray(saved.watchlist) &&
      saved.watchlist.length > 0 &&
      (await this.isTradingDay(now)) &&
      clock >= this.config.snapshotTime &&
      clock < this.config.marketCloseTime
    ) {
      normalizeWatchlist(saved.watchlist);
      await this.monitorState(saved);
      return true;
    }
    return false;
  }

  async runScheduler() {
    await this.resumeSavedState();

    for (;;) {
      const delay = msUntilClock(this.config.snapshotTime, this.config.timezone);
      await sleep(delay);
      try {
        await this.scanAndMonitor();
      } catch (error) {
        await this.logger?.error("scheduled_run_failed", { error });
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
    if (!(await this.isTradingDay(now))) return;
    if (await this.resumeSavedState(now)) return;
    const currentClock = clockValue(now, this.config.timezone);
    if (currentClock > this.config.snapshotTime && currentClock < this.config.marketCloseTime) {
      await this.logger?.error("snapshot_window_missed", {
        expected: this.config.snapshotTime,
        actual: currentClock,
        action: "No late official watchlist was created",
      });
      try {
        await this.notifier.send(
          `<b>Alert service did not start</b>\nOfficial ${escapeHtml(this.config.snapshotTime)} snapshot was missed. No late high/low references were created.`,
        );
      } catch {
        // The error is already recorded in the local structured log.
      }
      return;
    }
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
