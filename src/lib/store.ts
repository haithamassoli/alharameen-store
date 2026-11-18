// Build-time lookups shared by the layout, pages and components.
import { getCollection, getEntry } from "astro:content";
import type { CollectionEntry } from "astro:content";

/** Store name, contact details and policies from the single "main" entry. */
export const getStore = async (): Promise<CollectionEntry<"store">["data"]> => {
  const store = await getEntry("store", "main");

  if (!store) {
    throw new Error('Missing "main" entry in the store collection');
  }

  return store.data;
};

/** Delivery zones, cheapest first. */
export const getShippingZones = async (): Promise<
  CollectionEntry<"shippingZones">[]
> => {
  const zones = await getCollection("shippingZones");

  return zones.toSorted((a, b) => a.data.fee - b.data.fee);
};

/** How-to videos for a full SKU such as "HA-6506BW", if the family has any. */
export const getGuideFor = async (
  model: string
): Promise<CollectionEntry<"guides"> | undefined> => {
  const guides = await getCollection("guides");

  return guides.find(({ data }) =>
    data.models.some((base) => model.startsWith(base))
  );
};
