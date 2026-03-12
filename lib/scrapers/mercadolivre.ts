import {
  fetchPage,
  parsePrice,
  extractJsonLDPrice,
  extractMetaPrice,
  extractItempropPrice,
  type ScrapedProduct,
} from "./index";

export async function scrapeMercadoLivre(url: string): Promise<ScrapedProduct> {
  const $ = await fetchPage(url);

  // ── Title ─────────────────────────────────────────────────────────────
  const title =
    $("h1.ui-pdp-title").text().trim() ||
    $("meta[property='og:title']").attr("content")?.trim() ||
    $("h1").first().text().trim() ||
    "";

  // ── Price ─────────────────────────────────────────────────────────────
  let price: number | null =
    extractJsonLDPrice($) ||
    extractMetaPrice($) ||
    extractItempropPrice($);

  if (!price) {
    // MercadoLivre renders price split into fraction + cents spans
    const fraction = $("span.andes-money-amount__fraction").first().text().trim();
    const cents = $("span.andes-money-amount__cents").first().text().trim();
    if (fraction) {
      price = parsePrice(cents ? `${fraction},${cents}` : fraction);
    }
  }

  if (!price) {
    // Try meta[itemprop] attribute (content has raw number)
    const content = $("meta[itemprop='price']").attr("content");
    if (content) price = parseFloat(content) || null;
  }

  // ── Image ─────────────────────────────────────────────────────────────
  const imageUrl =
    $("meta[property='og:image']").attr("content") ||
    $("figure.ui-pdp-gallery__figure img").first().attr("src") ||
    $("img.ui-pdp-image").first().attr("src") ||
    null;

  // ── Availability ──────────────────────────────────────────────────────
  const bodyText = $("body").text().toLowerCase();
  const availability =
    bodyText.includes("produto não disponível") ||
    bodyText.includes("publicação pausada") ||
    bodyText.includes("anúncio pausado")
      ? "out_of_stock"
      : "in_stock";

  if (!price) throw new Error("Preço não encontrado no Mercado Livre");
  if (!title) throw new Error("Título não encontrado no Mercado Livre");

  return {
    title: title.substring(0, 300),
    price,
    imageUrl,
    availability,
    marketplace: "mercadolivre",
  };
}
