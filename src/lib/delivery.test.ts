import { expect, it } from "vitest";

import { deliveryTime } from "./delivery";

it("says one to two days in words", () => {
  expect(deliveryTime(1, 2)).toBe("خلال يوم إلى يومين");
});

it("uses an Arabic-digit range for longer windows", () => {
  expect(deliveryTime(2, 4)).toBe("خلال 2–4 أيام");
});
