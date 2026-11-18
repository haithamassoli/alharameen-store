import { describe, expect, it } from "vitest";

import {
  formatHijriDate,
  formatLcdTime,
  handAngles,
  toDegrees,
} from "./hero-time";

const at = (h: number, m: number, s: number, ms = 500): Date =>
  new Date(2026, 0, 1, h, m, s, ms);

describe("handAngles", () => {
  it("points every hand at 12 at midnight once the tick has landed", () => {
    const angles = handAngles(at(0, 0, 0));
    expect(toDegrees(angles.hour)).toBeCloseTo(0);
    expect(toDegrees(angles.minute)).toBeCloseTo(0);
    expect(toDegrees(angles.second)).toBeCloseTo(0);
  });

  it("places the hands at 3:30:15", () => {
    const angles = handAngles(at(15, 30, 15));
    // 3.5 h past 12, plus 15 s worth of hour-hand creep.
    expect(toDegrees(angles.hour)).toBeCloseTo(105.125);
    expect(toDegrees(angles.minute)).toBeCloseTo(181.5);
    expect(toDegrees(angles.second)).toBeCloseTo(90);
  });

  it("moves the second hand in a short tick, not a sweep", () => {
    const start = toDegrees(handAngles(at(9, 0, 10, 0)).second);
    const mid = toDegrees(handAngles(at(9, 0, 10, 75)).second);
    const rest = toDegrees(handAngles(at(9, 0, 10, 900)).second);
    expect(start).toBeCloseTo(54);
    expect(mid).toBeGreaterThan(start);
    expect(mid).toBeLessThan(60);
    expect(rest).toBeCloseTo(60);
  });
});

describe("Arabic labels", () => {
  it("formats the LCD time in Arabic-Indic digits without a day period", () => {
    expect(formatLcdTime(at(14, 5, 0))).toBe("٢:٠٥");
  });

  it("formats a Hijri date with Arabic-Indic digits", () => {
    expect(formatHijriDate(at(12, 0, 0))).toMatch(/^[٠-٩]+ \S/u);
  });
});
