import { fetchPage, parsePrice, type ScrapedProduct } from "./index";

export async function scrapeAmazon(url: string): Promise<ScrapedProduct> {
  const $ = await fetchPage(url);

  const title =
    $("#productTitle").text().trim() ||
    $("span.a-size-large.product-title-word-break").text().trim();

  const priceWhole = $("span.a-price-whole").first().text().trim();
  const priceFraction = $("span.a-price-fraction").first().text().trim();
  const priceText = priceWhole ? `${priceWhole}${priceFraction}` : "";

  const price =
    parsePrice(priceText) ||
    parsePrice($(".a-price .a-offscreen").first().text()) ||
    parsePrice($("#priceblock_ourprice").text()) ||
    parsePrice($("#priceblock_dealprice").text());

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
