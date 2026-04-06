import { db } from './index';
import { users, categories, products } from '../shared/schema';
import bcrypt from 'bcrypt';
import { count, eq } from 'drizzle-orm';

/** Senha inicial do admin: dev/testes = admin123; produção = senha123 (ou ADMIN_SEED_PASSWORD). */
function getDefaultAdminPassword(): string {
  if (process.env.ADMIN_SEED_PASSWORD?.trim()) {
    return process.env.ADMIN_SEED_PASSWORD.trim();
  }
  return process.env.NODE_ENV === 'production' ? 'senha123' : 'admin123';
}

// Função para popular o banco com dados padrão
export async function seedDatabase() {
  console.log('🌱 Populando banco de dados...');

  const hashedPassword = await bcrypt.hash(getDefaultAdminPassword(), 10);
  
  // Criar usuário admin
  console.log('Criando usuário administrador...');
  await db.insert(users).values([
    {
      name: 'Administrador',
      username: 'admin',
      password: hashedPassword,
      role: 'admin',
      avatar: '👨‍💼'
    }
  ]);

  console.log('✓ Usuário administrador criado');

  // Criar categorias
  console.log('Criando categorias...');
  const categoriesResult = await db.insert(categories).values([
    { name: 'Frutas', color: 'bg-orange-100 text-orange-800 border-orange-200' },
    { name: 'Verduras', color: 'bg-green-100 text-green-800 border-green-200' },
    { name: 'Grãos', color: 'bg-amber-100 text-amber-800 border-amber-200' },
    { name: 'Bebidas', color: 'bg-blue-100 text-blue-800 border-blue-200' },
    { name: 'Laticínios', color: 'bg-purple-100 text-purple-800 border-purple-200' }
  ]).returning();

  const [frutas, verduras, graos, bebidas, laticinios] = categoriesResult;

  console.log('✓ Categorias criadas');

  // Criar produtos de exemplo
  console.log('Criando produtos de exemplo...');
  await db.insert(products).values([
    // Frutas
    {
      sku: 'FRUTA001',
      name: 'Banana Prata',
      categoryId: frutas.id,
      price: '6.50',
      costPrice: '4.00',
      stock: '50',
      minStock: '10',
      unit: 'kg',
      image: '🍌'
    },
    {
      sku: 'FRUTA002',
      name: 'Maçã Fuji',
      categoryId: frutas.id,
      price: '8.90',
      costPrice: '5.50',
      stock: '30',
      minStock: '10',
      unit: 'kg',
      image: '🍎'
    },
    {
      sku: 'FRUTA003',
      name: 'Laranja Pera',
      categoryId: frutas.id,
      price: '5.50',
      costPrice: '3.20',
      stock: '45',
      minStock: '15',
      unit: 'kg',
      image: '🍊'
    },
    // Verduras
    {
      sku: 'VERD001',
      name: 'Alface Americana',
      categoryId: verduras.id,
      price: '4.50',
      costPrice: '2.50',
      stock: '25',
      minStock: '10',
      unit: 'un',
      image: '🥬'
    },
    {
      sku: 'VERD002',
      name: 'Tomate',
      categoryId: verduras.id,
      price: '7.90',
      costPrice: '5.00',
      stock: '40',
      minStock: '15',
      unit: 'kg',
      image: '🍅'
    },
    // Grãos
    {
      sku: 'GRAO001',
      name: 'Arroz Integral 1kg',
      categoryId: graos.id,
      price: '8.90',
      costPrice: '5.50',
      stock: '100',
      minStock: '20',
      unit: 'pack',
      image: '🌾'
    },
    {
      sku: 'GRAO002',
      name: 'Feijão Preto 1kg',
      categoryId: graos.id,
      price: '9.50',
      costPrice: '6.00',
      stock: '80',
      minStock: '20',
      unit: 'pack',
      image: '🫘'
    },
    // Bebidas
    {
      sku: 'BEB001',
      name: 'Água Mineral 500ml',
      categoryId: bebidas.id,
      price: '2.50',
      costPrice: '1.20',
      stock: '200',
      minStock: '50',
      unit: 'un',
      image: '💧'
    },
    // Laticínios
    {
      sku: 'LAT001',
      name: 'Leite Integral 1L',
      categoryId: laticinios.id,
      price: '5.90',
      costPrice: '4.00',
      stock: '60',
      minStock: '20',
      unit: 'un',
      image: '🥛'
    },
    {
      sku: 'LAT002',
      name: 'Queijo Minas Frescal',
      categoryId: laticinios.id,
      price: '28.90',
      costPrice: '18.00',
      stock: '15',
      minStock: '5',
      unit: 'kg',
      image: '🧀'
    }
  ]);

  console.log('✓ Produtos criados');
  console.log('\n✅ Banco de dados populado com sucesso!');
  console.log('\n📋 Credenciais padrão:');
  console.log(`   Admin: username=admin, senha=${getDefaultAdminPassword()}\n`);
}

