// Everything a home-page design needs, loaded once so the /1…/7 style
// explorations show the same catalog, copy and contact details as "/".
import { getCollection } from "astro:content";
import type { CollectionEntry } from "astro:content";

import { whatsappUrl } from "./cart";
import { getShippingZones, getStore } from "./store";

export interface HomeData {
  store: CollectionEntry<"store">["data"];
  /** Category order, then featured, then cheapest first (same as "/"). */
  products: CollectionEntry<"products">[];
  categoryName: (product: CollectionEntry<"products">) => string;
  /** Cheapest first. */
  zones: CollectionEntry<"shippingZones">[];
  /** "سنة كاملة", "سنتين" or "N سنوات". */
  warranty: string;
  /** wa.me link with a greeting pre-filled. */
  chatUrl: string;
  /** Arabic-Indic digits for counts and step numbers. */
  digits: Intl.NumberFormat;
  features: readonly { icon: string; text: string; title: string }[];
  steps: readonly { text: string; title: string }[];
}

const WARRANTY_WORDS = new Map([
  [1, "سنة كاملة"],
  [2, "سنتين"],
]);

export const getHomeData = async (): Promise<HomeData> => {
  const store = await getStore();
  const categories = await getCollection("categories");

  const categoryById = new Map(
    categories.map((entry) => [entry.id, entry.data])
  );

  const categoryOrder = (id: string): number =>
    categoryById.get(id)?.order ?? 0;

  const allProducts = await getCollection("products");

  const products = allProducts.toSorted(
    (a, b) =>
      categoryOrder(a.data.category.id) - categoryOrder(b.data.category.id) ||
      Number(b.data.featured) - Number(a.data.featured) ||
      a.data.price - b.data.price
  );

  const digits = new Intl.NumberFormat("ar-JO");
  const { contact, returnDays, warrantyYears } = store;

  const warranty =
    WARRANTY_WORDS.get(warrantyYears) ??
    `${digits.format(warrantyYears)} سنوات`;

  return {
    categoryName: (product) =>
      categoryById.get(product.data.category.id)?.name ?? "",
    chatUrl: whatsappUrl(
      contact.whatsapp,
      "السلام عليكم، أرغب بالاستفسار عن ساعات الحرمين."
    ),
    digits,
    features: [
      {
        icon: "azan",
        text: "مواقيت دقيقة لمعظم مدن العالم، ومنبّه لكل صلاة يتغير تلقائيًا مع وقت الأذان.",
        title: "أوقات الأذان لكل مدن العالم",
      },
      {
        icon: "qibla",
        text: "بوصلة إلكترونية تدلّك على القبلة أينما كنت، بضغطة زر واحدة.",
        title: "اتجاه القبلة",
      },
      {
        icon: "calendar",
        text: "التاريخ الهجري والميلادي وأيام الأسبوع معًا على شاشة واحدة.",
        title: "تقويم هجري",
      },
      {
        icon: "shield",
        text: `ضمان ${warranty} على كل ساعة، وإرجاع خلال ${digits.format(returnDays)} يومًا.`,
        title: "ضمان",
      },
      {
        icon: "truck",
        text: "نوصل لجميع محافظات الأردن، وتدفع نقدًا عند الاستلام.",
        title: "توصيل لكل المملكة",
      },
    ],
    products,
    steps: [
      { text: "تصفّح التشكيلة واختر الساعة التي تناسبك.", title: "اختر ساعتك" },
      {
        text: "أضف ما تريد إلى السلة واختر منطقة التوصيل.",
        title: "أضفها للسلة",
      },
      {
        text: "نجهّز لك رسالة الطلب، أرسلها ونؤكد معك موعد التوصيل.",
        title: "أرسل الطلب عبر واتساب",
      },
    ],
    store,
    warranty,
    zones: await getShippingZones(),
  };
};
