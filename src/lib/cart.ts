// Pure cart logic shared by the cart drawer script and its tests. No DOM here.
// Money is integer fils; prices always come from the catalog, never from storage.
import { formatNumber, formatPrice } from "./money";

export const CART_STORAGE_KEY = "alharameen-cart-v1";
export const MAX_QTY = 10;

export interface CartLine {
  id: string;
  qty: number;
}

// Shape of the catalog and delivery data the page renders as JSON for the
// cart script. The build writes it from validated content collections.
export interface CatalogItem {
  currency: string;
  id: string;
  image: string;
  model: string;
  name: string;
  price: number;
  url: string;
}

export interface ShippingZone {
  fee: number;
  id: string;
  name: string;
}

export interface CartConfig {
  whatsapp: string;
  zones: ShippingZone[];
}

interface Customer {
  address: string;
  /** Present when the order is a gift; `message` is the optional card text. */
  gift?: { message: string };
  name: string;
  notes?: string;
  phone: string;
}

export interface CartTotals {
  shipping: number;
  subtotal: number;
  total: number;
}

const DEFAULT_CURRENCY = "JOD";
const NON_DIGITS = /\D/gu;
const EASTERN_DIGITS = /[٠-٩۰-۹]/gu;

// Arabic-Indic then Persian digits: index % 10 is the digit's value.
const EASTERN_DIGIT_CHARS = "٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹";
const PHONE_SEPARATORS = /[\s\-().]/gu;

// Jordanian mobiles: 07[789] and seven digits, with or without +962 / 00962.
const JORDAN_MOBILE = /^(?:\+962|00962|962|0)?7[789]\d{7}$/u;
const LINE_BREAKS = /\s*[\r\n]+\s*/gu;

const clampQty = (qty: number): number =>
  Math.min(MAX_QTY, Math.max(0, Math.trunc(qty)));

const indexCatalog = (
  catalog: readonly CatalogItem[]
): Map<string, CatalogItem> => new Map(catalog.map((item) => [item.id, item]));

const isCartLine = (entry: unknown): entry is CartLine =>
  typeof entry === "object" &&
  entry !== null &&
  "id" in entry &&
  "qty" in entry &&
  typeof entry.id === "string" &&
  typeof entry.qty === "number";

// localStorage is untrusted: entries are checked one by one so a single bad
// entry does not empty the whole cart.
const readStoredLines = (raw: string): CartLine[] => {
  try {
    const parsed: unknown = JSON.parse(raw);

    return Array.isArray(parsed) ? parsed.filter(isCartLine) : [];
  } catch {
    return [];
  }
};

/**
 * Turns whatever is in localStorage into valid cart lines: unknown ids and
 * malformed entries are dropped, quantities become integers in 1..MAX_QTY and
 * duplicate ids are merged.
 */
export const parseCart = (
  raw: string | null,
  catalog: readonly CatalogItem[]
): CartLine[] => {
  if (raw === null || raw === "") {
    return [];
  }

  const known = indexCatalog(catalog);
  const merged = new Map<string, number>();

  for (const { id, qty } of readStoredLines(raw)) {
    if (known.has(id)) {
      merged.set(id, (merged.get(id) ?? 0) + Math.trunc(qty));
    }
  }

  const lines: CartLine[] = [];

  for (const [id, qty] of merged) {
    const clamped = clampQty(qty);

    if (clamped > 0) {
      lines.push({ id, qty: clamped });
    }
  }

  return lines;
};

/** Sets a line's quantity; 0 or less removes it, more than MAX_QTY is capped. */
export const setQty = (
  lines: readonly CartLine[],
  id: string,
  qty: number
): CartLine[] => {
  const next = clampQty(qty);

  if (next === 0) {
    return lines.filter((line) => line.id !== id);
  }

  if (!lines.some((line) => line.id === id)) {
    return [...lines, { id, qty: next }];
  }

  return lines.map((line) => (line.id === id ? { id, qty: next } : line));
};

export const addItem = (
  lines: readonly CartLine[],
  id: string,
  qty = 1
): CartLine[] =>
  setQty(lines, id, (lines.find((line) => line.id === id)?.qty ?? 0) + qty);

