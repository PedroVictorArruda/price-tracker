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

function isBlockedPage($: cheerio.CheerioAPI): boolean {
  const title = $("title").text().toLowerCase().trim();
  return (
    title === "amazon.com.br" ||
    title === "" ||
    title.includes("robot check") ||
    title.includes("captcha") ||
    $("form#captcha-form").length > 0
  );
}

// When Amazon serves the correct ASIN page, the variant selector
// shows the same price in all positions. When it serves the wrong
// default variant, prices are all different (e.g. 358, 293, 261…).
function getPagePrices($: cheerio.CheerioAPI): number[] {
  return $("span.a-price-whole")
    .map((_, el) => {
      const whole = $(el).text().trim();
      const frac = $(el).siblings("span.a-price-fraction").first().text().trim();
      return parsePrice(`${whole}${frac}`);
    })
    .get()
    .filter((p): p is number => p !== null && p > 0);
}

function isCorrectVariantPage($: cheerio.CheerioAPI, requestedAsin: string | null): boolean {
  // Primary check: the ASIN hidden input matches what we requested
  const pageAsin = $('input[name="ASIN"]').first().attr("value")?.toUpperCase() || "";
  if (requestedAsin && pageAsin && pageAsin === requestedAsin) return true;

  // Secondary check: all visible prices are the same value
  // (correct variant → uniform price; wrong variant → mixed prices)
  const prices = getPagePrices($);
  if (prices.length > 0 && new Set(prices).size === 1) return true;

  return false;
}

const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
];

async function fetchOnce(url: string, ua: string): Promise<cheerio.CheerioAPI | null> {
  try {
    const { data, status } = await axios.get(url, {
      headers: {
        "User-Agent": ua,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
        "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
        "Accept-Encoding": "gzip, deflate, br",
        "Cache-Control": "max-age=0",
        "Upgrade-Insecure-Requests": "1",
        "sec-fetch-dest": "document",
        "sec-fetch-mode": "navigate",
        "sec-fetch-site": "none",
        "sec-fetch-user": "?1",
        // Locale cookies: prevents Amazon from redirecting non-BR server IPs to homepage
        "Cookie": "lc-acbbr=pt_BR; i18n-prefs=BRL",
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
  // Always use clean /dp/ASIN to avoid encoded chars and tracking params
  const cleanUrl = requestedAsin
    ? `https://www.amazon.com.br/dp/${requestedAsin}`
    : url.split("?")[0].split("#")[0];

  // Also try with ?th=1&psc=1 which forces display of the specific ASIN variant
  const forcedUrl = requestedAsin
    ? `https://www.amazon.com.br/dp/${requestedAsin}?th=1&psc=1`
    : cleanUrl;

  // Use ?th=1&psc=1 on every attempt — this forces Amazon to render the specific ASIN
  const attempts = [
    { url: forcedUrl, ua: USER_AGENTS[0] },
    { url: forcedUrl, ua: USER_AGENTS[1] },
    { url: forcedUrl, ua: USER_AGENTS[2] },
  ];

  let lastGoodPage: cheerio.CheerioAPI | null = null;

  for (let i = 0; i < attempts.length; i++) {
    if (i > 0) await new Promise(r => setTimeout(r, 1000));

    const $ = await fetchOnce(attempts[i].url, attempts[i].ua);
    if (!$ || isBlockedPage($)) continue;

    lastGoodPage = $;

    if (isCorrectVariantPage($, requestedAsin)) {
      return $; // Got the right page — stop retrying
    }
    // Wrong variant — retry
  }

  // All attempts returned wrong variant — use last good page and let price
  // extraction try its best with ASIN-specific hidden inputs
  if (lastGoodPage) return lastGoodPage;

  throw new Error(
    "Amazon bloqueou o acesso automático. Aguarde alguns minutos e tente novamente."
  );
}

function extractPrice($: cheerio.CheerioAPI, requestedAsin: string | null): number | null {
  // 1. Structured data (JSON-LD / Open Graph meta tags)
  let price = extractJsonLDPrice($) || extractMetaPrice($);
  if (price) return price;

  // 2. All prices are the same → correct variant loaded, use that price
  const prices = getPagePrices($);
  if (prices.length > 0 && new Set(prices).size === 1) {
    return prices[0];
  }

  // 3. ASIN-specific price from the variant selector (must come BEFORE generic inputs
  //    so we don't accidentally return the wrong displayed-variant price from hidden fields)
  if (requestedAsin) {
    // 3a. Find each span.a-price-whole and check if any ancestor contains a link to our ASIN
    $("span.a-price-whole").each((_, priceEl) => {
      if (price) return;
      let $node = $(priceEl).parent();
      for (let depth = 0; depth < 6; depth++) {
        if (!$node.length) break;
        const hasAsinLink =
          $node.find(`a[href*="/dp/${requestedAsin}"]`).length > 0 ||
          $node.find(`[data-dp-url*="${requestedAsin}"]`).length > 0 ||
          ($node.is("a") && (($node.attr("href") || "").includes(`/dp/${requestedAsin}`) ||
                             ($node.attr("data-dp-url") || "").includes(requestedAsin)));
        if (hasAsinLink) {
          const whole = $(priceEl).text().trim();
          const frac = $(priceEl).siblings("span.a-price-fraction").first().text().trim();
          const p = parsePrice(`${whole}${frac}`);
          if (p) { price = p; return; }
        }
        $node = $node.parent();
      }
    });
    if (price) return price;

    // 3b. Look for plain-text "R$" price in the link text itself
    $(`a[href*="/dp/${requestedAsin}"], [data-dp-url*="${requestedAsin}"]`).each((_, el) => {
      if (price) return;
      const text = $(el).text();
      const m = text.match(/R\$\s*([\d.,]+)/);
      if (m) { price = parsePrice(m[1]); }
    });
    if (price) return price;

    // 3c. Dropdown <option> with ASIN as value may contain price text
    $(`option[value="${requestedAsin}"], option[value*="${requestedAsin}"]`).each((_, el) => {
      if (price) return;
      const m = $(el).text().match(/R\$\s*([\d.,]+)/);
      if (m) { price = parsePrice(m[1]); }
    });
    if (price) return price;
  }

  // 4. Hidden form inputs tied to the currently-displayed variant
  //    (only reached when ASIN lookup above failed — these reflect the loaded variant)
  const amountVal = $('input[name*="Price"][name*="amount"]').first().attr("value");
  if (amountVal) { price = parseFloat(amountVal) || null; if (price) return price; }

  const displayVal = $('input[name*="Price"][name*="displayString"]').first().attr("value");
  if (displayVal) { price = parsePrice(displayVal); if (price) return price; }

  price = parseFloat($("#price-data-price").attr("value") || "") || null;
  if (price) return price;

  // 5. First base-color price (last resort — may be wrong variant's price)
  const el = $('span.a-price[data-a-color="base"]').first();
  if (el.length) {
    const whole = el.find("span.a-price-whole").first().text().trim();
    const frac = el.find("span.a-price-fraction").first().text().trim();
    if (whole) { price = parsePrice(`${whole}${frac}`); if (price) return price; }
  }

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
