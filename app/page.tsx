import Link from "next/link";
import {
  ArrowRight,
  TrendingDown,
  Bell,
  BarChart3,
  Shield,
  Zap,
  Target,
} from "lucide-react";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-background relative overflow-hidden">
      {/* Background Gradient Blobs */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full bg-emerald-500/5 blur-[120px]" />
        <div className="absolute -bottom-40 -left-40 w-[500px] h-[500px] rounded-full bg-green-500/5 blur-[100px]" />
      </div>

      {/* Nav */}
      <nav className="relative z-10 border-b border-border/50 backdrop-blur-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500 to-green-600 flex items-center justify-center">
              <TrendingDown className="w-4 h-4 text-white" />
            </div>
            <span className="text-lg font-bold">PriceWatch</span>
          </div>
          <div className="flex items-center gap-3">
            <Link
              href="/login"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors px-4 py-2"
            >
              Entrar
            </Link>
            <Link
              href="/login?tab=signup"
              className="text-sm bg-primary text-primary-foreground px-4 py-2.5 rounded-xl font-medium hover:bg-primary/90 transition-colors"
            >
              Criar Conta
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero */}
      <section className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-20 pb-32">
        <div className="text-center max-w-3xl mx-auto">
          <div className="inline-flex items-center gap-2 text-xs bg-emerald-500/10 text-emerald-400 px-3 py-1.5 rounded-full border border-emerald-500/20 mb-6 animate-fade-in">
            <Zap className="w-3 h-3" />
            8 Marketplaces · Alertas Automáticos
          </div>

          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight mb-6 animate-slide-up">
            Nunca mais pague{" "}
            <span className="gradient-text">caro demais</span>
          </h1>

          <p className="text-lg sm:text-xl text-muted-foreground max-w-2xl mx-auto mb-10 animate-fade-in">
            Acompanhe preços de produtos na Amazon, Magazine Luiza, Americanas,
            KaBuM! e mais 4 lojas. Receba alertas quando o preço cair.
          </p>

          <div className="flex flex-col sm:flex-row items-center justify-center gap-4 animate-fade-in">
            <Link
              href="/login?tab=signup"
              className="group flex items-center gap-2 bg-primary text-primary-foreground px-7 py-3.5 rounded-xl font-semibold text-base hover:bg-primary/90 transition-all shadow-lg shadow-emerald-500/20"
            >
              Começar Grátis
              <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
            </Link>
            <Link
              href="#features"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors px-6 py-3.5"
            >
              Ver funcionalidades →
            </Link>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-6 max-w-lg mx-auto mt-20">
          {[
            { label: "Marketplaces", value: "8" },
            { label: "Atualizações", value: "24h" },
            { label: "100% Grátis", value: "R$0" },
          ].map((stat) => (
            <div key={stat.label} className="text-center">
              <div className="text-2xl sm:text-3xl font-bold gradient-text">{stat.value}</div>
              <div className="text-xs text-muted-foreground mt-1">{stat.label}</div>
            </div>
          ))}
        </div>
      </section>

      {/* Features */}
      <section id="features" className="relative z-10 border-t border-border/50 bg-muted/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24">
          <div className="text-center mb-16">
            <h2 className="text-3xl font-bold mb-4">
              Tudo que você precisa para economizar
            </h2>
            <p className="text-muted-foreground max-w-xl mx-auto">
              Ferramentas poderosas para rastrear, comparar e ser alertado sobre
              mudanças de preço.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-6">
            {[
              {
                icon: BarChart3,
                title: "Histórico Visual",
                desc: "Gráficos interativos com o histórico de preço de cada produto. Veja tendências e escolha o melhor momento para comprar.",
              },
              {
                icon: Bell,
                title: "Alertas de Preço",
                desc: "Configure um preço alvo e receba notificação quando o produto atingir o valor desejado. Zero spam.",
              },
              {
                icon: Target,
                title: "Multi-Marketplace",
                desc: "Amazon, Magalu, Americanas, Casas Bahia, KaBuM!, Shopee, Mercado Livre e Ponto em um só lugar.",
              },
              {
                icon: Zap,
                title: "Atualização Automática",
                desc: "Preços são verificados automaticamente. Sem necessidade de action manual para manter seus produtos atualizados.",
              },
              {
                icon: Shield,
                title: "Seguro & Privado",
                desc: "Seus dados são seus. Autenticação segura via Supabase. Nenhum dado de pagamento necessário.",
              },
              {
                icon: TrendingDown,
                title: "Menor Preço Histórico",
                desc: "Saiba se o preço atual é realmente uma promoção comparando com o menor preço já registrado.",
              },
            ].map((feature) => (
              <div
                key={feature.title}
                className="group p-6 rounded-2xl border border-border/50 bg-card hover:border-primary/30 transition-all duration-300 hover:shadow-lg hover:shadow-emerald-500/5"
              >
                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mb-4 group-hover:bg-primary/20 transition-colors">
                  <feature.icon className="w-5 h-5 text-primary" />
                </div>
                <h3 className="font-semibold mb-2">{feature.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {feature.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="relative z-10 border-t border-border/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-24 text-center">
          <h2 className="text-3xl font-bold mb-4">
            Comece a economizar agora
          </h2>
          <p className="text-muted-foreground max-w-md mx-auto mb-8">
            Crie sua conta gratuita em segundos e comece a rastrear seus
            produtos favoritos.
          </p>
          <Link
            href="/login?tab=signup"
            className="inline-flex items-center gap-2 bg-primary text-primary-foreground px-7 py-3.5 rounded-xl font-semibold hover:bg-primary/90 transition-all shadow-lg shadow-emerald-500/20"
          >
            Criar Conta Grátis
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-border/50 py-8">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center text-xs text-muted-foreground">
          © {new Date().getFullYear()} PriceWatch. Feito com ❤️ para consumidores brasileiros.
        </div>
      </footer>
    </div>
  );
}