export const removeItem = (
  lines: readonly CartLine[],
  id: string
): CartLine[] => lines.filter((line) => line.id !== id);

export const cartCount = (lines: readonly CartLine[]): number =>
  lines.reduce((sum, line) => sum + line.qty, 0);

/** Subtotal, delivery fee and grand total in fils. No zone means no fee yet. */
export const cartTotals = (
  lines: readonly CartLine[],
  catalog: readonly CatalogItem[],
  zone?: ShippingZone
): CartTotals => {
  const known = indexCatalog(catalog);
  let subtotal = 0;

  for (const line of lines) {
    const item = known.get(line.id);

    if (item) {
      subtotal += item.price * line.qty;
    }
  }

  const shipping = lines.length > 0 && zone ? zone.fee : 0;

  return {
    shipping,
    subtotal,
    total: subtotal + shipping,
  };
};

const singleLine = (text: string): string =>
  text.replaceAll(LINE_BREAKS, " ").trim();

interface OrderMessageInput {
  catalog: readonly CatalogItem[];
  customer: Customer;
  lines: readonly CartLine[];
  zone: ShippingZone;
}

/** The Arabic order message that the customer sends us on WhatsApp. */
export const buildWhatsAppMessage = ({
  catalog,
  customer,
  lines,
  zone,
}: OrderMessageInput): string => {
  const known = indexCatalog(catalog);
  const currency = catalog[0]?.currency ?? DEFAULT_CURRENCY;
  const price = (fils: number): string => formatPrice(fils, currency);

  const items: string[] = [];
  let position = 0;

  for (const line of lines) {
    const item = known.get(line.id);

    if (item) {
      position += 1;
      const qty = formatNumber(line.qty);
      items.push(
        `${formatNumber(position)}. ${item.name} (${item.model})`,
        `   ${qty} × ${price(item.price)} = ${price(item.price * line.qty)}`
      );
    }
  }

  const totals = cartTotals(lines, catalog, zone);
  const notes = customer.notes?.trim();
  const giftMessage = customer.gift?.message.trim() ?? "";

  const giftLines =
    customer.gift === undefined
      ? []
      : [
          "",
          "هذا الطلب هدية 🎁",
          ...(giftMessage === "" ? [] : [`رسالة الإهداء: ${giftMessage}`]),
        ];

  return [
    "السلام عليكم ورحمة الله وبركاته،",
    "أرغب بطلب ما يلي من متجر ساعات الحرمين:",
    "",
    ...items,
    "",
    `المجموع الفرعي: ${price(totals.subtotal)}`,
    `التوصيل (${zone.name}): ${price(totals.shipping)}`,
    `الإجمالي: ${price(totals.total)}`,
    "",
    "بيانات التوصيل:",
    `الاسم: ${singleLine(customer.name)}`,
    `الهاتف: ${singleLine(customer.phone)}`,
    `العنوان: ${singleLine(customer.address)}`,
    ...(notes !== undefined && notes !== "" ? [`ملاحظات: ${notes}`] : []),
    ...giftLines,
    "",
    "الدفع عند الاستلام. أرجو تأكيد الطلب، وجزاكم الله خيرًا.",
  ].join("\n");
};

/** Latin digits, no spaces or dashes: "٠٧٩ ١٢٣-٤٥٦٧" becomes "0791234567". */
export const normalizePhone = (phone: string): string =>
  phone
    .replaceAll(EASTERN_DIGITS, (digit) =>
      String(EASTERN_DIGIT_CHARS.indexOf(digit) % 10)
    )
    .replaceAll(PHONE_SEPARATORS, "");

export const isJordanMobile = (phone: string): boolean =>
  JORDAN_MOBILE.test(normalizePhone(phone));

/** https://wa.me link that opens a chat with `phone` and a pre-filled message. */
export const whatsappUrl = (phone: string, message: string): string => {
  const digits = phone.replaceAll(NON_DIGITS, "");

  if (!digits) {
    throw new Error(`WhatsApp number has no digits: "${phone}"`);
  }

  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
};
