import { db } from '../db/index';
import { sql } from 'drizzle-orm';

async function run() {
  await db.execute(sql`
    CREATE TABLE IF NOT EXISTS snapshots (
      id varchar PRIMARY KEY DEFAULT gen_random_uuid(),
      label text NOT NULL,
      type text NOT NULL,
      date_key text NOT NULL,
      data jsonb NOT NULL,
      created_at timestamp DEFAULT now() NOT NULL
    )
  `);
  console.log('✅ Tabela snapshots criada (ou já existia).');
  process.exit(0);
}

run().catch(err => { console.error('❌', err); process.exit(1); });
