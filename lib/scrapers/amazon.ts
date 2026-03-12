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
function extractAsin(url: string): string | null {
  // Matches /dp/ASIN or /gp/product/ASIN
  const match = url.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})/i);
  return match ? match[1].toUpperCase() : null;
}

async function fetchAmazonPage(url: string): Promise<cheerio.CheerioAPI> {
  // Always use a clean /dp/ASIN URL to avoid:
  //  - URL-encoded special chars in product name paths causing redirects
  //  - Tracking params that trigger bot detection or homepage redirects
  const asin = extractAsin(url);
  const cleanUrl = asin
    ? `https://www.amazon.com.br/dp/${asin}`
    : url.split("?")[0].split("#")[0];

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
      // Critical: without Brazilian locale cookies Amazon redirects to homepage
      "Cookie": "lc-acbbr=pt_BR; i18n-prefs=BRL",
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
    // Hidden input confirmed by debug: name contains "Price" and "amount"
    // e.g. items[0][Price][amount] value="269.0"
    const hiddenAmount = $('input[name*="Price"][name*="amount"]').first().attr("value");
    if (hiddenAmount) price = parseFloat(hiddenAmount) || null;
  }

  if (!price) {
    // Hidden input with display string e.g. value="R$ 269,00"
    const hiddenDisplay = $('input[name*="Price"][name*="displayString"]').first().attr("value");
    if (hiddenDisplay) price = parsePrice(hiddenDisplay);
  }

  if (!price) {
    // First span.a-price[data-a-color="base"] — confirmed by debug to contain
    // the correct price when the page loads with Brazilian locale cookies
    const el = $('span.a-price[data-a-color="base"]').first();
    if (el.length) {
      const whole = el.find("span.a-price-whole").first().text().trim();
      const frac = el.find("span.a-price-fraction").first().text().trim();
      if (whole) price = parsePrice(`${whole}${frac}`);
    }
  }

  if (!price) {
    // data-price hidden input confirmed in debug: id="price-data-price" value="269"
    const dataPriceEl = $("#price-data-price, [class*='price-data-price']").first();
    if (dataPriceEl.length) price = parseFloat(dataPriceEl.attr("value") || "") || null;
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
