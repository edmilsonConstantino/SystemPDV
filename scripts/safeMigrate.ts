/**
 * safeMigrate.ts — adiciona colunas em falta sem apagar dados.
 * Uso: npx tsx --env-file=.env scripts/safeMigrate.ts
 */
import { db } from '../db/index';
import { sql } from 'drizzle-orm';

async function safeMigrate() {
  console.log('🔧 A aplicar migrações seguras…\n');

  const steps: { label: string; query: string }[] = [
    // ── orders: colunas operacionais ──────────────────────────────────────
    { label: 'orders.accepted_by',              query: `ALTER TABLE orders ADD COLUMN IF NOT EXISTS accepted_by varchar` },
    { label: 'orders.accepted_at',              query: `ALTER TABLE orders ADD COLUMN IF NOT EXISTS accepted_at timestamp` },
    { label: 'orders.ready_at',                 query: `ALTER TABLE orders ADD COLUMN IF NOT EXISTS ready_at timestamp` },
    { label: 'orders.completed_at',             query: `ALTER TABLE orders ADD COLUMN IF NOT EXISTS completed_at timestamp` },
    { label: 'orders.completed_by',             query: `ALTER TABLE orders ADD COLUMN IF NOT EXISTS completed_by varchar` },
    { label: 'orders.sale_id',                  query: `ALTER TABLE orders ADD COLUMN IF NOT EXISTS sale_id varchar` },
    { label: 'orders.last3_phone',              query: `ALTER TABLE orders ADD COLUMN IF NOT EXISTS last3_phone varchar(3)` },
    { label: 'orders.customer_name_override',   query: `ALTER TABLE orders ADD COLUMN IF NOT EXISTS customer_name_override text` },
    { label: 'orders.staff_message',            query: `ALTER TABLE orders ADD COLUMN IF NOT EXISTS staff_message text` },
    { label: 'orders.staff_message_at',         query: `ALTER TABLE orders ADD COLUMN IF NOT EXISTS staff_message_at timestamp` },
  ];

  for (const step of steps) {
    try {
      await db.execute(sql.raw(step.query));
      console.log(`   ✓ ${step.label}`);
    } catch (err: any) {
      console.error(`   ✗ ${step.label}: ${err.message}`);
    }
  }

  console.log('\n✅ Migração concluída! Reinicia o servidor.');
  process.exit(0);
}

safeMigrate().catch(err => { console.error('❌', err); process.exit(1); });
