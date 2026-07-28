export const marketSettings = Object.freeze({
  topCount: 10,
  pollIntervalMs: 5_000,
  snapshotTime: "09:30:01",
  marketCloseTime: "15:30:00",
  timezone: "Asia/Kolkata",
});

export const marketDataSettings = Object.freeze({
  upstoxRetryAttempts: 3,
  upstoxRetryDelayMs: 1_000,
});

export const loggingSettings = Object.freeze({
  file: "./logs/app.log",
});
