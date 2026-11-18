import { describe, expect, it } from "vitest";

import { formatPrice } from "./money";

describe("formatPrice", () => {
  it("formats SAR halalas", () => {
    expect(formatPrice(12_345, "SAR", "en-US")).toBe("SAR\u00A0123.45");
  });

  it("handles 3-digit currencies", () => {
    expect(formatPrice(1500, "KWD", "en-US")).toBe("KWD\u00A01.500");
  });

  it("rejects fractional minor units", () => {
    expect(() => formatPrice(10.5)).toThrow(TypeError);
  });
});
