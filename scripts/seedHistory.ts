/**
 * seedHistory.ts — insere dados históricos (2+ meses) para testar a reversão de dados.
 *
 * Cria:
 *  • Audit logs de UPDATE_PRODUCT em datas variadas (alterações de preço/stock)
 *  • Vendas espalhadas pelos últimos 70 dias
 *  • Snapshots diários automáticos em datas passadas
 *
 * Uso:  npx tsx --env-file=.env scripts/seedHistory.ts
 */

import { db } from '../db/index';
import {
  users, products, categories, sales, auditLogs, snapshots,
} from '../shared/schema';
import { sql } from 'drizzle-orm';

// ── helpers ────────────────────────────────────────────────────────────────

function daysAgo(n: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - n);
  d.setHours(Math.floor(Math.random() * 12) + 8, Math.floor(Math.random() * 59), 0, 0);
  return d;
}

function rand(min: number, max: number) {
  return Math.random() * (max - min) + min;
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

// ── main ───────────────────────────────────────────────────────────────────

async function seedHistory() {
  console.log('🕐 A inserir dados históricos (70 dias)…\n');

  // Buscar dados existentes
  const allUsers   = await db.select().from(users);
  const allProds   = await db.select().from(products);
  const allCats    = await db.select().from(categories);

  if (allUsers.length === 0 || allProds.length === 0) {
    console.error('❌ Nenhum utilizador ou produto encontrado. Corre primeiro: npm run db:seed');
    process.exit(1);
  }

  const adminUser  = allUsers.find(u => u.role === 'admin') ?? allUsers[0];
  const sellers    = allUsers.filter(u => u.role === 'seller' || u.role === 'manager');
  const sellerUser = sellers.length > 0 ? sellers[0] : adminUser;

  // ── 1. AUDIT LOGS — alterações de produto (UPDATE_PRODUCT) ──────────────
  console.log('📋 A criar audit logs de alterações de produto…');

  // Simula alterações de preço e stock em ~35 dias diferentes dos últimos 70
  const changeEvents: { daysBack: number; prod: typeof allProds[0]; field: string; from: string; to: string }[] = [];

  // Cria ~3-5 alterações por produto espalhadas no tempo
  for (const prod of allProds) {
    const numChanges = Math.floor(rand(3, 6));
    const daysUsed = new Set<number>();

    for (let i = 0; i < numChanges; i++) {
      let day = Math.floor(rand(1, 70));
      while (daysUsed.has(day)) day = Math.floor(rand(1, 70));
      daysUsed.add(day);

      const isPrice = Math.random() > 0.4;
      if (isPrice) {
        const oldPrice = parseFloat(prod.price);
        const newPrice = +(oldPrice * rand(0.85, 1.25)).toFixed(2);
        changeEvents.push({ daysBack: day, prod, field: 'price', from: String(oldPrice), to: String(newPrice) });
      } else {
        const oldStock = parseFloat(prod.stock);
        const newStock = +(oldStock * rand(0.5, 2.0)).toFixed(0);
        changeEvents.push({ daysBack: day, prod, field: 'stock', from: String(oldStock), to: String(newStock) });
      }
    }
  }

  // Ordena por data (mais antigo primeiro)
  changeEvents.sort((a, b) => b.daysBack - a.daysBack);

  for (const ev of changeEvents) {
    const ts = daysAgo(ev.daysBack);
    await db.insert(auditLogs).values({
      userId: adminUser.id,
      action: 'UPDATE_PRODUCT',
      entityType: 'product',
      entityId: ev.prod.id,
      details: {
        productName: ev.prod.name,
        changes: {
          [ev.field]: { de: ev.from, para: ev.to },
        },
      },
      createdAt: ts,
    });
  }
  console.log(`   ✓ ${changeEvents.length} audit logs de produto criados`);

  // ── 2. VENDAS ────────────────────────────────────────────────────────────
  console.log('🛒 A criar vendas históricas…');

  const payMethods = ['cash', 'mpesa', 'emola', 'transfer', 'bank'] as const;
  const numSales = 120; // ~2 vendas/dia nos últimos 70 dias

  for (let i = 0; i < numSales; i++) {
    const dayBack = Math.floor(rand(0, 70));
    const ts = daysAgo(dayBack);

    // Escolhe 1-4 produtos aleatórios
    const itemCount = Math.floor(rand(1, 5));
    const chosenProds = Array.from({ length: itemCount }, () => pick(allProds));
    const items = chosenProds.map(p => ({
      productId: p.id,
      quantity: Math.floor(rand(1, 5)),
      priceAtSale: parseFloat(p.price),
      productName: p.name,
      productUnit: p.unit,
    }));

    const subtotal = items.reduce((s, it) => s + it.priceAtSale * it.quantity, 0);
    const total    = +subtotal.toFixed(2);
    const received = +(total + Math.floor(rand(0, 50))).toFixed(2);

    await db.insert(sales).values({
      userId: pick([adminUser, sellerUser]).id,
      total: String(total),
      amountReceived: String(received),
      change: String(+(received - total).toFixed(2)),
      paymentMethod: pick(payMethods),
      items: items.map(it => ({ productId: it.productId, quantity: it.quantity, priceAtSale: it.priceAtSale })),
      preview: {
        items,
        subtotal: total,
        discount: { type: 'none', value: 0 },
        discountAmount: 0,
        total,
        paymentMethod: pick(payMethods),
        amountReceived: received,
        change: +(received - total).toFixed(2),
      },
      createdAt: ts,
    });
  }
  console.log(`   ✓ ${numSales} vendas criadas`);

  // ── 3. SNAPSHOTS AUTOMÁTICOS ─────────────────────────────────────────────
  console.log('📸 A criar snapshots históricos…');

  // Um snapshot por semana nos últimos 10 semanas
  const snapshotWeeks = [70, 63, 56, 49, 42, 35, 28, 21, 14, 7, 3, 1];

  for (const daysBack of snapshotWeeks) {
    const ts       = daysAgo(daysBack);
    ts.setHours(3, 0, 0, 0); // madrugada (simula boot do servidor)
    const dateKey  = ts.toISOString().slice(0, 10);
    const label    = `Auto — ${ts.toLocaleDateString('pt-MZ', { day: '2-digit', month: '2-digit', year: 'numeric' })}`;

    // Estado simulado dos produtos nessa data (preços ligeiramente diferentes)
    const snapProducts = allProds.map(p => ({
      ...p,
      price: +(parseFloat(p.price) * rand(0.88, 1.12)).toFixed(2).toString(),
      stock: +(parseFloat(p.stock) * rand(0.6, 1.4)).toFixed(0).toString(),
    }));

    await db.insert(snapshots).values({
      label,
      type: 'auto',
      dateKey,
      data: { products: snapProducts, categories: allCats, sales: [], orders: [], tasks: [] },
      createdAt: ts,
    });
  }
  console.log(`   ✓ ${snapshotWeeks.length} snapshots históricos criados`);

  // ── Resumo ───────────────────────────────────────────────────────────────
  console.log('\n✅ Seed histórico concluído!');
  console.log('\n📊 O que foi criado:');
  console.log(`   • ${changeEvents.length} alterações de produto em ${new Set(changeEvents.map(e => e.daysBack)).size} dias diferentes`);
  console.log(`   • ${numSales} vendas nos últimos 70 dias`);
  console.log(`   • ${snapshotWeeks.length} snapshots (1 por semana + dias recentes)`);
  console.log('\n🔍 Abre Definições → Reversão de Dados para ver o calendário com os pontos vermelhos.');
}

seedHistory()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ Erro:', err);
    process.exit(1);
  });
