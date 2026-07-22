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