async function ensureAdminExists() {
  console.log('🔐 Verificando usuário admin...');
  
  const existingAdmin = await db.select().from(users).where(eq(users.username, 'admin')).limit(1);
  
  if (existingAdmin.length > 0) {
    console.log('✓ Usuário admin já existe');
    return;
  }
  
  const plain = getDefaultAdminPassword();
  console.log('📝 Criando usuário admin padrão...');
  const hashedPassword = await bcrypt.hash(plain, 10);

  await db.insert(users).values({
    name: 'Administrador',
    username: 'admin',
    password: hashedPassword,
    role: 'admin',
    avatar: 'A',
  });

  console.log(`✓ Usuário admin criado (username: admin, senha: ${plain})`);
}

const DEFAULT_GESTOR_USERNAME = 'gestor';
const DEFAULT_GESTOR_PASSWORD = 'OlaOla123';

const DEMO_SELLER_USERNAME = 'vendedor';

async function ensureDemoSellerExists() {
  if (process.env.NODE_ENV === 'production') return;

  console.log('🔐 Verificando usuário vendedor (demo)...');

  const existing = await db
    .select()
    .from(users)
    .where(eq(users.username, DEMO_SELLER_USERNAME))
    .limit(1);

  if (existing.length > 0) {
    console.log('✓ Usuário vendedor já existe');
    return;
  }

  const plain = getDefaultAdminPassword();
  const hashedPassword = await bcrypt.hash(plain, 10);

  await db.insert(users).values({
    name: 'Vendedor Demo',
    username: DEMO_SELLER_USERNAME,
    password: hashedPassword,
    role: 'seller',
    avatar: '👤',
  });

  console.log(`✓ Vendedor demo criado (username: ${DEMO_SELLER_USERNAME}, senha: ${plain})`);
}

async function ensureGestorExists() {
  console.log('🔐 Verificando usuário gestor...');

  const existing = await db
    .select()
    .from(users)
    .where(eq(users.username, DEFAULT_GESTOR_USERNAME))
    .limit(1);

  if (existing.length > 0) {
    console.log('✓ Usuário gestor já existe');
    return;
  }

  console.log('📝 Criando usuário gestor padrão...');
  const hashedPassword = await bcrypt.hash(DEFAULT_GESTOR_PASSWORD, 10);

  await db.insert(users).values({
    name: 'Gestor',
    username: DEFAULT_GESTOR_USERNAME,
    password: hashedPassword,
    role: 'manager',
    avatar: '👩‍💼',
  });

  console.log(
    `✓ Usuário gestor criado (username: ${DEFAULT_GESTOR_USERNAME}, senha: ${DEFAULT_GESTOR_PASSWORD})`,
  );
}

export async function initializeDatabase() {
  const isProduction = process.env.NODE_ENV === 'production';
  const environment = isProduction ? 'PRODUÇÃO' : 'DESENVOLVIMENTO';
  
  console.log(`🔍 Verificando banco de dados (${environment})...`);
  
  try {
    // SEMPRE garantir que admin e gestor existem (produção e desenvolvimento)
    await ensureAdminExists();
    await ensureGestorExists();
    await ensureDemoSellerExists();

    // Dados de exemplo: seedSampleData evita duplicar se já houver categorias
    if (!isProduction) {
      console.log('🌱 Garantindo dados de exemplo (categorias/produtos)...');
      await seedSampleData();
      logDevCredentials();
    }
  } catch (error) {
    console.error('❌ Erro ao inicializar banco de dados:', error);
    logDatabaseConnectionHints(error);

    if (isProduction) {
      console.error('🚨 ERRO CRÍTICO: Não foi possível inicializar o banco de dados em produção!');
      throw error;
    }

    console.warn('⚠️  Servidor continuará mas pode não ter dados iniciais');
  }
}

