export function selectMovers(quotes, count) {
    const ranked = quotes
      .filter((q) => Number.isFinite(q.ltp) && Number.isFinite(q.previousClose) && q.previousClose > 0)
      .map((q) => ({ ...q, changePercent: ((q.ltp - q.previousClose) / q.previousClose) * 100 }));
  
    return {
      gainers: ranked.filter((q) => q.changePercent > 0).sort((a, b) => b.changePercent - a.changePercent).slice(0, count),
      losers: ranked.filter((q) => q.changePercent < 0).sort((a, b) => a.changePercent - b.changePercent).slice(0, count),
    };
  }
  
  export function createWatchlist(movers) {
    return [
      ...movers.gainers.map((q) => ({
        key: q.key,
        symbol: q.symbol,
        side: "gainer",
        changePercent: q.changePercent,
        reference: q.high,
        previousPrice: q.ltp,
        alertSent: false,
      })),
      ...movers.losers.map((q) => ({
        key: q.key,
        symbol: q.symbol,
        side: "loser",
        changePercent: q.changePercent,
        reference: q.low,
        previousPrice: q.ltp,
        alertSent: false,
      })),
    ];
  }
  
  export function detectCrossings(watchlist, quotes) {
    const byKey = new Map(quotes.map((quote) => [quote.key, quote]));
    const alerts = [];
    for (const item of watchlist) {
      const quote = byKey.get(item.key);
      if (!quote) continue;
      const crossedHigh = item.side === "gainer" && item.previousPrice <= item.reference && quote.ltp > item.reference;
      const crossedLow = item.side === "loser" && item.previousPrice >= item.reference && quote.ltp < item.reference;
      if (!item.alertSent && (crossedHigh || crossedLow)) {
        item.alertSent = true;
        alerts.push({ ...item, currentPrice: quote.ltp, timestamp: quote.timestamp });
      }
      item.previousPrice = quote.ltp;
    }
    return alerts;
  }
  