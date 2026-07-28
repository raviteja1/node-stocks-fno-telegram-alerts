import path from "node:path";
import { marketSettings } from "./settings.js";

export function loadConfig() {
  const dryRun = (process.env.DRY_RUN ?? "false").toLowerCase() === "true";
  const config = {
    upstoxAccessToken: process.env.UPSTOX_ACCESS_TOKEN?.trim() || null,
    telegramBotToken: process.env.TELEGRAM_BOT_TOKEN,
    telegramChatId: process.env.TELEGRAM_CHAT_ID,
    ...marketSettings,
    dryRun,
    dataDir: path.resolve(process.env.DATA_DIR ?? "./data"),
  };

  if (!dryRun && (!config.telegramBotToken || !config.telegramChatId)) {
    throw new Error("TELEGRAM_BOT_TOKEN and TELEGRAM_CHAT_ID are required unless DRY_RUN=true");
  }
  return config;
}
