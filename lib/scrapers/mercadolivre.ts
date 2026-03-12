import { fetchPage, parsePrice, type ScrapedProduct } from "./index";

export async function scrapeMercadoLivre(url: string): Promise<ScrapedProduct> {
  const $ = await fetchPage(url);

  const title =
    $("h1.ui-pdp-title").text().trim() ||
    $("meta[property='og:title']").attr("content")?.trim() ||
    $("h1").first().text().trim();

  const price =
    parsePrice($("span.andes-money-amount__fraction").first().text() +
      ($("span.andes-money-amount__cents").first().text()
        ? "," + $("span.andes-money-amount__cents").first().text()
        : "")) ||
    parsePrice($("meta[itemprop='price']").attr("content") || "");

  const imageUrl =
    $("figure.ui-pdp-gallery__figure img").first().attr("src") ||
    $("img.ui-pdp-image").first().attr("src") ||
    $("meta[property='og:image']").attr("content") ||
    null;

  const bodyText = $("body").text().toLowerCase();
  const availability =
    bodyText.includes("produto não disponível") ||
    bodyText.includes("publicação pausada")
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
