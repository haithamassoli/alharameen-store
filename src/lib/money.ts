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

// Machine-readable amount for structured data ("26.000"), built from the
// integer string so no float ever touches the price.
export const toDecimalString = (
  minorUnits: number,
  currency = "JOD"
): string => {
  if (!Number.isInteger(minorUnits) || minorUnits < 0) {
    throw new TypeError(
      `Price must be a non-negative integer in minor units, got ${minorUnits}`
    );
  }

  const digits =
    new Intl.NumberFormat("en", {
      currency,
      style: "currency",
    }).resolvedOptions().maximumFractionDigits ?? 2;

  if (digits === 0) {
    return String(minorUnits);
  }

  const padded = String(minorUnits).padStart(digits + 1, "0");

  return `${padded.slice(0, -digits)}.${padded.slice(-digits)}`;
};
