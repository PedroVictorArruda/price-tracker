import {
  fetchPage,
  parsePrice,
  extractJsonLDPrice,
  extractMetaPrice,
  type ScrapedProduct,
} from "./index";

export async function scrapeMagalu(url: string): Promise<ScrapedProduct> {
  const $ = await fetchPage(url);

  // ── Title ─────────────────────────────────────────────────────────────
  const title =
    $("h1[data-testid='heading-product-title']").text().trim() ||
    $("meta[property='og:title']").attr("content")?.trim() ||
    $("h1").first().text().trim() ||
    "";

  // ── Price ─────────────────────────────────────────────────────────────
  let price: number | null =
    extractJsonLDPrice($) ||
    extractMetaPrice($);

  if (!price) {
    // Magalu is Next.js — try __NEXT_DATA__ embedded JSON
    const nextDataEl = $("#__NEXT_DATA__").html();
    if (nextDataEl) {
      try {
        const nd = JSON.parse(nextDataEl);
        const paths = [
          nd?.props?.pageProps?.data?.product?.price,
          nd?.props?.pageProps?.data?.product?.offers?.price,
          nd?.props?.pageProps?.product?.price,
        ];
        for (const val of paths) {
          if (val !== undefined && val !== null) {
            const p = parseFloat(String(val));
            if (!isNaN(p) && p > 0) { price = p; break; }
          }
        }
      } catch {}
    }
  }

  if (!price) {
    price =
      parsePrice($("[data-testid='price-value']").first().text()) ||
      parsePrice($("[class*='price-value']").first().text()) ||
      parsePrice($("[class*='Price']").first().text());
  }

  // ── Image ─────────────────────────────────────────────────────────────
  const imageUrl =
    $("meta[property='og:image']").attr("content") ||
    $("img[data-testid='image-selected-thumbnail']").attr("src") ||
    $("picture img").first().attr("src") ||
    null;

  // ── Availability ──────────────────────────────────────────────────────
  const bodyText = $("body").text().toLowerCase();
  const availability =
    bodyText.includes("produto indisponível") ||
    bodyText.includes("este produto não está disponível") ||
    bodyText.includes("esgotado")
      ? "out_of_stock"
      : "in_stock";

  if (!price) throw new Error("Preço não encontrado no Magazine Luiza");
  if (!title) throw new Error("Título não encontrado no Magazine Luiza");

  return {
    title: title.substring(0, 300),
    price,
    imageUrl,
    availability,
    marketplace: "magalu",
  };
}
