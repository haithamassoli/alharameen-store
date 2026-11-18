import { file } from "astro/loaders";
import { z } from "astro/zod";
import { defineCollection, reference } from "astro:content";

// Money is integer fils (1 JOD = 1000 fils). Display-only; checkout must re-price server-side.
const fils = z.number().int().nonnegative();
const currency = z.literal("JOD");

const categories = defineCollection({
  loader: file("src/content/categories.json"),
  schema: z.object({
    name: z.string(),
    order: z.number().int(),
  }),
});

const products = defineCollection({
  loader: file("src/content/products.json"),
  schema: ({ image }) =>
    z
      .object({
        category: reference("categories"),
        compareAtPrice: fils.optional(),
        currency,
        description: z.string(),
        featured: z.boolean(),
        features: z.array(z.string()).min(1),
        images: z.array(z.object({ alt: z.string(), src: image() })).min(1),
        // Full SKU, e.g. "HA-6506BW" or "HA-1013".
        model: z.string().regex(/^HA-\d{4}[A-Z]*$/u),
        name: z.string(),
        price: fils.positive(),
        // Where the specs and photos came from, for re-checking before launch.
        sources: z.array(z.url()),
        // Arabic label → value, rendered as-is in a spec table.
        specs: z.record(z.string(), z.string()),
        variants: z
          .array(
            z.object({
              color: z.string().optional(),
              sku: z.string(),
              stock: z.number().int().nonnegative(),
            })
          )
          .min(1),
      })
      .refine(
        (p) => p.compareAtPrice === undefined || p.compareAtPrice > p.price,
        { message: "compareAtPrice must be higher than price" }
      ),
});

const shippingZones = defineCollection({
  loader: file("src/content/shipping-zones.json"),
  schema: z
    .object({
      currency,
      fee: fils,
      maxDays: z.number().int().positive(),
      minDays: z.number().int().positive(),
      name: z.string(),
    })
    .refine((zone) => zone.minDays <= zone.maxDays, {
      message: "minDays > maxDays",
    }),
});

// Official Al-Harameen how-to videos (YouTube, Arabic), one entry per watch
// family. Source: https://www.al-harameen.com/data/support-index.json
const guides = defineCollection({
  loader: file("src/content/guides.json"),
  schema: z.object({
    // Base models without the colour suffix, matched by prefix: "HA-6506".
    models: z.array(z.string().regex(/^HA-\d{4}$/u)).min(1),
    name: z.string(),
    order: z.number().int(),
    videos: z
      .array(
        z.object({
          title: z.string(),
          youtubeId: z.string().regex(/^[\w-]{11}$/u),
        })
      )
      .min(1),
  }),
});

const store = defineCollection({
  loader: file("src/content/store.json"),
  schema: z.object({
    // One wrap and printed card per order, added on top of delivery.
    giftWrap: z.object({ currency, fee: fils.positive() }),
    contact: z.object({
      address: z.string(),
      facebook: z.url(),
      instagram: z.url(),
      phone: z.string(),
      // E.164 with leading "+"; strip it for https://wa.me/<digits> links.
      whatsapp: z.string().regex(/^\+\d{8,15}$/u),
    }),
    name: z.string(),
    returnDays: z.number().int().nonnegative(),
    tagline: z.string(),
    warrantyYears: z.number().int().nonnegative(),
  }),
});

export const collections = {
  categories,
  guides,
  products,
  shippingZones,
  store,
};
