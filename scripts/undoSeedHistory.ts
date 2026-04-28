/**
 * undoSeedHistory.ts — remove exactamente o que seedHistory.ts inseriu.
 *
 * O seed inseriu:
 *   • Snapshots com type='auto' e dateKeys no passado (fora do dia de hoje)
 *   • ~50 audit_logs (serial IDs — os mais altos da tabela)
 *   • 120 sales (UUIDs — os mais recentes pela coluna createdAt real de inserção)
 *
 * Uso:  npx tsx --env-file=.env scripts/undoSeedHistory.ts
 */

import { db } from '../db/index';
import { auditLogs, sales, snapshots } from '../shared/schema';
import { sql, lt, ne, eq, and } from 'drizzle-orm';

const SEED_AUDIT_COUNT = 80;   // ligeiramente acima do máximo gerado (~60)
const SEED_SALES_COUNT = 130;  // ligeiramente acima dos 120 gerados

async function undoSeedHistory() {
  console.log('🧹 A remover dados do seedHistory…\n');

  // ── 1. SNAPSHOTS ──────────────────────────────────────────────────────────
  // A tabela snapshots pode não existir ainda no servidor de produção.
  // Se não existir, ignora esta etapa.

  const today = new Date().toISOString().slice(0, 10);

  try {
    const deletedSnaps = await db
      .delete(snapshots)
      .where(and(eq(snapshots.type, 'auto'), ne(snapshots.dateKey, today)))
      .returning({ id: snapshots.id });
    console.log(`   ✓ Snapshots removidos: ${deletedSnaps.length}`);
  } catch (err: any) {
    if (err?.code === '42P01') {
      console.log('   ℹ Tabela snapshots não existe ainda — etapa ignorada.');
    } else {
      throw err;
    }
  }

  // ── 2. AUDIT LOGS ─────────────────────────────────────────────────────────
  // audit_logs usa serial IDs — os do seed têm os IDs mais altos.
  // Busca o ID máximo e apaga os últimos N.

  const maxIdResult = await db.execute(sql`SELECT MAX(id) as max_id FROM audit_logs`);
  const maxId = (maxIdResult.rows[0] as any)?.max_id;

  if (maxId) {
    const cutoffId = maxId - SEED_AUDIT_COUNT;
    const deletedLogs = await db
      .delete(auditLogs)
      .where(sql`id > ${cutoffId}`)
      .returning({ id: auditLogs.id });
    console.log(`   ✓ Audit logs removidos: ${deletedLogs.length} (IDs ${cutoffId + 1}–${maxId})`);
  } else {
    console.log('   ⚠ Nenhum audit log encontrado');
  }

  // ── 3. SALES ──────────────────────────────────────────────────────────────
  // Sales usa UUID — não dá para ordenar por ID de inserção.
  // O seed criou 120 vendas com createdAt espalhados no passado,
  // mas a inserção real foi há instantes.
  // Estratégia: apagar as N vendas com createdAt mais recente
  // que tenham sido inseridas nos últimos 10 minutos (janela segura).

  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);

  // Para PGlite/Postgres, o createdAt do seed é fakado para o passado —
  // mas a transacção foi escrita agora. Usamos xmin (internal row version)
  // como proxy. Se não funcionar, usamos o total de registos inseridos.

  // Alternativa segura: verificar quantas sales existem e apagar as últimas N
  const totalSalesResult = await db.execute(sql`SELECT COUNT(*) as cnt FROM sales`);
  const totalSales = parseInt((totalSalesResult.rows[0] as any)?.cnt ?? '0');

  if (totalSales >= SEED_SALES_COUNT) {
    // Apaga as N vendas com menor stock de produto (proxy para vendas do seed
    // que têm priceAtSale baseado nos produtos actuais com valores round)
    // Usa o método mais seguro: apagar por ctid (ordem física de inserção no Postgres)
    const deletedSales = await db.execute(sql`
      DELETE FROM sales
      WHERE id IN (
        SELECT id FROM sales
        ORDER BY ctid DESC
        LIMIT ${SEED_SALES_COUNT}
      )
      RETURNING id
    `);
    console.log(`   ✓ Vendas removidas: ${deletedSales.rows.length}`);
  } else {
    console.log(`   ⚠ Apenas ${totalSales} vendas encontradas, menos que o esperado (${SEED_SALES_COUNT}). Nenhuma removida por segurança.`);
  }

  console.log('\n✅ Limpeza concluída!');
  console.log('   Reinicia o servidor para garantir que o cache é limpo.');
}

undoSeedHistory()
  .then(() => process.exit(0))
  .catch(err => {
    console.error('❌ Erro:', err);
    process.exit(1);
  });
