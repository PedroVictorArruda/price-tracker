import axios from "axios";
import * as cheerio from "cheerio";
import { NextResponse } from "next/server";

// TEMPORARY DEBUG ENDPOINT — remove after diagnosing Amazon scraping
// Usage: GET /api/debug-scrape?url=<amazon_url>
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const url = searchParams.get("url");
  if (!url) return NextResponse.json({ error: "url param required" }, { status: 400 });

  const asinMatch = url.match(/\/(?:dp|gp\/product)\/([A-Z0-9]{10})/i);
  const cleanUrl = asinMatch
    ? `https://www.amazon.com.br/dp/${asinMatch[1].toUpperCase()}`
    : url.split("?")[0].split("#")[0];

  let rawHtml = "";
  let httpStatus = 0;

  try {
    const res = await axios.get(cleanUrl, {
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
      },
      timeout: 20000,
      maxRedirects: 5,
      validateStatus: () => true,
    });

    httpStatus = res.status;
    rawHtml = res.data as string;
  } catch (err: any) {
    return NextResponse.json({ error: err.message });
  }

  const $ = cheerio.load(rawHtml);

  const debug = {
    httpStatus,
    pageTitle: $("title").text(),
    isCaptcha: $("form#captcha-form").length > 0,

    // Price selectors
    apex_label: $("#apex_pricetopay_accessibility_label").text().trim(),
    reinventPrice_whole: $("span.reinventPricePriceToPayMargin span.a-price-whole").first().text().trim(),
    reinventPrice_frac: $("span.reinventPricePriceToPayMargin span.a-price-fraction").first().text().trim(),
    corePrice_base_whole: $("#corePriceDisplay_desktop_feature_div span.a-price[data-a-color='base'] span.a-price-whole").first().text().trim(),
    priceblock_ourprice: $("#priceblock_ourprice").text().trim(),

    // All a-price-whole values on page (helps identify which is which)
    all_price_whole: $("span.a-price-whole").map((_, el) => ({
      text: $(el).text().trim(),
      parent_class: $(el).parent().attr("class") || "",
      grandparent_class: $(el).parent().parent().attr("class") || "",
      data_a_color: $(el).closest("span.a-price").attr("data-a-color") || "",
    })).get(),

    // JSON-LD scripts
    jsonld_count: $('script[type="application/ld+json"]').length,
    jsonld_first_200: $('script[type="application/ld+json"]').first().html()?.slice(0, 200) || "",

    // Product title
    productTitle: $("#productTitle").text().trim().slice(0, 100),

    // Raw HTML snippet around corePriceDisplay (first 2000 chars)
    corePriceDisplay_html: $("#corePriceDisplay_desktop_feature_div").html()?.slice(0, 2000) || "NOT FOUND",
  };

  return NextResponse.json(debug, { status: 200 });
}
