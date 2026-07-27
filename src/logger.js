import fs from "node:fs/promises";
import path from "node:path";

function clean(value) {
  if (value instanceof Error) {
    return { name: value.name, message: value.message, stack: value.stack };
  }
  return value;
}

export class Logger {
  constructor(file) {
    this.file = path.resolve(file);
  }

  async write(level, event, details = {}) {
    const record = {
      timestamp: new Date().toISOString(),
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
          timestamp: new Date().toISOString(),
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
