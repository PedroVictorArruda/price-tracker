import {
  fetchPage,
  parsePrice,
  extractJsonLDPrice,
  extractMetaPrice,
  extractItempropPrice,
  type ScrapedProduct,
} from "./index";

export async function scrapeKabum(url: string): Promise<ScrapedProduct> {
  const $ = await fetchPage(url);

  // ── Title ─────────────────────────────────────────────────────────────
  const title =
    $("h1[itemprop='name']").text().trim() ||
    $("meta[property='og:title']").attr("content")?.trim() ||
    $("h1").first().text().trim() ||
    "";

  // ── Price extraction ─────────────────────────────────────────────────
  // KaBuM uses React with styled-components (class names like sc-* change
  // on each deploy). Use stable sources first.
  let price: number | null =
    extractJsonLDPrice($) ||
    extractMetaPrice($) ||
    extractItempropPrice($);

  if (!price) {
    // KaBuM Next.js pages embed product data in __NEXT_DATA__ JSON
    const nextDataEl = $("#__NEXT_DATA__").html();
    if (nextDataEl) {
      try {
        const nextData = JSON.parse(nextDataEl);
        // Walk common paths where KaBuM stores the price
        const paths = [
          nextData?.props?.pageProps?.product?.preco,
          nextData?.props?.pageProps?.product?.price,
          nextData?.props?.pageProps?.product?.vlrPreco,
          nextData?.props?.pageProps?.initialData?.product?.preco,
          nextData?.props?.pageProps?.initialData?.product?.price,
        ];
        for (const val of paths) {
          if (val !== undefined && val !== null) {
            const p = parseFloat(String(val));
            if (!isNaN(p) && p > 0) { price = p; break; }
          }
        }
      } catch {}
    }
  }

  if (!price) {
    // Fallback CSS selectors — fragile but kept as last resort
    price =
      parsePrice($("[class*='finalPrice']").first().text()) ||
      parsePrice($("[class*='FinalPrice']").first().text()) ||
      parsePrice($("[class*='price__']").first().text()) ||
      parsePrice($("[data-testid*='price']").first().text()) ||
      parsePrice($("h4[class*='Price']").first().text()) ||
      parsePrice($("h4").filter((_, el) => /R\$/.test($(el).text())).first().text());
  }

  // ── Image ─────────────────────────────────────────────────────────────
  const imageUrl =
    $("meta[property='og:image']").attr("content") ||
    $("img[itemprop='image']").attr("src") ||
    $("img[class*='product']").first().attr("src") ||
    null;

  // ── Availability ──────────────────────────────────────────────────────
  const bodyText = $("body").text().toLowerCase();
  const availability =
    bodyText.includes("produto indisponível") ||
    bodyText.includes("produto esgotado") ||
    bodyText.includes("este produto está esgotado") ||
    bodyText.includes("fora de estoque")
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
