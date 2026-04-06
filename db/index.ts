// db/index.ts — PostgreSQL remoto (pg) ou PGlite em ficheiro (sem Docker / sem servidor Postgres)
import fs from 'node:fs';
import { createRequire } from 'node:module';
import path from 'node:path';
import { PGlite } from '@electric-sql/pglite';
import { drizzle as drizzleNodePg } from 'drizzle-orm/node-postgres';
import { drizzle as drizzlePglite } from 'drizzle-orm/pglite';
import { Pool } from 'pg';
import * as schema from '../shared/schema';
import * as schemaModule from '../shared/schema';

function normalizePostgresConnectionUrl(input: string): string {
  let s = input
    .trim()
    .replace(/^\uFEFF/, '')
    .replace(/^["']|["']$/g, '');

  if (s.startsWith('/')) {
    return s;
  }

  const protoMatch = s.match(/^(postgres(?:ql)?:\/\/)/i);
  if (!protoMatch) {
    return s;
  }

  const proto = 'postgresql://';
  let rest = s.slice(protoMatch[1].length).replace(/\r?\n/g, '').trim();

  const lastAt = rest.lastIndexOf('@');
  if (lastAt <= 0) {
    return proto + rest;
  }

  const userInfo = rest.slice(0, lastAt);
  const hostPart = rest.slice(lastAt + 1);
  if (!hostPart) {
    return proto + rest;
  }

  const colonIdx = userInfo.indexOf(':');
  const user = colonIdx >= 0 ? userInfo.slice(0, colonIdx) : userInfo;
  const password = colonIdx >= 0 ? userInfo.slice(colonIdx + 1) : '';

  function safeEncodeComponent(part: string): string {
    if (!part) return part;
    try {
      return encodeURIComponent(decodeURIComponent(part));
    } catch {
      return encodeURIComponent(part);
    }
  }

  const auth =
    colonIdx >= 0
      ? `${safeEncodeComponent(user)}:${safeEncodeComponent(password)}`
      : safeEncodeComponent(user);

  return `${proto}${auth}@${hostPart}`;
}

function getPostgresUrlForPool(): string {
  const raw = process.env.DATABASE_URL;
  if (!raw || !raw.trim()) {
    throw new Error('DATABASE_URL is required for modo PostgreSQL');
  }
  return normalizePostgresConnectionUrl(raw);
}

function decodeUrlPart(s: string): string {
  try {
    return decodeURIComponent(s);
  } catch {
    return s;
  }
}

function buildPoolConfigFromUrl(urlString: string): ConstructorParameters<typeof Pool>[0] {
  if (urlString.startsWith('/')) {
    return {
      connectionString: urlString,
      max: 20,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
    };
  }

  let u: URL;
  try {
    u = new URL(urlString, 'postgres://base');
  } catch {
    console.error('❌ DATABASE_URL não é uma URI PostgreSQL válida.');
    console.error('   Formato: postgresql://utilizador:senha@HOST:PORTA/nome_base');
    if (/host:port|user:password/i.test(urlString)) {
      console.error('   Parece um placeholder. Para zero instalação local use: DATABASE_URL=pglite:./data/pglite-dev');
    }
    throw new Error('DATABASE_URL inválida');
  }

  const sslMode = u.searchParams.get('sslmode');
  const hostLower = (u.hostname || '').toLowerCase();
  const looksRemoteHosted =
    hostLower.includes('supabase.co') ||
    hostLower.includes('neon.tech') ||
    hostLower.includes('render.com');
  const useSsl =
    process.env.NODE_ENV === 'production' ||
    sslMode === 'require' ||
    sslMode === 'verify-full' ||
    sslMode === 'prefer' ||
    (looksRemoteHosted && sslMode !== 'disable');

  const database = u.pathname.replace(/^\//, '') || undefined;
  const port = u.port ? parseInt(u.port, 10) : 5432;
  const socketDir = u.searchParams.get('host');
  const user = u.username ? decodeUrlPart(u.username) : undefined;
  const password = u.password !== '' ? decodeUrlPart(u.password) : undefined;

  const base = {
    max: 20,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    ssl: useSsl ? ({ rejectUnauthorized: false } as const) : false,
  };

  if (u.hostname) {
    return { ...base, host: u.hostname, port, user, password, database };
  }

  if (socketDir) {
    return { ...base, host: socketDir, user, password, database };
  }

  return { ...base, host: '127.0.0.1', port, user, password, database };
}

function isPgliteUrl(url: string): boolean {
  return url.trim().startsWith('pglite:');
}

function pgliteDataDirFromEnv(): string {
  const raw = process.env.DATABASE_URL!.trim();
  const rest = raw.slice('pglite:'.length).trim();
  const rel = rest || './data/pglite-dev';
  return path.isAbsolute(rel) ? rel : path.resolve(process.cwd(), rel);
}

let pool: Pool | null = null;
let pgliteClient: PGlite | null = null;

const dbUrl = process.env.DATABASE_URL?.trim() ?? '';

async function createPgliteLayer() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error(
      'Em produção use postgresql://… (Supabase, RDS, etc.). PGlite (pglite:…) é só para desenvolvimento local.',
    );
  }

  const dataDir = pgliteDataDirFromEnv();
  fs.mkdirSync(dataDir, { recursive: true });
  console.log(`🗄️  PGlite (Postgres embutido) — dados em: ${dataDir}`);

  const client = await PGlite.create(dataDir);
  pgliteClient = client;

  const d = drizzlePglite({ client, schema });

  const require = createRequire(import.meta.url);
  const { pushSchema } = require('drizzle-kit/api') as typeof import('drizzle-kit/api');
  const push = await pushSchema(schemaModule as Record<string, unknown>, d as never);
  await push.apply();
  console.log('✅ Schema PGlite sincronizado (drizzle-kit push).');

  pool = null;
  return d;
}

function createPgLayer() {
  const p = new Pool(buildPoolConfigFromUrl(getPostgresUrlForPool()));
  pool = p;

  p.on('connect', () => {
    console.log('✅ Nova conexão estabelecida com PostgreSQL');
  });

  p.on('error', (err) => {
    console.error('❌ Erro inesperado no PostgreSQL:', err);
    process.exit(-1);
  });

  console.log('🗄️  PostgreSQL (driver pg) — pool configurado.');
  return drizzleNodePg(p, { schema });
}

const db = isPgliteUrl(dbUrl) ? await createPgliteLayer() : createPgLayer();

export { db, pool };

export async function testConnection() {
  try {
    if (pgliteClient) {
      const batches = await pgliteClient.exec(
        `SELECT NOW()::text as now, current_database() as database, version() as version`,
      );
      const rows = batches[0]?.rows as { now: string; database: string; version: string }[] | undefined;
      const row = rows?.[0];
      console.log('🔗 Conexão PGlite OK!');
      if (row) {
        console.log(`   📅 ${row.now}`);
        console.log(`   🗄️  ${row.database}`);
        console.log(`   📌 ${row.version?.split(',')?.[0]}`);
      }
      return true;
    }

    const client = await pool!.connect();
    const result = await client.query(
      'SELECT NOW() as now, current_database() as database, version() as version',
    );
    console.log('🔗 Conexão PostgreSQL bem-sucedida!');
    console.log(`   📅 Hora do servidor: ${result.rows[0].now}`);
    console.log(`   🗄️  Database: ${result.rows[0].database}`);
    console.log(`   📌 Versão: ${result.rows[0].version.split(',')[0]}`);
    client.release();
    return true;
  } catch (error) {
    console.error('❌ Falha ao conectar com PostgreSQL:');
    console.error('   Erro:', error instanceof Error ? error.message : error);
    const envUrl = process.env.DATABASE_URL;
    if (envUrl && !isPgliteUrl(envUrl)) {
      try {
        const urlObj = new URL(normalizePostgresConnectionUrl(envUrl), 'postgres://base');
        console.error('   Host:', urlObj.hostname || '(socket)');
        console.error('   Database:', urlObj.pathname.replace(/^\//, '') || '(default)');
      } catch {
        console.error('   (não foi possível analisar a DATABASE_URL)');
      }
    }
    throw error;
  }
}

export async function closeDatabase() {
  try {
    if (pgliteClient) {
      await pgliteClient.close();
      console.log('🔌 PGlite fechado');
      return;
    }
    if (pool) {
      await pool.end();
      console.log('🔌 Pool PostgreSQL fechado');
    }
  } catch (error) {
    console.error('❌ Erro ao fechar base de dados:', error);
  }
}

export default db;
