const digits = new Intl.NumberFormat("ar-JO");

/** One Arabic phrase for a delivery window, used everywhere zones are shown. */
export const deliveryTime = (minDays: number, maxDays: number): string =>
  minDays === 1 && maxDays === 2
    ? "خلال يوم إلى يومين"
    : `خلال ${digits.format(minDays)}–${digits.format(maxDays)} أيام`;
