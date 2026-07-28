import fs from "node:fs/promises";
import path from "node:path";
import { isoInZone } from "./time.js";

function clean(value) {
  if (value instanceof Error) {
    return { name: value.name, message: value.message, stack: value.stack };
  }
  return value;
}

export class Logger {
  constructor(file, timezone = "Asia/Kolkata") {
    this.file = path.resolve(file);
    this.timezone = timezone;
  }

  async write(level, event, details = {}) {
    const record = {
      timestamp: isoInZone(new Date(), this.timezone),
      level,
      event,
      ...Object.fromEntries(Object.entries(details).map(([key, value]) => [key, clean(value)])),
    };
    const line = JSON.stringify(record);
    console.log(line);
    try {
      await fs.mkdir(path.dirname(this.file), { recursive: true });
      await fs.appendFile(this.file, `${line}\n`);
    } catch (error) {
      console.error(
        JSON.stringify({
          timestamp: isoInZone(new Date(), this.timezone),
          level: "error",
          event: "log_file_write_failed",
          message: error.message,
        }),
      );
    }
  }

  info(event, details) {
    return this.write("info", event, details);
  }

  warn(event, details) {
    return this.write("warn", event, details);
  }

  error(event, details) {
    return this.write("error", event, details);
  }
}
