import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { detectMarketplace, scrapeProduct } from "@/lib/scrapers";

/**
 * POST /api/products - Add a new product to track
 */
export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "NÃ£o autorizado" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { url, targetPrice } = body;

    if (!url) {
      return NextResponse.json({ error: "URL Ã© obrigatÃ³ria" }, { status: 400 });
    }

    // Detect marketplace
    const marketplace = detectMarketplace(url);
    if (!marketplace) {
      return NextResponse.json(
        { error: "Marketplace nÃ£o suportado. Use Amazon, Magalu, Americanas, Casas Bahia, KaBuM!, Ponto, Shopee ou Mercado Livre." },
        { status: 400 }
      );
    }

    // Check if user already tracks this URL
    const { data: existing } = await supabase
      .from("tracked_products")
      .select("id")
      .eq("user_id", user.id)
      .eq("url", url)
      .single();

    if (existing) {
      return NextResponse.json({ error: "VocÃª jÃ¡ estÃ¡ rastreando este produto." }, { status: 409 });
    }

    // Scrape product info using existing scraper
    const result = await scrapeProduct(url);

    // If scraping failed, surface the error to the user instead of
    // silently saving a product with no title or price.
    if (!result.success) {
      return NextResponse.json(
        { error: result.error || "Não foi possível obter os dados do produto. Verifique a URL e tente novamente." },
        { status: 422 }
      );
    }

    const { title, price, imageUrl, availability } = {
      title: result.data!.title,
      price: result.data!.price,
      imageUrl: result.data!.imageUrl,
      availability: result.data!.availability,
    };

    // Insert product
    const { data: product, error: insertError } = await supabase
      .from("tracked_products")
      .insert({
        user_id: user.id,
        url,
        title,
        image_url: imageUrl,
        marketplace,
        target_price: targetPrice || null,
        current_price: price,
        lowest_price: price,
        highest_price: price,
      })
      .select()
      .single();

    if (insertError) throw insertError;

    // Insert first price record if we got a price
    if (price) {
      await supabase.from("price_history").insert({
        product_id: product.id,
        price,
        availability,
      });
    }

    return NextResponse.json({ product, price, scraped: result.success }, { status: 201 });
  } catch (err: any) {
    console.error("Error adding product:", err);
    return NextResponse.json(
      { error: err.message || "Erro ao adicionar produto" },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/products?id=xxx - Remove a tracked product
 */
export async function DELETE(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "NÃ£o autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "ID Ã© obrigatÃ³rio" }, { status: 400 });
  }

  // Delete price records first
  await supabase.from("price_history").delete().eq("product_id", id);

  const { error } = await supabase
    .from("tracked_products")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}

