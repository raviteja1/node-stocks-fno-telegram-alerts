import fs from "node:fs/promises";
import path from "node:path";

export class JsonStore {
  constructor(dataDir) {
    this.file = path.join(dataDir, "state.json");
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
    await fs.mkdir(path.dirname(this.file), { recursive: true });
    const temp = `${this.file}.tmp`;
    await fs.writeFile(temp, JSON.stringify(state, null, 2));
    await fs.rename(temp, this.file);
  }
}
