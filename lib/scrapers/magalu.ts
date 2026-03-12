import { fetchPage, parsePrice, type ScrapedProduct } from "./index";

export async function scrapeMagalu(url: string): Promise<ScrapedProduct> {
  const $ = await fetchPage(url);

  const title =
    $("h1[data-testid='heading-product-title']").text().trim() ||
    $("h1.sc-kpDqfm").text().trim() ||
    $("h1").first().text().trim();

  const price =
    parsePrice($("p[data-testid='price-value']").first().text()) ||
    parsePrice($(".sc-kpDqfm.sc-cOFTSb").first().text()) ||
    parsePrice($("[data-testid='price-value']").first().text());

  const imageUrl =
    $("img[data-testid='image-selected-thumbnail']").attr("src") ||
    $("img.sc-hKwDye").first().attr("src") ||
    $("picture img").first().attr("src") ||
    null;

  const outOfStockText = $("body").text().toLowerCase();
  const availability =
    outOfStockText.includes("produto indisponível") ||
    outOfStockText.includes("este produto não está disponível")
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
