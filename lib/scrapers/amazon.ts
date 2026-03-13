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
  const bodyText = $("body").text().toLowerCase();

  return (
    title === "amazon.com.br" ||
    title === "" ||
    title.includes("robot check") ||
    title.includes("captcha") ||
    $("form#captcha-form").length > 0 ||
    bodyText.includes("digite os caracteres que você vê abaixo") ||
    bodyText.includes("enter the characters you see below")
  );
}

function getPagePrices($: cheerio.CheerioAPI): number[] {
  return $("span.a-price-whole")
    .map((_, el) => {
      const whole = $(el).text().replace(/[,.]/g, "").trim();
      const frac = $(el).siblings("span.a-price-fraction").first().text().trim() || "00";
      return parsePrice(`${whole},${frac}`);
    })
    .get()
    .filter((p): p is number => p !== null && p > 0);
}

function isCorrectVariantPage($: cheerio.CheerioAPI, requestedAsin: string | null): boolean {
  const pageAsin = $('input[name="ASIN"], input#ASIN').first().attr("value")?.toUpperCase() || "";
  if (requestedAsin && pageAsin && pageAsin === requestedAsin) return true;

  const prices = getPagePrices($);
  if (prices.length > 0 && new Set(prices).size === 1) return true;

  return false;
}

// User-Agents atualizados e mais realistas
const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:124.0) Gecko/20100101 Firefox/124.0",
];

async function fetchOnce(url: string, ua: string): Promise<cheerio.CheerioAPI | null> {
  try {
    const { data, status } = await axios.get(url, {
      headers: {
        "User-Agent": ua,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.7",
        "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
        "Accept-Encoding": "gzip, deflate, br",
        "Cache-Control": "max-age=0",
        "Upgrade-Insecure-Requests": "1",
        "sec-ch-ua": '"Google Chrome";v="123", "Not:A-Brand";v="8", "Chromium";v="123"',
        "sec-ch-ua-mobile": "?0",
        "sec-ch-ua-platform": '"Windows"',
        "sec-fetch-dest": "document",
        "sec-fetch-mode": "navigate",
        "sec-fetch-site": "cross-site",
        "sec-fetch-user": "?1",
        "Cookie": "session-id=135-1234567-1234567; i18n-prefs=BRL; lc-acbbr=pt_BR;", // Fake session to look more legit
      },
      timeout: 15000,
      maxRedirects: 5,
      validateStatus: () => true,
    });

    if (status !== 200 && status !== 404) return null; // Accept 404 to handle unavailable products gracefully
    return cheerio.load(data);
  } catch (error) {
    console.error("Axios fetch error:", error);
    return null;
  }
}

async function fetchAmazonPage(url: string, requestedAsin: string | null): Promise<cheerio.CheerioAPI> {
  const cleanUrl = requestedAsin
    ? `https://www.amazon.com.br/dp/${requestedAsin}`
    : url.split("?")[0].split("#")[0];

  const forcedUrl = requestedAsin
    ? `${cleanUrl}?th=1&psc=1`
    : cleanUrl;

  const attempts = [
    { url: forcedUrl, ua: USER_AGENTS[0] },
    { url: cleanUrl, ua: USER_AGENTS[1] }, // Tenta sem parâmetros na segunda vez
    { url: forcedUrl, ua: USER_AGENTS[2] },
  ];

  let lastGoodPage: cheerio.CheerioAPI | null = null;

  for (let i = 0; i < attempts.length; i++) {
    if (i > 0) {
      // Backoff aleatório para não parecer robô (1s a 3s)
      await new Promise(r => setTimeout(r, 1000 + Math.random() * 2000));
    }

    const $ = await fetchOnce(attempts[i].url, attempts[i].ua);

    if (!$) continue;

    if (isBlockedPage($)) {
      console.warn(`Attempt ${i + 1} blocked by Amazon (Captcha/Robot check).`);
      continue;
    }

    lastGoodPage = $;

    if (isCorrectVariantPage($, requestedAsin)) {
      return $;
    }
  }

  if (lastGoodPage) return lastGoodPage;

  throw new Error("Amazon bloqueou todas as tentativas ou o produto não foi carregado corretamente.");
}

function extractPrice($: cheerio.CheerioAPI, requestedAsin: string | null): number | null {
  // 1. JSON-LD / Meta
  let price = extractJsonLDPrice($) || extractMetaPrice($);
  if (price) return price;

  // 2. Extra Seletores Comuns da Amazon (Desktop e Mobile web)
  const directSelectors = [
    ".a-price[data-a-color='price'] span.a-offscreen",
    "#corePriceDisplay_desktop_feature_div .a-price span.a-offscreen",
    "#corePrice_feature_div .a-price span.a-offscreen",
    "#priceblock_ourprice",
    "#priceblock_dealprice",
    ".a-price.a-text-price.a-size-medium.apexPriceToPay span.a-offscreen"
  ];

  for (const selector of directSelectors) {
    const textPrice = $(selector).first().text().trim();
    if (textPrice) {
      const p = parsePrice(textPrice);
      if (p) return p;
    }
  }

  // 3. Fallback para os seletores de variant que você já tinha
  const prices = getPagePrices($);
  if (prices.length > 0 && new Set(prices).size === 1) {
    return prices[0];
  }

  // 4. Fallback final: pegar o primeiro preço "whole" + "fraction" encontrado
  const firstWhole = $("span.a-price-whole").first().text().replace(/[,.]/g, "").trim();
  const firstFrac = $("span.a-price-fraction").first().text().trim();
  if (firstWhole) {
    return parsePrice(`${firstWhole},${firstFrac || "00"}`);
  }

  return null;
}

export async function scrapeAmazon(url: string): Promise<ScrapedProduct> {
  const requestedAsin = extractAsin(url);
  const $ = await fetchAmazonPage(url, requestedAsin);

  const title =
    $("#productTitle").text().trim() ||
    $("span.a-size-large.product-title-word-break").text().trim() ||
    $("meta[property='og:title']").attr("content")?.trim() ||
    "";

  if (!title) {
    // Se não achou nem o título, provavelmente o HTML carregado é inválido/bloqueado.
    throw new Error("Página da Amazon não retornou os dados estruturados básicos (Possível bloqueio agressivo).");
  }

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
      availText.includes("esgotado") ||
      availText.includes("não temos previsão de quando")
      ? "out_of_stock"
      : "in_stock";

  if (!price) {
    console.error("HTML Recebido:", $.html().substring(0, 500) + "..."); // Debug útil
    throw new Error("Preço não encontrado na Amazon");
  }

  return {
    title: title.substring(0, 300),
    price,
    imageUrl,
    availability,
    marketplace: "amazon",
  };
}