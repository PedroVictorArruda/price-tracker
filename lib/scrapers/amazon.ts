import { fetchPage, parsePrice, type ScrapedProduct } from "./index";

export async function scrapeAmazon(url: string): Promise<ScrapedProduct> {
  const $ = await fetchPage(url);

  const title =
    $("#productTitle").text().trim() ||
    $("span.a-size-large.product-title-word-break").text().trim();

  // Try specific "price to pay" containers first to avoid picking up
  // the crossed-out original price or installment prices
  const priceContainerSelectors = [
    "#corePriceDisplay_desktop_feature_div .priceToPay",
    "#corePriceDisplay_desktop_feature_div",
    ".priceToPay",
    "#apex_desktop .priceToPay",
    "#corePrice_desktop",
  ];

  let price: number | null = null;

  for (const selector of priceContainerSelectors) {
    const container = $(selector);
    if (!container.length) continue;

    // Prefer .a-offscreen (screen-reader text) — contains full price string
    const offscreen = container.find(".a-offscreen").first().text();
    if (offscreen) {
      price = parsePrice(offscreen);
      if (price) break;
    }

    // Fallback: reconstruct from whole + fraction parts
    const whole = container.find("span.a-price-whole").first().text().trim();
    const fraction = container.find("span.a-price-fraction").first().text().trim();
    if (whole) {
      price = parsePrice(`${whole}${fraction}`);
      if (price) break;
    }
  }

  // Last-resort fallbacks for older Amazon page layouts
  if (!price) {
    price =
      parsePrice($("#priceblock_ourprice").text()) ||
      parsePrice($("#priceblock_dealprice").text()) ||
      parsePrice($(".a-price .a-offscreen").first().text());
  }

  const imageUrl =
    $("#landingImage").attr("src") ||
    $("#imgBlkFront").attr("src") ||
    $(".a-dynamic-image").first().attr("src") ||
    null;

  const availability =
    $("#availability span").text().toLowerCase().includes("indisponível") ||
    $("#availability span").text().toLowerCase().includes("unavailable")
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
