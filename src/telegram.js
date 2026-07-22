export class TelegramNotifier {
    constructor({ token, chatId, dryRun = false, logger = console }) {
      this.token = token;
      this.chatId = chatId;
      this.dryRun = dryRun;
      this.logger = logger;
    }
  
    async send(text) {
      if (this.dryRun) {
        this.logger.log(`\n[DRY RUN TELEGRAM]\n${text.replaceAll(/<[^>]+>/g, "")}\n`);
        return;
      }
      const response = await fetch(`https://api.telegram.org/bot${this.token}/sendMessage`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ chat_id: this.chatId, text, parse_mode: "HTML", disable_web_page_preview: true }),
        signal: AbortSignal.timeout(15_000),
      });
      if (!response.ok) throw new Error(`Telegram request failed (${response.status}): ${(await response.text()).slice(0, 300)}`);
    }
  }
  