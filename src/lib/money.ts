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

  return formatter.format(minorUnits / 10 ** digits);
};
