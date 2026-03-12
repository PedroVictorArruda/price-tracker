import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { detectMarketplace, scrapeProduct, MARKETPLACE_LABELS } from "@/lib/scrapers";

/**
 * POST /api/products - Add a new product to track
 */
export async function POST(request: Request) {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  try {
    const body = await request.json();
    const { url, targetPrice } = body;

    if (!url) {
      return NextResponse.json({ error: "URL é obrigatória" }, { status: 400 });
    }

    // Detect marketplace
    const marketplace = detectMarketplace(url);
    if (!marketplace) {
      return NextResponse.json(
        { error: "Marketplace não suportado. Use Amazon, Magalu, Americanas, Casas Bahia, KaBuM!, Ponto, Shopee ou Mercado Livre." },
        { status: 400 }
      );
    }

    // Check if user already tracks this URL
    const { data: existing } = await supabase
      .from("products")
      .select("id")
      .eq("user_id", user.id)
      .eq("url", url)
      .single();

    if (existing) {
      return NextResponse.json({ error: "Você já está rastreando este produto." }, { status: 409 });
    }

    // Scrape product info using existing scraper
    const result = await scrapeProduct(url);

    let title = `Produto ${MARKETPLACE_LABELS[marketplace]}`;
    let price: number | null = null;
    let imageUrl: string | null = null;
    let availability: string = "unknown";

    if (result.success && result.data) {
      title = result.data.title;
      price = result.data.price;
      imageUrl = result.data.imageUrl;
      availability = result.data.availability;
    }

    // Insert product
    const { data: product, error: insertError } = await supabase
      .from("products")
      .insert({
        user_id: user.id,
        url,
        title,
        image_url: imageUrl,
        marketplace,
        target_price: targetPrice || null,
      })
      .select()
      .single();

    if (insertError) throw insertError;

    // Insert first price record if we got a price
    if (price) {
      await supabase.from("price_records").insert({
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
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "ID é obrigatório" }, { status: 400 });
  }

  // Delete price records first
  await supabase.from("price_records").delete().eq("product_id", id);

  const { error } = await supabase
    .from("products")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
