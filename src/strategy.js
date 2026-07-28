import { isoInZone } from './time.js';

export function selectMovers(quotes, count) {
  const ranked = quotes
    .filter(
      (q) =>
        Number.isFinite(q.ltp) &&
        Number.isFinite(q.previousClose) &&
        q.previousClose > 0,
    )
    .map((q) => ({
      ...q,
      changePercent: ((q.ltp - q.previousClose) / q.previousClose) * 100,
    }));

  return {
    gainers: ranked
      .filter((q) => q.changePercent > 0)
      .sort((a, b) => b.changePercent - a.changePercent)
      .slice(0, count),
    losers: ranked
      .filter((q) => q.changePercent < 0)
      .sort((a, b) => a.changePercent - b.changePercent)
      .slice(0, count),
  };
}

export function createWatchlist(movers) {
  return [
    ...movers.gainers.map((q) => ({
      key: q.key,
      symbol: q.symbol,
      side: 'gainer',
      changePercent: q.changePercent,
      initialLtp: q.ltp,
      capturedHigh: q.high,
      capturedLow: null,
      currentPrice: q.ltp,
      alertSent: false,
      alertTime: null,
    })),
    ...movers.losers.map((q) => ({
      key: q.key,
      symbol: q.symbol,
      side: 'loser',
      changePercent: q.changePercent,
      initialLtp: q.ltp,
      capturedHigh: null,
      capturedLow: q.low,
      currentPrice: q.ltp,
      alertSent: false,
      alertTime: null,
    })),
  ];
}

export function normalizeWatchlist(watchlist) {
  for (const item of watchlist) {
    item.initialLtp ??= item.currentPrice ?? item.previousPrice;
    item.currentPrice ??= item.previousPrice ?? item.initialLtp;
    item.capturedHigh ??= item.side === 'gainer' ? item.reference : null;
    item.capturedLow ??= item.side === 'loser' ? item.reference : null;
    item.alertSent ??= false;
    item.alertTime ??= null;
    delete item.reference;
    delete item.previousPrice;
  }
  return watchlist;
}

export function detectCrossings(watchlist, quotes) {
  const byKey = new Map(quotes.map((quote) => [quote.key, quote]));
  const alerts = [];
  for (const item of watchlist) {
    const quote = byKey.get(item.key);
    if (!quote) continue;
    item.currentPrice = quote.ltp;
    const crossedHigh = item.side === 'gainer' && quote.ltp > item.capturedHigh;
    const crossedLow = item.side === 'loser' && quote.ltp < item.capturedLow;
    if (!item.alertSent && (crossedHigh || crossedLow)) {
      const observed = quote.timestamp ? new Date(quote.timestamp) : new Date();
      const alertTime = isoInZone(Number.isNaN(observed.getTime()) ? new Date() : observed);
      alerts.push({
        key: item.key,
        symbol: item.symbol,
        side: item.side,
        reference:
          item.side === 'gainer' ? item.capturedHigh : item.capturedLow,
        currentPrice: quote.ltp,
        timestamp: alertTime,
        watchItem: item,
      });
    }
  }
  return alerts;
}

export function markAlertSent(alert) {
  alert.watchItem.alertSent = true;
  alert.watchItem.alertTime = alert.timestamp;
}
