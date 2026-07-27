function combinedError(primaryName, primaryError, fallbackName, fallbackError) {
  return new Error(
    `${primaryName} failed: ${primaryError.message}; ${fallbackName} fallback failed: ${fallbackError.message}`,
  );
}

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export class FallbackProvider {
  constructor(
    primary,
    fallback = null,
    {
      primaryName = 'Primary provider',
      fallbackName = 'Fallback provider',
      primaryAttempts = 1,
      retryDelayMs = 0,
    } = {},
  ) {
    this.primary = primary;
    this.fallback = fallback;
    this.active = primary;
    this.primaryName = primaryName;
    this.fallbackName = fallbackName;
    this.primaryAttempts = primaryAttempts;
    this.retryDelayMs = retryDelayMs;
  }

  get source() {
    return this.active === this.primary ? this.primaryName : this.fallbackName;
  }

  async tryPrimary(method, ...args) {
    let lastError;
    for (let attempt = 1; attempt <= this.primaryAttempts; attempt += 1) {
      try {
        const result = await this.primary[method](...args);
        this.active = this.primary;
        return result;
      } catch (error) {
        lastError = error;
        if (attempt < this.primaryAttempts && this.retryDelayMs > 0) {
          await sleep(this.retryDelayMs);
        }
      }
    }
    throw lastError;
  }

  async useFallback(method, primaryError, ...args) {
    if (!this.fallback) throw primaryError;
    try {
      const result = await this.fallback[method](...args);
      this.active = this.fallback;
      return result;
    } catch (fallbackError) {
      throw combinedError(
        this.primaryName,
        primaryError,
        this.fallbackName,
        fallbackError,
      );
    }
  }

  async getFnoEquities() {
    try {
      return await this.tryPrimary('getFnoEquities');
    } catch (primaryError) {
      return this.useFallback('getFnoEquities', primaryError);
    }
  }

  async getQuotes(instruments) {
    try {
      return await this.tryPrimary('getQuotes', instruments);
    } catch (primaryError) {
      return this.useFallback('getQuotes', primaryError, instruments);
    }
  }
}
