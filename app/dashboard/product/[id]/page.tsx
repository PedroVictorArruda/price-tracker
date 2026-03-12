import { notFound } from "next/navigation";
import PriceChart from "@/components/price-chart";
import { PriceTimeline } from "@/components/price-timeline";
import { ProductSettings } from "@/components/product-settings";
import { PriceAlertForm } from "@/components/price-alert-form";

export default async function ProductDetailPage({ params }: { params: { id: string } }) {
  // Mock data for display purposes
  const product = {
    id: params.id,
    title: "Produto de Exemplo",
    image: "https://via.placeholder.com/400",
    currentPrice: 199.90,
    marketplace: "Insider",
    url: "https://insider.com.br/produto",
    interval: "12h"
  };

  const history = [
    { id: "1", date: new Date().toISOString(), price: 199.90, variation: -5.0 },
    { id: "2", date: new Date(Date.now() - 86400000).toISOString(), price: 210.42, variation: 10.0 },
    { id: "3", date: new Date(Date.now() - 172800000).toISOString(), price: 191.29, variation: 0 },
  ];

  if (!product) return notFound();

  return (
    <div className="max-w-7xl mx-auto p-6 flex flex-col gap-8">
      <div className="flex flex-col md:flex-row gap-6 bg-white p-6 rounded-lg border shadow-sm">
        <img src={product.image} alt={product.title} className="w-full md:w-1/3 object-cover rounded-md" />
        <div className="flex flex-col gap-4">
          <h1 className="text-2xl font-bold">{product.title}</h1>
          <a href={product.url} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline text-sm">
            Ver produto na loja
          </a>
          <div className="mt-2 text-sm text-gray-500 bg-gray-100 px-2 py-1 rounded inline-block w-fit">
            {product.marketplace}
          </div>
          <div className="mt-4">
            <p className="text-sm text-gray-500">Preço atual</p>
            <p className="text-4xl font-bold text-green-600">
              {new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(product.currentPrice)}
            </p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        <div className="md:col-span-2 flex flex-col gap-8">
          <div className="bg-white p-6 rounded-lg border shadow-sm">
            <h3 className="text-lg font-semibold mb-4">Gráfico de Preços</h3>
            <PriceChart data={history} />
          </div>
          
          <div className="bg-white p-6 rounded-lg border shadow-sm">
            <PriceTimeline history={history} />
          </div>
        </div>

        <div className="flex flex-col gap-6">
          <PriceAlertForm productId={product.id} currentPrice={product.currentPrice} />
          <ProductSettings product={product} />
        </div>
      </div>
    </div>
  );
}
