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
  Edit2,
  Check,
  Info
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

const formatCurrencyInput = (value: string) => {
  const digits = value.replace(/\D/g, "");
  if (!digits) return "";
  const number = parseInt(digits, 10) / 100;
  return new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(number);
};

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

  // Edit Target Price State
  const [isEditingTarget, setIsEditingTarget] = useState(false);
  const [editTargetValue, setEditTargetValue] = useState("");
  const [updateLoading, setUpdateLoading] = useState(false);

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
      // Limpa a máscara do novo preço alvo antes de enviar
      const rawValue = newTargetPrice.replace(/\./g, "").replace(",", ".");
      const parsedTarget = rawValue ? parseFloat(rawValue) : null;

      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: newUrl,
          targetPrice: parsedTarget,
        }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro ao adicionar produto");

      const newProduct: Product = {
        id: data.product.id,
        url: data.product.url,
        title: data.product.title,
        imageUrl: data.product.image_url,
        marketplace: data.product.marketplace,
        targetPrice: data.product.target_price,
        createdAt: data.product.created_at,
        currentPrice: data.price ?? data.product.current_price ?? null,
        previousPrice: null,
        lowestPrice: data.price ?? data.product.lowest_price ?? null,
        highestPrice: data.price ?? data.product.highest_price ?? null,
        availability: "in_stock",
        priceHistory: [],
      };
      setProducts((prev) => [newProduct, ...prev]);

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

  async function handleUpdateTarget() {
    if (!selectedProduct) return;
    setUpdateLoading(true);
    try {
      const rawValue = editTargetValue.replace(/\./g, "").replace(",", ".");
      const parsedValue = rawValue ? parseFloat(rawValue) : null;

      const res = await fetch("/api/products", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: selectedProduct.id, targetPrice: parsedValue }),
      });

      if (!res.ok) throw new Error("Erro ao atualizar alvo");

      setProducts(prev => prev.map(p => p.id === selectedProduct.id ? { ...p, targetPrice: parsedValue } : p));
      setSelectedProduct({ ...selectedProduct, targetPrice: parsedValue });
      setIsEditingTarget(false);
    } catch (error) {
      console.error(error);
      alert("Erro ao atualizar o preço alvo.");
    } finally {
      setUpdateLoading(false);
    }
  }

  async function handleRemoveTarget() {
    if (!selectedProduct) return;
    setUpdateLoading(true);
    try {
      const res = await fetch("/api/products", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        // Enviando null para o banco de dados para apagar o alerta
        body: JSON.stringify({ id: selectedProduct.id, targetPrice: null }),
      });

      if (!res.ok) throw new Error("Erro ao remover alerta");

      // Atualiza a interface instantaneamente
      setProducts(prev => prev.map(p => p.id === selectedProduct.id ? { ...p, targetPrice: null } : p));
      setSelectedProduct({ ...selectedProduct, targetPrice: null });
      setIsEditingTarget(false);
      setEditTargetValue("");
    } catch (error) {
      console.error(error);
      alert("Erro ao remover o alerta.");
    } finally {
      setUpdateLoading(false);
    }
  }

  function openProductModal(product: Product) {
    setSelectedProduct(product);
    setEditTargetValue(product.targetPrice ? formatCurrencyInput((product.targetPrice * 100).toFixed(0)) : "");
    setIsEditingTarget(false);
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

  // --- Helpers para o Termômetro do Zoom ---
  const getThermometerPosition = (current: number, min: number, max: number) => {
    if (max === min) return 50; // No meio se não houver variação ainda
    const position = ((current - min) / (max - min)) * 100;
    return Math.max(0, Math.min(100, position)); // Limita entre 0 e 100
  };

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
                onClick={() => openProductModal(product)}
                className={`group cursor-pointer rounded-2xl border border-border/50 bg-card hover:border-primary/30 transition-all duration-300 hover:shadow-lg hover:shadow-emerald-500/5 animate-fade-in-up stagger-${Math.min(i + 1, 5)} ${viewMode === "list" ? "flex items-center gap-4 p-4" : "p-5"
                  }`}
              >
                {/* Image */}
                {viewMode === "grid" && product.imageUrl && (
                  <div className="w-full h-40 rounded-xl bg-white mb-4 flex items-center justify-center overflow-hidden relative">
                    <img
                      src={product.imageUrl}
                      alt={product.title}
                      className="max-h-full max-w-full object-contain p-2 mix-blend-multiply"
                    />
                  </div>
                )}
                {viewMode === "list" && product.imageUrl && (
                  <div className="w-16 h-16 rounded-xl bg-white flex-shrink-0 flex items-center justify-center overflow-hidden">
                    <img src={product.imageUrl} alt="" className="max-h-full max-w-full object-contain p-1 mix-blend-multiply" />
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
                      {product.availability === "out_of_stock" || product.currentPrice === 0 ? (
                        <p className="text-base sm:text-lg font-semibold text-red-500/90 mt-2">
                          Não disponível.
                        </p>
                      ) : (
                        <>
                          <div className="text-xl font-bold">
                            {formatCurrency(product.currentPrice!)}
                          </div>
                          {product.lowestPrice && product.lowestPrice < product.currentPrice! && (
                            <div className="text-[10px] text-muted-foreground mt-0.5">
                              Menor: {formatCurrency(product.lowestPrice)}
                            </div>
                          )}
                        </>
                      )}
                    </div>

                    {product.targetPrice && (
                      <div className={`text-[10px] px-2 py-1 rounded-lg ${product.currentPrice && product.currentPrice <= product.targetPrice && product.availability !== "out_of_stock"
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
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl shadow-black/40 animate-fade-in-up">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-semibold">Adicionar Produto</h2>
              <button onClick={() => { setShowAddDialog(false); setAddError(""); }} className="p-1.5 rounded-lg hover:bg-muted transition-colors">
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
                <label className="text-sm font-medium text-muted-foreground mb-1.5 block">URL do Produto *</label>
                <input
                  type="url"
                  value={newUrl}
                  onChange={(e) => setNewUrl(e.target.value)}
                  placeholder="https://www.amazon.com.br/dp/..."
                  required
                  className="w-full px-4 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                />
              </div>
              <div>
                <label className="text-sm font-medium text-muted-foreground mb-1.5 block">Preço Alvo (opcional)</label>
                <div className="relative">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={newTargetPrice}
                    onChange={(e) => setNewTargetPrice(formatCurrencyInput(e.target.value))}
                    placeholder="0,00"
                    className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/50 transition-all"
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-2">
                <button type="button" onClick={() => { setShowAddDialog(false); setAddError(""); }} className="flex-1 py-2.5 rounded-xl border border-border text-sm font-medium hover:bg-muted transition-colors">Cancelar</button>
                <button type="submit" disabled={addLoading} className="flex-1 flex items-center justify-center gap-2 bg-primary text-primary-foreground py-2.5 rounded-xl text-sm font-semibold hover:bg-primary/90 transition-all disabled:opacity-50">
                  {addLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Plus className="w-4 h-4" /> Adicionar</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* NOVO: Modal Centralizado de Detalhes do Produto (Zoom Style) */}
      {selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 lg:p-8 animate-in fade-in duration-200">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-md" onClick={() => setSelectedProduct(null)} />

          <div className="relative w-full max-w-5xl max-h-[90vh] bg-card border border-border/50 rounded-2xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">
            {/* Header Mínimo */}
            <div className="absolute top-4 right-4 z-10">
              <button onClick={() => setSelectedProduct(null)} className="p-2 rounded-full bg-background/80 hover:bg-muted backdrop-blur-sm border border-border text-muted-foreground transition-colors shadow-sm">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="overflow-y-auto flex-1 p-6 lg:p-8 custom-scrollbar">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12">

                {/* LADO ESQUERDO: Imagem e Resumo */}
                <div className="lg:col-span-5 flex flex-col gap-6">
                  {selectedProduct.imageUrl ? (
                    <div className="w-full aspect-square rounded-2xl bg-white border border-border/50 flex items-center justify-center overflow-hidden p-6 relative">
                      {/* Label Marketplace Absolute */}
                      <span className="absolute top-4 left-4 text-[10px] font-bold uppercase tracking-wider px-3 py-1 rounded-full shadow-sm"
                        style={{
                          color: MARKETPLACE_COLORS[selectedProduct.marketplace as Marketplace],
                          backgroundColor: `${MARKETPLACE_COLORS[selectedProduct.marketplace as Marketplace]}15`,
                          border: `1px solid ${MARKETPLACE_COLORS[selectedProduct.marketplace as Marketplace]}30`
                        }}>
                        {MARKETPLACE_LABELS[selectedProduct.marketplace as Marketplace]}
                      </span>
                      <img
                        src={selectedProduct.imageUrl}
                        alt={selectedProduct.title}
                        className="max-h-full max-w-full object-contain mix-blend-multiply"
                      />
                    </div>
                  ) : (
                    <div className="w-full aspect-square rounded-2xl bg-muted border border-border/50 flex items-center justify-center">
                      <Package className="w-16 h-16 text-muted-foreground/30" />
                    </div>
                  )}

                  <div>
                    <h2 className="text-xl font-bold leading-snug mb-4 text-foreground/90">
                      {selectedProduct.title}
                    </h2>

                    {/* Botões de Ação Principais */}
                    <div className="flex gap-3">
                      <a
                        href={selectedProduct.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 flex items-center justify-center gap-2 bg-primary text-primary-foreground py-3.5 rounded-xl text-sm font-semibold hover:bg-primary/90 transition-all shadow-md shadow-primary/20"
                      >
                        Ir à loja <ExternalLink className="w-4 h-4" />
                      </a>
                      <button
                        onClick={() => handleDelete(selectedProduct.id)}
                        disabled={deleteId === selectedProduct.id}
                        className="px-4 py-3.5 rounded-xl border border-destructive/30 text-destructive hover:bg-destructive/10 text-sm font-medium transition-all"
                        title="Remover produto"
                      >
                        {deleteId === selectedProduct.id ? <Loader2 className="w-5 h-5 animate-spin" /> : <Trash2 className="w-5 h-5" />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* LADO DIREITO: Preços, Alerta e Gráfico */}
                <div className="lg:col-span-7 flex flex-col gap-6">

                  {/* Status do Preço Atual */}
                  {selectedProduct.availability === "out_of_stock" || selectedProduct.currentPrice === 0 ? (
                    <div className="p-6 rounded-2xl border border-red-500/30 bg-red-500/5 flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-red-500/10 flex items-center justify-center flex-shrink-0">
                        <AlertTriangle className="w-6 h-6 text-red-500" />
                      </div>
                      <div>
                        <div className="text-xl font-bold text-red-500">Produto Indisponível</div>
                        <div className="text-sm text-muted-foreground mt-1">O estoque esgotou ou o rastreio falhou.</div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-6">

                      {/* CARD 1: Menor Preço Histórico (Zoom Style) */}
                      <div className="p-6 rounded-2xl border border-border/50 bg-card shadow-sm">
                        <div className="flex items-start justify-between mb-4">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <TrendingDown className="w-4 h-4 text-emerald-500" />
                              <h3 className="font-semibold text-foreground">Análise de Preço</h3>
                            </div>
                            <p className="text-sm text-muted-foreground">
                              {selectedProduct.currentPrice === selectedProduct.lowestPrice
                                ? "O produto está no menor preço histórico!"
                                : `O menor preço já registrado foi ${formatCurrency(selectedProduct.lowestPrice || 0)}`}
                            </p>
                          </div>
                          <div className="text-right">
                            <div className="text-sm text-muted-foreground uppercase tracking-wider font-medium">Agora</div>
                            <div className="text-3xl font-bold text-foreground">{formatCurrency(selectedProduct.currentPrice!)}</div>
                          </div>
                        </div>

                        {/* Termômetro */}
                        <div className="mt-8 relative">
                          <div className="flex justify-between text-[10px] text-muted-foreground font-medium mb-2 uppercase px-1">
                            <span>{formatCurrency(selectedProduct.lowestPrice || 0)}</span>
                            <span>{formatCurrency(selectedProduct.highestPrice || 0)}</span>
                          </div>
                          <div className="relative h-2.5 bg-gradient-to-r from-emerald-500 via-yellow-400 to-orange-500 rounded-full">
                            <div
                              className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white border-[3px] border-zinc-900 dark:border-white rounded-full shadow-lg transition-all duration-500"
                              style={{
                                left: `calc(${getThermometerPosition(selectedProduct.currentPrice!, selectedProduct.lowestPrice || 0, selectedProduct.highestPrice || 0)}% - 8px)`
                              }}
                            >
                              <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-foreground text-background text-[10px] font-bold py-0.5 px-2 rounded whitespace-nowrap">
                                Você está aqui
                                {/* Tooltip triangle */}
                                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-foreground"></div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* CARD 2: Alerta de Preço (Zoom Style Edit) */}
                      <div className="p-6 rounded-2xl border border-border/50 bg-card shadow-sm">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                          <div className="flex items-start gap-3">
                            <div className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ${selectedProduct.targetPrice ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>
                              <Bell className="w-5 h-5" />
                            </div>
                            <div>
                              <h3 className="font-semibold text-foreground">Quer pagar mais barato?</h3>
                              <p className="text-sm text-muted-foreground">
                                {selectedProduct.targetPrice
                                  ? `Avisaremos quando baixar de ${formatCurrency(selectedProduct.targetPrice)}`
                                  : "Defina um valor para receber um alerta"}
                              </p>
                            </div>
                          </div>

                          {/* Área de Edição */}
                          {isEditingTarget ? (
                            <div className="flex items-center gap-2 w-full sm:w-auto">
                              <div className="relative flex-1 sm:w-32">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">R$</span>
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  value={editTargetValue}
                                  onChange={(e) => setEditTargetValue(formatCurrencyInput(e.target.value))}
                                  placeholder="0,00"
                                  className="w-full pl-8 pr-3 py-2 rounded-lg border border-primary/50 bg-background text-sm focus:outline-none focus:ring-1 focus:ring-primary"
                                />
                              </div>

                              {/* Salvar */}
                              <button onClick={handleUpdateTarget} disabled={updateLoading} title="Salvar Alerta" className="p-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors">
                                {updateLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                              </button>

                              {/* Remover Alerta (Só aparece se já existir um alerta) */}
                              {selectedProduct.targetPrice && (
                                <button
                                  onClick={handleRemoveTarget}
                                  disabled={updateLoading}
                                  title="Remover Alerta"
                                  className="p-2 bg-red-500/10 text-red-500 rounded-lg hover:bg-red-500/20 transition-colors"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              )}

                              {/* Cancelar */}
                              <button onClick={() => setIsEditingTarget(false)} title="Cancelar Edição" className="p-2 bg-muted text-muted-foreground rounded-lg hover:bg-muted/80 transition-colors">
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setIsEditingTarget(true)}
                              className="w-full sm:w-auto px-4 py-2 rounded-lg border border-border hover:bg-muted font-medium text-sm transition-colors flex items-center justify-center gap-2"
                            >
                              <Edit2 className="w-4 h-4" />
                              {selectedProduct.targetPrice ? "Editar Alerta" : "Criar Alerta"}
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Histórico de Preços (Gráfico) */}
                  {selectedProduct.priceHistory.length > 1 ? (
                    <div className="mt-2">
                      <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                        Histórico de Preços <Info className="w-4 h-4 text-muted-foreground" />
                      </h3>
                      <div className="p-5 rounded-2xl border border-border/50 bg-card/50">
                        <div className="h-[250px] w-full">
                          <PriceChart data={selectedProduct.priceHistory} />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="mt-2 p-8 rounded-2xl border border-dashed border-border/50 flex flex-col items-center justify-center text-center">
                      <TrendingUp className="w-8 h-8 text-muted-foreground/30 mb-3" />
                      <h4 className="font-medium text-foreground">Histórico em construção</h4>
                      <p className="text-sm text-muted-foreground mt-1 max-w-sm">
                        O rastreamento acabou de começar. Volte amanhã para ver o gráfico de variação de preços.
                      </p>
                    </div>
                  )}

                  {/* Rodapé do Modal */}
                  <div className="text-center text-[11px] text-muted-foreground pt-4 border-t border-border/50">
                    Adicionado na plataforma {timeAgo(selectedProduct.createdAt)}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}