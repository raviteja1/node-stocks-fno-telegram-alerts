import { loadEnvFile } from "./env.js";
import { loadConfig } from "./config.js";
import { NseProvider } from "./providers/nse.js";
import { UpstoxProvider } from "./providers/upstox.js";
import { FallbackProvider } from "./providers/fallback.js";
import { TelegramNotifier } from "./telegram.js";
import { JsonStore } from "./store.js";
import { AlertService } from "./service.js";
import { Logger } from "./logger.js";
import { TradingCalendar } from "./calendar.js";
import { loggingSettings, marketDataSettings } from "./settings.js";

loadEnvFile();
const logger = new Logger(loggingSettings.file);

try {
  const config = loadConfig();
  const nse = new NseProvider();
  const upstox = config.upstoxAccessToken ? new UpstoxProvider(config.upstoxAccessToken) : null;
  const provider = upstox
    ? new FallbackProvider(upstox, nse, {
      primaryName: "Upstox",
      fallbackName: "NSE",
      primaryAttempts: marketDataSettings.upstoxRetryAttempts,
      retryDelayMs: marketDataSettings.upstoxRetryDelayMs,
      logger,
    })
    : nse;
  const service = new AlertService({
    config,
    provider,
    notifier: new TelegramNotifier({
      token: config.telegramBotToken,
      chatId: config.telegramChatId,
      dryRun: config.dryRun,
    }),
    store: new JsonStore(config.dataDir),
    calendar: new TradingCalendar({
      accessToken: config.upstoxAccessToken,
      logger,
    }),
    logger,
  });

  if (process.argv.includes("--scan-now")) await service.scanAndMonitor({ force: true });
  else if (process.argv.includes("--run-once")) await service.runOnce();
  else await service.runScheduler();
} catch (error) {
  console.error(error.stack ?? error.message);
  await logger.error("fatal_error", { error });
  process.exitCode = 1;
}
