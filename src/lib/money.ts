// Prices are stored as integers in the currency's minor unit (e.g. fils for JOD).
export const formatPrice = (
  minorUnits: number,
  currency = "JOD",
  locale = "ar-JO"
): string => {
  if (!Number.isInteger(minorUnits)) {
    throw new TypeError(
      `Price must be an integer in minor units, got ${minorUnits}`
    );
  }

  const formatter = new Intl.NumberFormat(locale, {
    currency,
    style: "currency",
  });

  // Respects currencies with 0 or 3 minor digits (JPY, KWD), not just 2.
  const digits = formatter.resolvedOptions().maximumFractionDigits ?? 2;
  const minorPerMajor = 10 ** digits;

  // Whole amounts drop the trailing zeros: "٣١ د.أ." reads better than
  // "٣١٫٠٠٠ د.أ.", which looks like thirty-one thousand.
  if (minorUnits % minorPerMajor === 0) {
    return new Intl.NumberFormat(locale, {
      currency,
      minimumFractionDigits: 0,
      style: "currency",
    }).format(minorUnits / minorPerMajor);
  }

  return formatter.format(minorUnits / minorPerMajor);
};
