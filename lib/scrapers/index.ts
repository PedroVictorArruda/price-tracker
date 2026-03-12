import axios from "axios";
import * as cheerio from "cheerio";

// ─── Types ──────────────────────────────────────────────────────────────
export interface ScrapedProduct {
  title: string;
  price: number;
  imageUrl: string | null;
  availability: "in_stock" | "out_of_stock";
  marketplace: string;
}

export type Marketplace =
  | "amazon"
  | "magalu"
  | "americanas"
  | "casasbahia"
  | "kabum"
  | "ponto"
  | "shopee"
  | "mercadolivre";

export interface ScraperResult {
  success: boolean;
  data?: ScrapedProduct;
  error?: string;
}

// ─── User-Agent Rotation ────────────────────────────────────────────────
const USER_AGENTS = [
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0",
  "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
];

function getRandomUserAgent(): string {
  return USER_AGENTS[Math.floor(Math.random() * USER_AGENTS.length)];
}

// ─── Shared HTTP Fetch ──────────────────────────────────────────────────
export async function fetchPage(url: string): Promise<cheerio.CheerioAPI> {
  const { data } = await axios.get(url, {
    headers: {
      "User-Agent": getRandomUserAgent(),
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
      "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7",
      "Accept-Encoding": "gzip, deflate, br",
      "Cache-Control": "no-cache",
      "Pragma": "no-cache",
      "Connection": "keep-alive",
      "Upgrade-Insecure-Requests": "1",
      "Sec-Fetch-Dest": "document",
      "Sec-Fetch-Mode": "navigate",
      "Sec-Fetch-Site": "none",
      "Sec-Fetch-User": "?1",
    },
    timeout: 20000,
    maxRedirects: 5,
  });
  return cheerio.load(data);
}

// ─── Structured Data Helpers ─────────────────────────────────────────────

/**
 * Extracts product price from JSON-LD <script> blocks.
 * Most reliable source — used for SEO, stable across UI changes.
 */
export function extractJsonLDPrice($: cheerio.CheerioAPI): number | null {
  let found: number | null = null;
  $('script[type="application/ld+json"]').each((_, el) => {
    if (found !== null) return;
    try {
      const raw = $(el).html() || "";
      const json = JSON.parse(raw);
      const items: any[] = Array.isArray(json) ? json : [json];
      for (const item of items) {
        if (!item) continue;
        const type = item["@type"];
        if (type === "Product" || type === "Offer") {
          const offers = item.offers ?? (type === "Offer" ? item : null);
          if (!offers) continue;
          const offer = Array.isArray(offers) ? offers[0] : offers;
          const raw = String(offer?.price ?? offer?.lowPrice ?? "").replace(",", ".");
          const val = parseFloat(raw);
          if (!isNaN(val) && val > 0) { found = val; return; }
        }
      }
    } catch {}
  });
  return found;
}

/**
 * Extracts product price from common meta tags.
 * Second most reliable — used by open graph / schema.org.
 */
export function extractMetaPrice($: cheerio.CheerioAPI): number | null {
  const selectors = [
    'meta[property="product:price:amount"]',
    'meta[property="og:price:amount"]',
    'meta[itemprop="price"]',
    'meta[name="price"]',
  ];
  for (const sel of selectors) {
    const content = $(sel).attr("content");
    if (content) {
      const val = parseFloat(content.replace(",", "."));
      if (!isNaN(val) && val > 0) return val;
    }
  }
  return null;
}

/**
 * Extracts product price from itemprop/microdata attributes.
 */
export function extractItempropPrice($: cheerio.CheerioAPI): number | null {
  const el = $('[itemprop="price"]').first();
  if (!el.length) return null;
  // Prefer content attribute (standard microdata), then text
  const content = el.attr("content") || el.attr("data-price") || el.text();
  if (!content) return null;
  const val = parseFloat(content.replace(",", "."));
  return !isNaN(val) && val > 0 ? val : null;
}

// ─── Marketplace Detection ──────────────────────────────────────────────
const MARKETPLACE_PATTERNS: Record<Marketplace, RegExp[]> = {
  amazon: [/amazon\.com\.br/i],
  magalu: [/magazineluiza\.com\.br/i, /magalu\.com\.br/i],
  americanas: [/americanas\.com\.br/i],
  casasbahia: [/casasbahia\.com\.br/i],
  kabum: [/kabum\.com\.br/i],
  ponto: [/pontofrio\.com\.br/i, /ponto\.com\.br/i],
  shopee: [/shopee\.com\.br/i],
  mercadolivre: [/mercadolivre\.com\.br/i, /produto\.mercadolivre/i],
};

export function detectMarketplace(url: string): Marketplace | null {
  for (const [marketplace, patterns] of Object.entries(MARKETPLACE_PATTERNS)) {
    if (patterns.some((p) => p.test(url))) {
      return marketplace as Marketplace;
    }
  }
  return null;
}

export const MARKETPLACE_LABELS: Record<Marketplace, string> = {
  amazon: "Amazon",
  magalu: "Magazine Luiza",
  americanas: "Americanas",
  casasbahia: "Casas Bahia",
  kabum: "KaBuM!",
  ponto: "Ponto",
  shopee: "Shopee",
  mercadolivre: "Mercado Livre",
};

export const MARKETPLACE_COLORS: Record<Marketplace, string> = {
  amazon: "#FF9900",
  magalu: "#0086FF",
  americanas: "#E60014",
  casasbahia: "#0046C0",
  kabum: "#FF6500",
  ponto: "#E60014",
  shopee: "#EE4D2D",
  mercadolivre: "#FFE600",
};

// ─── Price Parsing ──────────────────────────────────────────────────────
export function parsePrice(text: string): number | null {
  if (!text) return null;
  // Remove "R$", dots (thousands), and replace comma with period
  const cleaned = text
    .replace(/R\$\s*/g, "")
    .replace(/\./g, "")
    .replace(",", ".")
    .replace(/[^\d.]/g, "")
    .trim();
  const value = parseFloat(cleaned);
  return isNaN(value) || value <= 0 ? null : value;
}

// ─── Scraper Router ─────────────────────────────────────────────────────
import { scrapeAmazon } from "./amazon";
import { scrapeMagalu } from "./magalu";
import { scrapeAmericanas } from "./americanas";
import { scrapeCasasBahia } from "./casasbahia";
import { scrapeKabum } from "./kabum";
import { scrapePonto } from "./ponto";
import { scrapeShopee } from "./shopee";
import { scrapeMercadoLivre } from "./mercadolivre";

const SCRAPERS: Record<Marketplace, (url: string) => Promise<ScrapedProduct>> = {
  amazon: scrapeAmazon,
  magalu: scrapeMagalu,
  americanas: scrapeAmericanas,
  casasbahia: scrapeCasasBahia,
  kabum: scrapeKabum,
  ponto: scrapePonto,
  shopee: scrapeShopee,
  mercadolivre: scrapeMercadoLivre,
};

export async function scrapeProduct(url: string): Promise<ScraperResult> {
  const marketplace = detectMarketplace(url);
  if (!marketplace) {
    return { success: false, error: "Marketplace não suportado. Tente: Amazon, Magalu, Americanas, Casas Bahia, KaBuM!, Ponto, Shopee ou Mercado Livre." };
  }

  try {
    const scraper = SCRAPERS[marketplace];
    const data = await scraper(url);
    return { success: true, data };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Erro desconhecido ao buscar produto";
    return { success: false, error: `Falha ao extrair dados de ${MARKETPLACE_LABELS[marketplace]}: ${message}` };
  }
}