function isConnectionRefused(err: unknown): boolean {
  if (!err || typeof err !== 'object') return false;
  const o = err as { code?: string; errors?: Array<{ code?: string }> };
  if (o.code === 'ECONNREFUSED') return true;
  return Array.isArray(o.errors) && o.errors.some((e) => e?.code === 'ECONNREFUSED');
}

/** Mensagens úteis quando o Postgres não está acessível (Docker parado, porta errada, etc.) */
function logDevCredentials() {
  const plain = getDefaultAdminPassword();
  console.log('');
  console.log('📋 Contas para testes (desenvolvimento):');
  console.log(`   Admin     →  admin / ${plain}`);
  console.log(`   Gestor    →  ${DEFAULT_GESTOR_USERNAME} / ${DEFAULT_GESTOR_PASSWORD}`);
  console.log(`   Vendedor  →  ${DEMO_SELLER_USERNAME} / ${plain}`);
  console.log('');
}

function logDatabaseConnectionHints(err: unknown) {
  if (!isConnectionRefused(err)) return;
  console.error('');
  console.error('💡 ECONNREFUSED — nada a escutar nesse host/porta (modo postgresql://).');
  console.error('   • Mais simples: use PGlite no .env (sem servidor): DATABASE_URL=pglite:./data/pglite-dev');
  console.error('   • Ou Postgres nativo/Docker com URL postgresql://… e serviço a correr.');
  console.error('');
}

async function seedSampleData() {
  try {
    const [catCount] = await db.select({ count: count() }).from(categories);
    if (Number(catCount.count) > 0) {
      console.log('✓ Dados de exemplo já existem');
      return;
    }

    const categoriesResult = await db.insert(categories).values([
      { name: 'Frutas', color: 'bg-orange-100 text-orange-800 border-orange-200' },
      { name: 'Verduras', color: 'bg-green-100 text-green-800 border-green-200' },
      { name: 'Grãos', color: 'bg-amber-100 text-amber-800 border-amber-200' },
      { name: 'Bebidas', color: 'bg-blue-100 text-blue-800 border-blue-200' },
      { name: 'Laticínios', color: 'bg-purple-100 text-purple-800 border-purple-200' }
    ]).returning();

    const [frutas, verduras, graos, bebidas, laticinios] = categoriesResult;

    await db.insert(products).values([
      { sku: 'FRUTA001', name: 'Banana Prata', categoryId: frutas.id, price: '6.50', costPrice: '4.00', stock: '50', minStock: '10', unit: 'kg', image: '🍌' },
      { sku: 'FRUTA002', name: 'Maçã Fuji', categoryId: frutas.id, price: '8.90', costPrice: '5.50', stock: '30', minStock: '10', unit: 'kg', image: '🍎' },
      { sku: 'FRUTA003', name: 'Laranja Pera', categoryId: frutas.id, price: '5.50', costPrice: '3.20', stock: '45', minStock: '15', unit: 'kg', image: '🍊' },
      { sku: 'VERD001', name: 'Alface Americana', categoryId: verduras.id, price: '4.50', costPrice: '2.50', stock: '25', minStock: '10', unit: 'un', image: '🥬' },
      { sku: 'VERD002', name: 'Tomate', categoryId: verduras.id, price: '7.90', costPrice: '5.00', stock: '40', minStock: '15', unit: 'kg', image: '🍅' },
      { sku: 'GRAO001', name: 'Arroz Integral 1kg', categoryId: graos.id, price: '8.90', costPrice: '5.50', stock: '100', minStock: '20', unit: 'pack', image: '🌾' },
      { sku: 'GRAO002', name: 'Feijão Preto 1kg', categoryId: graos.id, price: '9.50', costPrice: '6.00', stock: '80', minStock: '20', unit: 'pack', image: '🫘' },
      { sku: 'BEB001', name: 'Água Mineral 500ml', categoryId: bebidas.id, price: '2.50', costPrice: '1.20', stock: '200', minStock: '50', unit: 'un', image: '💧' },
      { sku: 'LAT001', name: 'Leite Integral 1L', categoryId: laticinios.id, price: '5.90', costPrice: '4.00', stock: '60', minStock: '20', unit: 'un', image: '🥛' },
      { sku: 'LAT002', name: 'Queijo Minas Frescal', categoryId: laticinios.id, price: '28.90', costPrice: '18.00', stock: '15', minStock: '5', unit: 'kg', image: '🧀' },
    ]);

    console.log('✓ Dados de exemplo criados (5 categorias, 10 produtos)');
  } catch (e) {
    console.log('Dados de exemplo já existem ou erro:', e);
  }
}
