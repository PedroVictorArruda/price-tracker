import Link from "next/link";
import { TrendingDown, TrendingUp, Minus } from "lucide-react";

export interface ProductCardProps {
  id: string | number;
  title: string;
  imageUrl: string;
  marketplace: string;
  currentPrice: number;
  variationPercentage: number;
}

export function ProductCard({
  id,
  title,
  imageUrl,
  marketplace,
  currentPrice,
  variationPercentage,
}: ProductCardProps) {
  const isDrop = variationPercentage < 0;
  const isIncrease = variationPercentage > 0;
  
  // Formatando para Moeda Brasileira (BRL)
  const formattedPrice = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(currentPrice);

  // Formatando a porcentagem (absoluto para não ter dois sinais de menos)
  const formattedVariation = `${Math.abs(variationPercentage).toFixed(2)}%`;

  return (
    <Link href={`/dashboard/product/${id}`} className="group block focus:outline-none focus:ring-2 focus:ring-blue-500 rounded-2xl">
      <div className="flex flex-col h-full overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-sm transition-all hover:shadow-md dark:border-zinc-800 dark:bg-zinc-950 hover:border-blue-500/50 dark:hover:border-blue-500/50">
        
        {/* Contêiner da Imagem */}
        <div className="relative aspect-square w-full overflow-hidden bg-zinc-50 dark:bg-zinc-900 p-4 shrink-0 flex items-center justify-center">
          {/* Badge do Marketplace */}
          <div className="absolute right-3 top-3 z-10 rounded-full bg-white/90 px-2.5 py-1 text-xs font-semibold text-zinc-800 shadow-sm backdrop-blur-md dark:bg-zinc-950/90 dark:text-zinc-200 border border-zinc-100 dark:border-zinc-800">
            {marketplace}
          </div>
          
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt={title}
            className="h-full w-full object-contain mix-blend-multiply dark:mix-blend-normal transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
        </div>

        {/* Conteúdo do Card */}
        <div className="flex flex-1 flex-col p-4 justify-between gap-4">
          {/* Título (Truncado em 2 linhas) */}
          <h3
            className="line-clamp-2 text-sm font-medium text-zinc-900 dark:text-zinc-100 leading-snug"
            title={title}
          >
            {title}
          </h3>

          <div className="flex items-end justify-between gap-2 mt-auto">
            {/* Preço Atual */}
            <div className="flex flex-col">
              <span className="text-xs text-zinc-500 dark:text-zinc-400 mb-0.5">Preço atual</span>
              <span className="text-lg md:text-xl font-bold text-zinc-900 dark:text-white leading-none">
                {formattedPrice}
              </span>
            </div>

            {/* Variação Percentual */}
            <div 
              title={isDrop ? "Preço caiu" : isIncrease ? "Preço subiu" : "Preço estável"}
              className={`flex items-center gap-1 rounded-full px-2 py-1 text-xs font-semibold shrink-0 ${
                isDrop 
                  ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-400" 
                  : isIncrease 
                    ? "bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-400"
                    : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
              }`}
            >
              {isDrop ? (
                <TrendingDown className="h-3.5 w-3.5" />
              ) : isIncrease ? (
                <TrendingUp className="h-3.5 w-3.5" />
              ) : (
                <Minus className="h-3.5 w-3.5" />
              )}
              <span>{formattedVariation}</span>
            </div>
          </div>
        </div>
      </div>
    </Link>
  );
}
