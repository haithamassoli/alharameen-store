// Seven-segment readouts and live data for the /4 «الشاشة» home-page exploration.
// The server renders the markup once; the page script only swaps `data-d`
// attributes, and CSS decides which segments are lit for each digit.

const TIME_ZONE = "Asia/Amman";

/** Great-circle bearing from Amman to the Kaaba, in degrees from north (≈160.7°). */
export const QIBLA_BEARING_AMMAN = 161;

const STROKE = 10;
const HALF = STROKE / 2;
const GAP = 1.5;
const LEFT = 6;
const RIGHT = 54;
const TOP = 6;
const MIDDLE = 52;
const BOTTOM = 98;

const horizontal = (y: number): string => {
  const start = LEFT + GAP;
  const end = RIGHT - GAP;

  return [
    [start, y],
    [start + HALF, y - HALF],
    [end - HALF, y - HALF],
    [end, y],
    [end - HALF, y + HALF],
    [start + HALF, y + HALF],
  ]
    .map((point) => point.join(","))
    .join(" ");
};

const vertical = (x: number, from: number, to: number): string => {
  const start = from + GAP;
  const end = to - GAP;

  return [
    [x, start],
    [x + HALF, start + HALF],
    [x + HALF, end - HALF],
    [x, end],
    [x - HALF, end - HALF],
    [x - HALF, start + HALF],
  ]
    .map((point) => point.join(","))
    .join(" ");
};

const SEGMENTS = [
  ["a", horizontal(TOP)],
  ["b", vertical(RIGHT, TOP, MIDDLE)],
  ["c", vertical(RIGHT, MIDDLE, BOTTOM)],
  ["d", horizontal(BOTTOM)],
  ["e", vertical(LEFT, MIDDLE, BOTTOM)],
  ["f", vertical(LEFT, TOP, MIDDLE)],
  ["g", horizontal(MIDDLE)],
] as const;

const digitSvg = (char: string, index: number): string => {
  const polygons = SEGMENTS.map(
    ([id, points]) => `<polygon class="seg seg--${id}" points="${points}"/>`
  ).join("");

  return `<svg class="lcd__digit" viewBox="0 0 60 104" data-d="${char.trim()}" style="--i:${index}">${polygons}</svg>`;
};

const COLON_SVG =
  '<svg class="lcd__colon" viewBox="0 0 14 104"><rect x="2" y="28" width="10" height="10"/><rect x="2" y="66" width="10" height="10"/></svg>';

const DEGREE_SVG =
  '<svg class="lcd__degree" viewBox="0 0 24 104"><rect x="4" y="4" width="16" height="16" fill="none" stroke-width="5"/></svg>';

const DIGIT_OR_BLANK = /^[\d ]$/u;

/**
 * Inline SVG for a readout such as "10:08" or "161°". Digits and spaces
 * become seven-segment cells (a space is an all-ghost cell); ":" and "°"
 * get their own glyphs. Input is page-authored, never user text.
 */
export const lcdMarkup = (value: string): string => {
  let cell = 0;
  let markup = "";

  for (const char of value) {
    if (char === ":") {
      markup += COLON_SVG;
    } else if (char === "°") {
      markup += DEGREE_SVG;
    } else if (DIGIT_OR_BLANK.test(char)) {
      markup += digitSvg(char, cell);
      cell += 1;
    } else {
      throw new Error(`lcdMarkup cannot draw "${char}"`);
    }
  }

  return markup;
};

const clockParts = new Intl.DateTimeFormat("en-US", {
  hour: "numeric",
  hourCycle: "h12",
  minute: "2-digit",
  second: "2-digit",
  timeZone: TIME_ZONE,
});

const spokenTime = new Intl.DateTimeFormat("ar-JO", {
  hour: "numeric",
  hourCycle: "h12",
  minute: "2-digit",
  timeZone: TIME_ZONE,
});

export interface AmmanTime {
  /** Hours and minutes for the segment cells, e.g. " 935" (blank leading cell). */
  digits: string;
  seconds: string;
  /** "ص" before noon, "م" after. */
  period: string;
  /** Arabic text for screen readers, e.g. "٩:٣٥ م". */
  spoken: string;
}

export const ammanTime = (date: Date): AmmanTime => {
  const parts = clockParts.formatToParts(date);

  const part = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((entry) => entry.type === type)?.value ?? "";

  return {
    digits: `${part("hour").padStart(2, " ")}${part("minute")}`,
    period: part("dayPeriod") === "AM" ? "ص" : "م",
    seconds: part("second").padStart(2, "0"),
    spoken: spokenTime.format(date),
  };
};

const hijriLatin = new Intl.DateTimeFormat(
  "ar-SA-u-ca-islamic-umalqura-nu-latn",
  { day: "numeric", timeZone: TIME_ZONE }
);

const hijriText = new Intl.DateTimeFormat(
  "ar-SA-u-ca-islamic-umalqura-nu-arab",
  {
    day: "numeric",
    month: "long",
    timeZone: TIME_ZONE,
    weekday: "long",
    year: "numeric",
  }
);

export interface HijriDate {
  /** Day of the month in Latin digits, padded to two cells. */
  day: string;
  month: string;
  /** Year with era, e.g. "١٤٤٨ هـ". */
  year: string;
  weekday: string;
  spoken: string;
}

export const hijriDate = (date: Date): HijriDate => {
  const parts = hijriText.formatToParts(date);

  const part = (type: Intl.DateTimeFormatPartTypes): string =>
    parts.find((entry) => entry.type === type)?.value ?? "";

  const era = part("era");

  return {
    day: hijriLatin.format(date).padStart(2, " "),
    month: part("month"),
    spoken: hijriText.format(date),
    weekday: part("weekday"),
    year: era ? `${part("year")} ${era}` : part("year"),
  };
};
