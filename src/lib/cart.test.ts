import { describe, expect, it } from "vitest";

import {
  addItem,
  buildWhatsAppMessage,
  cartCount,
  cartTotals,
  isJordanMobile,
  MAX_QTY,
  normalizePhone,
  parseCart,
  removeItem,
  setQty,
  whatsappUrl,
} from "./cart";
import type { CatalogItem, ShippingZone } from "./cart";
import { formatPrice } from "./money";

const catalog: CatalogItem[] = [
  {
    currency: "JOD",
    id: "ha-6506bw",
    image: "/_astro/a.webp",
    model: "HA-6506BW",
    name: "ساعة الحرمين الرياضية باللون الأسود",
    price: 26_000,
    url: "/watches/ha-6506bw/",
  },
  {
    currency: "JOD",
    id: "ha-1013",
    image: "/_astro/b.webp",
    model: "HA-1013",
    name: "جهاز أذكار الباب من الحرمين",
    price: 7000,
    url: "/watches/ha-1013/",
  },
];

const amman: ShippingZone = { fee: 3000, id: "amman", name: "داخل عمّان" };

const outside: ShippingZone = {
  fee: 5000,
  id: "outside-amman",
  name: "خارج عمّان",
};

const customer = {
  address: "عمّان، خلدا\nشارع وصفي التل",
  name: "  أحمد  ",
  phone: "0791234567",
};

describe("parseCart", () => {
  it("returns an empty cart for missing or broken storage", () => {
    expect(parseCart(null, catalog)).toEqual([]);
    expect(parseCart("", catalog)).toEqual([]);
    expect(parseCart("{not json", catalog)).toEqual([]);
    expect(parseCart('{"id":"ha-1013","qty":1}', catalog)).toEqual([]);
  });

  it("drops unknown ids and malformed entries but keeps the rest", () => {
    const raw = JSON.stringify([
      { id: "ha-9999", qty: 1 },
      { id: "ha-1013", qty: "2" },
      null,
      "ha-1013",
      { id: 42, qty: 1 },
      { id: "ha-6506bw", qty: 2, price: 1 },
    ]);

    expect(parseCart(raw, catalog)).toEqual([{ id: "ha-6506bw", qty: 2 }]);
  });

  it("truncates, clamps and merges quantities", () => {
    const raw = JSON.stringify([
      { id: "ha-1013", qty: 1.9 },
      { id: "ha-6506bw", qty: 0 },
      { id: "ha-1013", qty: 2 },
      { id: "ha-6506bw", qty: -3 },
    ]);

    expect(parseCart(raw, catalog)).toEqual([{ id: "ha-1013", qty: 3 }]);
    expect(
      parseCart(JSON.stringify([{ id: "ha-1013", qty: 999 }]), catalog)
    ).toEqual([{ id: "ha-1013", qty: MAX_QTY }]);
  });
});

describe("cart updates", () => {
  it("adds, increments, caps, sets and removes lines", () => {
    let lines = addItem([], "ha-1013");
    lines = addItem(lines, "ha-1013", 2);
    lines = addItem(lines, "ha-6506bw");
    expect(lines).toEqual([
      { id: "ha-1013", qty: 3 },
      { id: "ha-6506bw", qty: 1 },
    ]);
    expect(addItem(lines, "ha-1013", 50)[0]?.qty).toBe(MAX_QTY);
    expect(setQty(lines, "ha-6506bw", 4)[1]?.qty).toBe(4);
    expect(setQty(lines, "ha-6506bw", 0)).toEqual([{ id: "ha-1013", qty: 3 }]);
    expect(removeItem(lines, "ha-1013")).toEqual([{ id: "ha-6506bw", qty: 1 }]);
    expect(cartCount(lines)).toBe(4);
  });

  it("does not mutate the input", () => {
    const lines = [{ id: "ha-1013", qty: 1 }];
    addItem(lines, "ha-1013");
    expect(lines).toEqual([{ id: "ha-1013", qty: 1 }]);
  });
});

describe("cartTotals", () => {
  const lines = [
    { id: "ha-6506bw", qty: 2 },
    { id: "ha-1013", qty: 1 },
  ];

  it("adds the Amman delivery fee", () => {
    expect(cartTotals(lines, catalog, amman)).toEqual({
      shipping: 3000,
      subtotal: 59_000,
      total: 62_000,
    });
  });

  it("adds the outside-Amman delivery fee", () => {
    expect(cartTotals(lines, catalog, outside).total).toBe(64_000);
  });

  it("charges no delivery before a zone is chosen or for an empty cart", () => {
    expect(cartTotals(lines, catalog).total).toBe(59_000);
    expect(cartTotals([], catalog, amman)).toEqual({
      shipping: 0,
      subtotal: 0,
      total: 0,
    });
  });
});

