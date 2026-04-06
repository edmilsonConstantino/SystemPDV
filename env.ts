// env.ts - Carrega as variáveis de ambiente o mais cedo possível
import { config } from 'dotenv';
import path from 'path';

// Carregar .env do diretório raiz
const result = config({ path: path.resolve(process.cwd(), '.env') });

if (result.error) {
  console.warn('⚠️  Aviso: Arquivo .env não encontrado ou erro ao carregar');
  console.warn('   Caminho procurado:', path.resolve(process.cwd(), '.env'));
} else {
  console.log('✅ Variáveis de ambiente carregadas do .env');
}

// Base de dados: em desenvolvimento, PGlite local se DATABASE_URL estiver vazia (sem Docker / sem Postgres)
const isProd = process.env.NODE_ENV === 'production';
if (!process.env.DATABASE_URL?.trim()) {
  if (isProd) {
    console.error('❌ ERRO: DATABASE_URL é obrigatória em produção.');
    process.exit(1);
  }
  process.env.DATABASE_URL = 'pglite:./data/pglite-dev';
  console.log('📁 DATABASE_URL vazia — usando PGlite em ./data/pglite-dev (ficheiro local, zero instalação).');
  console.log('   Para Postgres remoto: defina DATABASE_URL=postgresql://… no .env\n');
}

export {};