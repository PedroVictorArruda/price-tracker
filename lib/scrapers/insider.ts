import axios from "axios";
import * as cheerio from "cheerio";

export async function scrapeInsider(url: string) {
  try {
    const { data } = await axios.get(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36"
      }
    });

    const $ = cheerio.load(data);

    // Extracting title
    const title = $("h1").first().text().trim() || $("title").text().trim();

    // Extracting price
    let priceText = $(".price, [data-price], .product-price, meta[property='product:price:amount']").first().text().trim();
    
    if (!priceText) {
      priceText = $("meta[property='product:price:amount']").attr("content") || "";
    }

    const priceMatch = priceText.match(/[\d,.]+/);
    let price = 0;
    if (priceMatch) {
      price = parseFloat(priceMatch[0].replace(/\./g, "").replace(",", "."));
    }

    // Extracting image
    let image = $("meta[property='og:image']").attr("content") || $("img").first().attr("src");
    
    if (image && image.startsWith("//")) {
      image = "https:" + image;
    }

    return {
      title,
      price,
      image,
      marketplace: "Insider",
      url
    };
  } catch (error) {
    console.error(`Error scraping Insider URL: ${url}`, error);
    throw new Error("Failed to scrape product data");
  }
}
