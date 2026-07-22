function combinedError(primaryError, fallbackError) {
    return new Error(`NSE failed: ${primaryError.message}; Upstox fallback failed: ${fallbackError.message}`);
  }
  
  export class FallbackProvider {
    constructor(primary, fallback = null) {
      this.primary = primary;
      this.fallback = fallback;
      this.active = primary;
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
          throw combinedError(primaryError, fallbackError);
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
          throw combinedError(primaryError, fallbackError);
        }
      }
    }
  }
  