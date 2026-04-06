/**
 * Cache em memória do catálogo para reduzir carga na BD com muitos GET concorrentes.
 * Invalidação em mutações (produtos, categorias, vendas que mexem no stock).
 */

const TTL_MS = Math.max(5_000, Number(process.env.CATALOG_CACHE_TTL_MS) || 45_000);

type CacheEntry<T> = { payload: T; expiresAt: number };

let productsCache: CacheEntry<unknown> | null = null;
let categoriesCache: CacheEntry<unknown> | null = null;

export async function getCachedProducts<T>(loader: () => Promise<T>): Promise<T> {
  const now = Date.now();
  if (productsCache && now < productsCache.expiresAt) {
    return productsCache.payload as T;
  }
  const payload = await loader();
  productsCache = { payload, expiresAt: now + TTL_MS };
  return payload;
}

export async function getCachedCategories<T>(loader: () => Promise<T>): Promise<T> {
  const now = Date.now();
  if (categoriesCache && now < categoriesCache.expiresAt) {
    return categoriesCache.payload as T;
  }
  const payload = await loader();
  categoriesCache = { payload, expiresAt: now + TTL_MS };
  return payload;
}

export function bustProductsCache(): void {
  productsCache = null;
}

export function bustCategoriesCache(): void {
  categoriesCache = null;
}

export function bustAllCatalogCache(): void {
  productsCache = null;
  categoriesCache = null;
}
