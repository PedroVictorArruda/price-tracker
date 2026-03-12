import {
  fetchPage,
  parsePrice,
  extractMetaPrice,
  type ScrapedProduct,
} from "./index";

export async function scrapeShopee(url: string): Promise<ScrapedProduct> {
  const $ = await fetchPage(url);

  // ── Title ─────────────────────────────────────────────────────────────
  // Shopee is heavily client-side rendered. Meta tags and <title> are
  // the most reliable server-rendered data available.
  const title =
    $("meta[property='og:title']").attr("content")?.trim() ||
    $("title").text().split("|")[0]?.trim() ||
    $("h1").first().text().trim() ||
    "";

  // ── Price ─────────────────────────────────────────────────────────────
  // Shopee's JS-heavy SPA means most price elements aren't in server HTML.
  // Meta tags (product:price:amount) ARE server-rendered for SEO.
  let price: number | null = extractMetaPrice($);

  if (!price) {
    // Some Shopee pages include price in og:description like "R$ 49,90"
    const desc = $("meta[property='og:description']").attr("content") || "";
    const match = desc.match(/R\$\s*([\d.,]+)/);
    if (match) price = parsePrice(match[1]);
  }

  if (!price) {
    // Last resort: scan visible text for first R$ price pattern
    const bodyHtml = $("body").html() || "";
    const match = bodyHtml.match(/"price"\s*:\s*([\d.]+)/);
    if (match) {
      const val = parseFloat(match[1]);
      // Shopee stores prices in cents (integer) — divide by 100000
      if (!isNaN(val) && val > 1000) price = val / 100000;
      else if (!isNaN(val) && val > 0) price = val;
    }
  }

  // ── Image ─────────────────────────────────────────────────────────────
  const imageUrl =
    $("meta[property='og:image']").attr("content") ||
    null;

  // ── Availability ──────────────────────────────────────────────────────
  const bodyText = $("body").text().toLowerCase();
  const availability =
    bodyText.includes("esgotado") ||
    bodyText.includes("produto indisponível")
      ? "out_of_stock"
      : "in_stock";

  if (!price) throw new Error("Preço não encontrado na Shopee (página requer JavaScript)");
  if (!title) throw new Error("Título não encontrado na Shopee");

  return {
    title: title.substring(0, 300),
    price,
    imageUrl,
    availability,
    marketplace: "shopee",
  };
}
