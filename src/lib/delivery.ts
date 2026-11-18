import { formatNumber } from "./money";

/** One Arabic phrase for a delivery window, used everywhere zones are shown. */
export const deliveryTime = (minDays: number, maxDays: number): string =>
  minDays === 1 && maxDays === 2
    ? "خلال يوم إلى يومين"
    : `خلال ${formatNumber(minDays)}–${formatNumber(maxDays)} أيام`;
