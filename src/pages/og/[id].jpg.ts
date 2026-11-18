// 1200×630 share card per product, drawn at build in the style of
// public/og-image.jpg: white ground, photo on the left, wordmark and text on
// the right. sharp's text renderer (Pango + HarfBuzz) shapes the Arabic.
import path from "node:path";

import type { APIRoute, GetStaticPaths } from "astro";
import { z } from "astro/zod";
import { getCollection, getEntry } from "astro:content";
import sharp from "sharp";

const WIDTH = 1200;
const HEIGHT = 630;
const EDGE = 72;
const RIGHT = WIDTH - EDGE;
const PHOTO_BOX = 460;
const PHOTO_CENTER_X = 316;
const TEXT_WIDTH = 540;
const LOGO_SIZE = 48;
const LOGO_GAP = 14;
const BLOCK_GAP = 22;

const INK = "#19251f";
const MUTED = "#56625b";

// Read from the source tree: this endpoint only runs during `astro build`.
const asset = (file: string): string =>
  path.join(process.cwd(), "src/assets", file);

const FONTS = {
  bold: asset("fonts/thmanyahsans-Bold.woff2"),
  medium: asset("fonts/thmanyahsans-Medium.woff2"),
};

const escapeMarkup = (value: string): string =>
  value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");

interface Line {
  color: string;
  /** Thmanyah's stylistic alternates, as on the site's headings. */
  heading?: boolean;
  size: number;
  text: string;
  weight: keyof typeof FONTS;
}

const renderText = async ({
  color,
  heading = false,
  size,
  text,
  weight,
}: Line) =>
  await sharp({
    text: {
      // Pango mirrors alignment for right-to-left paragraphs: "left" here
      // lines wrapped rows up on the right edge.
      align: "left",
      font: `Thmanyah Sans ${weight === "bold" ? "Bold" : "Medium"} ${size}`,
      fontfile: FONTS[weight],
      rgba: true,
      spacing: Math.round(size * 0.15),
      text: `<span${heading ? ' font_features="salt=1"' : ""} foreground="${color}">${escapeMarkup(text)}</span>`,
      width: TEXT_WIDTH,
      wrap: "word",
    },
  })
    .png()
    .toBuffer({ resolveWithObject: true });

// Astro keeps the source path of a content image on a hidden `fsPath`; the
// parse fails the build loudly if that ever changes.
const sourceImage = z.object({ fsPath: z.string() });

export const getStaticPaths = (async () => {
  const products = await getCollection("products");

  return products.map((product) => ({
    params: { id: product.id },
    props: { product },
  }));
}) satisfies GetStaticPaths;

export const GET: APIRoute<
  Awaited<ReturnType<typeof getStaticPaths>>[number]["props"]
> = async ({ props: { product } }) => {
  const { data } = product;
  const category = await getEntry(data.category);
  const [cover] = data.images;

  const photo = await sharp(sourceImage.parse(cover.src).fsPath)
    .trim()
    .resize(PHOTO_BOX, PHOTO_BOX, { fit: "inside" })
    .toBuffer({ resolveWithObject: true });

  const logo = await sharp(asset("logo.svg"))
    .resize(LOGO_SIZE, LOGO_SIZE)
    .toBuffer();

  const lines: Line[] = [
    { color: INK, size: 32, text: "ساعات الحرمين", weight: "bold" },
    { color: MUTED, size: 26, text: category.data.name, weight: "medium" },
    { color: INK, heading: true, size: 54, text: data.name, weight: "bold" },
    { color: MUTED, size: 24, text: data.model, weight: "medium" },
  ];

  const [wordmark, ...block] = await Promise.all(lines.map(renderText));

  const blockHeight =
    block.reduce((sum, { info }) => sum + info.height, 0) +
    BLOCK_GAP * (block.length - 1);

  let top = Math.round((HEIGHT - blockHeight) / 2);

  const text = block.map(({ data: input, info }) => {
    const layer = { input, left: RIGHT - info.width, top };
    top += info.height + BLOCK_GAP;

    return layer;
  });

  const card = await sharp({
    create: {
      background: "#ffffff",
      channels: 3,
      height: HEIGHT,
      width: WIDTH,
    },
  })
    .composite([
      {
        input: photo.data,
        left: Math.round(PHOTO_CENTER_X - photo.info.width / 2),
        top: Math.round((HEIGHT - photo.info.height) / 2),
      },
      { input: logo, left: RIGHT - LOGO_SIZE, top: EDGE - 8 },
      {
        input: wordmark.data,
        left: RIGHT - LOGO_SIZE - LOGO_GAP - wordmark.info.width,
        top: Math.round(EDGE - 8 + (LOGO_SIZE - wordmark.info.height) / 2),
      },
      ...text,
    ])
    .jpeg({ mozjpeg: true, quality: 85 })
    .toBuffer();

  return new Response(new Uint8Array(card), {
    headers: { "Content-Type": "image/jpeg" },
  });
};
