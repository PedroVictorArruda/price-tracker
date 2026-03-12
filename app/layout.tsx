import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "PriceWatch — Rastreador de Preços Brasileiro",
  description:
    "Acompanhe preços de produtos nos maiores marketplaces do Brasil. Receba alertas de queda de preço. Amazon, Magalu, Americanas, KaBuM! e mais.",
  keywords: ["rastreador de preços", "price tracker", "comparar preços", "Amazon", "Magalu", "KaBuM"],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-BR" className="dark">
      <body className="min-h-screen bg-background">
        {children}
      </body>
    </html>
  );
}
