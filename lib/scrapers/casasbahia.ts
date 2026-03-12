import {
  fetchPage,
  parsePrice,
  extractJsonLDPrice,
  extractMetaPrice,
  extractItempropPrice,
  type ScrapedProduct,
} from "./index";

export async function scrapeCasasBahia(url: string): Promise<ScrapedProduct> {
  const $ = await fetchPage(url);

  // ── Title ─────────────────────────────────────────────────────────────
  const title =
    $("meta[property='og:title']").attr("content")?.trim() ||
    $("h1[itemprop='name']").text().trim() ||
    $("h1").first().text().trim() ||
    "";

  // ── Price ─────────────────────────────────────────────────────────────
  // Casas Bahia is VTEX-based — JSON-LD and itemprop are reliable
  let price: number | null =
    extractJsonLDPrice($) ||
    extractMetaPrice($) ||
    extractItempropPrice($);

  if (!price) {
    // VTEX spotPrice in embedded script
    $("script").each((_, el) => {
      if (price) return;
      const html = $(el).html() || "";
      const match = html.match(/"spotPrice"\s*:\s*([\d.]+)/);
      if (match) {
        const val = parseFloat(match[1]);
        if (!isNaN(val) && val > 0) price = val;
      }
    });
  }

  if (!price) {
    price =
      parsePrice($("[class*='BestPrice']").first().text()) ||
      parsePrice($("[class*='bestPrice']").first().text()) ||
      parsePrice($("span.sales-price").first().text());
  }

  // ── Image ─────────────────────────────────────────────────────────────
  const imageUrl =
    $("meta[property='og:image']").attr("content") ||
    $("img[itemprop='image']").attr("src") ||
    $("picture img").first().attr("src") ||
    null;

  // ── Availability ──────────────────────────────────────────────────────
  const bodyText = $("body").text().toLowerCase();
  const availability =
    bodyText.includes("produto indisponível") ||
    bodyText.includes("esgotado")
      ? "out_of_stock"
      : "in_stock";

  if (!price) throw new Error("Preço não encontrado nas Casas Bahia");
  if (!title) throw new Error("Título não encontrado nas Casas Bahia");

  return {
    title: title.substring(0, 300),
    price,
    imageUrl,
    availability,
    marketplace: "casasbahia",
  };
}
