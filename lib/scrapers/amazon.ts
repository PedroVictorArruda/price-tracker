import {
  fetchPage,
  parsePrice,
  extractJsonLDPrice,
  extractMetaPrice,
  type ScrapedProduct,
} from "./index";

export async function scrapeAmazon(url: string): Promise<ScrapedProduct> {
  const $ = await fetchPage(url);

  const title =
    $("#productTitle").text().trim() ||
    $("span.a-size-large.product-title-word-break").text().trim() ||
    $("meta[property='og:title']").attr("content")?.trim() ||
    "";

  // ── Price extraction ─────────────────────────────────────────────────
  // Priority order:
  //   1. JSON-LD (most stable — won't change with UI redesigns)
  //   2. Meta tags
  //   3. Specific "price to pay" containers (avoids crossed-out/installment prices)
  //   4. Older Amazon price block IDs

  let price: number | null =
    extractJsonLDPrice($) ||
    extractMetaPrice($);

  if (!price) {
    // Amazon renders multiple .a-price elements (original, installment, current).
    // Target only the "priceToPay" container which holds the real buy price.
    const priceContainers = [
      "#corePriceDisplay_desktop_feature_div .priceToPay",
      ".reinventPricePriceToPayMargin",
      ".apexPriceToPay",
      ".priceToPay",
      "#corePriceDisplay_desktop_feature_div",
      "#corePrice_desktop",
    ];

    for (const selector of priceContainers) {
      const container = $(selector);
      if (!container.length) continue;

      // .a-offscreen contains the full "R$269,00" string for screen readers
      const offscreen = container.find(".a-offscreen").first().text();
      if (offscreen) {
        price = parsePrice(offscreen);
        if (price) break;
      }

      // Fallback: reconstruct from separate whole + fraction spans
      const whole = container.find("span.a-price-whole").first().text().trim();
      const frac = container.find("span.a-price-fraction").first().text().trim();
      if (whole) {
        price = parsePrice(`${whole}${frac}`);
        if (price) break;
      }
    }
  }

  // Legacy Amazon page layouts
  if (!price) {
    price =
      parsePrice($("#priceblock_ourprice").text()) ||
      parsePrice($("#priceblock_dealprice").text()) ||
      // Absolute last resort: first .a-offscreen on page (may still be wrong
      // on pages with many price variants — only reached if everything else fails)
      parsePrice($("span[data-a-color='price'] .a-offscreen").first().text());
  }

  // ── Image ─────────────────────────────────────────────────────────────
  const imageUrl =
    $("#landingImage").attr("src") ||
    $("#imgBlkFront").attr("src") ||
    $("meta[property='og:image']").attr("content") ||
    $(".a-dynamic-image").first().attr("src") ||
    null;

  // ── Availability ──────────────────────────────────────────────────────
  const availText = $("#availability span").text().toLowerCase();
  const availability =
    availText.includes("indisponível") ||
    availText.includes("unavailable") ||
    availText.includes("esgotado")
      ? "out_of_stock"
      : "in_stock";

  if (!price) throw new Error("Preço não encontrado na Amazon");
  if (!title) throw new Error("Título não encontrado na Amazon");

  return {
    title: title.substring(0, 300),
    price,
    imageUrl,
    availability,
    marketplace: "amazon",
  };
}
