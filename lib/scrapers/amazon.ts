import axios from "axios";
import * as cheerio from "cheerio";
import {
  parsePrice,
  extractJsonLDPrice,
  extractMetaPrice,
  type ScrapedProduct,
} from "./index";

// Amazon-specific fetch with headers that closely mimic a real Chrome browser.
// Amazon's bot detection inspects sec-ch-ua, Accept, and header ordering.
async function fetchAmazonPage(url: string): Promise<cheerio.CheerioAPI> {
  // Normalise URL: remove tracking params that can trigger redirects/captcha
  const cleanUrl = url.split("?")[0].split("#")[0];

  const { data, status } = await axios.get(cleanUrl, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
      "Accept":
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
      "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
      "Accept-Encoding": "gzip, deflate, br",
      "sec-ch-ua": '"Chromium";v="122", "Not(A:Brand";v="24", "Google Chrome";v="122"',
      "sec-ch-ua-mobile": "?0",
      "sec-ch-ua-platform": '"Windows"',
      "sec-fetch-dest": "document",
      "sec-fetch-mode": "navigate",
      "sec-fetch-site": "none",
      "sec-fetch-user": "?1",
      "Cache-Control": "max-age=0",
      "Upgrade-Insecure-Requests": "1",
      "Connection": "keep-alive",
    },
    timeout: 20000,
    maxRedirects: 5,
    validateStatus: () => true, // don't throw on non-2xx so we can inspect
  });

  if (status !== 200) {
    throw new Error(`Amazon retornou status ${status}`);
  }

  const $ = cheerio.load(data);

  // Detect bot-blocking / CAPTCHA pages
  const pageTitle = $("title").text().toLowerCase();
  const bodyText = ($("body").text() || "").toLowerCase().slice(0, 2000);

  if (
    pageTitle.includes("robot check") ||
    pageTitle.includes("captcha") ||
    pageTitle.includes("sorry") ||
    bodyText.includes("enter the characters you see below") ||
    bodyText.includes("type the characters you see in this image") ||
    bodyText.includes("há um problema com seu pedido") ||
    ($("form#captcha-form").length > 0)
  ) {
    throw new Error(
      "Amazon bloqueou o acesso automático (CAPTCHA). Tente novamente em alguns minutos."
    );
  }

  return $;
}

export async function scrapeAmazon(url: string): Promise<ScrapedProduct> {
  const $ = await fetchAmazonPage(url);

  // ── Title ─────────────────────────────────────────────────────────────
  const title =
    $("#productTitle").text().trim() ||
    $("span.a-size-large.product-title-word-break").text().trim() ||
    $("meta[property='og:title']").attr("content")?.trim() ||
    "";

  // ── Price extraction ─────────────────────────────────────────────────
  // 1. JSON-LD (most stable)
  // 2. Meta tags
  // 3. Specific "priceToPay" containers — avoids crossed-out / installment prices
  // 4. Legacy selectors

  let price: number | null =
    extractJsonLDPrice($) ||
    extractMetaPrice($);

  if (!price) {
    // #apex_pricetopay_accessibility_label is an accessibility label Amazon
    // places on the price-to-pay element — contains the full "R$ 269,00" string
    // and is the most direct/stable selector visible in the page source.
    price = parsePrice($("#apex_pricetopay_accessibility_label").text());
  }

  if (!price) {
    // reinventPricePriceToPayMargin is the visible price container for the
    // current buy price. Note: .a-offscreen inside this span is often empty,
    // so we reconstruct from .a-price-whole + .a-price-fraction directly.
    const container = $("span.reinventPricePriceToPayMargin").first();
    if (container.length) {
      const whole = container.find("span.a-price-whole").first().text().trim();
      const frac = container.find("span.a-price-fraction").first().text().trim();
      if (whole) price = parsePrice(`${whole}${frac}`);
    }
  }

  if (!price) {
    // Fallback: corePriceDisplay container — walk all .a-price children and
    // pick the one marked with data-a-color="base" (the main price, not strikethrough)
    const coreDiv = $("#corePriceDisplay_desktop_feature_div");
    if (coreDiv.length) {
      coreDiv.find("span.a-price[data-a-color='base']").each((_, el) => {
        if (price) return;
        const whole = $(el).find("span.a-price-whole").first().text().trim();
        const frac = $(el).find("span.a-price-fraction").first().text().trim();
        if (whole) price = parsePrice(`${whole}${frac}`);
      });
    }
  }

  if (!price) {
    price =
      parsePrice($("#priceblock_ourprice").text()) ||
      parsePrice($("#priceblock_dealprice").text());
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
