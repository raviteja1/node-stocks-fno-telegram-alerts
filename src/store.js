import fs from "node:fs/promises";
import path from "node:path";

export class JsonStore {
  constructor(dataDir) {
    this.dataDir = dataDir;
    this.file = path.join(dataDir, "state.json");
    this.snapshotsDir = path.join(dataDir, "snapshots");
  }

  async load() {
    try {
      return JSON.parse(await fs.readFile(this.file, "utf8"));
    } catch (error) {
      if (error.code === "ENOENT") return null;
      throw error;
    }
  }

  async save(state) {
    await this.writeJson(this.file, state);

    if (state?.officialSnapshot === true) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(state.day ?? "")) {
        throw new Error("Official snapshot state requires a YYYY-MM-DD day");
      }
      await this.writeJson(path.join(this.snapshotsDir, `${state.day}.json`), state);
    }
  }

  async writeJson(file, value) {
    await fs.mkdir(path.dirname(file), { recursive: true });
    const temp = `${file}.tmp`;
    await fs.writeFile(temp, JSON.stringify(value, null, 2));
    await fs.rename(temp, file);
  }
}
