import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import DashboardClient from "./dashboard-client";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  // Fetch user's products with latest price
  const { data: products } = await supabase
    .from("products")
    .select(`
      id,
      url,
      title,
      image_url,
      marketplace,
      target_price,
      created_at,
      price_records (
        price,
        availability,
        created_at
      )
    `)
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  // Transform data for client
  const transformedProducts = (products || []).map((product: any) => {
    const records = product.price_records || [];
    const sorted = [...records].sort(
      (a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    const currentPrice = sorted[0]?.price || null;
    const previousPrice = sorted[1]?.price || null;
    const lowestPrice = records.length > 0
      ? Math.min(...records.map((r: any) => r.price))
      : null;
    const highestPrice = records.length > 0
      ? Math.max(...records.map((r: any) => r.price))
      : null;

    return {
      id: product.id,
      url: product.url,
      title: product.title,
      imageUrl: product.image_url,
      marketplace: product.marketplace,
      targetPrice: product.target_price,
      createdAt: product.created_at,
      currentPrice,
      previousPrice,
      lowestPrice,
      highestPrice,
      availability: sorted[0]?.availability || "in_stock",
      priceHistory: sorted.reverse().map((r: any) => ({
        price: r.price,
        date: r.created_at,
      })),
    };
  });

  return <DashboardClient products={transformedProducts} userName={user.user_metadata?.full_name || user.email || "Usuário"} />;
}
