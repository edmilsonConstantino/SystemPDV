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
  ChevronRight,
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

/** Tokens visuais — alinhados ao tema global (teal + índigo, nítidos) */
const mk = {
  page: 'relative min-h-[min(100%,48rem)] -mx-3 -mt-1 px-1 pb-10 pt-2 sm:-mx-4 sm:px-2 md:-mx-6 md:px-0',
  heroBg: `
    radial-gradient(ellipse 90% 70% at 100% 0%, rgba(255,255,255,0.55) 0%, transparent 45%),
    radial-gradient(ellipse 55% 45% at 0% 100%, hsl(172 72% 45% / 0.2) 0%, transparent 50%),
    linear-gradient(125deg, hsl(230 85% 92%) 0%, hsl(172 55% 88%) 42%, hsl(239 75% 90%) 100%)
  `,
  softTeal: 'bg-primary/12 text-primary',
  softPeri: 'bg-accent/12 text-accent',
  softAmber: 'bg-[hsl(32_95%_95%)] text-[hsl(24_90%_38%)]',
  softRose: 'bg-destructive/10 text-destructive',
  softSky: 'bg-[hsl(199_90%_94%)] text-[hsl(200_85%_32%)]',
  chartStroke: 'hsl(172 72% 36%)',
  chartMeta: 'hsl(239 78% 58%)',
  kpiBase:
    'border border-border bg-card shadow-[0_22px_56px_-32px_hsl(239_40%_22%/0.14)] transition-shadow duration-300 hover:shadow-[0_28px_64px_-36px_hsl(172_50%_30%/0.12)]',
};

