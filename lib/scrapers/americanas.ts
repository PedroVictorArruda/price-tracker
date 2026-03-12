import { fetchPage, parsePrice, type ScrapedProduct } from "./index";

export async function scrapeAmericanas(url: string): Promise<ScrapedProduct> {
  const $ = await fetchPage(url);

  const title =
    $("h1.product-title").text().trim() ||
    $("h1[class*='Title']").text().trim() ||
    $("h1").first().text().trim();

  const price =
    parsePrice($("[class*='price__BestPrice']").first().text()) ||
    parsePrice($("[class*='Price']").first().text()) ||
    parsePrice($("span.sales-price").first().text());

  const imageUrl =
    $("img[class*='main-image']").attr("src") ||
    $("picture img").first().attr("src") ||
    $("img[alt]").first().attr("src") ||
    null;

  const bodyText = $("body").text().toLowerCase();
  const availability =
    bodyText.includes("produto indisponível") ||
    bodyText.includes("produto esgotado")
      ? "out_of_stock"
      : "in_stock";

  if (!price) throw new Error("Preço não encontrado nas Americanas");
  if (!title) throw new Error("Título não encontrado nas Americanas");

  return {
    title: title.substring(0, 300),
    price,
    imageUrl,
    availability,
    marketplace: "americanas",
  };
}
