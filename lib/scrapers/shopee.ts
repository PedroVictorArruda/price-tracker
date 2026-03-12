import { fetchPage, parsePrice, type ScrapedProduct } from "./index";

export async function scrapeShopee(url: string): Promise<ScrapedProduct> {
  const $ = await fetchPage(url);

  const title =
    $("div.product-briefing h1").text().trim() ||
    $("span._44qnta").text().trim() ||
    $("meta[property='og:title']").attr("content")?.trim() ||
    $("title").text().split("|")[0]?.trim() ||
    "";

  const price =
    parsePrice($("div.product-briefing .pmmxKx").first().text()) ||
    parsePrice($("div._3_ISdg").first().text()) ||
    parsePrice($("meta[property='product:price:amount']").attr("content") || "");

  const imageUrl =
    $("meta[property='og:image']").attr("content") ||
    $("div.product-briefing img").first().attr("src") ||
    null;

  const bodyText = $("body").text().toLowerCase();
  const availability =
    bodyText.includes("esgotado") || bodyText.includes("produto indisponível")
      ? "out_of_stock"
      : "in_stock";

  if (!price) throw new Error("Preço não encontrado na Shopee (página pode requerer JavaScript)");
  if (!title) throw new Error("Título não encontrado na Shopee");

  return {
    title: title.substring(0, 300),
    price,
    imageUrl,
    availability,
    marketplace: "shopee",
  };
}
