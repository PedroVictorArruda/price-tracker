"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { formatCurrency, formatPercentage, getPercentageChange, timeAgo } from "@/lib/utils";
import { MARKETPLACE_LABELS, MARKETPLACE_COLORS, type Marketplace } from "@/lib/scrapers";
import {
  TrendingDown,
  TrendingUp,
  Minus,
  Plus,
  Bell,
  LogOut,
  ExternalLink,
  Trash2,
  Loader2,
  Search,
  Package,
  AlertTriangle,
  ArrowDown,
  ArrowUp,
  X,
  ChevronDown,
  LayoutGrid,
  List,
  RefreshCw,
} from "lucide-react";
import PriceChart from "./price-chart";

interface Product {
  id: string;
  url: string;
  title: string;
  imageUrl: string | null;
  marketplace: string;
  targetPrice: number | null;
  createdAt: string;
  currentPrice: number | null;
  previousPrice: number | null;
  lowestPrice: number | null;
  highestPrice: number | null;
  availability: string;
  priceHistory: { price: number; date: string }[];
}

interface DashboardClientProps {
  products: Product[];
  userName: string;
}

export default function DashboardClient({ products: initialProducts, userName }: DashboardClientProps) {
  const router = useRouter();
  const supabase = createClient();
  const [isPending, startTransition] = useTransition();

  const [products, setProducts] = useState(initialProducts);
  const [showAddDialog, setShowAddDialog] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [search, setSearch] = useState("");
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [sortBy, setSortBy] = useState<"recent" | "price-asc" | "price-desc" | "change">("recent");

  // Add Product Form State
  const [newUrl, setNewUrl] = useState("");
  const [newTargetPrice, setNewTargetPrice] = useState("");
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState("");

  // Delete State
  const [deleteId, setDeleteId] = useState<string | null>(null);

  // Filtered & Sorted Products
  const filtered = products
    .filter((p) => p.title.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => {
      switch (sortBy) {
        case "price-asc": return (a.currentPrice || 0) - (b.currentPrice || 0);
        case "price-desc": return (b.currentPrice || 0) - (a.currentPrice || 0);
        case "change":
          return Math.abs(getPercentageChange(b.currentPrice || 0, b.previousPrice || 0)) -
            Math.abs(getPercentageChange(a.currentPrice || 0, a.previousPrice || 0));
        default: return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      }
    });

  // Stats
  const totalProducts = products.length;
  const priceDrops = products.filter(
    (p) => p.currentPrice && p.previousPrice && p.currentPrice < p.previousPrice
  ).length;
  const atTarget = products.filter(
    (p) => p.targetPrice && p.currentPrice && p.currentPrice <= p.targetPrice
  ).length;

  async function handleAddProduct(e: React.FormEvent) {
    e.preventDefault();
    setAddLoading(true);
    setAddError("");

    try {
      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: newUrl,
          targetPrice: newTargetPrice ? parseFloat(newTargetPrice) : null,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao adicionar produto");

      setNewUrl("");
      setNewTargetPrice("");
      setShowAddDialog(false);
      startTransition(() => router.refresh());
    } catch (err: any) {
      setAddError(err.message);
    } finally {
      setAddLoading(false);
    }
  }

  async function handleDelete(productId: string) {
    setDeleteId(productId);
    try {
      await fetch(`/api/products?id=${productId}`, { method: "DELETE" });
      setProducts((prev) => prev.filter((p) => p.id !== productId));
      if (selectedProduct?.id === productId) setSelectedProduct(null);
    } finally {
      setDeleteId(null);
    }
  }

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  function PriceChangeIndicator({ current, previous }: { current: number | null; previous: number | null }) {
    if (!current || !previous) return <Minus className="w-3 h-3 text-muted-foreground" />;
    const change = getPercentageChange(current, previous);
    if (change < 0) return (
      <span className="flex items-center gap-0.5 text-emerald-500 text-xs font-medium">
        <ArrowDown className="w-3 h-3" />
        {Math.abs(change).toFixed(1)}%
      </span>
    );
    if (change > 0) return (
      <span className="flex items-center gap-0.5 text-red-500 text-xs font-medium">
        <ArrowUp className="w-3 h-3" />
        {change.toFixed(1)}%
      </span>
    );
    return <Minus className="w-3 h-3 text-muted-foreground" />;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-border/50 backdrop-blur-xl bg-background/80">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center">
              <TrendingDown className="w-4 h-4 text-white" />
            </div>
            <span className="text-lg font-bold hidden sm:inline">PriceWatch</span>
          </div>

          <div className="flex items-center gap-3">
            <span className="text-sm text-muted-foreground hidden sm:inline">
              Olá, {userName.split(" ")[0]}
            </span>
            <button
              onClick={handleLogout}
              className="p-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
              title="Sair"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="p-4 rounded-2xl border border-border/50 bg-card">
            <div className="flex items-center gap-2 text-muted-foreground text-xs mb-1">
              <Package className="w-3.5 h-3.5" />
              Produtos
            </div>
            <div className="text-2xl font-bold">{totalProducts}</div>
          </div>
          <div className="p-4 rounded-2xl border border-border/50 bg-card">
            <div className="flex items-center gap-2 text-emerald-500 text-xs mb-1">
              <TrendingDown className="w-3.5 h-3.5" />
              Quedas
            </div>
            <div className="text-2xl font-bold text-emerald-500">{priceDrops}</div>
          </div>
          <div className="p-4 rounded-2xl border border-border/50 bg-card">
            <div className="flex items-center gap-2 text-amber-500 text-xs mb-1">
              <Bell className="w-3.5 h-3.5" />
              No Alvo
            </div>
            <div className="text-2xl font-bold text-amber-500">{atTarget}</div>
          </div>
        </div>

        {/* Toolbar */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Buscar produtos..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
            />
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="appearance-none pl-3 pr-8 py-2.5 rounded-xl border border-border bg-card text-sm focus:outline-none cursor-pointer"
              >
                <option value="recent">Mais recente</option>
                <option value="price-asc">Menor preço</option>
                <option value="price-desc">Maior preço</option>
                <option value="change">Maior variação</option>
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            </div>

            <div className="flex p-1 rounded-xl border border-border bg-card">
              <button
                onClick={() => setViewMode("grid")}
                className={`p-1.5 rounded-lg transition-colors ${viewMode === "grid" ? "bg-muted" : ""}`}
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`p-1.5 rounded-lg transition-colors ${viewMode === "list" ? "bg-muted" : ""}`}
              >
                <List className="w-4 h-4" />
              </button>
            </div>

            <button
              onClick={() => setShowAddDialog(true)}
              className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-xl font-medium text-sm hover:bg-primary/90 transition-colors shadow-md shadow-emerald-500/10"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Adicionar</span>
            </button>
          </div>
        </div>

        {/* Products Grid/List */}
        {filtered.length === 0 ? (
          <div className="text-center py-20">
            <Package className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">
              {search ? "Nenhum produto encontrado" : "Nenhum produto adicionado"}
            </h3>
            <p className="text-muted-foreground text-sm mb-4">
              {search
                ? "Tente outra busca."
                : "Adicione a URL de um produto para começar a rastrear."}
            </p>
            {!search && (
              <button
                onClick={() => setShowAddDialog(true)}
                className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-xl font-medium text-sm"
              >
                <Plus className="w-4 h-4" />
                Adicionar Produto
              </button>
            )}
          </div>
        ) : (
          <div className={viewMode === "grid"
            ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
            : "space-y-3"
          }>
            {filtered.map((product, i) => (
              <div
                key={product.id}
                onClick={() => setSelectedProduct(product)}
                className={`group cursor-pointer rounded-2xl border border-border/50 bg-card hover:border-primary/30 transition-all duration-300 hover:shadow-lg hover:shadow-emerald-500/5 animate-fade-in-up stagger-${Math.min(i + 1, 5)} ${
                  viewMode === "list" ? "flex items-center gap-4 p-4" : "p-5"
                }`}
              >
                {/* Image */}
                {viewMode === "grid" && product.imageUrl && (
                  <div className="w-full h-40 rounded-xl bg-muted/30 mb-4 flex items-center justify-center overflow-hidden">
                    <img
                      src={product.imageUrl}
                      alt={product.title}
                      className="max-h-full max-w-full object-contain p-2"
                    />
                  </div>
                )}
                {viewMode === "list" && product.imageUrl && (
                  <div className="w-16 h-16 rounded-xl bg-muted/30 flex-shrink-0 flex items-center justify-center overflow-hidden">
                    <img src={product.imageUrl} alt="" className="max-h-full max-w-full object-contain p-1" />
                  </div>
                )}

                <div className={viewMode === "list" ? "flex-1 min-w-0" : ""}>
                  {/* Marketplace Badge */}
                  <div className="flex items-center justify-between mb-2">
                    <span
                      className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md"
                      style={{
                        color: MARKETPLACE_COLORS[product.marketplace as Marketplace] || "#888",
                        backgroundColor: `${MARKETPLACE_COLORS[product.marketplace as Marketplace] || "#888"}15`,
                      }}
                    >
                      {MARKETPLACE_LABELS[product.marketplace as Marketplace] || product.marketplace}
                    </span>
                    <PriceChangeIndicator current={product.currentPrice} previous={product.previousPrice} />
                  </div>

                  {/* Title */}
                  <h3 className="text-sm font-medium line-clamp-2 mb-3 group-hover:text-foreground transition-colors">
                    {product.title}
                  </h3>

                  {/* Price */}
                  <div className="flex items-end justify-between">
                    <div>
                      {product.currentPrice ? (
                        <div className="text-xl font-bold">
                          {formatCurrency(product.currentPrice)}
                        </div>
                      ) : (
                        <div className="text-sm text-muted-foreground">Preço indisponível</div>
                      )}
                      {product.lowestPrice && product.currentPrice && product.lowestPrice < product.currentPrice && (
                        <div className="text-[10px] text-muted-foreground mt-0.5">
                          Menor: {formatCurrency(product.lowestPrice)}
                        </div>
                      )}
                    </div>

                    {product.targetPrice && (
                      <div className={`text-[10px] px-2 py-1 rounded-lg ${
                        product.currentPrice && product.currentPrice <= product.targetPrice
                          ? "bg-emerald-500/10 text-emerald-500"
                          : "bg-muted text-muted-foreground"
                      }`}>
                        Alvo: {formatCurrency(product.targetPrice)}
                      </div>
                    )}
                  </div>
                </div>

                {/* List View Actions */}
                {viewMode === "list" && (
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <a
                      href={product.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </a>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(product.id); }}
                      disabled={deleteId === product.id}
                      className="p-2 rounded-lg text-muted-foreground hover:text-red-500 hover:bg-red-500/10 transition-colors"
                    >
                      {deleteId === product.id ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Add Product Dialog */}
      {showAddDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl shadow-black/40 animate-fade-in-up">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold">Adicionar Produto</h2>
              <button
                onClick={() => { setShowAddDialog(false); setAddError(""); }}
                className="p-1.5 rounded-lg hover:bg-muted transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {addError && (
              <div className="mb-4 p-3 rounded-xl text-sm bg-destructive/10 text-destructive border border-destructive/20 flex items-start gap-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                {addError}
              </div>
            )}

            <form onSubmit={handleAddProduct} className="space-y-4">
              <div>
                <label className="text-sm font-medium text-muted-foreground mb-1.5 block">
                  URL do Produto *
                </label>
                <input
                  type="url"
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  placeholder="https://www.amazon.com.br/dp/..."
                  required
                  className="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                />
                <p className="text-[10px] text-muted-foreground mt-1">
                  Amazon, Magalu, Americanas, Casas Bahia, KaBuM!, Ponto, Shopee, ou Mercado Livre
                </p>
              </div>

              <div>
                <label className="text-sm font-medium text-muted-foreground mb-1.5 block">
                  Preço Alvo (opcional)
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
                  <input
                    type="number"
                    value={newTargetPrice}
                    onChange={(e) => setNewTargetPrice(e.target.value)}
                    placeholder="0,00"
                    step="0.01"
                    min="0"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                  />
                </div>
                <p className="text-[10px] text-muted-foreground mt-1">
                  Receba alerta quando o preço atingir esse valor
                </p>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => { setShowAddDialog(false); setAddError(""); }}
                  className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={addLoading}
                  className="flex-1 flex items-center justify-center gap-2 bg-primary text-primary-foreground py-2.5 rounded-xl text-sm font-semibold hover:bg-primary/90 transition-all disabled:opacity-50"
                >
                  {addLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <>
                      <Plus className="w-4 h-4" />
                      Adicionar
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Product Detail Drawer */}
      {selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-start justify-end">
          <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setSelectedProduct(null)} />
          <div className="relative w-full max-w-lg h-full bg-card border-l border-border overflow-y-auto shadow-2xl shadow-black/40">
            {/* Close */}
            <div className="sticky top-0 z-10 bg-card/80 backdrop-blur-xl border-b border-border/50 p-4 flex items-center justify-between">
              <h2 className="text-base font-semibold">Detalhes do Produto</h2>
              <button
                onClick={() => setSelectedProduct(null)}
                className="p-1.5 rounded-lg hover:bg-muted transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-4 space-y-6">
              {/* Product Image */}
              {selectedProduct.imageUrl && (
                <div className="w-full h-52 rounded-2xl bg-muted/30 flex items-center justify-center overflow-hidden">
                  <img
                    src={selectedProduct.imageUrl}
                    alt={selectedProduct.title}
                    className="max-h-full max-w-full object-contain p-3"
                  />
                </div>
              )}

              {/* Title & Marketplace */}
              <div>
                <span
                  className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md inline-block mb-2"
                  style={{
                    color: MARKETPLACE_COLORS[selectedProduct.marketplace as Marketplace],
                    backgroundColor: `${MARKETPLACE_COLORS[selectedProduct.marketplace as Marketplace]}15`,
                  }}
                >
                  {MARKETPLACE_LABELS[selectedProduct.marketplace as Marketplace]}
                </span>
                <h3 className="text-base font-semibold leading-snug">{selectedProduct.title}</h3>
              </div>

              {/* Price Info */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl border border-border/50 bg-muted/30">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Atual</div>
                  <div className="text-lg font-bold">
                    {selectedProduct.currentPrice ? formatCurrency(selectedProduct.currentPrice) : "—"}
                  </div>
                </div>
                <div className="p-3 rounded-xl border border-border/50 bg-muted/30">
                  <div className="text-[10px] text-muted-foreground uppercase tracking-wider mb-1">Variação</div>
                  <div className="text-lg font-bold">
                    <PriceChangeIndicator current={selectedProduct.currentPrice} previous={selectedProduct.previousPrice} />
                  </div>
                </div>
                <div className="p-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5">
                  <div className="text-[10px] text-emerald-500 uppercase tracking-wider mb-1">Menor</div>
                  <div className="text-lg font-bold text-emerald-500">
                    {selectedProduct.lowestPrice ? formatCurrency(selectedProduct.lowestPrice) : "—"}
                  </div>
                </div>
                <div className="p-3 rounded-xl border border-red-500/20 bg-red-500/5">
                  <div className="text-[10px] text-red-500 uppercase tracking-wider mb-1">Maior</div>
                  <div className="text-lg font-bold text-red-500">
                    {selectedProduct.highestPrice ? formatCurrency(selectedProduct.highestPrice) : "—"}
                  </div>
                </div>
              </div>

              {/* Target Price */}
              {selectedProduct.targetPrice && (
                <div className={`p-3 rounded-xl border ${
                  selectedProduct.currentPrice && selectedProduct.currentPrice <= selectedProduct.targetPrice
                    ? "border-emerald-500/30 bg-emerald-500/10"
                    : "border-amber-500/30 bg-amber-500/10"
                }`}>
                  <div className="flex items-center gap-2">
                    <Bell className={`w-4 h-4 ${
                      selectedProduct.currentPrice && selectedProduct.currentPrice <= selectedProduct.targetPrice
                        ? "text-emerald-500"
                        : "text-amber-500"
                    }`} />
                    <span className="text-sm font-medium">
                      Alvo: {formatCurrency(selectedProduct.targetPrice)}
                    </span>
                    {selectedProduct.currentPrice && selectedProduct.currentPrice <= selectedProduct.targetPrice && (
                      <span className="text-xs text-emerald-500 font-medium ml-auto">✓ Atingido!</span>
                    )}
                  </div>
                </div>
              )}

              {/* Price Chart */}
              {selectedProduct.priceHistory.length > 1 && (
                <div>
                  <h4 className="text-sm font-semibold mb-3">Histórico de Preço</h4>
                  <div className="rounded-xl border border-border/50 bg-muted/20 p-4">
                    <PriceChart data={selectedProduct.priceHistory} />
                  </div>
                </div>
              )}

              {/* Actions */}
              <div className="flex gap-3 pt-2">
                <a
                  href={selectedProduct.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex-1 flex items-center justify-center gap-2 bg-primary text-primary-foreground py-2.5 rounded-xl text-sm font-semibold hover:bg-primary/90 transition-all"
                >
                  <ExternalLink className="w-4 h-4" />
                  Ver na Loja
                </a>
                <button
                  onClick={() => handleDelete(selectedProduct.id)}
                  disabled={deleteId === selectedProduct.id}
                  className="px-4 py-2.5 rounded-xl border border-red-500/30 text-red-500 hover:bg-red-500/10 text-sm font-medium transition-all"
                >
                  {deleteId === selectedProduct.id ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Trash2 className="w-4 h-4" />
                  )}
                </button>
              </div>

              {/* Meta info */}
              <div className="text-[10px] text-muted-foreground text-center pb-4">
                Adicionado {timeAgo(selectedProduct.createdAt)} · {selectedProduct.priceHistory.length} registros de preço
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
