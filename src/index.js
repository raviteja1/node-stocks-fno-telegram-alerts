import { loadEnvFile } from "./env.js";
import { loadConfig } from "./config.js";
import { NseProvider } from "./providers/nse.js";
import { UpstoxProvider } from "./providers/upstox.js";
import { FallbackProvider } from "./providers/fallback.js";
import { TelegramNotifier } from "./telegram.js";
import { JsonStore } from "./store.js";
import { AlertService } from "./service.js";

loadEnvFile();

try {
  const config = loadConfig();
  const nse = new NseProvider();
  const upstox = config.upstoxAccessToken ? new UpstoxProvider(config.upstoxAccessToken) : null;
  const provider =
    config.marketDataProvider === "nse"
      ? nse
      : config.marketDataProvider === "upstox"
        ? upstox
        : new FallbackProvider(nse, upstox);
  const service = new AlertService({
    config,
    provider,
    notifier: new TelegramNotifier({
      token: config.telegramBotToken,
      chatId: config.telegramChatId,
      dryRun: config.dryRun,
    }),
    store: new JsonStore(config.dataDir),
  });

  if (process.argv.includes("--scan-now")) await service.scanAndMonitor({ force: true });
  else if (process.argv.includes("--run-once")) await service.runOnce();
  else await service.runScheduler();
} catch (error) {
  console.error(error.stack ?? error.message);
  process.exitCode = 1;
}
