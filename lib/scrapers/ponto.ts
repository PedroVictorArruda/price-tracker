import { fetchPage, parsePrice, type ScrapedProduct } from "./index";

export async function scrapePonto(url: string): Promise<ScrapedProduct> {
  const $ = await fetchPage(url);

  const title =
    $("h1.product-name").text().trim() ||
    $("h1[class*='Heading']").text().trim() ||
    $("h1").first().text().trim();

  const price =
    parsePrice($("[class*='price__BestPrice']").first().text()) ||
    parsePrice($("[class*='Price']").first().text()) ||
    parsePrice($("span.sales-price").first().text());

  const imageUrl =
    $("img[class*='main-image']").attr("src") ||
    $("picture img").first().attr("src") ||
    null;

  const bodyText = $("body").text().toLowerCase();
  const availability =
    bodyText.includes("produto indisponível") ||
    bodyText.includes("esgotado")
      ? "out_of_stock"
      : "in_stock";

  if (!price) throw new Error("Preço não encontrado no Ponto");
  if (!title) throw new Error("Título não encontrado no Ponto");

  return {
    title: title.substring(0, 300),
    price,
    imageUrl,
    availability,
    marketplace: "ponto",
  };
}
