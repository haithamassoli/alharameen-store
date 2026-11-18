// Clock maths and Arabic labels shared by the 3D hero watch and its SVG fallback.

const TAU = Math.PI * 2;
const SECONDS_PER_MINUTE = 60;
const MINUTES_PER_HOUR = 60;
const HOURS_ON_DIAL = 12;

// Quartz tick: the second hand travels to the next mark over this many ms, then rests.
const TICK_MS = 150;

export interface HandAngles {
  /** Radians, clockwise from 12 o'clock. */
  hour: number;
  minute: number;
  second: number;
}

const easeOutCubic = (t: number): number => 1 - (1 - t) ** 3;

export const handAngles = (date: Date): HandAngles => {
  const tick = easeOutCubic(Math.min(date.getMilliseconds() / TICK_MS, 1));
  // Until the tick lands, the hand is still travelling from the previous second.
  const seconds = date.getSeconds() - 1 + tick;
  const minutes = date.getMinutes() + date.getSeconds() / SECONDS_PER_MINUTE;
  const hours = (date.getHours() % HOURS_ON_DIAL) + minutes / MINUTES_PER_HOUR;

  return {
    hour: (hours / HOURS_ON_DIAL) * TAU,
    minute: (minutes / MINUTES_PER_HOUR) * TAU,
    second: (seconds / SECONDS_PER_MINUTE) * TAU,
  };
};

const timeFormat = new Intl.DateTimeFormat("ar-JO", {
  hour: "numeric",
  hourCycle: "h12",
  minute: "2-digit",
});

const hijriFormat = new Intl.DateTimeFormat(
  "ar-SA-u-ca-islamic-umalqura-nu-arab",
  { day: "numeric", month: "long" }
);

/** "٢:٣٠" in Arabic-Indic digits, 12-hour, without the AM/PM marker. */
export const formatLcdTime = (date: Date): string =>
  timeFormat
    .formatToParts(date)
    .filter((part) => part.type === "hour" || part.type === "minute")
    .map((part) => part.value)
    .join(":");

/** Hijri (Umm al-Qura) day and month, e.g. "٨ جمادى الآخرة". */
export const formatHijriDate = (date: Date): string => hijriFormat.format(date);

const RAD_TO_DEG = 180 / Math.PI;

export const toDegrees = (radians: number): number => radians * RAD_TO_DEG;
