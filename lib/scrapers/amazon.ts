import axios from "axios";
import * as cheerio from "cheerio";
import {
  parsePrice,
  extractJsonLDPrice,
  extractMetaPrice,
  type ScrapedProduct,
} from "./index";

function extractAsin(url: string): string | null {
  const match = url.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})/i);
  return match ? match[1].toUpperCase() : null;
}

// Returns the ASIN that the loaded page is actually for.
// Amazon embeds this in a hidden input on every product page.
function getPageAsin($: cheerio.CheerioAPI): string {
  return $('input[name="ASIN"]').first().attr("value")?.toUpperCase() || "";
}

function isBlockedPage($: cheerio.CheerioAPI): boolean {
  const title = $("title").text().toLowerCase();
  const body = ($("body").text() || "").toLowerCase().slice(0, 2000);
  return (
    title === "amazon.com.br" || // homepage redirect
    title.includes("robot check") ||
    title.includes("captcha") ||
    title.includes("sorry") ||
    body.includes("enter the characters you see below") ||
    $("form#captcha-form").length > 0
  );
}

async function fetchOnce(cleanUrl: string, extra: Record<string, string> = {}): Promise<cheerio.CheerioAPI | null> {
  try {
    const { data, status } = await axios.get(cleanUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
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
        // Brazilian locale: prevents homepage redirect for non-BR server IPs
        "Cookie": "lc-acbbr=pt_BR; i18n-prefs=BRL",
        ...extra,
      },
      timeout: 20000,
      maxRedirects: 5,
      validateStatus: () => true,
    });
    if (status !== 200) return null;
    return cheerio.load(data);
  } catch {
    return null;
  }
}

async function fetchAmazonPage(url: string, requestedAsin: string | null): Promise<cheerio.CheerioAPI> {
  const cleanUrl = requestedAsin
    ? `https://www.amazon.com.br/dp/${requestedAsin}`
    : url.split("?")[0].split("#")[0];

  // Attempt 1 — standard request with locale cookie
  let $ = await fetchOnce(cleanUrl);

  if ($ && !isBlockedPage($)) {
    const pageAsin = getPageAsin($);
    // If page ASIN matches (or we can't verify), accept it
    if (!requestedAsin || !pageAsin || pageAsin === requestedAsin) {
      return $;
    }
    // Amazon served the wrong variant — retry with a different user-agent
  }

  // Attempt 2 — Firefox user-agent, slight delay to avoid rate limiting
  await new Promise(r => setTimeout(r, 800));
  $ = await fetchOnce(cleanUrl, {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0",
    "sec-ch-ua": '"Firefox";v="124", "Not-A.Brand";v="8"',
  });

  if ($ && !isBlockedPage($)) {
    const pageAsin = getPageAsin($);
    if (!requestedAsin || !pageAsin || pageAsin === requestedAsin) {
      return $;
    }
    // Still wrong variant — use it anyway (price extraction will try ASIN-specific elements)
    return $;
  }

  // Attempt 3 — try with ?th=1&psc=1 which forces the specific ASIN
  await new Promise(r => setTimeout(r, 800));
  const forcedUrl = `${cleanUrl}?th=1&psc=1`;
  $ = await fetchOnce(forcedUrl);

  if ($ && !isBlockedPage($)) return $;

  throw new Error(
    "Amazon bloqueou o acesso automático. Aguarde alguns minutos e tente novamente."
  );
}

function extractPrice($: cheerio.CheerioAPI, requestedAsin: string | null): number | null {
  // 1. JSON-LD structured data (most stable across page changes)
  let price = extractJsonLDPrice($) || extractMetaPrice($);
  if (price) return price;

  // 2. ASIN-specific hidden form inputs — these are tied to the current page's ASIN.
  //    When Amazon serves the right variant, these are the most reliable source.
  const amountAttr = $('input[name*="Price"][name*="amount"]').first().attr("value");
  if (amountAttr) { price = parseFloat(amountAttr) || null; if (price) return price; }

  const displayAttr = $('input[name*="Price"][name*="displayString"]').first().attr("value");
  if (displayAttr) { price = parsePrice(displayAttr); if (price) return price; }

  price = parseFloat($("#price-data-price").attr("value") || "") || null;
  if (price) return price;

  // 3. If the page ASIN differs from what we requested, try to find
  //    a variant link pointing to our ASIN and read its associated price.
  if (requestedAsin) {
    const pageAsin = getPageAsin($);
    if (pageAsin && pageAsin !== requestedAsin) {
      // Find any anchor/element with a reference to our ASIN
      const variantEl = $(`[data-dp-url*="${requestedAsin}"], a[href*="/dp/${requestedAsin}"]`).first();
      if (variantEl.length) {
        const container = variantEl.closest("li, .swatchElement, .a-button-text, span");
        const whole = container.find("span.a-price-whole").first().text().trim();
        const frac = container.find("span.a-price-fraction").first().text().trim();
        if (whole) { price = parsePrice(`${whole}${frac}`); if (price) return price; }
      }
    }
  }

  // 4. First visible base-color price span (reliable when correct variant is shown)
  const el = $('span.a-price[data-a-color="base"]').first();
  if (el.length) {
    const whole = el.find("span.a-price-whole").first().text().trim();
    const frac = el.find("span.a-price-fraction").first().text().trim();
    if (whole) { price = parsePrice(`${whole}${frac}`); if (price) return price; }
  }

  // 5. Legacy price block IDs
  return (
    parsePrice($("#priceblock_ourprice").text()) ||
    parsePrice($("#priceblock_dealprice").text())
  );
}

export async function scrapeAmazon(url: string): Promise<ScrapedProduct> {
  const requestedAsin = extractAsin(url);
  const $ = await fetchAmazonPage(url, requestedAsin);

  const title =
    $("#productTitle").text().trim() ||
    $("span.a-size-large.product-title-word-break").text().trim() ||
    $("meta[property='og:title']").attr("content")?.trim() ||
    "";

  const price = extractPrice($, requestedAsin);

  const imageUrl =
    $("#landingImage").attr("src") ||
    $("#imgBlkFront").attr("src") ||
    $("meta[property='og:image']").attr("content") ||
    $(".a-dynamic-image").first().attr("src") ||
    null;

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
