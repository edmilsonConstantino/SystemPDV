const PREFS_KEY = 'makira_pos_prefs_v1';
const RECENT_KEY = 'makira_pos_recent_products_v1';
const MAX_RECENT = 14;

/** Só a vista lista/grelha persiste — filtros e pesquisa reiniciam ao recarregar a página */
export type PosPrefs = {
  viewMode: 'grid' | 'list';
};

const defaultPrefs: PosPrefs = {
  viewMode: 'list',
};

export function loadPosPrefs(): PosPrefs {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return { ...defaultPrefs };
    const p = JSON.parse(raw) as Partial<PosPrefs>;
    return {
      viewMode: p.viewMode === 'grid' ? 'grid' : 'list',
    };
  } catch {
    return { ...defaultPrefs };
  }
}

export function savePosPrefs(prefs: PosPrefs): void {
  try {
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  } catch {
    /* quota / private mode */
  }
}

/** Migração: remover chaves antigas com filtros guardados para forçar reset limpo */
export function migratePosPrefsIfNeeded(): void {
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return;
    const p = JSON.parse(raw) as Record<string, unknown>;
    if ('onlyInStock' in p || 'lowStockOnly' in p || 'selectedCategory' in p) {
      savePosPrefs({ viewMode: p.viewMode === 'grid' ? 'grid' : 'list' });
    }
  } catch {
    /* ignore */
  }
}

export function loadRecentProductIds(): string[] {
  try {
    const raw = localStorage.getItem(RECENT_KEY);
    if (!raw) return [];
    const arr = JSON.parse(raw) as unknown;
    if (!Array.isArray(arr)) return [];
    return arr.filter((x): x is string => typeof x === 'string').slice(0, MAX_RECENT);
  } catch {
    return [];
  }
}

export function recordRecentProduct(productId: string): void {
  try {
    const cur = loadRecentProductIds().filter((id) => id !== productId);
    cur.unshift(productId);
    localStorage.setItem(RECENT_KEY, JSON.stringify(cur.slice(0, MAX_RECENT)));
  } catch {
    /* ignore */
  }
}
