import { fetchPage, parsePrice, type ScrapedProduct } from "./index";

export async function scrapeKabum(url: string): Promise<ScrapedProduct> {
  const $ = await fetchPage(url);

  const title =
    $("h1.sc-fqkvVR").text().trim() ||
    $("h1[itemprop='name']").text().trim() ||
    $("h1").first().text().trim();

  const price =
    parsePrice($("h4.sc-dUjcNx").first().text()) ||
    parsePrice($("[class*='finalPrice']").first().text()) ||
    parsePrice($("h4[class*='Price']").first().text());

  const imageUrl =
    $("img.sc-hLQSwg").attr("src") ||
    $("img[itemprop='image']").attr("src") ||
    $("img.product-image").first().attr("src") ||
    null;

  const bodyText = $("body").text().toLowerCase();
  const availability =
    bodyText.includes("produto indisponível") ||
    bodyText.includes("este produto está esgotado")
      ? "out_of_stock"
      : "in_stock";

  if (!price) throw new Error("Preço não encontrado no KaBuM!");
  if (!title) throw new Error("Título não encontrado no KaBuM!");

  return {
    title: title.substring(0, 300),
    price,
    imageUrl,
    availability,
    marketplace: "kabum",
  };
}
