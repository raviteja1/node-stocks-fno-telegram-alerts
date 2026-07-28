const PARTS = ["year", "month", "day", "hour", "minute", "second"];

export function zonedParts(date, timezone) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  const values = Object.fromEntries(
    formatter.formatToParts(date).filter((part) => PARTS.includes(part.type)).map((part) => [part.type, part.value]),
  );
  return values;
}

export function dateKey(date, timezone) {
  const p = zonedParts(date, timezone);
  return `${p.year}-${p.month}-${p.day}`;
}

export function clockValue(date, timezone) {
  const p = zonedParts(date, timezone);
  return `${p.hour}:${p.minute}:${p.second}`;
}

export function zoneOffsetMinutes(date, timezone) {
  const p = zonedParts(date, timezone);
  const asZoneWallClock = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  const actualUtc = date.getTime() - date.getMilliseconds();
  return Math.round((asZoneWallClock - actualUtc) / 60_000);
}

// Machine-parseable ISO-8601 string carrying the zone offset (e.g. 2026-07-28T10:05:52.123+05:30).
export function isoInZone(date = new Date(), timezone = "Asia/Kolkata") {
  const p = zonedParts(date, timezone);
  const ms = String(date.getMilliseconds()).padStart(3, "0");
  const offset = zoneOffsetMinutes(date, timezone);
  const sign = offset >= 0 ? "+" : "-";
  const abs = Math.abs(offset);
  const hh = String(Math.floor(abs / 60)).padStart(2, "0");
  const mm = String(abs % 60).padStart(2, "0");
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}:${p.second}.${ms}${sign}${hh}:${mm}`;
}

// Human-friendly date-time in the target zone (e.g. 28 Jul 2026, 10:05:52 am).
export function readableInZone(value = new Date(), timezone = "Asia/Kolkata") {
  const parsed = value instanceof Date ? value : new Date(value);
  const date = Number.isNaN(parsed.getTime()) ? new Date() : parsed;
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: timezone,
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  }).format(date);
}

export function weekday(date, timezone) {
  return new Intl.DateTimeFormat("en-US", { timeZone: timezone, weekday: "short" }).format(date);
}

export function isWeekday(date, timezone) {
  return !["Sat", "Sun"].includes(weekday(date, timezone));
}

export function msUntilClock(target, timezone, now = new Date()) {
  const [targetHour, targetMinute, targetSecond] = target.split(":").map(Number);
  for (let seconds = 0; seconds <= 26 * 60 * 60; seconds += 1) {
    const candidate = new Date(now.getTime() + seconds * 1_000);
    const p = zonedParts(candidate, timezone);
    if (+p.hour === targetHour && +p.minute === targetMinute && +p.second === targetSecond) {
      return candidate.getTime() - now.getTime();
    }
  }
  throw new Error(`Could not schedule ${target} in ${timezone}`);
}

export function scheduledRunDelay(snapshotTime, marketCloseTime, timezone, now = new Date()) {
  const current = clockValue(now, timezone);
  if (current >= marketCloseTime) return null;
  if (current >= snapshotTime) return 0;
  return msUntilClock(snapshotTime, timezone, now);
}
