// Prices are stored as integers in the currency's minor unit (e.g. fils for JOD).

// Respects currencies with 0 or 3 minor digits (JPY, KWD), not just 2.
const minorDigits = (currency: string): number =>
  new Intl.NumberFormat("en", { currency, style: "currency" }).resolvedOptions()
    .maximumFractionDigits ?? 2;

export const formatPrice = (
  minorUnits: number,
  currency = "JOD",
  locale = "ar-JO-u-nu-latn"
): string => {
  if (!Number.isInteger(minorUnits)) {
    throw new TypeError(
      `Price must be an integer in minor units, got ${minorUnits}`
    );
  }

  const minorPerMajor = 10 ** minorDigits(currency);

  // Whole amounts drop the trailing zeros: "31 د.أ." reads better than
  // "31.000 د.أ.", which looks like thirty-one thousand.
  const isWhole = minorUnits % minorPerMajor === 0;

  return new Intl.NumberFormat(locale, {
    currency,
    style: "currency",
    ...(isWhole && { minimumFractionDigits: 0 }),
  }).format(minorUnits / minorPerMajor);
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

  const digits = minorDigits(currency);

  if (digits === 0) {
    return String(minorUnits);
  }

  const padded = String(minorUnits).padStart(digits + 1, "0");

  return `${padded.slice(0, -digits)}.${padded.slice(-digits)}`;
};
