import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { scrapeProduct } from "@/lib/scrapers";

const BATCH_SIZE = 5;      // URLs scraped in parallel per batch
const BATCH_DELAY_MS = 800; // delay between batches (anti-block)

function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * GET /api/cron/scrape-all
 *
 * Atualiza os preços de todos os produtos rastreados.
 *
 * Otimizações de escala:
 * - Deduplicação: produtos com a mesma URL são rastreados 1x, não N vezes.
 * - Batching: processa BATCH_SIZE URLs em paralelo com delay entre lotes.
 * - Notificação: envia e-mail quando o preço atinge o alvo pela primeira vez.
 */
export async function GET(request: Request) {
  // ── Autenticação ──────────────────────────────────────────────────────────
  const authHeader = request.headers.get("authorization");
  if (
    process.env.CRON_SECRET &&
    authHeader !== `Bearer ${process.env.CRON_SECRET}`
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();
  const startedAt = Date.now();

  try {
    // ── 1. Busca todos os produtos rastreados ─────────────────────────────
    const { data: products, error: fetchError } = await admin
      .from("tracked_products")
      .select("id, url, title, user_id, current_price, lowest_price, highest_price, target_price");

    if (fetchError) throw fetchError;
    if (!products || products.length === 0) {
      return NextResponse.json({ success: true, message: "Nenhum produto para atualizar." });
    }

    // ── 2. Deduplicação por URL ───────────────────────────────────────────
    // Se 50 usuários rastreiam o mesmo produto, fazemos 1 scrape, não 50.
    const urlMap = new Map<string, typeof products>();
    for (const p of products) {
      if (!urlMap.has(p.url)) urlMap.set(p.url, []);
      urlMap.get(p.url)!.push(p);
    }

    const uniqueUrls = Array.from(urlMap.keys());

    // ── 3. Processamento em lotes ─────────────────────────────────────────
    let updated = 0;
    let failed = 0;
    let alertsSent = 0;

    for (let i = 0; i < uniqueUrls.length; i += BATCH_SIZE) {
      const batch = uniqueUrls.slice(i, i + BATCH_SIZE);

      await Promise.all(
        batch.map(async (url) => {
          const trackers = urlMap.get(url)!;
          let newPrice: number | null = null;
          let availability = "in_stock";

          // ── Scrape ──────────────────────────────────────────────────────
          try {
            const result = await scrapeProduct(url);
            if (result.success && result.data?.price) {
              newPrice = result.data.price;
              availability = result.data.availability ?? "in_stock";
            }
          } catch (err) {
            console.error(`[cron] Falha ao scrape ${url}:`, err);
            failed++;
            return; // pula para a próxima URL
          }

          // Se não conseguimos preço, não atualizamos
          if (newPrice === null) {
            failed++;
            return;
          }

          // ── Atualiza cada tracker que usa essa URL ───────────────────────
          await Promise.all(
            trackers.map(async (tracker) => {
              const oldPrice = tracker.current_price ?? newPrice!;
              const newLowest = Math.min(newPrice!, tracker.lowest_price ?? newPrice!);
              const newHighest = Math.max(newPrice!, tracker.highest_price ?? newPrice!);

              // Atualiza tracked_products
              const { error: updateError } = await admin
                .from("tracked_products")
                .update({
                  current_price: newPrice,
                  lowest_price: newLowest,
                  highest_price: newHighest,
                })
                .eq("id", tracker.id);

              if (updateError) {
                console.error(`[cron] Erro ao atualizar produto ${tracker.id}:`, updateError);
                return;
              }

              // Insere no histórico
              await admin.from("price_history").insert({
                product_id: tracker.id,
                price: newPrice,
                availability,
              });

              updated++;

              // ── Notificação de alvo ──────────────────────────────────────
              // Dispara quando: havia preço alvo, preço ACABOU de cruzar o alvo
              const targetPrice = tracker.target_price;
              const targetJustHit =
                targetPrice !== null &&
                oldPrice > targetPrice &&
                newPrice! <= targetPrice;

              if (targetJustHit) {
                await sendTargetAlert({
                  admin,
                  userId: tracker.user_id,
                  productTitle: tracker.title,
                  productUrl: url,
                  newPrice: newPrice!,
                  targetPrice: targetPrice!,
                });
                alertsSent++;
              }
            })
          );
        })
      );

      // Aguarda entre lotes para não sobrecarregar os marketplaces
      if (i + BATCH_SIZE < uniqueUrls.length) {
        await sleep(BATCH_DELAY_MS);
      }
    }

    const duration = ((Date.now() - startedAt) / 1000).toFixed(1);

    console.log(
      `[cron] Concluído em ${duration}s | ` +
      `Total: ${products.length} | URLs únicas: ${uniqueUrls.length} | ` +
      `Atualizados: ${updated} | Falhas: ${failed} | Alertas: ${alertsSent}`
    );

    return NextResponse.json({
      success: true,
      stats: {
        totalTracked: products.length,
        uniqueUrls: uniqueUrls.length,
        updated,
        failed,
        alertsSent,
        durationSeconds: Number(duration),
      },
    });
  } catch (error: any) {
    console.error("[cron] Erro geral:", error);
    return NextResponse.json({ error: error.message || "Erro interno" }, { status: 500 });
  }
}

// ── Envio de e-mail de alerta ─────────────────────────────────────────────────

async function sendTargetAlert({
  admin,
  userId,
  productTitle,
  productUrl,
  newPrice,
  targetPrice,
}: {
  admin: ReturnType<typeof createAdminClient>;
  userId: string;
  productTitle: string;
  productUrl: string;
  newPrice: number;
  targetPrice: number;
}) {
  const RESEND_KEY = process.env.RESEND_API_KEY;
  if (!RESEND_KEY || RESEND_KEY === "your_resend_api_key") {
    console.log(`[cron] Alerta p/ ${userId}: preço atingiu R$${newPrice} (alvo R$${targetPrice}). Configure RESEND_API_KEY p/ enviar e-mail.`);
    return;
  }

  try {
    // Busca o e-mail do usuário
    const { data: { user }, error } = await admin.auth.admin.getUserById(userId);
    if (error || !user?.email) return;

    const formattedPrice = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(newPrice);
    const formattedTarget = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(targetPrice);

    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${RESEND_KEY}`,
      },
      body: JSON.stringify({
        from: "PriceWatch <alertas@seudominio.com.br>",
        to: [user.email],
        subject: `🎯 Preço alvo atingido: ${productTitle.slice(0, 60)}`,
        html: buildEmailHtml({ productTitle, productUrl, formattedPrice, formattedTarget }),
      }),
    });

    console.log(`[cron] E-mail de alerta enviado para ${user.email}`);
  } catch (err) {
    console.error("[cron] Falha ao enviar e-mail:", err);
  }
}

function buildEmailHtml({
  productTitle,
  productUrl,
  formattedPrice,
  formattedTarget,
}: {
  productTitle: string;
  productUrl: string;
  formattedPrice: string;
  formattedTarget: string;
}) {
  return `<!DOCTYPE html>
<html lang="pt-BR">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
<body style="margin:0;padding:0;background:#07091A;font-family:Inter,system-ui,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#07091A;padding:40px 16px;">
    <tr><td align="center">
      <table width="560" cellpadding="0" cellspacing="0" style="background:#0D1127;border:1px solid #1C2840;border-radius:16px;overflow:hidden;max-width:560px;width:100%;">
        <!-- Header -->
        <tr>
          <td style="padding:32px 32px 24px;border-bottom:1px solid #1C2840;">
            <table cellpadding="0" cellspacing="0">
              <tr>
                <td style="background:linear-gradient(135deg,#7C3AED,#4F46E5);border-radius:12px;width:40px;height:40px;text-align:center;vertical-align:middle;">
                  <span style="color:#fff;font-size:18px;line-height:40px;">📉</span>
                </td>
                <td style="padding-left:12px;">
                  <span style="color:#E2E8F0;font-size:18px;font-weight:700;letter-spacing:-0.3px;">PriceWatch</span>
                </td>
              </tr>
            </table>
          </td>
        </tr>
        <!-- Body -->
        <tr>
          <td style="padding:32px;">
            <p style="margin:0 0 8px;color:#94A3B8;font-size:13px;font-weight:600;text-transform:uppercase;letter-spacing:1px;">Alerta de Preço</p>
            <h1 style="margin:0 0 20px;color:#E2E8F0;font-size:22px;font-weight:700;line-height:1.3;">
              🎯 Seu preço alvo foi atingido!
            </h1>
            <p style="margin:0 0 24px;color:#94A3B8;font-size:15px;line-height:1.6;">
              O produto que você está monitorando chegou ao preço que você definiu como alvo.
            </p>

            <!-- Product title -->
            <div style="background:#141B2D;border:1px solid #1C2840;border-radius:12px;padding:20px;margin-bottom:24px;">
              <p style="margin:0 0 16px;color:#E2E8F0;font-size:15px;font-weight:500;line-height:1.4;">${productTitle}</p>
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td style="text-align:center;padding:12px;background:#0D1127;border-radius:8px;">
                    <p style="margin:0 0 4px;color:#94A3B8;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.8px;">Preço alvo</p>
                    <p style="margin:0;color:#94A3B8;font-size:18px;font-weight:700;text-decoration:line-through;">${formattedTarget}</p>
                  </td>
                  <td style="padding:0 12px;color:#94A3B8;font-size:20px;text-align:center;">→</td>
                  <td style="text-align:center;padding:12px;background:#052E16;border:1px solid #14532D;border-radius:8px;">
                    <p style="margin:0 0 4px;color:#86EFAC;font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:0.8px;">Preço atual</p>
                    <p style="margin:0;color:#4ADE80;font-size:22px;font-weight:800;">${formattedPrice}</p>
                  </td>
                </tr>
              </table>
            </div>

            <!-- CTA -->
            <a href="${productUrl}" style="display:block;text-align:center;background:linear-gradient(135deg,#7C3AED,#4F46E5);color:#fff;font-size:15px;font-weight:700;text-decoration:none;padding:14px 24px;border-radius:12px;margin-bottom:24px;">
              Comprar agora →
            </a>

            <p style="margin:0;color:#64748B;font-size:12px;text-align:center;line-height:1.6;">
              Este alerta foi enviado pelo PriceWatch porque o preço atingiu seu valor alvo.<br>
              O preço pode mudar rapidamente — compre logo!
            </p>
          </td>
        </tr>
        <!-- Footer -->
        <tr>
          <td style="padding:20px 32px;border-top:1px solid #1C2840;text-align:center;">
            <p style="margin:0;color:#475569;font-size:11px;">PriceWatch · Você recebeu este e-mail porque definiu um alerta de preço.</p>
          </td>
        </tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
