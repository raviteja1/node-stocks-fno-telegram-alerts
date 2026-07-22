import path from "node:path";

function integer(name, fallback, minimum = 1) {
  const value = Number.parseInt(process.env[name] ?? String(fallback), 10);
  if (!Number.isInteger(value) || value < minimum) {
    throw new Error(`${name} must be an integer >= ${minimum}`);
  }
  return value;
}

function time(name, fallback) {
  const value = process.env[name] ?? fallback;
  if (!/^(?:[01]\d|2[0-3]):[0-5]\d:[0-5]\d$/.test(value)) {
    throw new Error(`${name} must use HH:mm:ss format`);
  }
  return value;
}

export function loadConfig() {
  const dryRun = (process.env.DRY_RUN ?? "false").toLowerCase() === "true";
  const marketDataProvider = (process.env.MARKET_DATA_PROVIDER ?? "auto").toLowerCase();
  if (!["auto", "nse", "upstox"].includes(marketDataProvider)) {
    throw new Error("MARKET_DATA_PROVIDER must be auto, nse, or upstox");
  }
  const config = {
    upstoxAccessToken: process.env.UPSTOX_ACCESS_TOKEN?.trim() || null,
    marketDataProvider,
    telegramBotToken: process.env.TELEGRAM_BOT_TOKEN,
    telegramChatId: process.env.TELEGRAM_CHAT_ID,
    topCount: integer("TOP_COUNT", 10),
    pollIntervalMs: integer("POLL_INTERVAL_MS", 5_000, 3_000),
    snapshotTime: time("SNAPSHOT_TIME", "09:30:30"),
    marketCloseTime: time("MARKET_CLOSE_TIME", "15:30:00"),
    timezone: process.env.TIMEZONE ?? "Asia/Kolkata",
    dryRun,
    dataDir: path.resolve(process.env.DATA_DIR ?? "./data"),
  };

  if (!dryRun && (!config.telegramBotToken || !config.telegramChatId)) {
    throw new Error("TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID are required unless DRY_RUN=true");
  }
  if (marketDataProvider === "upstox" && !config.upstoxAccessToken) {
    throw new Error("UPSTOX_ACCESS_TOKEN is required when MARKET_DATA_PROVIDER=upstox");
  }
  return config;
}
