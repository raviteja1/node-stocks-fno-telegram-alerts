import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { Logger } from "../src/logger.js";

test("writes structured JSON log records", async () => {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), "stock-alert-log-"));
  const file = path.join(directory, "app.log");
  try {
    const logger = new Logger(file);
    await logger.info("watchlist_created", { count: 20 });
    const record = JSON.parse((await fs.readFile(file, "utf8")).trim());
    assert.equal(record.level, "info");
    assert.equal(record.event, "watchlist_created");
    assert.equal(record.count, 20);
  } finally {
    await fs.rm(directory, { recursive: true });
  }
});
