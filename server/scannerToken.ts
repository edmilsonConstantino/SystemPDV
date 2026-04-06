/**
 * In-memory store for remote scanner tokens.
 * Token links a POS session to barcodes sent from a mobile/companion device.
 */

/** Sessão do scanner remoto: 7 dias desde criação ou última renovação manual */
export const TOKEN_TTL_MS = 7 * 24 * 60 * 60 * 1000;

export interface ScannerSession {
  token: string;
  userId: string;
  userName: string;
  createdAt: number;
  lastAccess: number;
  userAgent: string;
  deviceType: 'mobile' | 'desktop' | 'unknown';
  pendingBarcodes: string[];
}

const tokens = new Map<string, ScannerSession>();

function parseDeviceType(ua: string): 'mobile' | 'desktop' | 'unknown' {
  const m = /Mobile|Android|iPhone|iPad|iPod|webOS|BlackBerry|IEMobile|Opera Mini/i.test(ua);
  return m ? 'mobile' : 'desktop';
}

function pruneExpired() {
  const now = Date.now();
  for (const [token, entry] of tokens.entries()) {
    if (now - entry.createdAt > TOKEN_TTL_MS) tokens.delete(token);
  }
}

export function createScannerToken(
  userId: string,
  userName: string,
  userAgent = ''
): { token: string } {
  pruneExpired();
  const token = `sc_${userId.slice(0, 8)}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  tokens.set(token, {
    token,
    userId,
    userName,
    createdAt: Date.now(),
    lastAccess: Date.now(),
    userAgent,
    deviceType: parseDeviceType(userAgent),
    pendingBarcodes: [],
  });
  return { token };
}

export function consumeBarcodes(token: string, userId: string): string[] {
  const entry = tokens.get(token);
  if (!entry || entry.userId !== userId) return [];
  if (Date.now() - entry.createdAt > TOKEN_TTL_MS) {
    tokens.delete(token);
    return [];
  }
  const barcodes = entry.pendingBarcodes.slice();
  entry.pendingBarcodes.length = 0;
  return barcodes;
}

export function pushBarcode(token: string, barcode: string, userAgent = ''): boolean {
  const entry = tokens.get(token);
  if (!entry) return false;
  if (Date.now() - entry.createdAt > TOKEN_TTL_MS) {
    tokens.delete(token);
    return false;
  }
  entry.pendingBarcodes.push(barcode);
  if (userAgent) {
    entry.lastAccess = Date.now();
    entry.userAgent = userAgent;
    entry.deviceType = parseDeviceType(userAgent);
  }
  return true;
}

export function pingToken(token: string, userAgent = ''): ScannerSession | null {
  const entry = tokens.get(token);
  if (!entry) return null;
  if (Date.now() - entry.createdAt > TOKEN_TTL_MS) {
    tokens.delete(token);
    return null;
  }
  entry.lastAccess = Date.now();
  /* Não alterar createdAt no ping — evita “renovação infinita”; TTL conta desde criação/renovar */
  if (userAgent) {
    entry.userAgent = userAgent;
    entry.deviceType = parseDeviceType(userAgent);
  }
  return { ...entry };
}

export function validateToken(token: string): { userId: string } | null {
  const entry = tokens.get(token);
  if (!entry) return null;
  if (Date.now() - entry.createdAt > TOKEN_TTL_MS) {
    tokens.delete(token);
    return null;
  }
  return { userId: entry.userId };
}

export function listSessions(userId: string): Omit<ScannerSession, 'pendingBarcodes'>[] {
  pruneExpired();
  const now = Date.now();
  return Array.from(tokens.values())
    .filter((e) => e.userId === userId && now - e.createdAt < TOKEN_TTL_MS)
    .map(({ pendingBarcodes: _, ...s }) => s)
    .sort((a, b) => b.createdAt - a.createdAt);
}

export function revokeToken(token: string, userId: string): boolean {
  const entry = tokens.get(token);
  if (!entry || entry.userId !== userId) return false;
  tokens.delete(token);
  return true;
}

export function renewToken(
  oldToken: string,
  userId: string,
  userName: string,
  _userAgent = ''
): { token: string } | null {
  const entry = tokens.get(oldToken);
  if (!entry || entry.userId !== userId) return null;
  entry.createdAt = Date.now();
  entry.lastAccess = Date.now();
  return { token: oldToken };
}