const giftOrder = (cardText: string): string =>
  buildWhatsAppMessage({
    catalog,
    customer: { ...customer, gift: { message: cardText } },
    lines: [{ id: "ha-1013", qty: 1 }],
    zone: amman,
  });

describe("buildWhatsAppMessage", () => {
  const message = buildWhatsAppMessage({
    catalog,
    customer: { ...customer, notes: "الرجاء الاتصال قبل التوصيل" },
    lines: [
      { id: "ha-6506bw", qty: 2 },
      { id: "ha-1013", qty: 1 },
    ],
    zone: outside,
  });

  it("lists each item with model, quantity and line total", () => {
    expect(message).toContain(
      "1. ساعة الحرمين الرياضية باللون الأسود (HA-6506BW)"
    );
    expect(message).toContain(
      `2 × ${formatPrice(26_000)} = ${formatPrice(52_000)}`
    );
    expect(message).toContain("2. جهاز أذكار الباب من الحرمين (HA-1013)");
  });

  it("includes subtotal, delivery zone and grand total", () => {
    expect(message).toContain(`المجموع الفرعي: ${formatPrice(59_000)}`);
    expect(message).toContain(`التوصيل (خارج عمّان): ${formatPrice(5000)}`);
    expect(message).toContain(`الإجمالي: ${formatPrice(64_000)}`);
  });

  it("includes tidy customer details and notes", () => {
    expect(message).toContain("الاسم: أحمد\n");
    expect(message).toContain("الهاتف: 0791234567");
    expect(message).toContain("العنوان: عمّان، خلدا شارع وصفي التل");
    expect(message).toContain("ملاحظات: الرجاء الاتصال قبل التوصيل");
    expect(message.startsWith("السلام عليكم")).toBe(true);
  });

  it("omits empty notes", () => {
    const withoutNotes = buildWhatsAppMessage({
      catalog,
      customer: { ...customer, notes: "   " },
      lines: [{ id: "ha-1013", qty: 1 }],
      zone: amman,
    });

    expect(withoutNotes).not.toContain("ملاحظات");
    expect(withoutNotes).not.toContain("هدية");
    expect(withoutNotes).toContain(`الإجمالي: ${formatPrice(10_000)}`);
  });

  it("marks gift orders and adds the card message when given", () => {
    expect(giftOrder(" كل عام وأنت بخير ")).toContain(
      "هذا الطلب هدية 🎁\nرسالة الإهداء: كل عام وأنت بخير"
    );
    expect(giftOrder("  ")).toContain("هذا الطلب هدية");
    expect(giftOrder("  ")).not.toContain("رسالة الإهداء");
  });
});

describe("whatsappUrl", () => {
  it("strips non-digits from the number and encodes the text", () => {
    expect(whatsappUrl("+962 77 619 3666", "طلب #1 & شكرًا\nمرحبا")).toBe(
      `https://wa.me/962776193666?text=${encodeURIComponent("طلب #1 & شكرًا\nمرحبا")}`
    );
    expect(whatsappUrl("+962776193666", "a b&c")).toBe(
      "https://wa.me/962776193666?text=a%20b%26c"
    );
  });

  it("rejects a number without digits", () => {
    expect(() => whatsappUrl("+", "hi")).toThrow(Error);
  });
});

describe("phone numbers", () => {
  it("normalizes Arabic digits and separators", () => {
    expect(normalizePhone("٠٧٩ ١٢٣-٤٥٦٧")).toBe("0791234567");
    expect(normalizePhone("۰۷۹۱۲۳۴۵۶۷")).toBe("0791234567");
    expect(normalizePhone("(+962) 79 123 4567")).toBe("+962791234567");
  });

  it("accepts Jordanian mobiles only", () => {
    expect(isJordanMobile("0791234567")).toBe(true);
    expect(isJordanMobile("+962 77 123 4567")).toBe(true);
    expect(isJordanMobile("٠٧٨١٢٣٤٥٦٧")).toBe(true);
    expect(isJordanMobile("abcdefghijk")).toBe(false);
    expect(isJordanMobile("0761234567")).toBe(false);
    expect(isJordanMobile("079123456")).toBe(false);
  });
});
