import { useMemo, useState, type ReactNode } from 'react';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  DollarSign,
  ShoppingBag,
  Package,
  AlertTriangle,
  TrendingUp,
  Users,
  Activity,
  CheckCircle2,
  Star,
} from 'lucide-react';
import { Link } from 'wouter';
import { cn, formatCurrency } from '@/lib/utils';
import { Area, AreaChart, CartesianGrid, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { format, subDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useQuery } from '@tanstack/react-query';
import { salesApi, productsApi, usersApi, notificationsApi } from '@/lib/api';
import { KpiCarousel } from '@/components/dashboard/KpiCarousel';
import type { LucideIcon } from 'lucide-react';

/** Tokens visuais — Nerion Group: vermelho · preto · branco */
const mk = {
  page: 'relative min-h-screen bg-white px-6 py-6',
  // acento colorido por card (linha no topo)
  kpiAccent: [
    'bg-gradient-to-r from-red-700 via-red-500 to-transparent',           // vendas  — vermelho
    'bg-gradient-to-r from-gray-900 via-gray-600 to-transparent',         // pedidos — preto
    'bg-gradient-to-r from-amber-500 via-amber-400 to-transparent',       // stock   — âmbar
    'bg-gradient-to-r from-red-800 via-red-600 to-transparent',            // equipa  — vermelho escuro
  ],
  softRed:    'bg-red-50    text-red-700',
  softDark:   'bg-gray-100  text-gray-800',
  softAmber:  'bg-amber-50  text-amber-600',
  softIndigo: 'bg-red-50    text-red-700',
  chartStroke: 'hsl(0 75% 44%)',
  chartMeta:   'hsl(0 0% 20%)',
  kpiBase: 'border border-gray-200 bg-white shadow-sm transition-all duration-300 hover:shadow-md hover:-translate-y-0.5',
};

const KPI_DESKTOP_COL = [
  'md:col-span-6 lg:col-span-5',
  'md:col-span-6 lg:col-span-3',
  'md:col-span-6 lg:col-span-2',
  'md:col-span-6 lg:col-span-2',
] as const;

type KpiDef = {
  id: string;
  title: string;
  iconWrap: string;
  Icon: LucideIcon;
  body: ReactNode;
};

export default function Dashboard() {
  const { user } = useAuth();

  const { data: sales = [], isLoading: salesLoading } = useQuery({
    queryKey: ['/api/sales'],
    queryFn: salesApi.getAll,
  });

  const { data: products = [], isLoading: productsLoading } = useQuery({
    queryKey: ['/api/products'],
    queryFn: productsApi.getAll,
  });

  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ['/api/users'],
    queryFn: usersApi.getAll,
    enabled: user?.role === 'admin',
  });

  const { data: notifications = [], isLoading: notificationsLoading } = useQuery({
    queryKey: ['/api/notifications'],
    queryFn: notificationsApi.getAll,
  });

  const totalSalesToday = sales
    .filter((s) => new Date(s.createdAt).toDateString() === new Date().toDateString())
    .reduce((acc, curr) => acc + parseFloat(curr.total), 0);

  const totalOrdersToday = sales.filter(
    (s) => new Date(s.createdAt).toDateString() === new Date().toDateString(),
  ).length;

  const yesterday = subDays(new Date(), 1);
  const ordersYesterday = sales.filter(
    (s) => new Date(s.createdAt).toDateString() === yesterday.toDateString(),
  ).length;
  const ordersDelta = totalOrdersToday - ordersYesterday;

  const outOfStockCount = products.filter((p) => parseFloat(p.stock) <= 0).length;
  const lowBelowMinCount = products.filter((p) => {
    const s = parseFloat(p.stock);
    const m = parseFloat(p.minStock);
    return s > 0 && s <= m;
  }).length;
  const stockAttentionTotal = outOfStockCount + lowBelowMinCount;
  const activeUsers = user?.role === 'admin' ? users.length : null;

  const topProducts = sales
    .flatMap((s) => s.items)
    .reduce(
      (acc, item) => {
        const existing = acc.find((p) => p.productId === item.productId);
        if (existing) {
          existing.quantity += item.quantity;
          existing.revenue += item.priceAtSale * item.quantity;
        } else {
          acc.push({
            productId: item.productId,
            quantity: item.quantity,
            revenue: item.priceAtSale * item.quantity,
          });
        }
        return acc;
      },
      [] as { productId: string; quantity: number; revenue: number }[],
    )
    .map((item) => {
      const product = products.find((p) => p.id === item.productId);
      return { ...item, name: product?.name || 'Desconhecido' };
    })
    .sort((a, b) => b.quantity - a.quantity)
    .slice(0, 5);

  const lowStockProducts = products
    .filter((p) => parseFloat(p.stock) <= parseFloat(p.minStock))
    .sort((a, b) => parseFloat(a.stock) - parseFloat(b.stock))
    .slice(0, 5);

  const [chartRangeDays, setChartRangeDays] = useState<7 | 30 | 90>(7);

  const chartBase = useMemo(() => {
    return Array.from({ length: chartRangeDays }).map((_, i) => {
      const date = subDays(new Date(), chartRangeDays - 1 - i);
      const dateStr = format(date, 'dd/MM', { locale: ptBR });
      const daySales = sales
        .filter((s) => new Date(s.createdAt).toDateString() === date.toDateString())
        .reduce((acc, curr) => acc + parseFloat(curr.total), 0);
      return { date: dateStr, total: daySales };
    });
  }, [sales, chartRangeDays]);

  const chartData = useMemo(() => {
    const maxVal = Math.max(...chartBase.map((d) => d.total), 1);
    const goalLine = Math.round(maxVal * 0.75 * 100) / 100;
    return chartBase.map((d) => ({ ...d, meta: goalLine }));
  }, [chartBase]);

  const recentSales = useMemo(() => {
    const cutoff = subDays(new Date(), chartRangeDays - 1);
    return sales
      .filter((s) => new Date(s.createdAt) >= cutoff)
      .slice()
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 10);
  }, [chartRangeDays, sales]);

  const firstName = user?.name?.split(' ')[0] ?? 'Utilizador';
  const dateLabel = format(new Date(), "EEE, dd MMM yyyy", { locale: ptBR });

  const kpis: KpiDef[] = [
    {
      id: 'sales',
      title: 'Vendas hoje',
      iconWrap: mk.softRed,
      Icon: DollarSign,
      body: (
        <>
          <p className="font-heading text-xl font-bold tracking-tight text-foreground" data-testid="text-sales-today">
            {formatCurrency(totalSalesToday)}
          </p>
        </>
      ),
    },
    {
      id: 'orders',
      title: 'Pedidos',
      iconWrap: mk.softDark,
      Icon: ShoppingBag,
      body: (
        <>
          <p className="font-heading text-xl font-bold tracking-tight text-foreground" data-testid="text-orders-today">
            {totalOrdersToday}
          </p>
          <p className="mt-1.5 text-[0.7rem] text-muted-foreground">
            <span className="font-bold text-gray-800">{ordersDelta >= 0 ? `+${ordersDelta}` : ordersDelta}</span>
            {' '}vs. ontem
          </p>
        </>
      ),
    },
    {
      id: 'stock',
      title: 'Alertas stock',
      iconWrap: mk.softAmber,
      Icon: AlertTriangle,
      body: (
        <>
          <p className="font-heading text-xl font-bold tracking-tight text-foreground" data-testid="text-low-stock">
            {stockAttentionTotal}
          </p>
          <p className="mt-1.5">
            <span className={`rounded px-2 py-0.5 text-[0.7rem] font-bold ${stockAttentionTotal > 0 ? 'bg-red-50 text-red-700' : 'bg-gray-100 text-gray-700'}`}>
              {stockAttentionTotal > 0 ? 'Atenção' : 'Normal'}
            </span>
          </p>
        </>
      ),
    },
    ...(user?.role === 'admin'
      ? ([
          {
            id: 'team',
            title: 'Equipa',
            iconWrap: mk.softIndigo,
            Icon: Users,
            body: (
              <>
                <p className="font-heading text-xl font-bold tracking-tight text-foreground" data-testid="text-active-users">
                  {activeUsers}
                </p>
                <p className="mt-1.5 text-[0.7rem]">
                  <span className="rounded bg-red-50 px-1.5 py-0.5 font-bold text-red-700">Utilizadores</span>
                </p>
              </>
            ),
          },
        ] as KpiDef[])
      : []),
  ];


  return (
    <div className={mk.page}>
      {/* ── HERO DASHBOARD (ESTILO FIEL À IMAGEM) ── */}
      <div className="dash-hero relative mb-8 overflow-hidden rounded-[2rem] bg-[#1a1a1a] p-8 shadow-2xl text-white border border-white/5">

        {/* Camadas de Fundo (Shapes) */}
        <div className="absolute inset-0 z-0">
          <div className="hero-red-shape" />
          <div className="hero-dark-overlay" />
          <div className="hero-white-curve" />
        </div>

        {/* CONTEÚDO REAL */}
        <div className="relative z-10 grid items-center gap-6 lg:grid-cols-[1fr_auto]">

          {/* LEFT */}
          <div className="flex flex-col gap-5">
            {/* Badge Resumo */}
            <div className="flex w-fit items-center gap-2 rounded-full border border-white/10 bg-black/30 px-4 py-1.5 backdrop-blur-md">
              <span className="h-2 w-2 animate-pulse rounded-full bg-red-500" />
              <span className="text-[0.7rem] font-bold uppercase tracking-widest text-gray-200">
                Resumo do dia
              </span>
            </div>

            {/* Texto Principal */}
            <div className="space-y-1">
              <h1 className="text-4xl font-bold tracking-tight">
                Olá, <span className="font-extrabold">{firstName}</span> 👋
              </h1>
              <p className="font-medium text-gray-300 opacity-90">
                Tudo sob controlo hoje. Bom trabalho.
              </p>
            </div>

            {/* Botões */}
            <div className="flex flex-wrap gap-3">
              <Link href="/pos">
                <button type="button" className="flex items-center gap-2 rounded-full bg-[#e11d1d] px-7 py-3 text-sm font-bold shadow-lg shadow-red-900/20 transition-all hover:scale-105 hover:bg-red-500 active:scale-95">
                  + Nova venda
                </button>
              </Link>
              <Link href="/reports">
                <button type="button" className="rounded-full border border-white/10 bg-white/10 px-7 py-3 text-sm font-bold backdrop-blur-md transition-all hover:bg-white/20">
                  Relatórios
                </button>
              </Link>
              <Link href="/products">
                <button type="button" className="rounded-full border border-white/10 bg-white/10 px-7 py-3 text-sm font-bold backdrop-blur-md transition-all hover:bg-white/20">
                  Produtos
                </button>
              </Link>
            </div>
          </div>

          {/* RIGHT — stats */}
          <div className="hidden shrink-0 flex-col gap-3 lg:flex">
            {/* Receita hoje */}
            <div className="min-w-[185px] rounded-xl border border-black/20 bg-black/30 px-5 py-4 backdrop-blur-sm">
              <p className="text-[0.6rem] font-semibold uppercase tracking-[0.12em] text-white/50">Receita hoje</p>
              <p className="mt-1.5 font-heading text-[1.65rem] font-extrabold tracking-tight text-white">
                {formatCurrency(totalSalesToday)}
              </p>
              <p className="mt-1 text-[0.67rem] text-white/35">Actualizado ao abrir o painel</p>
            </div>
            {/* Mini stats */}
            <div className="grid grid-cols-3 gap-2">
              {[
                { label: 'Pedidos', value: totalOrdersToday },
                { label: 'Alertas', value: stockAttentionTotal },
                { label: 'Equipa',  value: activeUsers ?? '—' },
              ].map(({ label, value }) => (
                <div key={label} className="rounded-lg border border-black/20 bg-black/30 px-3 py-2.5 text-center backdrop-blur-sm">
                  <p className="text-[0.55rem] font-semibold uppercase tracking-[0.1em] text-white/40">{label}</p>
                  <p className="mt-1 font-heading text-lg font-bold text-white">{value}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* KPIs — mobile: carrossel */}
      <KpiCarousel>
        {kpis.map((k) => {
          const KIcon = k.Icon;
          return (
            <Card key={k.id} className={cn('w-full overflow-hidden rounded-xl', mk.kpiBase)}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-2">
                <CardTitle className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{k.title}</CardTitle>
                <div className={`flex h-8 w-8 items-center justify-center rounded-xl ${k.iconWrap}`}>
                  <KIcon className="h-4 w-4" strokeWidth={2.25} />
                </div>
              </CardHeader>
              <CardContent className="px-4 pb-4 pt-0">{k.body}</CardContent>
            </Card>
          );
        })}
      </KpiCarousel>

      {/* KPIs — desktop */}
      <div className="dash-kpi mb-6 hidden grid-cols-12 gap-4 md:grid">
        {kpis.map((k, i) => {
          const KIcon = k.Icon;
          const kpiDelayClass = (['dash-kpi-1', 'dash-kpi-2', 'dash-kpi-3', 'dash-kpi-4'] as const)[i] ?? 'dash-kpi-1';
          return (
            <Card
              key={k.id}
              className={cn('overflow-hidden rounded-2xl', mk.kpiBase, KPI_DESKTOP_COL[i], kpiDelayClass)}
            >
              <CardHeader className="flex flex-row items-center justify-between space-y-0 p-5 pb-2">
                <CardTitle className="text-[0.7rem] font-bold uppercase tracking-widest text-muted-foreground">{k.title}</CardTitle>
                <div className={`flex h-8 w-8 items-center justify-center rounded-xl ${k.iconWrap}`}>
                  <KIcon className="h-4 w-4" strokeWidth={2.25} />
                </div>
              </CardHeader>
              <CardContent className="px-5 pb-5 pt-1">{k.body}</CardContent>
            </Card>
          );
        })}
      </div>

      {/* ── MAIN CONTENT ROW: Chart (2/3) + Right column (1/3) ── */}
      <div className="dash-row-1 grid grid-cols-1 gap-5 lg:grid-cols-[2fr_1fr] lg:gap-6">

        {/* Chart card */}
        <Card className="relative overflow-hidden border border-border bg-card shadow-sm">
          <div
            className="absolute inset-x-0 top-0 z-10 h-1 bg-gradient-to-r from-red-800 via-red-700 to-red-950"
            aria-hidden
          />
          <CardHeader className="relative flex flex-col gap-4 pt-7 sm:flex-row sm:items-start sm:justify-between">
            <div className="border-l-4 border-red-800 pl-3">
              <CardTitle className="text-lg font-bold text-foreground">Desempenho</CardTitle>
              <CardDescription>
                Últimos {chartRangeDays} dias · receita diária vs. meta de referência
              </CardDescription>
            </div>
            <div className="flex w-full gap-1 rounded-2xl bg-muted/60 p-1 sm:w-auto">
              {([7, 30, 90] as const).map((d) => (
                <Button
                  key={d}
                  type="button"
                  size="sm"
                  variant={chartRangeDays === d ? 'secondary' : 'ghost'}
                  className={cn(
                    'h-9 flex-1 rounded-xl text-xs sm:flex-none',
                    chartRangeDays === d
                      ? 'bg-card font-black text-foreground shadow-sm ring-1 ring-red-500/20'
                      : 'font-semibold text-muted-foreground hover:text-foreground',
                  )}
                  onClick={() => setChartRangeDays(d)}
                >
                  {d} dias
                </Button>
              ))}
            </div>
          </CardHeader>
          <CardContent className="px-2 sm:pl-6 sm:pr-4">
            <div className="h-[220px] w-full sm:h-[300px] md:h-[320px]">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 8, left: -18, bottom: 0 }}>
                  <defs>
                    <linearGradient id="mkArea" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={mk.chartStroke} stopOpacity={0.35} />
                      <stop offset="95%" stopColor={mk.chartStroke} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(0 0% 90%)" />
                  <XAxis
                    dataKey="date"
                    tick={{ fill: 'hsl(215 18% 42%)', fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    dy={8}
                    minTickGap={chartRangeDays > 7 ? 28 : 8}
                  />
                  <YAxis
                    tick={{ fill: 'hsl(215 18% 42%)', fontSize: 10 }}
                    axisLine={false}
                    tickLine={false}
                    tickFormatter={(v) => `${v}`}
                    dx={-4}
                    width={36}
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: '14px',
                      border: '1px solid hsl(230 26% 88%)',
                      boxShadow: '0 10px 30px rgba(0,0,0,0.1)',
                    }}
                    formatter={(value: number, name: string) => [
                      formatCurrency(value),
                      name === 'total' ? 'Receita' : 'Meta',
                    ]}
                  />
                  <Area type="monotone" dataKey="total" stroke={mk.chartStroke} strokeWidth={2} fill="url(#mkArea)" />
                  <Line
                    type="monotone"
                    dataKey="meta"
                    stroke={mk.chartMeta}
                    strokeWidth={2}
                    strokeDasharray="6 4"
                    dot={false}
                    name="meta"
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
            <div className="mt-3 flex flex-wrap gap-4 px-2 text-xs font-semibold text-muted-foreground">
              <span className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full bg-red-800" /> Receita
              </span>
              <span className="flex items-center gap-2">
                <span className="h-0.5 w-5 border-t-2 border-dashed border-gray-800" /> Meta
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Right column: Top produtos + Atividade stacked */}
        <div className="flex flex-col gap-5 lg:gap-6">
          {/* Top produtos */}
          <Card className="border border-border bg-card shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg font-bold text-foreground">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-50">
                  <Star className="h-5 w-5 text-red-700" strokeWidth={2.25} />
                </span>
                Top produtos
              </CardTitle>
              <CardDescription>Por unidades vendidas</CardDescription>
            </CardHeader>
            <CardContent className="space-y-2">
              {topProducts.length === 0 ? (
                <p className="py-8 text-center text-sm font-medium text-muted-foreground">Ainda sem vendas registadas</p>
              ) : (
                topProducts.map((p, idx) => (
                  <div
                    key={p.productId}
                    className="flex items-center justify-between rounded-2xl border border-gray-200 bg-white px-3 py-3 shadow-sm transition hover:border-red-200 hover:shadow-md"
                  >
                    <div className="flex min-w-0 flex-1 items-center gap-3">
                      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-red-100 to-rose-50 text-sm font-bold text-red-800">
                        #{idx + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-foreground">{p.name}</p>
                        <p className="text-xs text-muted-foreground">{p.quantity} vendas</p>
                      </div>
                    </div>
                    <p className="shrink-0 text-sm font-bold text-red-700">{formatCurrency(p.revenue)}</p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>

          {/* Atividade */}
          <Card className="flex flex-1 flex-col border border-border bg-card shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-lg font-bold text-foreground">
                <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gray-900/8">
                  <Activity className="h-5 w-5 text-gray-800" strokeWidth={2.25} />
                </span>
                Atividade
              </CardTitle>
              <CardDescription>Últimos {chartRangeDays} dias · vendas e alertas</CardDescription>
            </CardHeader>
            <CardContent className="max-h-[min(52vh,18rem)] overflow-y-auto pr-1">
              <div className="space-y-1">
                {notifications.slice(0, 4).map((notif) => (
                  <div key={notif.id} className="flex gap-3 border-b border-border py-2.5 last:border-0">
                    <div
                      className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ring-2 ring-card ${
                        notif.type === 'warning'
                          ? 'bg-[hsl(32_95%_50%)]'
                          : notif.type === 'success'
                            ? 'bg-primary'
                            : notif.type === 'error'
                              ? 'bg-destructive'
                              : 'bg-gray-700'
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium leading-snug text-foreground">{notif.message}</p>
                      <p className="text-xs text-muted-foreground">
                        {format(new Date(notif.createdAt), 'HH:mm', { locale: ptBR })}
                      </p>
                    </div>
                  </div>
                ))}

                {(() => {
                  const todayStart = new Date();
                  todayStart.setHours(0, 0, 0, 0);
                  const yesterdayStart = subDays(todayStart, 1);

                  const paymentLabel = (m: string) => {
                    if (m === 'card') return 'Cartão';
                    if (m === 'pix' || m === 'mpesa') return 'M-Pesa';
                    if (m === 'emola') return 'e-Mola';
                    if (m === 'pos') return 'POS';
                    if (m === 'bank') return 'Transferência';
                    return 'Dinheiro';
                  };

                  let lastGroup = '';
                  return recentSales.map((sale) => {
                    const saleDate = new Date(sale.createdAt);
                    saleDate.setHours(0, 0, 0, 0);
                    const group =
                      saleDate.getTime() === todayStart.getTime()
                        ? 'Hoje'
                        : saleDate.getTime() === yesterdayStart.getTime()
                          ? 'Ontem'
                          : format(saleDate, 'dd/MM', { locale: ptBR });
                    const showHeader = group !== lastGroup;
                    lastGroup = group;
                    return (
                      <div key={sale.id}>
                        {showHeader && (
                          <p className="pb-1 pt-3 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                            {group}
                          </p>
                        )}
                        <div className="flex gap-3 border-b border-border py-2.5 last:border-0">
                          <div className="mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full bg-primary ring-2 ring-card" />
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center justify-between gap-2">
                              <p className="text-sm font-semibold text-foreground">Venda #{sale.id.slice(-4)}</p>
                              <span className="shrink-0 rounded-lg bg-red-50 px-2 py-0.5 text-xs font-bold text-red-700">
                                {formatCurrency(parseFloat(sale.total))}
                              </span>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {sale.items.length} {sale.items.length === 1 ? 'item' : 'itens'} ·{' '}
                              {paymentLabel(sale.paymentMethod ?? '')} ·{' '}
                              {format(new Date(sale.createdAt), 'HH:mm', { locale: ptBR })}
                            </p>
                          </div>
                        </div>
                      </div>
                    );
                  });
                })()}

                {notifications.length === 0 && recentSales.length === 0 && (
                  <p className="py-8 text-center text-sm font-medium text-muted-foreground">Sem atividade recente</p>
                )}
              </div>
            </CardContent>
            <div className="mt-auto border-t border-border bg-muted/20 px-4 py-3">
              <Link href="/reports">
                <Button variant="ghost" className="w-full rounded-xl text-sm font-bold text-red-700 hover:bg-red-50">
                  Ver histórico completo
                </Button>
              </Link>
            </div>
          </Card>
        </div>
      </div>

      {/* ── STOCK ALERTS (full width) ── */}
      <div className="dash-row-2 mt-5 lg:mt-6">
        <Card className="border border-border bg-card shadow-sm">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg font-bold text-foreground">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-red-50">
                <Package className="h-5 w-5 text-red-700" strokeWidth={2.25} />
              </span>
              Alertas de stock
            </CardTitle>
          </CardHeader>
          <CardContent>
            {lowStockProducts.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-red-200 bg-red-50/50 py-10 text-center sm:py-12">
                <CheckCircle2 className="mb-3 h-12 w-12 text-red-700" strokeWidth={2} />
                <p className="font-bold text-foreground">Tudo em ordem!</p>
                <p className="mt-1 text-sm text-muted-foreground">Sem produtos abaixo do mínimo</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {lowStockProducts.map((p) => {
                  const s = parseFloat(p.stock);
                  const m = parseFloat(p.minStock);
                  const esgotado = s <= 0;
                  return (
                    <div
                      key={p.id}
                      className={cn(
                        'flex items-start justify-between rounded-2xl border px-3 py-3',
                        esgotado
                          ? 'border-destructive/25 bg-destructive/5'
                          : 'border-amber-400/40 bg-amber-50/70 dark:border-amber-700/40 dark:bg-amber-950/25',
                      )}
                    >
                      <div>
                        <p className="text-sm font-semibold text-foreground">{p.name}</p>
                        <p
                          className={cn(
                            'text-xs font-bold',
                            esgotado ? 'text-destructive' : 'text-amber-800 dark:text-amber-200',
                          )}
                        >
                          {s} {p.unit} (mín. {m})
                        </p>
                      </div>
                      <span
                        className={cn(
                          'rounded-lg px-2 py-1 text-[10px] font-bold',
                          esgotado
                            ? 'bg-destructive text-destructive-foreground'
                            : 'bg-amber-600 text-white dark:bg-amber-700',
                        )}
                      >
                        {esgotado ? 'Esgotado' : 'Stock baixo'}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