const KPI_DESKTOP_COL = [
  'md:col-span-6 lg:col-span-5 xl:ring-2 xl:ring-primary/18 xl:shadow-[0_32px_70px_-40px_hsl(172_72%_28%/0.22)]',
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

  const isLoading =
    salesLoading ||
    productsLoading ||
    (user?.role === 'admin' ? usersLoading : false) ||
    notificationsLoading;
  const firstName = user?.name?.split(' ')[0] ?? 'Utilizador';
  const dateLabel = format(new Date(), "EEE, dd MMM yyyy", { locale: ptBR });

  if (isLoading) {
    return (
      <div className="flex min-h-[420px] items-center justify-center rounded-3xl border border-border/60 bg-card">
        <div className="space-y-4 text-center">
          <div className="mx-auto h-12 w-12 animate-pulse rounded-2xl bg-gradient-to-br from-primary to-accent shadow-lg shadow-primary/25" />
          <p className="text-sm font-semibold text-muted-foreground">A carregar dashboard…</p>
        </div>
      </div>
    );
  }

  const kpis: KpiDef[] = [
    {
      id: 'sales',
      title: 'Vendas hoje',
      iconWrap: mk.softTeal,
      Icon: DollarSign,
      body: (
        <>
          <p
            className="font-heading text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl"
            data-testid="text-sales-today"
          >
            {formatCurrency(totalSalesToday)}
          </p>
          <p className="mt-2 flex flex-wrap items-center gap-1 text-xs text-primary">
            <TrendingUp className="h-3.5 w-3.5 shrink-0" />
            <span className="rounded-lg bg-primary/15 px-2 py-0.5 font-bold text-primary">+12.5%</span>
            <span className="text-muted-foreground">vs. média semanal</span>
          </p>
        </>
      ),
    },
    {
      id: 'orders',
      title: 'Pedidos',
      iconWrap: mk.softAmber,
      Icon: ShoppingBag,
      body: (
        <>
          <p
            className="font-heading text-3xl font-bold tracking-tight text-foreground sm:text-4xl"
            data-testid="text-orders-today"
          >
            {totalOrdersToday}
          </p>
          <p className="mt-2 text-xs text-muted-foreground">
            {ordersDelta >= 0 ? (
              <span className="font-bold text-[hsl(24_90%_38%)]">+{ordersDelta}</span>
            ) : (
              <span className="font-bold text-foreground">{ordersDelta}</span>
            )}{' '}
            vs. ontem · <span className="text-muted-foreground/80">{ordersYesterday} ontem</span>
          </p>
        </>
      ),
    },
    {
      id: 'stock',
      title: 'Alertas stock',
      iconWrap: mk.softRose,
      Icon: AlertTriangle,
      body: (
        <>
          <p
            className="font-heading text-3xl font-bold tracking-tight text-foreground sm:text-4xl"
            data-testid="text-low-stock"
          >
            {stockAttentionTotal}
          </p>
          <p className="mt-2">
            <span
              className={`rounded-lg px-2.5 py-1 text-xs font-bold ${
                stockAttentionTotal > 0 ? 'bg-destructive/15 text-destructive' : 'bg-primary/15 text-primary'
              }`}
            >
              {stockAttentionTotal > 0 ? 'Atenção' : 'Normal'}
            </span>
          </p>
          {stockAttentionTotal > 0 && (
            <p className="mt-1 text-[0.65rem] font-medium text-muted-foreground">
              {lowBelowMinCount > 0 && <span>{lowBelowMinCount} abaixo do mín.</span>}
              {lowBelowMinCount > 0 && outOfStockCount > 0 && <span> · </span>}
              {outOfStockCount > 0 && <span>{outOfStockCount} esgotado{outOfStockCount !== 1 ? 's' : ''}</span>}
            </p>
          )}
        </>
      ),
    },
    ...(user?.role === 'admin'
      ? ([
          {
            id: 'team',
            title: 'Equipa',
            iconWrap: mk.softSky,
            Icon: Users,
            body: (
              <>
                <p
                  className="font-heading text-3xl font-bold tracking-tight text-foreground sm:text-4xl"
                  data-testid="text-active-users"
                >
                  {activeUsers}
                </p>
                <p className="mt-2 text-xs font-bold text-accent">
                  <span className="rounded-lg bg-accent/12 px-2 py-0.5">Utilizadores</span>
                </p>
              </>
            ),
          },
        ] as KpiDef[])
      : []),
  ];

  return (
    <div className={mk.page}>
      <div
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 mx-auto h-64 max-w-4xl opacity-40 blur-3xl md:h-80"
        style={{
          background:
            'radial-gradient(ellipse at 50% 0%, hsl(172 72% 45% / 0.25) 0%, transparent 55%), radial-gradient(ellipse at 80% 20%, hsl(239 78% 60% / 0.2) 0%, transparent 50%)',
        }}
        aria-hidden
      />

      {/* Breadcrumb + data */}
      <div className="mb-5 flex flex-col gap-3 sm:mb-6 sm:flex-row sm:items-center sm:justify-between">
        <nav className="flex flex-wrap items-center gap-1 text-sm text-muted-foreground">
          <span className="font-bold text-accent">Makira Sales</span>
          <ChevronRight className="h-4 w-4 text-border" aria-hidden />
          <span className="font-semibold text-foreground">Dashboard</span>
        </nav>
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground sm:text-sm sm:normal-case">
          {dateLabel}
        </p>
      </div>

      {/* Hero — mobile: coluna; desktop: grelha + painel lateral “glass” */}
      <div
        className="relative mb-6 overflow-hidden rounded-3xl border border-white/60 shadow-[0_28px_64px_-32px_hsl(239_45%_25%/0.35)] sm:mb-8 lg:rounded-[2rem]"
        style={{ background: mk.heroBg }}
      >
        <div className="pointer-events-none absolute -right-16 -top-16 h-48 w-48 rounded-full bg-white/40 blur-3xl sm:h-56 sm:w-56" />
        <div className="pointer-events-none absolute -bottom-12 left-0 h-36 w-36 rounded-full bg-primary/20 blur-3xl" />
        <div className="pointer-events-none absolute right-1/4 top-1/2 h-24 w-24 rounded-full bg-accent/15 blur-2xl" />
        <div
          className="pointer-events-none absolute inset-0 opacity-[0.07] lg:opacity-[0.09]"
          style={{
            backgroundImage: `linear-gradient(hsl(239 30% 40%) 1px, transparent 1px), linear-gradient(90deg, hsl(239 30% 40%) 1px, transparent 1px)`,
            backgroundSize: '28px 28px',
          }}
          aria-hidden
        />

        <div className="relative z-10 grid gap-8 p-5 sm:p-7 lg:grid-cols-12 lg:items-center lg:gap-10 lg:p-10 xl:p-12">
          <div className="space-y-3 sm:space-y-4 lg:col-span-7">
            <div className="inline-flex items-center gap-2 rounded-full border border-primary/25 bg-white/55 px-3 py-1 text-[0.65rem] font-bold uppercase tracking-[0.2em] text-primary shadow-sm backdrop-blur-sm">
              Resumo do dia
            </div>
            <h1 className="font-heading text-[1.35rem] font-bold leading-tight tracking-tight text-foreground sm:text-2xl lg:text-4xl xl:text-[2.35rem]">
              Olá, {firstName}
              <span className="mt-1 block font-medium text-muted-foreground lg:mt-2 lg:text-[1.35rem] lg:font-normal xl:text-[1.45rem]">
                — aqui está o seu resumo em tempo real
              </span>
            </h1>
            <p className="max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base lg:text-lg">
              Tudo sob controlo hoje
              {stockAttentionTotal > 0 ? (
                <>
                  .{' '}
                  <span className="font-bold text-[hsl(24_90%_38%)]">
                    {stockAttentionTotal} alerta{stockAttentionTotal !== 1 ? 's' : ''} de stock
                  </span>{' '}
                  para rever.
                </>
              ) : (
                <>.</>
              )}
            </p>
            <div className="flex gap-2 overflow-x-auto pb-1 pt-1 [-ms-overflow-style:none] [scrollbar-width:none] sm:flex-wrap sm:overflow-visible lg:pt-2 [&::-webkit-scrollbar]:hidden">
              <Link href="/pos" className="shrink-0">
                <Button className="h-11 rounded-2xl border-0 bg-gradient-to-r from-primary via-[hsl(239_70%_50%)] to-accent px-5 font-bold text-primary-foreground shadow-[0_14px_32px_-10px_hsl(172_72%_28%/0.55)] hover:brightness-[1.05] lg:h-12 lg:px-7">
                  Nova venda
                </Button>
              </Link>
              <Link href="/reports" className="shrink-0">
                <Button
                  variant="outline"
                  className="h-11 rounded-2xl border-border bg-white/85 font-semibold text-foreground shadow-sm backdrop-blur-sm hover:bg-card lg:h-12"
                >
                  Relatórios
                </Button>
              </Link>
              <Link href="/products" className="shrink-0">
                <Button
                  variant="outline"
                  className="h-11 rounded-2xl border-border bg-white/85 font-semibold text-foreground shadow-sm backdrop-blur-sm hover:bg-card lg:h-12"
                >
                  Produtos
                </Button>
              </Link>
            </div>
          </div>

          <div className="hidden flex-col gap-3 lg:col-span-5 lg:flex">
            <div className="group relative overflow-hidden rounded-2xl border border-white/50 bg-white/45 p-5 shadow-[0_20px_50px_-28px_hsl(172_40%_30%/0.25)] backdrop-blur-md transition hover:border-primary/30 hover:bg-white/55">
              <div className="absolute -right-6 -top-6 h-20 w-20 rounded-full bg-gradient-to-br from-primary/25 to-transparent blur-xl transition group-hover:from-primary/35" />
              <p className="text-[0.65rem] font-bold uppercase tracking-[0.18em] text-primary">Receita hoje</p>
              <p className="mt-1 font-heading text-3xl font-bold tracking-tight text-foreground xl:text-4xl">
                {formatCurrency(totalSalesToday)}
              </p>
              <p className="mt-2 text-xs font-medium text-muted-foreground">Atualizado ao abrir o painel</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="rounded-2xl border border-white/45 bg-gradient-to-br from-accent/10 to-primary/5 p-4 shadow-inner backdrop-blur-sm">
                <p className="text-[0.6rem] font-bold uppercase tracking-wider text-accent">Pedidos</p>
                <p className="mt-1 font-heading text-2xl font-bold text-foreground">{totalOrdersToday}</p>
              </div>
              <div className="rounded-2xl border border-white/45 bg-gradient-to-br from-primary/10 to-accent/5 p-4 shadow-inner backdrop-blur-sm">
                <p className="text-[0.6rem] font-bold uppercase tracking-wider text-primary">Stock</p>
                <p className="mt-1 font-heading text-2xl font-bold text-foreground">{stockAttentionTotal}</p>
                <p className="text-[0.65rem] font-semibold text-muted-foreground">stock</p>
              </div>
            </div>
            <div className="flex items-center justify-between rounded-2xl border border-dashed border-primary/25 bg-white/35 px-4 py-3 text-xs font-semibold text-muted-foreground backdrop-blur-sm">
              <span className="text-foreground">Equipa activa</span>
              <span className="rounded-lg bg-primary/15 px-2 py-1 font-bold text-primary">{activeUsers}</span>
            </div>
          </div>
        </div>
      </div>

      {/* KPIs — mobile: carrossel + dots + setas + auto; desktop: bento 12 colunas */}
      <KpiCarousel>
        {kpis.map((k) => {
          const KIcon = k.Icon;
          return (
            <Card key={k.id} className={cn('w-full rounded-2xl', mk.kpiBase)}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-semibold text-muted-foreground">{k.title}</CardTitle>
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${k.iconWrap}`}>
                  <KIcon className="h-5 w-5" strokeWidth={2.25} />
                </div>
              </CardHeader>
              <CardContent>{k.body}</CardContent>
            </Card>
          );
        })}
      </KpiCarousel>

      <div className="mb-8 hidden grid-cols-12 gap-4 md:grid md:gap-5 lg:gap-6">
        {kpis.map((k, i) => {
          const KIcon = k.Icon;
          return (
            <Card key={k.id} className={cn('rounded-2xl', mk.kpiBase, KPI_DESKTOP_COL[i])}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-semibold text-muted-foreground">{k.title}</CardTitle>
                <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${k.iconWrap}`}>
                  <KIcon className="h-5 w-5" strokeWidth={2.25} />
                </div>
              </CardHeader>
              <CardContent>{k.body}</CardContent>
            </Card>
          );
        })}
      </div>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3 lg:gap-6">
        <Card className="relative overflow-hidden border border-border bg-card shadow-[0_24px_56px_-32px_hsl(239_40%_20%/0.14)] lg:col-span-2">
          <div
            className="absolute inset-x-0 top-0 z-10 h-1 bg-gradient-to-r from-primary via-accent to-[hsl(262_72%_58%)]"
            aria-hidden
          />
          <CardHeader className="relative flex flex-col gap-4 pt-7 sm:flex-row sm:items-start sm:justify-between">
            <div className="border-l-4 border-primary pl-3">
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
                      ? 'bg-card font-black text-foreground shadow-sm ring-1 ring-primary/20'
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
                      <stop offset="5%" stopColor={mk.chartStroke} stopOpacity={0.45} />
                      <stop offset="95%" stopColor={mk.chartStroke} stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(230 26% 88%)" />
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
                      boxShadow: '0 16px 48px -16px hsl(239 40% 30% / 0.2)',
                    }}
                    formatter={(value: number, name: string) => [
                      formatCurrency(value),
                      name === 'total' ? 'Receita' : 'Meta',
                    ]}
                  />
                  <Area type="monotone" dataKey="total" stroke={mk.chartStroke} strokeWidth={2.5} fill="url(#mkArea)" />
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
                <span className="h-2 w-2 rounded-full bg-primary" /> Receita
              </span>
              <span className="flex items-center gap-2">
                <span className="h-0.5 w-5 border-t-2 border-dashed border-accent" /> Meta
              </span>
            </div>
          </CardContent>
        </Card>

        <Card className="border border-border bg-card shadow-[0_24px_56px_-32px_hsl(239_40%_20%/0.14)]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg font-bold text-foreground">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/12">
                <Star className="h-5 w-5 text-accent" strokeWidth={2.25} />
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
                  className="flex items-center justify-between rounded-2xl border border-border/80 bg-muted/25 px-3 py-3 transition hover:border-primary/25 hover:bg-muted/40"
                >
                  <div className="flex min-w-0 flex-1 items-center gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 text-sm font-bold text-accent">
                      #{idx + 1}
                    </span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">{p.name}</p>
                      <p className="text-xs text-muted-foreground">{p.quantity} vendas</p>
                    </div>
                  </div>
                  <p className="shrink-0 text-sm font-bold text-primary">{formatCurrency(p.revenue)}</p>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-5 lg:mt-6 lg:grid-cols-2 lg:gap-6">
        <Card className="border border-border bg-card shadow-[0_24px_56px_-32px_hsl(239_40%_20%/0.14)]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg font-bold text-foreground">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/12">
                <Package className="h-5 w-5 text-primary" strokeWidth={2.25} />
              </span>
              Alertas de stock
            </CardTitle>
          </CardHeader>
          <CardContent>
            {lowStockProducts.length === 0 ? (
              <div className="flex flex-col items-center justify-center rounded-2xl border-2 border-dashed border-primary/25 bg-primary/5 py-10 text-center sm:py-12">
                <CheckCircle2 className="mb-3 h-12 w-12 text-primary" strokeWidth={2} />
                <p className="font-bold text-foreground">Tudo em ordem!</p>
                <p className="mt-1 text-sm text-muted-foreground">Sem produtos abaixo do mínimo</p>
              </div>
            ) : (
              <div className="space-y-2">
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

        {/* Feed */}
        <Card className="border border-border bg-card shadow-[0_24px_56px_-32px_hsl(239_40%_20%/0.14)]">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg font-bold text-foreground">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-accent/12">
                <Activity className="h-5 w-5 text-accent" strokeWidth={2.25} />
              </span>
              Atividade
            </CardTitle>
            <CardDescription>Últimos {chartRangeDays} dias · vendas e alertas</CardDescription>
          </CardHeader>
          <CardContent className="max-h-[min(52vh,22rem)] overflow-y-auto pr-1 sm:max-h-[360px]">
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
                            : 'bg-accent'
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
                            <span className="shrink-0 rounded-lg bg-accent/12 px-2 py-0.5 text-xs font-bold text-accent">
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
          <div className="border-t border-border bg-muted/20 px-4 py-3">
            <Link href="/reports">
              <Button variant="ghost" className="w-full rounded-xl text-sm font-bold text-accent hover:bg-accent/10">
                Ver histórico completo
              </Button>
            </Link>
          </div>
        </Card>
      </div>
    </div>
  );
}
