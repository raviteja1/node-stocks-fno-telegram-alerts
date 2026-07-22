const price = new Intl.NumberFormat("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function escapeHtml(value) {
  return String(value).replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

function table(items, side) {
  const level = side === "gainer" ? "HIGH" : "LOW ";
  const rows = ["SYMBOL       CHANGE       LTP      " + level];
  for (const q of items) {
    rows.push(
      `${q.symbol.slice(0, 12).padEnd(12)} ${q.changePercent.toFixed(2).padStart(7)}% ${q.ltp.toFixed(2).padStart(9)} ${(side === "gainer" ? q.high : q.low).toFixed(2).padStart(9)}`,
    );
  }
  return rows.join("\n");
}

export function formatSnapshot(movers, capturedAt) {
  return [
    `<b>F&amp;O morning snapshot</b>`,
    escapeHtml(capturedAt),
    "",
    "<b>Top gainers</b>",
    `<pre>${escapeHtml(table(movers.gainers, "gainer"))}</pre>`,
    "<b>Top losers</b>",
    `<pre>${escapeHtml(table(movers.losers, "loser"))}</pre>`,
  ].join("\n");
}

export function formatAlert(alert) {
  const high = alert.side === "gainer";
  return [
    high ? "🚀 <b>DAY-HIGH BREAKOUT</b>" : "🔻 <b>DAY-LOW BREAKDOWN</b>",
    "",
    `<b>${escapeHtml(alert.symbol)}</b>`,
    `Snapshot ${high ? "high" : "low"}: ₹${price.format(alert.reference)}`,
    `Current price: ₹${price.format(alert.currentPrice)}`,
  ].join("\n");
}
