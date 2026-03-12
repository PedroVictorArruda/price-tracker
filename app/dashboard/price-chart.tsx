"use client";

import { useMemo } from "react";
import { formatCurrency } from "@/lib/utils";

interface PriceChartProps {
  data: { price: number; date: string }[];
}

export default function PriceChart({ data }: PriceChartProps) {
  const chartData = useMemo(() => {
    if (data.length < 2) return null;

    const prices = data.map((d) => d.price);
    const minPrice = Math.min(...prices);
    const maxPrice = Math.max(...prices);
    const range = maxPrice - minPrice || 1;
    const padding = range * 0.1;

    const width = 400;
    const height = 160;
    const marginY = 20;
    const marginX = 15;
    const chartW = width - marginX * 2;
    const chartH = height - marginY * 2;

    const points = data.map((d, i) => {
      const x = marginX + (i / (data.length - 1)) * chartW;
      const y = marginY + chartH - ((d.price - minPrice + padding) / (range + padding * 2)) * chartH;
      return { x, y, price: d.price, date: d.date };
    });

    const pathD = points
      .map((p, i) => `${i === 0 ? "M" : "L"} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
      .join(" ");

    // Area fill
    const areaD = `${pathD} L ${points[points.length - 1].x.toFixed(1)} ${height - marginY} L ${points[0].x.toFixed(1)} ${height - marginY} Z`;

    // Color based on trend
    const isDown = points[points.length - 1].y > points[0].y;
    const strokeColor = isDown ? "#10b981" : "#ef4444";
    const fillColor = isDown ? "#10b981" : "#ef4444";

    return { points, pathD, areaD, width, height, strokeColor, fillColor, minPrice, maxPrice };
  }, [data]);

  if (!chartData) return <div className="text-xs text-muted-foreground text-center py-8">Dados insuficientes</div>;

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${chartData.width} ${chartData.height}`}
        className="w-full h-auto"
        preserveAspectRatio="xMidYMid meet"
      >
        <defs>
          <linearGradient id="areaGradient" x1="0" x2="0" y1="0" y2="1">
            <stop offset="0%" stopColor={chartData.fillColor} stopOpacity="0.2" />
            <stop offset="100%" stopColor={chartData.fillColor} stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Area */}
        <path d={chartData.areaD} fill="url(#areaGradient)" />

        {/* Line */}
        <path d={chartData.pathD} fill="none" stroke={chartData.strokeColor} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

        {/* Points */}
        {chartData.points.map((p, i) => (
          <circle
            key={i}
            cx={p.x}
            cy={p.y}
            r={i === 0 || i === chartData.points.length - 1 ? 3.5 : 2}
            fill={chartData.strokeColor}
            stroke="var(--background)"
            strokeWidth="1.5"
          />
        ))}
      </svg>

      {/* Labels */}
      <div className="flex items-center justify-between text-[10px] text-muted-foreground mt-2">
        <span>{new Date(data[0].date).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}</span>
        <span className="text-xs font-medium" style={{ color: chartData.strokeColor }}>
          {formatCurrency(data[data.length - 1].price)}
        </span>
        <span>{new Date(data[data.length - 1].date).toLocaleDateString("pt-BR", { day: "2-digit", month: "short" })}</span>
      </div>
    </div>
  );
}
