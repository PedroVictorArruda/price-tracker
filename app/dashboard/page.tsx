import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import DashboardClient from "./dashboard-client";

export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: products } = await supabase
    .from("tracked_products")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  const transformedProducts = (products || []).map((product: any) => ({
    id: product.id,
    url: product.url,
    title: product.title,
    imageUrl: product.image_url,
    marketplace: product.marketplace,
    targetPrice: product.target_price,
    createdAt: product.created_at,
    currentPrice: product.current_price,
    previousPrice: null,
    lowestPrice: product.lowest_price,
    highestPrice: product.highest_price,
    availability: "in_stock",
    priceHistory: [],
  }));

  return <DashboardClient products={transformedProducts} userName={user.user_metadata?.full_name || user.email || "Usuario"} />;
}