import type { APIRoute } from "astro";
import { getCollection } from "astro:content";

// ponytail: hand-rolled for two page types; switch to @astrojs/sitemap if pages multiply.
export const GET: APIRoute = async ({ site }) => {
  const products = await getCollection("products");
  const paths = ["/", ...products.map(({ id }) => `/watches/${id}/`)];

  const urls = paths
    .map((path) => `  <url><loc>${new URL(path, site)}</loc></url>`)
    .join("\n");

  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls}
</urlset>
`,
    { headers: { "Content-Type": "application/xml; charset=utf-8" } }
  );
};
