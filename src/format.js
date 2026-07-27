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

export function formatSnapshot(movers, capturedAt, dataSource) {
  return [
    `<b>F&amp;O morning snapshot</b>`,
    escapeHtml(capturedAt),
    dataSource ? `<b>Data source:</b> ${escapeHtml(dataSource)}` : null,
    "",
    "<b>Top gainers</b>",
    `<pre>${escapeHtml(table(movers.gainers, "gainer"))}</pre>`,
    "<b>Top losers</b>",
    `<pre>${escapeHtml(table(movers.losers, "loser"))}</pre>`,
  ]
    .filter((line) => line !== null)
    .join("\n");
}

export function formatDataSourceStatus(dataSource) {
  const fallback = dataSource === "NSE";
  return fallback
    ? "⚠️ <b>Market data source:</b> NSE fallback\nUpstox retries failed. The next poll will retry Upstox first."
    : "✅ <b>Market data source:</b> Upstox\nUpstox is active again.";
}

export function formatAlert(alert) {
  const high = alert.side === "gainer";
  return [
    high ? "🚀 <b>Positive side</b>" : "🔻 <b>Negative side</b>",
    "",
    `Stock name: <b>${escapeHtml(alert.symbol)}</b>`,
    `Day ${high ? "high" : "low"}: ₹${price.format(alert.reference)}`,
    `Current price: ₹${price.format(alert.currentPrice)}`,
  ].join("\n");
}
