function combinedError(primaryName, primaryError, fallbackName, fallbackError) {
  return new Error(
    `${primaryName} failed: ${primaryError.message}; ${fallbackName} fallback failed: ${fallbackError.message}`,
  );
}

export class FallbackProvider {
  constructor(primary, fallback = null, { primaryName = "Primary provider", fallbackName = "Fallback provider" } = {}) {
    this.primary = primary;
    this.fallback = fallback;
    this.active = primary;
    this.primaryName = primaryName;
    this.fallbackName = fallbackName;
  }

  async getFnoEquities() {
    this.active = this.primary;
    try {
      return await this.primary.getFnoEquities();
    } catch (primaryError) {
      if (!this.fallback) throw primaryError;
      this.active = this.fallback;
      try {
        return await this.fallback.getFnoEquities();
      } catch (fallbackError) {
        throw combinedError(this.primaryName, primaryError, this.fallbackName, fallbackError);
      }
    }
  }

  async getQuotes(instruments) {
    try {
      return await this.active.getQuotes(instruments);
    } catch (primaryError) {
      if (this.active !== this.primary || !this.fallback) throw primaryError;
      this.active = this.fallback;
      try {
        return await this.fallback.getQuotes(instruments);
      } catch (fallbackError) {
        throw combinedError(this.primaryName, primaryError, this.fallbackName, fallbackError);
      }
    }
  }
}
