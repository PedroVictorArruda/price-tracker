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
  BellOff,
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
  Edit3,
  Check,
  Target,
  Zap,
  ShoppingBag,
  Link2,
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

  const [newUrl, setNewUrl] = useState("");
  const [newTargetPrice, setNewTargetPrice] = useState("");
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState("");

  const [isEditingTarget, setIsEditingTarget] = useState(false);
  const [editTargetValue, setEditTargetValue] = useState("");
  const [updateLoading, setUpdateLoading] = useState(false);

  const [deleteId, setDeleteId] = useState<string | null>(null);

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
      const rawValue = newTargetPrice.replace(/\./g, "").replace(",", ".");
      const parsedTarget = rawValue ? parseFloat(rawValue) : null;
      const res = await fetch("/api/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: newUrl, targetPrice: parsedTarget }),
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
        body: JSON.stringify({ id: selectedProduct.id, targetPrice: null }),
      });
      if (!res.ok) throw new Error("Erro ao remover alerta");
      setProducts(prev => prev.map(p => p.id === selectedProduct.id ? { ...p, targetPrice: null } : p));
      setSelectedProduct({ ...selectedProduct, targetPrice: null });
      setIsEditingTarget(false);
      setEditTargetValue("");
    } catch (error) {
      console.error(error);
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

  const getThermometerPosition = (current: number, min: number, max: number) => {
    if (max === min) return 50;
    return Math.max(0, Math.min(100, ((current - min) / (max - min)) * 100));
  };

  function PriceChangeBadge({ current, previous }: { current: number | null; previous: number | null }) {
    if (!current || !previous) return null;
    const change = getPercentageChange(current, previous);
    if (change === 0) return null;
    const isDown = change < 0;
    return (
      <span className={`inline-flex items-center gap-0.5 text-[10px] font-semibold px-1.5 py-0.5 rounded-md ${
        isDown ? "bg-emerald-500/12 text-emerald-400" : "bg-red-500/12 text-red-400"
      }`}>
        {isDown ? <ArrowDown className="w-2.5 h-2.5" /> : <ArrowUp className="w-2.5 h-2.5" />}
        {Math.abs(change).toFixed(1)}%
      </span>
    );
  }

  const firstNameInitial = userName ? userName[0].toUpperCase() : "U";

  return (
    <div className="min-h-screen bg-background">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-30 border-b border-border/60 backdrop-blur-xl bg-background/85">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-15 flex items-center justify-between" style={{ height: "60px" }}>
          {/* Logo */}
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center shadow-lg shadow-violet-500/30">
              <TrendingDown className="w-4 h-4 text-white" strokeWidth={2.5} />
            </div>
            <span className="text-[15px] font-bold tracking-tight">PriceWatch</span>
          </div>

          {/* Right side */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setShowAddDialog(true)}
              className="hidden sm:flex items-center gap-1.5 bg-primary/10 text-primary border border-primary/20 hover:bg-primary/15 px-3.5 py-1.5 rounded-xl text-sm font-medium transition-all duration-150"
            >
              <Plus className="w-3.5 h-3.5" />
              Adicionar
            </button>
            <div className="flex items-center gap-2 pl-3 border-l border-border/60">
              <div className="w-7 h-7 rounded-full bg-gradient-to-br from-violet-500 to-indigo-600 flex items-center justify-center text-[11px] font-bold text-white shadow-sm">
                {firstNameInitial}
              </div>
              <span className="text-sm text-muted-foreground hidden sm:inline">
                {userName.split(" ")[0]}
              </span>
              <button
                onClick={handleLogout}
                className="p-1.5 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/80 transition-colors ml-1"
                title="Sair"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-7">

        {/* ── Page Title ──────────────────────────────────────────────────── */}
        <div className="mb-7">
          <h1 className="text-2xl font-bold tracking-tight">
            Olá, {userName.split(" ")[0]} 👋
          </h1>
          <p className="text-muted-foreground text-sm mt-1">
            Acompanhe os preços dos seus produtos em tempo real.
          </p>
        </div>

        {/* ── Stats ───────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-3 sm:gap-4 mb-7">
          {/* Total Produtos */}
          <div className="p-4 sm:p-5 rounded-2xl border border-border/70 bg-card relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-violet-500/3 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl" />
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-xl bg-violet-500/10 flex items-center justify-center">
                <ShoppingBag className="w-4 h-4 text-violet-400" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-bold tracking-tight">{totalProducts}</div>
            <div className="text-xs text-muted-foreground mt-0.5 font-medium">Produtos</div>
          </div>

          {/* Quedas */}
          <div className="p-4 sm:p-5 rounded-2xl border border-border/70 bg-card relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/3 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl" />
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 flex items-center justify-center">
                <TrendingDown className="w-4 h-4 text-emerald-400" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-bold tracking-tight text-emerald-400">{priceDrops}</div>
            <div className="text-xs text-muted-foreground mt-0.5 font-medium">Quedas de preço</div>
          </div>

          {/* No Alvo */}
          <div className="p-4 sm:p-5 rounded-2xl border border-border/70 bg-card relative overflow-hidden group">
            <div className="absolute inset-0 bg-gradient-to-br from-amber-500/3 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl" />
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-xl bg-amber-500/10 flex items-center justify-center">
                <Target className="w-4 h-4 text-amber-400" />
              </div>
            </div>
            <div className="text-2xl sm:text-3xl font-bold tracking-tight text-amber-400">{atTarget}</div>
            <div className="text-xs text-muted-foreground mt-0.5 font-medium">No preço alvo</div>
          </div>
        </div>

        {/* ── Toolbar ─────────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60" />
            <input
              type="text"
              placeholder="Buscar produtos..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-border/70 bg-card text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/30 focus:border-primary/40 transition-all"
            />
          </div>

          <div className="flex items-center gap-2">
            <div className="relative">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as any)}
                className="appearance-none pl-3.5 pr-8 py-2.5 rounded-xl border border-border/70 bg-card text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 cursor-pointer text-muted-foreground hover:text-foreground transition-colors"
              >
                <option value="recent">Mais recente</option>
                <option value="price-asc">Menor preço</option>
                <option value="price-desc">Maior preço</option>
                <option value="change">Maior variação</option>
              </select>
              <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground pointer-events-none" />
            </div>

            <div className="flex p-1 rounded-xl border border-border/70 bg-card gap-0.5">
              <button
                onClick={() => setViewMode("grid")}
                className={`p-1.5 rounded-lg transition-all duration-150 ${viewMode === "grid" ? "bg-muted text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              >
                <LayoutGrid className="w-4 h-4" />
              </button>
              <button
                onClick={() => setViewMode("list")}
                className={`p-1.5 rounded-lg transition-all duration-150 ${viewMode === "list" ? "bg-muted text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              >
                <List className="w-4 h-4" />
              </button>
            </div>

            <button
              onClick={() => setShowAddDialog(true)}
              className="flex items-center gap-2 bg-primary text-primary-foreground px-4 py-2.5 rounded-xl font-semibold text-sm hover:bg-primary/90 active:scale-[0.98] transition-all shadow-md shadow-violet-500/20"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Adicionar</span>
            </button>
          </div>
        </div>

        {/* ── Product Grid / List ──────────────────────────────────────────── */}
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <div className="w-16 h-16 rounded-2xl bg-muted/60 flex items-center justify-center mb-5">
              <Package className="w-7 h-7 text-muted-foreground/40" />
            </div>
            <h3 className="text-base font-semibold mb-1.5">
              {search ? "Nenhum resultado encontrado" : "Nenhum produto ainda"}
            </h3>
            <p className="text-muted-foreground text-sm mb-6 max-w-xs">
              {search
                ? `Nenhum produto corresponde a "${search}".`
                : "Cole a URL de um produto para começar a monitorar o preço."}
            </p>
            {!search && (
              <button
                onClick={() => setShowAddDialog(true)}
                className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-5 py-2.5 rounded-xl font-semibold text-sm shadow-md shadow-violet-500/20 hover:bg-primary/90 transition-all"
              >
                <Plus className="w-4 h-4" />
                Adicionar primeiro produto
              </button>
            )}
          </div>
        ) : (
          <div className={viewMode === "grid"
            ? "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
            : "flex flex-col gap-2.5"
          }>
            {filtered.map((product, i) => {
              const mktColor = MARKETPLACE_COLORS[product.marketplace as Marketplace] || "#888";
              const isOutOfStock = product.availability === "out_of_stock" || product.currentPrice === 0;
              const isAtTarget = !isOutOfStock && product.targetPrice && product.currentPrice && product.currentPrice <= product.targetPrice;

              if (viewMode === "list") return (
                <div
                  key={product.id}
                  onClick={() => openProductModal(product)}
                  className={`group cursor-pointer flex items-center gap-4 p-4 rounded-2xl border bg-card transition-all duration-200 animate-fade-in-up stagger-${Math.min(i + 1, 5)} hover:border-violet-500/20 hover:bg-card/80`}
                  style={{ borderColor: "hsl(var(--border) / 0.7)" }}
                >
                  {/* Thumbnail */}
                  <div className="w-14 h-14 rounded-xl bg-white flex-shrink-0 flex items-center justify-center overflow-hidden shadow-sm">
                    {product.imageUrl
                      ? <img src={product.imageUrl} alt="" className="max-h-full max-w-full object-contain p-1 mix-blend-multiply" />
                      : <Package className="w-5 h-5 text-gray-300" />}
                  </div>

                  {/* Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[10px] font-bold uppercase tracking-wider"
                        style={{ color: mktColor }}>
                        {MARKETPLACE_LABELS[product.marketplace as Marketplace] || product.marketplace}
                      </span>
                      <PriceChangeBadge current={product.currentPrice} previous={product.previousPrice} />
                    </div>
                    <p className="text-sm font-medium truncate text-foreground/90">{product.title}</p>
                  </div>

                  {/* Price */}
                  <div className="text-right flex-shrink-0">
                    {isOutOfStock ? (
                      <span className="text-sm font-semibold text-red-400">Indisponível</span>
                    ) : (
                      <>
                        <div className="text-base font-bold">{formatCurrency(product.currentPrice!)}</div>
                        {product.targetPrice && (
                          <div className={`text-[10px] mt-0.5 ${isAtTarget ? "text-emerald-400" : "text-muted-foreground"}`}>
                            Alvo: {formatCurrency(product.targetPrice)}
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    <a
                      href={product.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                    </a>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(product.id); }}
                      disabled={deleteId === product.id}
                      className="p-2 rounded-lg text-muted-foreground hover:text-red-400 hover:bg-red-500/10 transition-colors"
                    >
                      {deleteId === product.id
                        ? <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        : <Trash2 className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>
              );

              // ── Grid card ──
              return (
                <div
                  key={product.id}
                  onClick={() => openProductModal(product)}
                  className={`group cursor-pointer rounded-2xl border bg-card flex flex-col overflow-hidden transition-all duration-250 animate-fade-in-up stagger-${Math.min(i + 1, 5)} hover:border-violet-500/25 hover:shadow-xl hover:shadow-violet-500/6 hover:-translate-y-0.5`}
                  style={{ borderColor: "hsl(var(--border) / 0.7)" }}
                >
                  {/* Image area */}
                  <div className="relative w-full bg-white overflow-hidden" style={{ height: "160px" }}>
                    {product.imageUrl ? (
                      <img
                        src={product.imageUrl}
                        alt={product.title}
                        className="absolute inset-0 w-full h-full object-contain p-4 mix-blend-multiply transition-transform duration-300 group-hover:scale-105"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Package className="w-10 h-10 text-gray-200" />
                      </div>
                    )}
                    {/* Marketplace badge */}
                    <div className="absolute top-3 left-3">
                      <span
                        className="text-[9px] font-extrabold uppercase tracking-widest px-2 py-1 rounded-md"
                        style={{
                          color: mktColor,
                          backgroundColor: `${mktColor}18`,
                          border: `1px solid ${mktColor}30`,
                        }}
                      >
                        {MARKETPLACE_LABELS[product.marketplace as Marketplace] || product.marketplace}
                      </span>
                    </div>
                    {/* Price change badge */}
                    <div className="absolute top-3 right-3">
                      <PriceChangeBadge current={product.currentPrice} previous={product.previousPrice} />
                    </div>
                    {/* Target reached badge */}
                    {isAtTarget && (
                      <div className="absolute bottom-3 right-3 flex items-center gap-1 bg-emerald-500 text-white text-[9px] font-bold uppercase tracking-wider px-2 py-1 rounded-md shadow-md">
                        <Zap className="w-2.5 h-2.5" />
                        No alvo!
                      </div>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex flex-col flex-1 p-4 pt-3.5 gap-3">
                    <h3 className="text-sm font-medium line-clamp-2 leading-snug text-foreground/85 group-hover:text-foreground transition-colors">
                      {product.title}
                    </h3>

                    <div className="flex items-end justify-between mt-auto">
                      <div>
                        {isOutOfStock ? (
                          <span className="text-sm font-semibold text-red-400">Indisponível</span>
                        ) : (
                          <>
                            <div className="text-xl font-bold tracking-tight">
                              {formatCurrency(product.currentPrice!)}
                            </div>
                            {product.lowestPrice && product.lowestPrice < product.currentPrice! && (
                              <div className="text-[10px] text-muted-foreground mt-0.5 flex items-center gap-1">
                                <TrendingDown className="w-2.5 h-2.5 text-emerald-400" />
                                Mínimo: {formatCurrency(product.lowestPrice)}
                              </div>
                            )}
                          </>
                        )}
                      </div>

                      {product.targetPrice && !isAtTarget && (
                        <div className="flex items-center gap-1 text-[10px] text-muted-foreground bg-muted/80 px-2 py-1 rounded-lg">
                          <Bell className="w-2.5 h-2.5" />
                          {formatCurrency(product.targetPrice)}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Add Product Dialog ───────────────────────────────────────────────── */}
      {showAddDialog && (
        <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm">
          <div className="w-full sm:max-w-lg rounded-t-3xl sm:rounded-2xl border border-border/70 bg-card p-6 shadow-2xl shadow-black/60 animate-fade-in-up">
            <div className="flex items-center justify-between mb-6">
              <div>
                <h2 className="text-lg font-bold">Rastrear produto</h2>
                <p className="text-sm text-muted-foreground mt-0.5">Cole a URL de qualquer produto suportado</p>
              </div>
              <button
                onClick={() => { setShowAddDialog(false); setAddError(""); }}
                className="p-2 rounded-xl hover:bg-muted transition-colors text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {addError && (
              <div className="mb-5 p-3.5 rounded-xl text-sm bg-red-500/8 text-red-400 border border-red-500/20 flex items-start gap-2.5">
                <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                <span>{addError}</span>
              </div>
            )}

            <form onSubmit={handleAddProduct} className="space-y-4">
              <div>
                <label className="text-sm font-semibold text-foreground/80 mb-2 block">
                  URL do produto
                </label>
                <div className="relative">
                  <Link2 className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground/60" />
                  <input
                    type="url"
                    value={newUrl}
                    onChange={(e) => setNewUrl(e.target.value)}
                    placeholder="https://www.amazon.com.br/dp/..."
                    required
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-border/70 bg-background/60 text-sm placeholder:text-muted-foreground/45 focus:outline-none focus:ring-2 focus:ring-primary/35 focus:border-primary/40 transition-all"
                  />
                </div>
                <p className="text-[11px] text-muted-foreground mt-1.5">
                  Suporta Amazon, Magalu, Americanas, Casas Bahia, KaBuM!, Ponto, Shopee e Mercado Livre.
                </p>
              </div>

              <div>
                <label className="text-sm font-semibold text-foreground/80 mb-2 flex items-center gap-1.5">
                  <Bell className="w-3.5 h-3.5 text-muted-foreground" />
                  Preço alvo
                  <span className="font-normal text-muted-foreground">(opcional)</span>
                </label>
                <div className="relative">
                  <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">R$</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={newTargetPrice}
                    onChange={(e) => setNewTargetPrice(formatCurrencyInput(e.target.value))}
                    placeholder="0,00"
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-border/70 bg-background/60 text-sm placeholder:text-muted-foreground/45 focus:outline-none focus:ring-2 focus:ring-primary/35 focus:border-primary/40 transition-all"
                  />
                </div>
                <p className="text-[11px] text-muted-foreground mt-1.5">
                  Você será notificado quando o preço atingir este valor.
                </p>
              </div>

              <div className="flex gap-3 pt-1">
                <button
                  type="button"
                  onClick={() => { setShowAddDialog(false); setAddError(""); }}
                  className="flex-1 py-3 rounded-xl border border-border/70 text-sm font-medium hover:bg-muted transition-colors"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={addLoading}
                  className="flex-1 flex items-center justify-center gap-2 bg-primary text-primary-foreground py-3 rounded-xl text-sm font-bold hover:bg-primary/90 active:scale-[0.98] transition-all shadow-md shadow-violet-500/25 disabled:opacity-50"
                >
                  {addLoading ? (
                    <><Loader2 className="w-4 h-4 animate-spin" /> Buscando...</>
                  ) : (
                    <><Plus className="w-4 h-4" /> Adicionar produto</>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── Product Detail Modal ─────────────────────────────────────────────── */}
      {selectedProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 lg:p-8">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/75 backdrop-blur-md"
            onClick={() => setSelectedProduct(null)}
          />

          {/* Panel */}
          <div className="relative w-full max-w-5xl max-h-[92vh] bg-card border border-border/60 rounded-2xl shadow-2xl shadow-black/60 flex flex-col overflow-hidden animate-in zoom-in-95 fade-in duration-200">

            {/* Close button */}
            <button
              onClick={() => setSelectedProduct(null)}
              className="absolute top-4 right-4 z-10 p-2 rounded-full bg-background/70 hover:bg-muted backdrop-blur-sm border border-border/60 text-muted-foreground hover:text-foreground transition-all shadow-sm"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Scrollable body */}
            <div className="overflow-y-auto flex-1 p-6 lg:p-8">
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

                {/* ── Left: image + title + actions ── */}
                <div className="lg:col-span-5 flex flex-col gap-5">
                  {/* Image */}
                  <div className="relative w-full aspect-square rounded-2xl bg-white border border-border/40 flex items-center justify-center overflow-hidden p-6 shadow-sm">
                    <div
                      className="absolute top-3 left-3 text-[9px] font-extrabold uppercase tracking-widest px-2.5 py-1 rounded-lg"
                      style={{
                        color: MARKETPLACE_COLORS[selectedProduct.marketplace as Marketplace],
                        backgroundColor: `${MARKETPLACE_COLORS[selectedProduct.marketplace as Marketplace]}15`,
                        border: `1px solid ${MARKETPLACE_COLORS[selectedProduct.marketplace as Marketplace]}30`,
                      }}
                    >
                      {MARKETPLACE_LABELS[selectedProduct.marketplace as Marketplace]}
                    </div>
                    {selectedProduct.imageUrl ? (
                      <img
                        src={selectedProduct.imageUrl}
                        alt={selectedProduct.title}
                        className="max-h-full max-w-full object-contain mix-blend-multiply"
                      />
                    ) : (
                      <Package className="w-20 h-20 text-gray-200" />
                    )}
                  </div>

                  {/* Title */}
                  <div>
                    <h2 className="text-lg font-bold leading-snug text-foreground/90 mb-4">
                      {selectedProduct.title}
                    </h2>
                    <div className="flex gap-2.5">
                      <a
                        href={selectedProduct.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 flex items-center justify-center gap-2 bg-primary text-primary-foreground py-3 rounded-xl text-sm font-bold hover:bg-primary/90 active:scale-[0.98] transition-all shadow-md shadow-violet-500/20"
                      >
                        Ir à loja <ExternalLink className="w-3.5 h-3.5" />
                      </a>
                      <button
                        onClick={() => handleDelete(selectedProduct.id)}
                        disabled={deleteId === selectedProduct.id}
                        className="px-4 py-3 rounded-xl border border-red-500/25 text-red-400 hover:bg-red-500/10 text-sm transition-all"
                        title="Remover produto"
                      >
                        {deleteId === selectedProduct.id
                          ? <Loader2 className="w-4 h-4 animate-spin" />
                          : <Trash2 className="w-4 h-4" />}
                      </button>
                    </div>
                  </div>
                </div>

                {/* ── Right: pricing + alert + chart ── */}
                <div className="lg:col-span-7 flex flex-col gap-4">

                  {/* Availability */}
                  {(selectedProduct.availability === "out_of_stock" || selectedProduct.currentPrice === 0) ? (
                    <div className="p-5 rounded-2xl border border-red-500/25 bg-red-500/5 flex items-center gap-4">
                      <div className="w-11 h-11 rounded-xl bg-red-500/10 flex items-center justify-center flex-shrink-0">
                        <AlertTriangle className="w-5 h-5 text-red-400" />
                      </div>
                      <div>
                        <div className="font-bold text-red-400">Produto Indisponível</div>
                        <div className="text-sm text-muted-foreground mt-0.5">Fora de estoque ou rastreamento falhou.</div>
                      </div>
                    </div>
                  ) : (
                    <>
                      {/* Price analysis card */}
                      <div className="p-5 rounded-2xl border border-border/60 bg-background/40">
                        <div className="flex items-start justify-between mb-5">
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                              <TrendingDown className="w-4 h-4 text-emerald-400" />
                              <span className="font-semibold text-sm">Análise de Preço</span>
                            </div>
                            <p className="text-xs text-muted-foreground max-w-[200px]">
                              {selectedProduct.currentPrice === selectedProduct.lowestPrice
                                ? "Está no menor preço histórico!"
                                : `Menor já visto: ${formatCurrency(selectedProduct.lowestPrice || 0)}`}
                            </p>
                          </div>
                          <div className="text-right">
                            <div className="text-xs text-muted-foreground uppercase tracking-wider font-medium mb-0.5">Preço atual</div>
                            <div className="text-3xl font-bold tracking-tight">{formatCurrency(selectedProduct.currentPrice!)}</div>
                            <PriceChangeBadge current={selectedProduct.currentPrice} previous={selectedProduct.previousPrice} />
                          </div>
                        </div>

                        {/* Thermometer */}
                        <div className="mt-2">
                          <div className="flex justify-between text-[10px] text-muted-foreground font-medium mb-2 uppercase tracking-wider">
                            <span className="flex items-center gap-1"><TrendingDown className="w-2.5 h-2.5 text-emerald-400" />{formatCurrency(selectedProduct.lowestPrice || 0)}</span>
                            <span className="flex items-center gap-1">{formatCurrency(selectedProduct.highestPrice || 0)}<TrendingUp className="w-2.5 h-2.5 text-red-400" /></span>
                          </div>
                          <div className="relative h-2 bg-gradient-to-r from-emerald-500 via-amber-400 to-red-500 rounded-full">
                            <div
                              className="absolute top-1/2 -translate-y-1/2 w-4 h-4 bg-white border-2 border-violet-600 rounded-full shadow-lg shadow-violet-500/40 transition-all duration-500"
                              style={{
                                left: `calc(${getThermometerPosition(selectedProduct.currentPrice!, selectedProduct.lowestPrice || 0, selectedProduct.highestPrice || 0)}% - 8px)`
                              }}
                            >
                              <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-foreground text-background text-[9px] font-bold py-0.5 px-1.5 rounded whitespace-nowrap shadow-sm">
                                Você está aqui
                                <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 border-l-3 border-r-3 border-t-3 border-l-transparent border-r-transparent border-t-foreground"></div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Alert card */}
                      <div className="p-5 rounded-2xl border border-border/60 bg-background/40">
                        {isEditingTarget ? (
                          <div>
                            <div className="flex items-center gap-2 mb-3">
                              <Bell className="w-4 h-4 text-primary" />
                              <span className="font-semibold text-sm">Definir preço alvo</span>
                            </div>
                            <p className="text-xs text-muted-foreground mb-4">
                              Você será notificado quando o preço cair para este valor.
                            </p>
                            <div className="flex items-center gap-2">
                              <div className="relative flex-1">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">R$</span>
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  value={editTargetValue}
                                  onChange={(e) => setEditTargetValue(formatCurrencyInput(e.target.value))}
                                  placeholder="0,00"
                                  autoFocus
                                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-primary/40 bg-background text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
                                />
                              </div>
                              <button
                                onClick={handleUpdateTarget}
                                disabled={updateLoading}
                                className="flex items-center gap-1.5 px-4 py-2.5 bg-primary text-primary-foreground rounded-xl text-sm font-semibold hover:bg-primary/90 transition-all disabled:opacity-50"
                              >
                                {updateLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <><Check className="w-3.5 h-3.5" /> Salvar</>}
                              </button>
                              {selectedProduct.targetPrice && (
                                <button
                                  onClick={handleRemoveTarget}
                                  disabled={updateLoading}
                                  className="p-2.5 rounded-xl bg-red-500/10 text-red-400 hover:bg-red-500/20 transition-colors"
                                  title="Remover alerta"
                                >
                                  <BellOff className="w-4 h-4" />
                                </button>
                              )}
                              <button
                                onClick={() => setIsEditingTarget(false)}
                                className="p-2.5 rounded-xl bg-muted text-muted-foreground hover:text-foreground transition-colors"
                              >
                                <X className="w-4 h-4" />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-between">
                            <div className="flex items-start gap-3">
                              <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${selectedProduct.targetPrice ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
                                <Bell className="w-4 h-4" />
                              </div>
                              <div>
                                <div className="font-semibold text-sm">
                                  {selectedProduct.targetPrice ? "Alerta ativo" : "Criar alerta de preço"}
                                </div>
                                <div className="text-xs text-muted-foreground mt-0.5">
                                  {selectedProduct.targetPrice
                                    ? `Avisaremos quando baixar de ${formatCurrency(selectedProduct.targetPrice)}`
                                    : "Defina um preço alvo para receber notificações"}
                                </div>
                              </div>
                            </div>
                            <button
                              onClick={() => setIsEditingTarget(true)}
                              className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-border/70 hover:bg-muted text-sm font-medium transition-all text-muted-foreground hover:text-foreground"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                              {selectedProduct.targetPrice ? "Editar" : "Definir"}
                            </button>
                          </div>
                        )}
                      </div>
                    </>
                  )}

                  {/* Price history chart */}
                  <div className="p-5 rounded-2xl border border-border/60 bg-background/40">
                    <h3 className="font-semibold text-sm mb-4 flex items-center gap-2">
                      <TrendingUp className="w-4 h-4 text-muted-foreground" />
                      Histórico de Preços
                    </h3>
                    {selectedProduct.priceHistory.length > 1 ? (
                      <div className="h-[220px] w-full">
                        <PriceChart data={selectedProduct.priceHistory} />
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center py-10 text-center">
                        <div className="w-10 h-10 rounded-xl bg-muted/70 flex items-center justify-center mb-3">
                          <TrendingUp className="w-5 h-5 text-muted-foreground/40" />
                        </div>
                        <p className="text-sm font-medium text-foreground/70">Histórico em construção</p>
                        <p className="text-xs text-muted-foreground mt-1 max-w-[200px]">
                          Volte amanhã para ver o gráfico de variação de preços.
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Footer */}
                  <div className="text-center text-[11px] text-muted-foreground/60 pb-1">
                    Adicionado {timeAgo(selectedProduct.createdAt)}
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
