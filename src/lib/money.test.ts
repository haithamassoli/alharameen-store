import { describe, expect, it } from "vitest";

import { formatPrice, toDecimalString } from "./money";

describe("formatPrice", () => {
  it("formats SAR halalas", () => {
    expect(formatPrice(12_345, "SAR", "en-US")).toBe("SAR\u00A0123.45");
  });

  it("handles 3-digit currencies", () => {
    expect(formatPrice(1500, "KWD", "en-US")).toBe("KWD\u00A01.500");
  });

  it("drops the fraction for whole amounts", () => {
    expect(formatPrice(31_000, "JOD", "en-US")).toBe("JOD\u00A031");
    expect(formatPrice(12_300, "SAR", "en-US")).toBe("SAR\u00A0123");
  });

  it("defaults to Jordanian dinars", () => {
    expect(formatPrice(25_500)).toBe(formatPrice(25_500, "JOD", "ar-JO"));
    expect(formatPrice(25_500, "JOD", "en-US")).toBe("JOD\u00A025.500");
  });

  it("rejects fractional minor units", () => {
    expect(() => formatPrice(10.5)).toThrow(TypeError);
  });
});

describe("toDecimalString", () => {
  it("keeps every minor digit", () => {
    expect(toDecimalString(26_000)).toBe("26.000");
    expect(toDecimalString(25_500, "JOD")).toBe("25.500");
    expect(toDecimalString(5, "JOD")).toBe("0.005");
    expect(toDecimalString(12_345, "SAR")).toBe("123.45");
    expect(toDecimalString(500, "JPY")).toBe("500");
  });

  it("rejects fractional or negative minor units", () => {
    expect(() => toDecimalString(10.5)).toThrow(TypeError);
    expect(() => toDecimalString(-1)).toThrow(TypeError);
  });
});
