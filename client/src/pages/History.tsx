import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/lib/auth';
import {
  History, Search, Plus, Pencil, Trash2, LogIn, LogOut,
  PackagePlus, ShoppingBag, Download, RefreshCw, User,
  ShoppingCart, Tag, Settings, FileText, ArrowRight,
  CalendarDays, X, Eye, Receipt,
} from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';
import { format, isToday, isYesterday, startOfWeek, formatDistanceToNow, isSameDay, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface AuditLog {
  id: number;
  userId: string;
  action: string;
  entityType: string;
  entityId?: string;
  details?: any;
  createdAt: string;
}

interface UserItem { id: string; name: string; username: string }

// ── Configuração visual por tipo de acção ──────────────────────────────────
const ACTION_CONFIG: Record<string, {
  label: string;
  verb: string;       // frase activa: "criou o produto"
  Icon: any;
  ring: string; iconBg: string; iconColor: string; badge: string;
}> = {
  CREATE_PRODUCT:  { label: 'Produto criado',     verb: 'criou o produto',        Icon: Plus,         ring: 'ring-emerald-200', iconBg: 'bg-emerald-50', iconColor: 'text-emerald-600', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  UPDATE_PRODUCT:  { label: 'Produto editado',     verb: 'editou o produto',        Icon: Pencil,       ring: 'ring-blue-200',    iconBg: 'bg-blue-50',    iconColor: 'text-blue-600',    badge: 'bg-blue-50 text-blue-700 border-blue-200'           },
  DELETE_PRODUCT:  { label: 'Produto eliminado',   verb: 'eliminou o produto',      Icon: Trash2,       ring: 'ring-red-200',     iconBg: 'bg-red-50',     iconColor: 'text-red-600',     badge: 'bg-red-50 text-red-700 border-red-200'             },
  INCREASE_STOCK:  { label: 'Stock reposto',       verb: 'aumentou o stock de',     Icon: PackagePlus,  ring: 'ring-emerald-200', iconBg: 'bg-emerald-50', iconColor: 'text-emerald-600', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  CREATE_SALE:     { label: 'Venda registada',     verb: 'registou uma venda',      Icon: ShoppingBag,  ring: 'ring-emerald-200', iconBg: 'bg-emerald-50', iconColor: 'text-emerald-600', badge: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  CREATE_ORDER:    { label: 'Pedido criado',       verb: 'criou um pedido',         Icon: ShoppingCart, ring: 'ring-indigo-200',  iconBg: 'bg-indigo-50',  iconColor: 'text-indigo-600',  badge: 'bg-indigo-50 text-indigo-700 border-indigo-200'     },
  UPDATE_ORDER:    { label: 'Pedido atualizado',   verb: 'atualizou o pedido',      Icon: ShoppingCart, ring: 'ring-blue-200',    iconBg: 'bg-blue-50',    iconColor: 'text-blue-600',    badge: 'bg-blue-50 text-blue-700 border-blue-200'           },
  CREATE_CATEGORY: { label: 'Categoria criada',    verb: 'criou a categoria',       Icon: Tag,          ring: 'ring-violet-200',  iconBg: 'bg-violet-50',  iconColor: 'text-violet-600',  badge: 'bg-violet-50 text-violet-700 border-violet-200'     },
  UPDATE_CATEGORY: { label: 'Categoria editada',   verb: 'editou a categoria',      Icon: Tag,          ring: 'ring-violet-200',  iconBg: 'bg-violet-50',  iconColor: 'text-violet-600',  badge: 'bg-violet-50 text-violet-700 border-violet-200'     },
  DELETE_CATEGORY: { label: 'Categoria eliminada', verb: 'eliminou a categoria',    Icon: Tag,          ring: 'ring-red-200',     iconBg: 'bg-red-50',     iconColor: 'text-red-600',     badge: 'bg-red-50 text-red-700 border-red-200'             },
  CREATE_USER:     { label: 'Utilizador criado',   verb: 'criou o utilizador',      Icon: User,         ring: 'ring-violet-200',  iconBg: 'bg-violet-50',  iconColor: 'text-violet-600',  badge: 'bg-violet-50 text-violet-700 border-violet-200'     },
  UPDATE_USER:     { label: 'Utilizador editado',  verb: 'editou o utilizador',     Icon: User,         ring: 'ring-blue-200',    iconBg: 'bg-blue-50',    iconColor: 'text-blue-600',    badge: 'bg-blue-50 text-blue-700 border-blue-200'           },
  DELETE_USER:     { label: 'Utilizador removido', verb: 'removeu o utilizador',    Icon: User,         ring: 'ring-red-200',     iconBg: 'bg-red-50',     iconColor: 'text-red-600',     badge: 'bg-red-50 text-red-700 border-red-200'             },
  LOGIN:           { label: 'Início de sessão',    verb: 'entrou no sistema',       Icon: LogIn,        ring: 'ring-gray-200',    iconBg: 'bg-gray-100',   iconColor: 'text-gray-600',    badge: 'bg-gray-100 text-gray-600 border-gray-200'         },
  LOGOUT:          { label: 'Fim de sessão',       verb: 'saiu do sistema',         Icon: LogOut,       ring: 'ring-gray-200',    iconBg: 'bg-gray-100',   iconColor: 'text-gray-500',    badge: 'bg-gray-100 text-gray-500 border-gray-200'         },
  EXPORT:          { label: 'Exportação CSV',      verb: 'exportou dados',          Icon: Download,     ring: 'ring-amber-200',   iconBg: 'bg-amber-50',   iconColor: 'text-amber-600',   badge: 'bg-amber-50 text-amber-700 border-amber-200'       },
  UPDATE_SETTINGS: { label: 'Configurações alteradas', verb: 'alterou as configurações', Icon: Settings, ring: 'ring-gray-200',  iconBg: 'bg-gray-100',   iconColor: 'text-gray-600',    badge: 'bg-gray-100 text-gray-600 border-gray-200'         },
};

function getActionConfig(action: string) {
  if (ACTION_CONFIG[action]) return ACTION_CONFIG[action];
  return {
    label: action.replace(/_/g, ' ').toLowerCase().replace(/^\w/, c => c.toUpperCase()),
    verb: 'realizou uma acção',
    Icon: FileText,
    ring: 'ring-gray-200', iconBg: 'bg-gray-100', iconColor: 'text-gray-500',
    badge: 'bg-gray-100 text-gray-600 border-gray-200',
  };
}

// ── Detalhes legíveis ──────────────────────────────────────────────────────
const FIELD_LABELS: Record<string, string> = {
  name: 'Nome', price: 'Preço de venda', costPrice: 'Preço de custo',
  stock: 'Quantidade em stock', minStock: 'Stock mínimo',
  sku: 'SKU', barcode: 'Código de barras', unit: 'Unidade', categoryId: 'Categoria',
};

function ChangeRow({ label, from, to }: { label: string; from: string; to: string }) {
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="text-[11px] font-semibold text-gray-500 min-w-[90px]">{label}</span>
      <span className="rounded-md bg-red-50 px-1.5 py-0.5 text-[11px] text-red-600 line-through">{from}</span>
      <ArrowRight className="h-3 w-3 shrink-0 text-gray-300" />
      <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-700">{to}</span>
    </div>
  );
}

function LogDetails({ log }: { log: AuditLog }) {
  const d = log.details || {};

  if (log.action === 'UPDATE_PRODUCT' && d.changes) {
    const raw = d.changes as Record<string, any>;
    const entries = Object.entries(raw).filter(([field]) => field !== 'image');
    if (entries.length === 0) return <p className="mt-1.5 text-[11px] text-gray-400 italic">Nenhuma alteração foi registada nesta acção.</p>;

    // Detectar formato: novo = { de, para }, antigo = valor directo
    const isNewFormat = entries.some(([, val]) => val !== null && typeof val === 'object' && ('de' in val || 'para' in val));

    return (
      <div className="mt-2.5 space-y-2 rounded-xl border border-gray-100 bg-gray-50/80 px-3.5 py-3">
        <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">O que foi alterado</p>
        {d.productName && (
          <p className="text-[12px] font-semibold text-gray-700">{d.productName}</p>
        )}
        <div className="space-y-1.5 pt-0.5">
          {isNewFormat
            ? entries.map(([field, val]) => (
                <ChangeRow key={field} label={FIELD_LABELS[field] || field} from={String(val?.de ?? '—')} to={String(val?.para ?? '—')} />
              ))
            : entries.map(([field, val]) => (
                <div key={field} className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] font-semibold text-gray-500 min-w-[90px]">{FIELD_LABELS[field] || field}</span>
                  <span className="rounded-md bg-emerald-50 px-1.5 py-0.5 text-[11px] font-semibold text-emerald-700">{String(val)}</span>
                  <span className="text-[10px] text-gray-400 italic">(valor anterior não disponível)</span>
                </div>
              ))
          }
        </div>
      </div>
    );
  }

  if (log.action === 'INCREASE_STOCK') {
    const fmtQty = (v: any) => {
      const n = parseFloat(String(v));
      return isNaN(n) ? String(v) : (Number.isInteger(n) ? String(n) : n.toLocaleString('pt-PT'));
    };
    const prev = fmtQty(d.previousStock);
    const next = fmtQty(d.newStock);
    const added = fmtQty(d.quantityAdded);
    return (
      <div className="mt-2.5 rounded-xl border border-gray-100 bg-gray-50/80 px-3.5 py-3 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Stock actualizado</span>
          <span className="rounded-md bg-emerald-100 px-2 py-0.5 text-[11px] font-bold text-emerald-700">
            +{added} unidades
          </span>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[12px]">
          <span className="text-gray-500">Antes:</span>
          <span className="font-semibold text-gray-700">{prev} un.</span>
          <ArrowRight className="h-3.5 w-3.5 text-gray-300" />
          <span className="text-gray-500">Agora:</span>
          <span className="font-bold text-emerald-700">{next} un.</span>
        </div>
        {d.priceChanged && (
          <ChangeRow label="Preço de venda" from={String(d.previousPrice)} to={String(d.newPrice)} />
        )}
      </div>
    );
  }

  if (d.name) {
    return (
      <p className="mt-1 text-[12px] font-medium text-gray-500">
        {d.name}
      </p>
    );
  }

  return null;
}

// ── Modal de detalhe de venda ──────────────────────────────────────────────
const PAYMENT_LABELS: Record<string, string> = {
  cash: 'Dinheiro', card: 'Cartão', mpesa: 'M-Pesa',
  emola: 'e-Mola', pos: 'POS', bank: 'Transferência', pix: 'PIX',
};

function SaleDetailModal({ log, open, onClose }: { log: AuditLog | null; open: boolean; onClose: () => void }) {
  const d = log?.details || {};
  const items: any[] = d.items || [];
  const total = parseFloat(d.total || '0');
  const hasItems = items.length > 0;

  return (
    <Dialog open={open} onOpenChange={v => !v && onClose()}>
      <DialogContent className="max-w-md rounded-2xl p-0 overflow-hidden">
        {/* Cabeçalho */}
        <div className="bg-gradient-to-br from-[#c0392b] via-[#a93226] to-[#922b21] px-5 py-4">
          <div className="banner-texture" />
          <DialogHeader className="relative">
            <div className="flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/25">
                <Receipt className="h-4.5 w-4.5 text-white" />
              </div>
              <div>
                <DialogTitle className="text-base font-extrabold text-white">Detalhe da Venda</DialogTitle>
                {log && (
                  <p className="text-[11px] text-white/60 mt-0.5">
                    {format(new Date(log.createdAt), "d 'de' MMMM 'de' yyyy 'às' HH:mm", { locale: ptBR })}
                  </p>
                )}
              </div>
            </div>
          </DialogHeader>
        </div>

        {/* Corpo */}
        <div className="px-5 py-4 space-y-4">
          {!hasItems && (
            <div className="py-6 text-center space-y-1">
              <p className="text-[12px] font-semibold text-gray-600">Detalhes de itens não disponíveis.</p>
              <p className="text-[11px] text-gray-400">Esta venda foi registada antes do registo detalhado de itens.</p>
            </div>
          )}

          {log && (
            <>
              {/* Resumo */}
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl bg-gray-50 px-3 py-2.5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Total</p>
                  <p className="mt-0.5 text-lg font-black text-gray-900">{formatCurrency(total)}</p>
                </div>
                <div className="rounded-xl bg-gray-50 px-3 py-2.5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Pagamento</p>
                  <p className="mt-0.5 text-sm font-bold text-gray-700">{PAYMENT_LABELS[d.paymentMethod] || d.paymentMethod || '—'}</p>
                </div>
              </div>

              {/* Itens */}
              {hasItems && (
                <div>
                  <p className="mb-2 text-[10px] font-bold uppercase tracking-wider text-gray-400">
                    {items.length} {items.length === 1 ? 'item vendido' : 'itens vendidos'}
                  </p>
                  <div className="divide-y divide-gray-100 rounded-xl border border-gray-200 overflow-hidden">
                    {items.map((item: any, i: number) => (
                      <div key={i} className="flex items-center justify-between gap-3 px-3.5 py-2.5">
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-semibold text-gray-800">{item.productName}</p>
                          <p className="text-[11px] text-gray-400">
                            {item.quantity} {item.unit} × {formatCurrency(item.priceAtSale)}
                          </p>
                        </div>
                        <p className="shrink-0 text-[13px] font-bold text-gray-900">
                          {formatCurrency(item.quantity * item.priceAtSale)}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Troco (se aplicável) */}
              {d.amountReceived && (
                <div className="flex items-center justify-between rounded-xl bg-emerald-50 px-4 py-2.5 text-[12px]">
                  <span className="font-semibold text-emerald-700">Recebido</span>
                  <span className="font-bold text-emerald-700">{formatCurrency(parseFloat(d.amountReceived))}</span>
                </div>
              )}
              {d.change && parseFloat(d.change) > 0 && (
                <div className="flex items-center justify-between rounded-xl bg-blue-50 px-4 py-2.5 text-[12px]">
                  <span className="font-semibold text-blue-700">Troco devolvido</span>
                  <span className="font-bold text-blue-700">{formatCurrency(parseFloat(d.change))}</span>
                </div>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ── Helpers de data ────────────────────────────────────────────────────────
function dayHeading(dateStr: string) {
  const d = new Date(dateStr);
  if (isToday(d)) return 'Hoje';
  if (isYesterday(d)) return 'Ontem';
  return format(d, "EEEE, d 'de' MMMM 'de' yyyy", { locale: ptBR });
}

function toDateStr(d: Date) {
  return format(d, 'yyyy-MM-dd');
}

// ── Chips de categoria ─────────────────────────────────────────────────────
const CATEGORY_CHIPS = [
  { id: 'all',     label: 'Todas as acções' },
  { id: 'product', label: 'Produtos' },
  { id: 'stock',   label: 'Stock' },
  { id: 'sale',    label: 'Vendas' },
  { id: 'order',   label: 'Pedidos' },
  { id: 'user',    label: 'Utilizadores' },
  { id: 'login',   label: 'Sessões' },
];

// ── Atalhos de data ────────────────────────────────────────────────────────
const DATE_SHORTCUTS = [
  { id: 'all',   label: 'Todos os dias' },
  { id: 'today', label: 'Hoje' },
  { id: 'yesterday', label: 'Ontem' },
  { id: 'week',  label: 'Esta semana' },
];

export default function HistoryPage() {
  const [search, setSearch] = useState('');
  const [saleModal, setSaleModal] = useState<{ open: boolean; log: AuditLog | null }>({ open: false, log: null });
  const [category, setCategory] = useState('all');
  const [dateShortcut, setDateShortcut] = useState('all');
  const [customDate, setCustomDate] = useState('');
  const [visibleCount, setVisibleCount] = useState(40);

  const { data: logs = [], isFetching, refetch, dataUpdatedAt } = useQuery<AuditLog[]>({
    queryKey: ['/api/audit-logs'],
    queryFn: async () => {
      const res = await fetch('/api/audit-logs', { credentials: 'include' });
      if (!res.ok) throw new Error('Erro ao buscar histórico');
      return res.json();
    },
    staleTime: 30_000,
  });

  const { data: users = [] } = useQuery<UserItem[]>({
    queryKey: ['/api/users'],
    queryFn: async () => {
      const res = await fetch('/api/users', { credentials: 'include' });
      if (!res.ok) return [];
      return res.json();
    },
  });

  const userMap = useMemo(() => {
    const m: Record<string, string> = {};
    for (const u of users) m[u.id] = u.name;
    return m;
  }, [users]);

  // Resolver o filtro de data activo
  const activeDateFilter: Date | 'week' | null = useMemo(() => {
    if (customDate) return new Date(customDate + 'T00:00:00');
    if (dateShortcut === 'today') return new Date();
    if (dateShortcut === 'yesterday') return subDays(new Date(), 1);
    if (dateShortcut === 'week') return 'week';
    return null;
  }, [dateShortcut, customDate]);

  const weekStart = useMemo(() => startOfWeek(new Date(), { locale: ptBR }), []);

  const filtered = useMemo(() => {
    return logs.filter(log => {
      const logDate = new Date(log.createdAt);

      // Filtro de data
      if (activeDateFilter) {
        if (activeDateFilter === 'week') {
          if (logDate < weekStart) return false;
        } else {
          if (!isSameDay(logDate, activeDateFilter)) return false;
        }
      }

      // Filtro de categoria
      if (category !== 'all') {
        const a = log.action.toLowerCase();
        if (category === 'product' && !a.includes('product')) return false;
        if (category === 'stock'   && !a.includes('stock'))   return false;
        if (category === 'sale'    && !a.includes('sale'))    return false;
        if (category === 'order'   && !a.includes('order'))   return false;
        if (category === 'user'    && !a.includes('user'))    return false;
        if (category === 'login'   && !a.includes('login') && !a.includes('logout')) return false;
      }

      // Filtro de texto
      if (search.trim()) {
        const q = search.toLowerCase();
        const blob = `${log.action} ${log.entityType} ${JSON.stringify(log.details || {})} ${userMap[log.userId] || ''}`.toLowerCase();
        if (!blob.includes(q)) return false;
      }

      return true;
    });
  }, [logs, activeDateFilter, weekStart, category, search, userMap]);

  // Agrupar por dia
  const grouped = useMemo(() => {
    const visible = filtered.slice(0, visibleCount);
    const days: { label: string; isoDate: string; entries: AuditLog[] }[] = [];
    let curDay = '';
    for (const log of visible) {
      const dl = dayHeading(log.createdAt);
      if (dl !== curDay) {
        curDay = dl;
        days.push({ label: dl, isoDate: format(new Date(log.createdAt), 'yyyy-MM-dd'), entries: [] });
      }
      days[days.length - 1].entries.push(log);
    }
    return days;
  }, [filtered, visibleCount]);

  const todayCount = useMemo(() => logs.filter(l => isToday(new Date(l.createdAt))).length, [logs]);
  const updatedLabel = dataUpdatedAt ? formatDistanceToNow(new Date(dataUpdatedAt), { locale: ptBR, addSuffix: true }) : '';

  function clearDateFilter() {
    setDateShortcut('all');
    setCustomDate('');
  }

  const hasDateFilter = dateShortcut !== 'all' || customDate !== '';
  const activeDateLabel = customDate
    ? format(new Date(customDate + 'T00:00:00'), "d 'de' MMMM 'de' yyyy", { locale: ptBR })
    : DATE_SHORTCUTS.find(s => s.id === dateShortcut)?.label || '';

  return (
    <div className="mx-auto max-w-4xl space-y-5">

      {/* ── BANNER ── */}
      <div className="overflow-hidden rounded-3xl shadow-sm">
        <div className="relative bg-gradient-to-br from-[#c0392b] via-[#a93226] to-[#922b21] px-5 py-5 sm:px-7 sm:py-6">
          <div className="banner-texture" />
          <div className="relative space-y-4">

            {/* Linha superior: ícone + título + botão */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/25">
                  <History className="h-5.5 w-5.5 text-white" strokeWidth={2} />
                </div>
                <div>
                  <h1 className="text-lg font-extrabold leading-tight tracking-tight text-white sm:text-2xl">
                    Histórico de Alterações
                  </h1>
                  <p className="mt-0.5 text-[11px] font-medium text-white/55">
                    Registo completo de todas as acções do sistema
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => refetch()}
                disabled={isFetching}
                title="Recarregar histórico"
                className="flex shrink-0 items-center gap-1.5 rounded-xl border border-white/25 bg-white/10 px-3 py-2 text-xs font-semibold text-white transition hover:bg-white/20 disabled:opacity-60"
              >
                <RefreshCw className={cn('h-3.5 w-3.5', isFetching && 'animate-spin')} />
                <span className="hidden sm:inline">Atualizar</span>
              </button>
            </div>

            {/* Linha inferior: stats rápidas */}
            <div className="flex items-center gap-2 border-t border-white/10 pt-3.5">
              <div className="flex flex-1 items-center gap-2 rounded-2xl bg-white/10 px-3.5 py-2.5">
                <div className="flex flex-col">
                  <span className="text-[9px] font-bold uppercase tracking-widest text-white/45">Total de registos</span>
                  <span className="text-xl font-black leading-tight text-white tabular-nums">{logs.length}</span>
                </div>
              </div>
              <div className="flex flex-1 items-center gap-2 rounded-2xl bg-white/10 px-3.5 py-2.5">
                <div className="flex flex-col">
                  <span className="text-[9px] font-bold uppercase tracking-widest text-white/45">Hoje</span>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-xl font-black leading-tight text-white tabular-nums">{todayCount}</span>
                    {todayCount > 0 && (
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-300 animate-pulse" />
                    )}
                  </div>
                </div>
              </div>
              <div className="flex flex-1 items-center gap-2 rounded-2xl bg-white/10 px-3.5 py-2.5">
                <div className="flex flex-col">
                  <span className="text-[9px] font-bold uppercase tracking-widest text-white/45">Filtrados</span>
                  <span className="text-xl font-black leading-tight text-white tabular-nums">{filtered.length}</span>
                </div>
              </div>
            </div>

          </div>
        </div>
      </div>

      {/* ── FILTROS ── */}
      <div className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">

        {/* Cabeçalho do bloco de filtros */}
        <div className="flex items-center justify-between border-b border-gray-100 bg-gray-50/60 px-4 py-3 sm:px-5">
          <p className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Filtros</p>
          {(hasDateFilter || search || category !== 'all') && (
            <button
              type="button"
              onClick={() => { clearDateFilter(); setSearch(''); setCategory('all'); }}
              className="flex items-center gap-1 text-[11px] font-semibold text-[#B71C1C] transition hover:opacity-70"
            >
              <X className="h-3 w-3" /> Limpar tudo
            </button>
          )}
        </div>

        <div className="divide-y divide-gray-100">

          {/* Pesquisa */}
          <div className="px-4 py-3.5 sm:px-5">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={search}
                onChange={e => { setSearch(e.target.value); setVisibleCount(40); }}
                placeholder="Produto, utilizador ou tipo de acção…"
                className="w-full rounded-xl border border-gray-200 bg-gray-50 py-2.5 pl-10 pr-9 text-sm text-gray-800 placeholder:text-gray-400 transition focus:border-[#B71C1C]/40 focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#B71C1C]/15"
              />
              {search && (
                <button type="button" title="Limpar pesquisa" onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>

          {/* Filtro de data */}
          <div className="px-4 py-3.5 sm:px-5">
            <p className="mb-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">Período</p>

            {/* Atalhos: linha com scroll horizontal em mobile */}
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
              {DATE_SHORTCUTS.map(s => (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => { setDateShortcut(s.id); setCustomDate(''); setVisibleCount(40); }}
                  className={cn(
                    'shrink-0 rounded-full border px-3.5 py-1.5 text-[12px] font-semibold transition',
                    dateShortcut === s.id && !customDate
                      ? 'border-[#B71C1C]/30 bg-[#B71C1C]/10 text-[#B71C1C]'
                      : 'border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100',
                  )}
                >
                  {s.label}
                </button>
              ))}
            </div>

            {/* Input de data personalizada — linha separada */}
            <div className="mt-2.5 flex items-center gap-2">
              <div className="relative flex-1">
                <CalendarDays className="absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-gray-400 pointer-events-none" />
                <input
                  type="date"
                  value={customDate}
                  max={toDateStr(new Date())}
                  onChange={e => { setCustomDate(e.target.value); setDateShortcut('custom'); setVisibleCount(40); }}
                  title="Escolher um dia específico"
                  className={cn(
                    'w-full rounded-xl border py-2 pl-9 pr-3 text-[13px] font-semibold transition focus:outline-none focus:ring-2 focus:ring-[#B71C1C]/15',
                    customDate
                      ? 'border-[#B71C1C]/30 bg-[#B71C1C]/10 text-[#B71C1C]'
                      : 'border-gray-200 bg-gray-50 text-gray-400',
                  )}
                />
              </div>
              {customDate && (
                <button
                  type="button"
                  title="Limpar data"
                  onClick={clearDateFilter}
                  className="flex shrink-0 items-center gap-1 rounded-xl border border-gray-200 bg-white px-3 py-2 text-[12px] font-semibold text-gray-500 transition hover:bg-gray-50"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Filtro de tipo */}
          <div className="px-4 py-3.5 sm:px-5">
            <p className="mb-2.5 text-[10px] font-bold uppercase tracking-wider text-gray-400">Tipo de acção</p>
            <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
              {CATEGORY_CHIPS.map(fc => (
                <button
                  key={fc.id}
                  type="button"
                  onClick={() => { setCategory(fc.id); setVisibleCount(40); }}
                  className={cn(
                    'shrink-0 rounded-full border px-3.5 py-1.5 text-[12px] font-semibold transition',
                    category === fc.id
                      ? 'border-[#B71C1C]/30 bg-[#B71C1C]/10 text-[#B71C1C]'
                      : 'border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100',
                  )}
                >
                  {fc.label}
                </button>
              ))}
            </div>
          </div>

          {/* Resumo do filtro activo */}
          {(filtered.length !== logs.length || hasDateFilter) && (
            <div className="flex items-center gap-2 bg-blue-50/50 px-4 py-3 sm:px-5">
              <div className="h-1.5 w-1.5 shrink-0 rounded-full bg-blue-400" />
              <p className="text-[12px] font-semibold text-blue-700">
                {filtered.length === 0
                  ? 'Nenhum registo encontrado com os filtros aplicados.'
                  : `A mostrar ${filtered.length} ${filtered.length === 1 ? 'registo' : 'registos'}${hasDateFilter && dateShortcut !== 'all' ? ` de ${activeDateLabel}` : ''}.`
                }
              </p>
            </div>
          )}

        </div>
      </div>

      {/* ── TIMELINE ── */}
      {filtered.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 rounded-3xl border border-gray-200 bg-white py-16 text-center shadow-sm">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl border border-gray-100 bg-gray-50">
            <History className="h-8 w-8 text-gray-300" />
          </div>
          <div>
            <p className="text-sm font-bold text-gray-600">Nenhuma acção encontrada</p>
            <p className="mt-1 text-[12px] text-gray-400">
              {hasDateFilter && dateShortcut !== 'all'
                ? `Não houve actividade registada em ${activeDateLabel}.`
                : 'Tente ajustar os filtros ou escolha um período diferente.'}
            </p>
          </div>
          {(hasDateFilter || search || category !== 'all') && (
            <button
              type="button"
              onClick={() => { clearDateFilter(); setSearch(''); setCategory('all'); }}
              className="mt-1 rounded-xl border border-gray-200 bg-white px-4 py-2 text-[12px] font-semibold text-gray-500 transition hover:bg-gray-50"
            >
              Remover todos os filtros
            </button>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          {grouped.map(group => (
            <div key={group.isoDate}>
              {/* Separador de dia */}
              <div className="mb-3 flex items-center gap-3">
                <div className="h-px flex-1 bg-gray-200" />
                <span className="rounded-full border border-gray-200 bg-white px-3 py-1 text-[11px] font-bold capitalize text-gray-500">
                  {group.label}
                  <span className="ml-1.5 text-gray-400 font-normal">
                    · {group.entries.length} {group.entries.length === 1 ? 'registo' : 'registos'}
                  </span>
                </span>
                <div className="h-px flex-1 bg-gray-200" />
              </div>

              {/* Entradas do dia */}
              <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                {group.entries.map((log, idx) => {
                  const cfg = getActionConfig(log.action);
                  const Icon = cfg.Icon;
                  const userName = userMap[log.userId] || 'Utilizador desconhecido';
                  const time = format(new Date(log.createdAt), "HH:mm", { locale: ptBR });

                  return (
                    <div
                      key={log.id}
                      className={cn(
                        'flex gap-4 px-4 py-4 sm:px-5',
                        idx !== group.entries.length - 1 && 'border-b border-gray-50',
                        'transition-colors hover:bg-gray-50/50',
                      )}
                    >
                      {/* Ícone da acção */}
                      <div className={cn(
                        'mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ring-1',
                        cfg.iconBg, cfg.ring,
                      )}>
                        <Icon className={cn('h-4 w-4', cfg.iconColor)} strokeWidth={2} />
                      </div>

                      {/* Conteúdo */}
                      <div className="min-w-0 flex-1">
                        {/* Cabeçalho da entrada */}
                        <div className="flex flex-wrap items-start justify-between gap-x-3 gap-y-1">
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className={cn('rounded-full border px-2.5 py-0.5 text-[11px] font-bold', cfg.badge)}>
                              {cfg.label}
                            </span>
                          </div>
                          <span className="text-[11px] tabular-nums text-gray-400 whitespace-nowrap">
                            às {time}
                          </span>
                        </div>

                        {/* Frase descritiva */}
                        <div className="mt-1 flex items-center justify-between gap-2">
                          <p className="text-[12px] text-gray-600">
                            <span className="font-semibold text-gray-800">{userName}</span>
                            {log.action === 'INCREASE_STOCK' && log.details?.productName
                              ? <> repôs o stock de <span className="font-semibold text-gray-800">{log.details.productName}</span>.</>
                              : <> {cfg.verb}.</>
                            }
                          </p>
                          {log.action === 'CREATE_SALE' && (
                            <button
                              type="button"
                              onClick={() => setSaleModal({ open: true, log })}
                              className="flex shrink-0 items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-[11px] font-semibold text-gray-600 transition hover:bg-gray-50 hover:text-gray-900"
                            >
                              <Eye className="h-3.5 w-3.5" />
                              Ver venda
                            </button>
                          )}
                        </div>

                        {/* Detalhe das alterações */}
                        <LogDetails log={log} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {/* Carregar mais */}
          {filtered.length > visibleCount && (
            <button
              type="button"
              onClick={() => setVisibleCount(v => v + 40)}
              className="w-full rounded-2xl border border-gray-200 bg-white py-3.5 text-sm font-semibold text-gray-500 shadow-sm transition hover:bg-gray-50"
            >
              Ver mais {filtered.length - visibleCount} {filtered.length - visibleCount === 1 ? 'registo' : 'registos'} anteriores
            </button>
          )}

          {updatedLabel && (
            <p className="pb-2 text-center text-[11px] text-gray-400">
              Dados actualizados {updatedLabel}
            </p>
          )}
        </div>
      )}

      {/* Modal de detalhe de venda */}
      <SaleDetailModal
        log={saleModal.log}
        open={saleModal.open}
        onClose={() => setSaleModal({ open: false, log: null })}
      />
    </div>
  );
}
