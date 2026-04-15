import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, Pie, PieChart, Cell } from 'recharts';
import { format, subDays, isSameDay, differenceInCalendarDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatCurrency } from '@/lib/utils';
import { useMemo, useState } from 'react';
import { DateRange } from "react-day-picker"
import { Calendar as CalendarIcon, Download, TrendingUp, Users, ShoppingBag, Clock, TrendingDown, Filter, Sparkles, ReceiptText, Layers, ArrowUpRight, ArrowDownRight, FileDown, Zap, BadgeAlert, Flame, Wand2, BarChart2, Wallet, PackageOpen } from "lucide-react"
import { cn } from "@/lib/utils"
import { Calendar } from "@/components/ui/calendar"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { Tabs, TabsContent, TabsList } from "@/components/ui/tabs"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useQuery } from '@tanstack/react-query';
import { salesApi, productsApi, categoriesApi, usersApi } from '@/lib/api';
import * as XLSX from 'xlsx';
import { toast } from '@/hooks/use-toast';

export default function Reports() {
  const { user } = useAuth();
  const [date, setDate] = useState<DateRange | undefined>({
    from: subDays(new Date(), 30),
    to: new Date(),
  });
  const [quickRange, setQuickRange] = useState<7 | 30 | 90>(30);
  const [activeTab, setActiveTab] = useState<'overview' | 'trends' | 'breakdown' | 'detailed'>('overview');
  const [paymentFilter, setPaymentFilter] = useState<string>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [sellerFilter, setSellerFilter] = useState<string>('all');
  const [drillCategory, setDrillCategory] = useState<string | null>(null);
  const [trendGranularity, setTrendGranularity] = useState<'day' | 'hour'>('day');

  const { data: sales = [], isLoading: salesLoading } = useQuery({
    queryKey: ['/api/sales'],
    queryFn: salesApi.getAll
  });

  const { data: products = [], isLoading: productsLoading } = useQuery({
    queryKey: ['/api/products'],
    queryFn: productsApi.getAll
  });

  const { data: categories = [], isLoading: categoriesLoading } = useQuery({
    queryKey: ['/api/categories'],
    queryFn: categoriesApi.getAll
  });

  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ['/api/users'],
    queryFn: usersApi.getAll,
    enabled: user?.role !== 'seller',
  });

  const isSeller = user?.role === 'seller';
  const baseSales = useMemo(() => (isSeller ? (sales as any[]).filter((s) => s.userId === user?.id) : (sales as any[])), [isSeller, sales, user?.id]);

  const selectedFrom = date?.from;
  const selectedTo = date?.to || date?.from;
  const normalizedFrom = selectedFrom ? new Date(selectedFrom.getFullYear(), selectedFrom.getMonth(), selectedFrom.getDate(), 0, 0, 0, 0) : null;
  const normalizedTo = selectedTo ? new Date(selectedTo.getFullYear(), selectedTo.getMonth(), selectedTo.getDate(), 23, 59, 59, 999) : null;

  const filteredSales = useMemo(() => {
    if (!normalizedFrom || !normalizedTo) return baseSales;
    return baseSales.filter((s: any) => {
      const d = new Date(s.createdAt);
      return d >= normalizedFrom && d <= normalizedTo;
    });
  }, [baseSales, normalizedFrom, normalizedTo]);

  const productById = useMemo(() => {
    const m = new Map<string, any>();
    for (const p of products as any[]) m.set(p.id, p);
    return m;
  }, [products]);

  const categoryById = useMemo(() => {
    const m = new Map<string, any>();
    for (const c of categories as any[]) m.set(c.id, c);
    return m;
  }, [categories]);

  const filteredSales2 = useMemo(() => {
    return (filteredSales as any[]).filter((s) => {
      if (paymentFilter !== 'all' && String(s.paymentMethod) !== paymentFilter) return false;
      if (!isSeller && sellerFilter !== 'all' && String(s.userId) !== sellerFilter) return false;
      if (categoryFilter !== 'all') {
        const ok = (s.items ?? []).some((it: any) => {
          const p = productById.get(it.productId);
          return p?.categoryId === categoryFilter;
        });
        if (!ok) return false;
      }
      if (drillCategory) {
        const ok = (s.items ?? []).some((it: any) => {
          const p = productById.get(it.productId);
          const cat = p?.categoryId ? categoryById.get(p.categoryId) : null;
          return (cat?.name || 'Outros') === drillCategory;
        });
        if (!ok) return false;
      }
      return true;
    });
  }, [categoryById, categoryFilter, drillCategory, filteredSales, isSeller, paymentFilter, productById, sellerFilter]);

  const rangeDays = useMemo(() => {
    if (!selectedFrom || !selectedTo) return quickRange;
    const d = Math.abs(differenceInCalendarDays(selectedTo, selectedFrom));
    return Math.max(1, d + 1);
  }, [quickRange, selectedFrom, selectedTo]);

  const previousWindow = useMemo(() => {
    if (!normalizedFrom || !normalizedTo) return null;
    const end = new Date(normalizedFrom.getTime() - 1);
    const start = new Date(end.getTime() - (rangeDays - 1) * 24 * 60 * 60 * 1000);
    start.setHours(0, 0, 0, 0);
    return { start, end };
  }, [normalizedFrom, normalizedTo, rangeDays]);

  const previousSales = useMemo(() => {
    if (!previousWindow) return [];
    return baseSales.filter((s: any) => {
      const d = new Date(s.createdAt);
      return d >= previousWindow.start && d <= previousWindow.end;
    });
  }, [baseSales, previousWindow]);

  const totals = useMemo(() => {
    const revenue = filteredSales2.reduce((acc: number, s: any) => acc + parseFloat(s.total), 0);
    const count = filteredSales2.length;
    const avg = count > 0 ? revenue / count : 0;
    const items = filteredSales2.reduce((acc: number, s: any) => acc + (s.items?.length ?? 0), 0);
    const prevRevenue = previousSales.reduce((acc: number, s: any) => acc + parseFloat(s.total), 0);
    const prevCount = previousSales.length;
    const pct = prevRevenue > 0 ? ((revenue - prevRevenue) / prevRevenue) * 100 : revenue > 0 ? 100 : 0;
    const salesPct = prevCount > 0 ? ((count - prevCount) / prevCount) * 100 : count > 0 ? 100 : 0;
    return { revenue, count, avg, items, prevRevenue, prevCount, pct, salesPct };
  }, [filteredSales2, previousSales]);

  const dailySeries = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of filteredSales2 as any[]) {
      const d = new Date(s.createdAt);
      const key = format(d, 'yyyy-MM-dd');
      map.set(key, (map.get(key) ?? 0) + parseFloat(s.total));
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, total]) => ({
        key,
        date: format(new Date(key + 'T00:00:00'), 'dd/MM', { locale: ptBR }),
        total,
      }));
  }, [filteredSales2]);

  const dailyCountSeries = useMemo(() => {
    const map = new Map<string, number>();
    for (const s of filteredSales2 as any[]) {
      const key = format(new Date(s.createdAt), 'yyyy-MM-dd');
      map.set(key, (map.get(key) ?? 0) + 1);
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, value]) => ({
        key,
        date: format(new Date(key + 'T00:00:00'), 'dd/MM', { locale: ptBR }),
        value,
      }));
  }, [filteredSales2]);

  const dailyAvgTicketSeries = useMemo(() => {
    const map = new Map<string, { sum: number; n: number }>();
    for (const s of filteredSales2 as any[]) {
      const key = format(new Date(s.createdAt), 'yyyy-MM-dd');
      const v = map.get(key) ?? { sum: 0, n: 0 };
      v.sum += parseFloat(s.total);
      v.n += 1;
      map.set(key, v);
    }
    return Array.from(map.entries())
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([key, v]) => ({
        key,
        date: format(new Date(key + 'T00:00:00'), 'dd/MM', { locale: ptBR }),
        value: v.n ? v.sum / v.n : 0,
      }));
  }, [filteredSales2]);

  const paymentBreakdown = useMemo(() => {
    const m: Record<string, { name: string; value: number; count: number }> = {};
    for (const s of filteredSales2 as any[]) {
      const pm = String(s.paymentMethod || 'outros');
      if (!m[pm]) m[pm] = { name: pm, value: 0, count: 0 };
      m[pm].value += parseFloat(s.total);
      m[pm].count += 1;
    }
    return Object.values(m).sort((a, b) => b.value - a.value);
  }, [filteredSales2]);

  const annotations = useMemo(() => {
    if (dailySeries.length < 2) {
      return {
        spike: null as any,
        drop: null as any,
        streak: 0,
        last3TrendPct: 0,
        topPayment: paymentBreakdown[0]?.name || null,
      };
    }
    const diffs = dailySeries.slice(1).map((d, i) => ({ from: dailySeries[i], to: d, delta: d.total - dailySeries[i].total }));
    const spike = diffs.reduce((a, c) => (c.delta > a.delta ? c : a), diffs[0]);
    const drop = diffs.reduce((a, c) => (c.delta < a.delta ? c : a), diffs[0]);
    // streak: dias seguidos com venda (>0) no final do período
    let streak = 0;
    for (let i = dailySeries.length - 1; i >= 0; i--) {
      if (dailySeries[i].total > 0) streak += 1;
      else break;
    }
    const last = dailySeries.slice(-3);
    const prev = dailySeries.slice(-6, -3);
    const sumLast = last.reduce((a, c) => a + c.total, 0);
    const sumPrev = prev.reduce((a, c) => a + c.total, 0);
    const last3TrendPct = sumPrev > 0 ? ((sumLast - sumPrev) / sumPrev) * 100 : sumLast > 0 ? 100 : 0;
    const topPayment = paymentBreakdown[0]?.name || null;
    return { spike, drop, streak, last3TrendPct, topPayment };
  }, [dailySeries, paymentBreakdown]);

  const dailyWithSignals = useMemo(() => {
    const rows = dailySeries.map((d) => ({ ...d, cumulative: 0, ma7: 0 }));
    let cum = 0;
    for (let i = 0; i < rows.length; i++) {
      cum += rows[i].total;
      rows[i].cumulative = cum;
      const start = Math.max(0, i - 6);
      const slice = rows.slice(start, i + 1);
      const avg = slice.reduce((a, c) => a + c.total, 0) / slice.length;
      rows[i].ma7 = avg;
    }
    return rows;
  }, [dailySeries]);

  const bestWorst = useMemo(() => {
    if (!dailySeries.length) return { best: null as any, worst: null as any };
    const best = dailySeries.reduce((a, c) => (c.total > a.total ? c : a), dailySeries[0]);
    const worst = dailySeries.reduce((a, c) => (c.total < a.total ? c : a), dailySeries[0]);
    return { best, worst };
  }, [dailySeries]);

  const lowStockAlerts = useMemo(() => {
    const list = (products as any[])
      .filter((p) => parseFloat(p.stock) <= parseFloat(p.minStock))
      .sort((a, b) => parseFloat(a.stock) - parseFloat(b.stock))
      .slice(0, 8);
    return list;
  }, [products]);

  const categoryBreakdown = useMemo(() => {
    const byCat: Record<string, number> = {};
    for (const sale of filteredSales2 as any[]) {
      for (const item of sale.items ?? []) {
        const product = productById.get(item.productId);
        const category = product ? categoryById.get(product.categoryId) : null;
        const name = category?.name || 'Outros';
        byCat[name] = (byCat[name] ?? 0) + (item.priceAtSale * item.quantity);
      }
    }
    return Object.entries(byCat)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [categoryById, filteredSales2, productById]);

  const topProducts = useMemo(() => {
    const byProd: Record<string, { productId: string; name: string; qty: number; revenue: number }> = {};
    for (const sale of filteredSales2 as any[]) {
      for (const item of sale.items ?? []) {
        const product = productById.get(item.productId);
        const name = product?.name || item.productId;
        if (!byProd[item.productId]) byProd[item.productId] = { productId: item.productId, name, qty: 0, revenue: 0 };
        byProd[item.productId].qty += Number(item.quantity ?? 0);
        byProd[item.productId].revenue += Number(item.quantity ?? 0) * Number(item.priceAtSale ?? 0);
      }
    }
    return Object.values(byProd).sort((a, b) => b.revenue - a.revenue).slice(0, 10);
  }, [filteredSales2, productById]);

  const drilledTopProducts = useMemo(() => {
    if (!drillCategory) return topProducts;
    const byProd: Record<string, { productId: string; name: string; qty: number; revenue: number }> = {};
    for (const sale of filteredSales2 as any[]) {
      for (const item of sale.items ?? []) {
        const product = productById.get(item.productId);
        const category = product?.categoryId ? categoryById.get(product.categoryId) : null;
        const nameCat = category?.name || 'Outros';
        if (nameCat !== drillCategory) continue;
        const name = product?.name || item.productId;
        if (!byProd[item.productId]) byProd[item.productId] = { productId: item.productId, name, qty: 0, revenue: 0 };
        byProd[item.productId].qty += Number(item.quantity ?? 0);
        byProd[item.productId].revenue += Number(item.quantity ?? 0) * Number(item.priceAtSale ?? 0);
      }
    }
    return Object.values(byProd).sort((a, b) => b.revenue - a.revenue).slice(0, 10);
  }, [categoryById, drillCategory, filteredSales2, productById, topProducts]);

  const hourHeat = useMemo(() => {
    const hours = Array.from({ length: 24 }, (_, h) => ({ hour: `${String(h).padStart(2, '0')}h`, value: 0, count: 0 }));
    for (const s of filteredSales2 as any[]) {
      const d = new Date(s.createdAt);
      const h = d.getHours();
      hours[h].value += parseFloat(s.total);
      hours[h].count += 1;
    }
    return hours;
  }, [filteredSales2]);

  const trendSeriesDaily = useMemo(() => {
    return dailySeries.map((d) => ({ label: d.date, value: d.total }));
  }, [dailySeries]);

  const trendSeriesHourly = useMemo(() => {
    return hourHeat.map((h) => ({ label: h.hour, value: h.value }));
  }, [hourHeat]);

  const sellerPerformance = useMemo(() => {
    if (isSeller) return [];
    const byUser: Record<string, { id: string; name: string; total: number; count: number }> = {};
    for (const s of filteredSales2 as any[]) {
      const seller = (users as any[]).find((u) => u.id === s.userId);
      const name = seller?.name || 'Desconhecido';
      if (!byUser[s.userId]) byUser[s.userId] = { id: s.userId, name, total: 0, count: 0 };
      byUser[s.userId].total += parseFloat(s.total);
      byUser[s.userId].count += 1;
    }
    return Object.values(byUser).sort((a, b) => b.total - a.total).slice(0, 12);
  }, [filteredSales2, isSeller, users]);

  const detailedRows = useMemo(() => {
    return (filteredSales2 as any[])
      .slice()
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .map((s) => {
        const seller = (users as any[]).find((u) => u.id === s.userId);
        return {
          id: s.id,
          shortId: String(s.id).slice(-6).toUpperCase(),
          createdAt: new Date(s.createdAt),
          seller: seller?.name || 'Desconhecido',
          paymentMethod: String(s.paymentMethod || ''),
          items: Array.isArray(s.items) ? s.items.length : 0,
          total: parseFloat(s.total),
        };
      });
  }, [filteredSales2, users]);

  const financialSummary = useMemo(() => {
    const isAdminOrManager = user?.role === 'admin' || user?.role === 'manager';
    if (!isAdminOrManager) return null;
    const capitalInStock = (products as any[]).reduce((sum, p) => {
      const cost = parseFloat(p.costPrice ?? '0') || 0;
      const stock = parseFloat(p.stock ?? '0') || 0;
      return sum + cost * stock;
    }, 0);
    let periodCMV = 0;
    for (const sale of filteredSales2 as any[]) {
      for (const item of sale.items ?? []) {
        const product = productById.get(item.productId);
        const cost = parseFloat(product?.costPrice ?? '0') || 0;
        periodCMV += cost * Number(item.quantity ?? 0);
      }
    }
    const grossProfit = totals.revenue - periodCMV;
    const margin = totals.revenue > 0 ? (grossProfit / totals.revenue) * 100 : 0;
    return { capitalInStock, periodCMV, grossProfit, margin };
  }, [filteredSales2, productById, products, totals.revenue, user?.role]);

  const handleExportExcel = () => {
    try {
      const workbook = XLSX.utils.book_new();
      
      // Sheet 1: Relatório de Vendas
      const salesData = filteredSales.map(s => ({
        'ID': s.id.slice(-6),
        'Vendedor': users.find(u => u.id === s.userId)?.name || 'Desconhecido',
        'Total': parseFloat(s.total),
        'Itens': s.items.length,
        'Forma Pagamento': s.paymentMethod,
        'Data': format(new Date(s.createdAt), 'dd/MM/yyyy HH:mm', { locale: ptBR })
      }));
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(salesData), "Vendas");

      // Sheet 2: Performance por Vendedor
      const sellerPerformance = sales.reduce((acc, sale) => {
        const seller = users.find(u => u.id === sale.userId);
        const existing = acc.find(s => s.vendedor === (seller?.name || 'Desconhecido'));
        if (existing) {
          existing.vendas += 1;
          existing.total += parseFloat(sale.total);
        } else {
          acc.push({ vendedor: seller?.name || 'Desconhecido', vendas: 1, total: parseFloat(sale.total) });
        }
        return acc;
      }, [] as any[]).sort((a, b) => b.total - a.total);
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(sellerPerformance), "Performance Vendedores");

      // Sheet 3: Produtos Mais Vendidos
      const topProducts = sales
        .flatMap(s => s.items)
        .reduce((acc, item) => {
          const existing = acc.find(p => p.productId === item.productId);
          const product = products.find(p => p.id === item.productId);
          if (existing) {
            existing.quantidade += item.quantity;
          } else {
            acc.push({ produto: product?.name || 'Desconhecido', quantidade: item.quantity, preco: item.priceAtSale, productId: item.productId });
          }
          return acc;
        }, [] as any[])
        .map(p => ({ 'Produto': p.produto, 'Quantidade': p.quantidade, 'Preço': p.preco }))
        .sort((a, b) => b.Quantidade - a.Quantidade);
      XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(topProducts), "Top Produtos");

      XLSX.writeFile(workbook, `relatorio_vendas_${format(new Date(), 'dd-MM-yyyy')}.xlsx`);
      toast({ title: "Sucesso", description: "Relatório exportado com sucesso!" });
    } catch (error) {
      toast({ title: "Erro", description: "Erro ao exportar relatório", variant: "destructive" });
    }
  };

  const today = new Date();
  const todaySales = baseSales.filter(s => isSameDay(new Date(s.createdAt), today));
  const yesterdaySales = baseSales.filter(s => isSameDay(new Date(s.createdAt), subDays(today, 1)));
  const todayTotal = todaySales.reduce((acc, s) => acc + parseFloat(s.total), 0);
  const yesterdayTotal = yesterdaySales.reduce((acc, s) => acc + parseFloat(s.total), 0);

  const isLoading = salesLoading || productsLoading || categoriesLoading || (user?.role !== 'seller' ? usersLoading : false);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <div className="animate-spin h-12 w-12 border-4 border-primary border-t-transparent rounded-full mx-auto"></div>
          <p className="text-muted-foreground">Carregando relatórios...</p>
        </div>
      </div>
    );
  }

  const PAYMENT_COLORS = ['#10b981', '#0ea5e9', '#f59e0b', '#8b5cf6', '#ef4444', '#64748b'];

  function exportCsv(filename: string, rows: Array<Record<string, any>>) {
    if (!rows.length) {
      toast({ title: 'Nada para exportar', description: 'Sem dados no período atual.', variant: 'destructive' });
      return;
    }
    const headers = Object.keys(rows[0]);
    const esc = (v: any) => {
      const s = String(v ?? '');
      if (/[",\n]/.test(s)) return `"${s.replaceAll('"', '""')}"`;
      return s;
    };
    const csv = [headers.join(','), ...rows.map((r) => headers.map((h) => esc(r[h])).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function applyQuickRange(days: 7 | 30 | 90) {
    setQuickRange(days);
    setDate({ from: subDays(new Date(), days), to: new Date() });
  }

  return (
    <div className="space-y-6">

      {/* MOBILE: Resumo do vendedor — hoje e ontem */}
      <div className="md:hidden space-y-3">
        {/* mini banner mobile */}
        <div className="overflow-hidden rounded-2xl shadow-sm">
          <div className="relative bg-[#B71C1C] px-4 py-4">
            <div className="banner-texture" />
            <div className="relative flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/25">
                <BarChart2 className="h-4 w-4 text-white" strokeWidth={2.5} />
              </div>
              <div>
                <h1 className="text-base font-extrabold text-white">Minhas Vendas</h1>
                <p className="text-[11px] text-white/60">Resumo do seu desempenho</p>
              </div>
            </div>
          </div>
        </div>

        {/* KPIs hoje / ontem */}
        <div className="grid grid-cols-2 gap-2.5">
          <div className="relative overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
            <div className="px-4 py-3">
              <div className="flex items-center gap-1.5 mb-1">
                <Clock className="h-3 w-3 text-[#B71C1C]" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Hoje</span>
              </div>
              <p className="text-lg font-black text-[#B71C1C] tabular-nums">{formatCurrency(todayTotal)}</p>
              <p className="text-[11px] text-gray-400 mt-0.5">{todaySales.length} venda{todaySales.length !== 1 ? 's' : ''}</p>
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[#B71C1C] to-[#7f1d1d]" />
          </div>
          <div className="relative overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
            <div className="px-4 py-3">
              <div className="flex items-center gap-1.5 mb-1">
                <TrendingDown className="h-3 w-3 text-gray-500" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Ontem</span>
              </div>
              <p className="text-lg font-black text-gray-800 tabular-nums">{formatCurrency(yesterdayTotal)}</p>
              <p className="text-[11px] text-gray-400 mt-0.5">{yesterdaySales.length} venda{yesterdaySales.length !== 1 ? 's' : ''}</p>
            </div>
            <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-[#1A1A2E]" />
          </div>
        </div>

        {/* Lista de vendas recentes */}
        <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
          <div className="flex items-center gap-2 border-b border-gray-100 bg-gray-50/60 px-4 py-3">
            <ShoppingBag className="h-3.5 w-3.5 text-[#B71C1C]" />
            <p className="text-xs font-bold text-gray-700">Vendas Recentes</p>
          </div>
          <div className="divide-y divide-gray-50">
            {baseSales.length === 0 ? (
              <div className="py-8 text-center text-sm text-gray-400">Nenhuma venda registada</div>
            ) : (
              baseSales
                .slice()
                .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                .slice(0, 10)
                .map(sale => {
                  const isToday = isSameDay(new Date(sale.createdAt), today);
                  const isYesterday = isSameDay(new Date(sale.createdAt), subDays(today, 1));
                  const dayLabel = isToday ? 'Hoje' : isYesterday ? 'Ontem' : format(new Date(sale.createdAt), "dd/MM", { locale: ptBR });
                  return (
                    <div key={sale.id} className="flex items-center justify-between px-4 py-3">
                      <div>
                        <p className="text-sm font-semibold text-gray-800">#{sale.id.slice(-6).toUpperCase()}</p>
                        <p className="text-[11px] text-gray-400">
                          {dayLabel} · {format(new Date(sale.createdAt), "HH:mm")} · {sale.items.length} {sale.items.length === 1 ? 'item' : 'itens'}
                        </p>
                      </div>
                      <span className="text-sm font-black tabular-nums text-[#B71C1C]">{formatCurrency(parseFloat(sale.total))}</span>
                    </div>
                  );
                })
            )}
          </div>
        </div>
      </div>

      {/* ── CABEÇALHO — padrão do sistema ── */}
      <div className="hidden md:block overflow-hidden rounded-3xl shadow-sm">
        {/* Banner vermelho */}
        <div className="relative bg-[#B71C1C] px-6 py-5">
          <div className="banner-texture" />
          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            {/* Título */}
            <div className="flex items-center gap-3">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/25">
                <BarChart2 className="h-5 w-5 text-white" strokeWidth={2.5} />
              </div>
              <div>
                <h1 className="text-xl font-extrabold tracking-tight text-white">
                  Relatórios
                  <span className="hidden sm:inline text-sm font-normal text-white/50 ml-2">— Insights &amp; Tendências</span>
                </h1>
                <p className="flex items-center gap-2 text-[11px] font-medium text-white/60 mt-0.5">
                  <span>{totals.count} venda{totals.count !== 1 ? 's' : ''} no período</span>
                  <span className="h-1 w-1 rounded-full bg-white/40" />
                  <span className="text-emerald-200">{formatCurrency(totals.revenue)} receita</span>
                  {totals.pct !== 0 && (
                    <>
                      <span className="h-1 w-1 rounded-full bg-amber-300/80" />
                      <span className={totals.pct >= 0 ? 'text-emerald-200' : 'text-red-200'}>
                        {totals.pct >= 0 ? '+' : ''}{totals.pct.toFixed(1)}% vs anterior
                      </span>
                    </>
                  )}
                </p>
              </div>
            </div>
            {/* Acções: exportar + data */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => exportCsv(`relatorio_resumo_${format(new Date(), 'dd-MM-yyyy')}.csv`, [{
                  periodo: date?.from ? `${format(date.from, 'dd/MM/yyyy')} - ${format((date.to || date.from), 'dd/MM/yyyy')}` : '—',
                  receita_total: totals.revenue.toFixed(2),
                  vendas: totals.count,
                  ticket_medio: totals.avg.toFixed(2),
                  itens_total: totals.items,
                }])}
                className="flex items-center gap-1.5 rounded-xl border border-white/25 bg-white/10 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-white/20"
              >
                <FileDown className="h-3.5 w-3.5" />
                CSV
              </button>
              <button
                type="button"
                onClick={handleExportExcel}
                className="flex items-center gap-1.5 rounded-xl border border-white/25 bg-white/10 px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-white/20"
              >
                <Download className="h-3.5 w-3.5" />
                Excel
              </button>
              <Popover>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    data-testid="button-date-range"
                    className="flex items-center gap-1.5 rounded-xl bg-white px-3.5 py-2 text-xs font-bold text-[#B71C1C] shadow-md shadow-black/20 transition hover:bg-gray-50"
                  >
                    <CalendarIcon className="h-3.5 w-3.5" />
                    {date?.from ? (
                      date.to
                        ? `${format(date.from, "dd MMM", { locale: ptBR })} – ${format(date.to, "dd MMM", { locale: ptBR })}`
                        : format(date.from, "dd MMM yyyy", { locale: ptBR })
                    ) : 'Selecione período'}
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="end">
                  <Calendar
                    mode="range"
                    defaultMonth={date?.from}
                    selected={date}
                    onSelect={setDate}
                    numberOfMonths={2}
                  />
                </PopoverContent>
              </Popover>
            </div>
          </div>
        </div>

        {/* Tabs + filtros */}
        <div className="bg-white px-6 py-4">
          {/* Tabs de vista */}
          <div className="flex flex-wrap gap-1.5">
            {([
              { id: 'overview',  label: 'Visão geral',  icon: Sparkles   },
              { id: 'trends',    label: 'Tendências',   icon: TrendingUp  },
              { id: 'breakdown', label: 'Breakdown',    icon: Users       },
              { id: 'detailed',  label: 'Detalhado',    icon: ReceiptText },
            ] as const).map((t) => {
              const Icon = t.icon;
              const active = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setActiveTab(t.id)}
                  className={`flex items-center gap-1.5 rounded-full px-4 py-2 text-sm font-semibold transition-all ${
                    active
                      ? 'bg-[#B71C1C] text-white shadow-sm shadow-[#B71C1C]/25'
                      : 'border border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <Icon className="h-4 w-4" />
                  {t.label}
                </button>
              );
            })}
          </div>

          {/* Filtros rápidos */}
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 rounded-xl border border-gray-200 bg-gray-50 px-2.5 py-1">
              <Filter className="h-3 w-3 text-gray-400 mr-0.5" />
              <span className="text-[10px] font-bold text-gray-400 mr-1">Período</span>
              {([7, 30, 90] as const).map((d) => {
                const active = quickRange === d && rangeDays === d;
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => applyQuickRange(d)}
                    title={`Últimos ${d} dias`}
                    className={`cursor-pointer rounded-md px-2.5 py-1 text-[11px] font-bold transition-all select-none ${
                      active
                        ? 'bg-[#B71C1C] text-white shadow-sm shadow-[#B71C1C]/30'
                        : 'border border-gray-200 bg-white text-gray-600 hover:border-[#B71C1C]/30 hover:bg-[#B71C1C]/5 hover:text-[#B71C1C] active:scale-95'
                    }`}
                  >
                    {d}d
                  </button>
                );
              })}
            </div>

            <Select value={paymentFilter} onValueChange={setPaymentFilter}>
              <SelectTrigger className="h-8 w-[170px] rounded-xl border-gray-200 text-xs">
                <SelectValue placeholder="Pagamento" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos pagamentos</SelectItem>
                {Array.from(new Set((sales as any[]).map((s) => String(s.paymentMethod || ''))))
                  .filter(Boolean).sort().map((pm) => (
                    <SelectItem key={pm} value={pm}>{pm}</SelectItem>
                  ))}
              </SelectContent>
            </Select>

            <Select value={categoryFilter} onValueChange={setCategoryFilter}>
              <SelectTrigger className="h-8 w-[170px] rounded-xl border-gray-200 text-xs">
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas categorias</SelectItem>
                {(categories as any[]).map((c) => (
                  <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>

            {!isSeller && (
              <Select value={sellerFilter} onValueChange={setSellerFilter}>
                <SelectTrigger className="h-8 w-[190px] rounded-xl border-gray-200 text-xs">
                  <SelectValue placeholder="Vendedor" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos vendedores</SelectItem>
                  {(users as any[]).map((u) => (
                    <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {(paymentFilter !== 'all' || categoryFilter !== 'all' || sellerFilter !== 'all' || drillCategory) && (
              <button
                type="button"
                onClick={() => { setPaymentFilter('all'); setCategoryFilter('all'); setSellerFilter('all'); setDrillCategory(null); }}
                className="rounded-xl border border-gray-200 bg-white px-3 py-1.5 text-[11px] font-semibold text-gray-600 transition hover:bg-gray-50"
              >
                Limpar filtros
              </button>
            )}

            {drillCategory && (
              <div className="flex items-center gap-1.5 rounded-xl border border-[#B71C1C]/20 bg-[#B71C1C]/5 px-3 py-1.5">
                <span className="text-[11px] font-black text-[#B71C1C]">{drillCategory}</span>
                <button type="button" onClick={() => setDrillCategory(null)} className="text-[#B71C1C]/60 hover:text-[#B71C1C]">×</button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="hidden md:grid md:grid-cols-4 gap-3">

        {/* Receita */}
        <div className="relative overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
          <div className="px-4 pt-3 pb-2">
            <div className="flex items-start justify-between gap-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Receita</p>
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#B71C1C]/10">
                <Sparkles className="h-3.5 w-3.5 text-[#B71C1C]" />
              </div>
            </div>
            <p className="mt-1 text-lg font-black tabular-nums text-[#B71C1C]" data-testid="text-total-revenue">
              {formatCurrency(totals.revenue)}
            </p>
            <p className="mt-1 flex items-center gap-1 text-[11px]">
              {totals.pct >= 0
                ? <ArrowUpRight className="h-3 w-3 text-emerald-600" />
                : <ArrowDownRight className="h-3 w-3 text-rose-600" />}
              <span className={totals.pct >= 0 ? 'font-semibold text-emerald-700' : 'font-semibold text-rose-700'}>
                {Math.abs(totals.pct).toFixed(1)}%
              </span>
              <span className="text-gray-400">vs anterior</span>
            </p>
            <div className="mt-1.5 h-7">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={dailySeries}>
                  <defs>
                    <linearGradient id="mkMiniRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#B71C1C" stopOpacity={0.15} />
                      <stop offset="95%" stopColor="#B71C1C" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area type="monotone" dataKey="total" stroke="#B71C1C" strokeWidth={1.5} fill="url(#mkMiniRev)" dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[#B71C1C] to-[#7f1d1d]" />
        </div>

        {/* Vendas */}
        <div className="relative overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
          <div className="px-4 pt-3 pb-2">
            <div className="flex items-start justify-between gap-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Vendas</p>
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100">
                <ReceiptText className="h-3.5 w-3.5 text-gray-700" />
              </div>
            </div>
            <p className="mt-1 text-lg font-black tabular-nums text-gray-900" data-testid="text-total-sales">
              {totals.count}
            </p>
            <p className="mt-1 flex items-center gap-1 text-[11px]">
              {totals.salesPct >= 0
                ? <ArrowUpRight className="h-3 w-3 text-emerald-600" />
                : <ArrowDownRight className="h-3 w-3 text-rose-600" />}
              <span className={totals.salesPct >= 0 ? 'font-semibold text-emerald-700' : 'font-semibold text-rose-700'}>
                {Math.abs(totals.salesPct).toFixed(1)}%
              </span>
              <span className="text-gray-400">vs anterior</span>
            </p>
            <div className="mt-1.5 h-7">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dailyCountSeries}>
                  <Line type="monotone" dataKey="value" stroke="#1A1A2E" strokeWidth={1.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-[#1A1A2E]" />
        </div>

        {/* Ticket médio */}
        <div className="relative overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
          <div className="px-4 pt-3 pb-2">
            <div className="flex items-start justify-between gap-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Ticket médio</p>
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#B71C1C]/10">
                <ShoppingBag className="h-3.5 w-3.5 text-[#B71C1C]" />
              </div>
            </div>
            <p className="mt-1 text-lg font-black tabular-nums text-gray-900" data-testid="text-avg-ticket">
              {formatCurrency(totals.avg)}
            </p>
            <p className="mt-1 text-[11px] text-gray-400">Receita por venda</p>
            <div className="mt-1.5 h-7">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dailyAvgTicketSeries}>
                  <Line type="monotone" dataKey="value" stroke="#B71C1C" strokeWidth={1.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-[#B71C1C]/50" />
        </div>

        {/* Itens */}
        <div className="relative overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
          <div className="px-4 pt-3 pb-2">
            <div className="flex items-start justify-between gap-2">
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Itens vendidos</p>
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100">
                <Layers className="h-3.5 w-3.5 text-gray-700" />
              </div>
            </div>
            <p className="mt-1 text-lg font-black tabular-nums text-gray-900">{totals.items}</p>
            <p className="mt-1 text-[11px] text-gray-400">Total no período</p>
            <div className="mt-2 flex flex-wrap gap-1">
              {annotations.streak > 0 && (
                <span className="inline-flex items-center gap-1 rounded-md bg-[#B71C1C]/8 px-1.5 py-0.5 text-[10px] font-bold text-[#B71C1C]">
                  <Flame className="h-2.5 w-2.5" /> {annotations.streak}d
                </span>
              )}
              {annotations.topPayment && (
                <span className="inline-flex items-center gap-1 rounded-md bg-gray-100 px-1.5 py-0.5 text-[10px] font-bold text-gray-600">
                  <Wand2 className="h-2.5 w-2.5" /> {annotations.topPayment}
                </span>
              )}
            </div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-[#1A1A2E]" />
        </div>

      </div>

      {/* ── SECÇÃO FINANCEIRA (admin/manager) ── */}
      {financialSummary && (
        <div className="hidden md:block">
          <div className="mb-3 flex items-center gap-2">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#B71C1C]/10">
              <Wallet className="h-3.5 w-3.5 text-[#B71C1C]" />
            </div>
            <p className="text-sm font-bold text-gray-700">Análise Financeira</p>
            <span className="rounded-full bg-[#B71C1C]/8 px-2 py-0.5 text-[10px] font-bold text-[#B71C1C]">Admin / Gestor</span>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">

            {/* Lucro bruto */}
            <div className="relative overflow-hidden rounded-2xl border border-emerald-100 bg-white shadow-sm">
              <div className="px-4 pt-3 pb-2">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Lucro bruto</p>
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50">
                    <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
                  </div>
                </div>
                <p className={`mt-1 text-lg font-black tabular-nums ${financialSummary.grossProfit >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                  {formatCurrency(financialSummary.grossProfit)}
                </p>
                <p className="mt-1 flex items-center gap-1 text-[11px]">
                  {financialSummary.margin >= 0
                    ? <ArrowUpRight className="h-3 w-3 text-emerald-600" />
                    : <ArrowDownRight className="h-3 w-3 text-rose-600" />}
                  <span className={`font-semibold ${financialSummary.margin >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                    {Math.abs(financialSummary.margin).toFixed(1)}%
                  </span>
                  <span className="text-gray-400">margem</span>
                </p>
              </div>
              <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-gradient-to-r from-emerald-500 to-emerald-400" />
            </div>

            {/* CMV */}
            <div className="relative overflow-hidden rounded-2xl border border-orange-100 bg-white shadow-sm">
              <div className="px-4 pt-3 pb-2">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">CMV</p>
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-orange-50">
                    <TrendingDown className="h-3.5 w-3.5 text-orange-500" />
                  </div>
                </div>
                <p className="mt-1 text-lg font-black tabular-nums text-orange-600">
                  {formatCurrency(financialSummary.periodCMV)}
                </p>
                <p className="mt-1 text-[11px] text-gray-400">
                  Custo das mercadorias vendidas
                </p>
              </div>
              <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-gradient-to-r from-orange-400 to-amber-400" />
            </div>

            {/* Capital em stock */}
            <div className="relative overflow-hidden rounded-2xl border border-blue-100 bg-white shadow-sm">
              <div className="px-4 pt-3 pb-2">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Capital em stock</p>
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50">
                    <Wallet className="h-3.5 w-3.5 text-blue-600" />
                  </div>
                </div>
                <p className="mt-1 text-lg font-black tabular-nums text-blue-700">
                  {formatCurrency(financialSummary.capitalInStock)}
                </p>
                <p className="mt-1 text-[11px] text-gray-400">Valor de custo em inventário</p>
              </div>
              <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-gradient-to-r from-blue-500 to-blue-400" />
            </div>

            {/* Receita vs CMV */}
            <div className="relative overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
              <div className="px-4 pt-3 pb-2">
                <div className="flex items-start justify-between gap-2">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Receita / Custo</p>
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100">
                    <PackageOpen className="h-3.5 w-3.5 text-gray-600" />
                  </div>
                </div>
                <div className="mt-1.5 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-gray-500">Receita</span>
                    <span className="text-[11px] font-bold text-[#B71C1C]">{formatCurrency(totals.revenue)}</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-gray-500">CMV</span>
                    <span className="text-[11px] font-bold text-orange-500">{formatCurrency(financialSummary.periodCMV)}</span>
                  </div>
                  <div className="flex items-center justify-between border-t border-gray-100 pt-1.5">
                    <span className="text-[11px] font-bold text-gray-600">Lucro</span>
                    <span className={`text-[11px] font-black ${financialSummary.grossProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {formatCurrency(financialSummary.grossProfit)}
                    </span>
                  </div>
                </div>
              </div>
              <div className="absolute bottom-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[#B71C1C] to-orange-400" />
            </div>

          </div>
        </div>
      )}

      <Tabs value={activeTab} onValueChange={(v: any) => setActiveTab(v)} className="hidden md:block space-y-4">
        <TabsList className="sr-only" />

        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2 overflow-hidden">
              <CardHeader className="pb-3">
                <CardTitle className="flex items-center gap-2">
                  <Zap className="h-5 w-5 text-primary" /> Pro Insights
                </CardTitle>
                <CardDescription>O essencial, com estética limpa e leitura rápida</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
                  <div className="rounded-2xl border border-border bg-muted/15 p-3">
                    <p className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">Melhor dia</p>
                    <p className="mt-1 text-sm font-semibold text-foreground">{bestWorst.best ? bestWorst.best.date : '—'}</p>
                    <p className="mt-1 text-base font-black text-emerald-700 tabular-nums">{bestWorst.best ? formatCurrency(bestWorst.best.total) : '—'}</p>
                  </div>
                  <div className="rounded-2xl border border-border bg-muted/15 p-3">
                    <p className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">Pior dia</p>
                    <p className="mt-1 text-sm font-semibold text-foreground">{bestWorst.worst ? bestWorst.worst.date : '—'}</p>
                    <p className="mt-1 text-base font-black text-rose-700 tabular-nums">{bestWorst.worst ? formatCurrency(bestWorst.worst.total) : '—'}</p>
                  </div>
                  <div className="rounded-2xl border border-border bg-muted/15 p-3">
                    <p className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">Média (dia)</p>
                    <p className="mt-1 text-sm font-semibold text-foreground">{rangeDays} dias</p>
                    <p className="mt-1 text-base font-black tabular-nums">{formatCurrency(rangeDays ? totals.revenue / rangeDays : 0)}</p>
                  </div>
                  <div className="rounded-2xl border border-border bg-muted/15 p-3">
                    <p className="text-[11px] font-black uppercase tracking-wider text-muted-foreground">Acumulado</p>
                    <p className="mt-1 text-sm font-semibold text-foreground">Período</p>
                    <p className="mt-1 text-base font-black text-primary tabular-nums">{formatCurrency(totals.revenue)}</p>
                  </div>
                </div>

                <div className="rounded-2xl border border-border bg-card p-3">
                  <div className="mb-2 flex items-center justify-between gap-2">
                    <p className="text-sm font-black">Tendência por dia</p>
                    <div className="flex items-center gap-2 text-xs font-semibold text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full bg-primary" /> Receita
                      </span>
                      <span className="flex items-center gap-1">
                        <span className="h-2 w-2 rounded-full bg-amber-500" /> Média 7d
                      </span>
                    </div>
                  </div>
                  <div className="mb-2 flex flex-wrap gap-2">
                    {annotations.spike && (
                      <span className="inline-flex items-center gap-1 rounded-xl bg-emerald-500/10 px-2 py-1 text-[11px] font-black text-emerald-700">
                        ↑ pico {annotations.spike.to.date} (+{formatCurrency(annotations.spike.delta)})
                      </span>
                    )}
                    {annotations.drop && (
                      <span className="inline-flex items-center gap-1 rounded-xl bg-rose-500/10 px-2 py-1 text-[11px] font-black text-rose-700">
                        ↓ queda {annotations.drop.to.date} ({formatCurrency(annotations.drop.delta)})
                      </span>
                    )}
                    <span
                      className={cn(
                        'inline-flex items-center gap-1 rounded-xl px-2 py-1 text-[11px] font-black',
                        annotations.last3TrendPct >= 0 ? 'bg-primary/10 text-primary' : 'bg-destructive/10 text-destructive',
                      )}
                    >
                      3d {annotations.last3TrendPct >= 0 ? '+' : ''}
                      {annotations.last3TrendPct.toFixed(1)}%
                    </span>
                  </div>
                  <div className="h-[200px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={dailyWithSignals}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                        <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} minTickGap={18} />
                        <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`} />
                        <Tooltip
                          contentStyle={{ backgroundColor: 'hsl(var(--card))', borderRadius: '12px', border: '1px solid hsl(var(--border))' }}
                          formatter={(val: number, name: any) => [formatCurrency(Number(val)), name === 'ma7' ? 'Média móvel (7d)' : 'Receita']}
                        />
                        <Line type="monotone" dataKey="total" stroke="hsl(var(--primary))" strokeWidth={2.5} dot={false} />
                        <Line type="monotone" dataKey="ma7" stroke="#f59e0b" strokeWidth={2} dot={false} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BadgeAlert className="h-5 w-5 text-primary" /> Alertas de estoque
                </CardTitle>
                <CardDescription>Produtos abaixo do mínimo</CardDescription>
              </CardHeader>
              <CardContent>
                {lowStockAlerts.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Sem alertas no momento.</p>
                ) : (
                  <div className="space-y-2">
                    {lowStockAlerts.map((p: any) => (
                      <div key={p.id} className="flex items-center justify-between rounded-xl border border-border bg-muted/20 px-3 py-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold">{p.name}</p>
                          <p className="text-xs text-muted-foreground">{p.sku}</p>
                        </div>
                        <div className="shrink-0 text-right">
                          <p className="text-sm font-black tabular-nums">{parseFloat(p.stock)} {p.unit}</p>
                          <p className="text-xs text-muted-foreground">mín: {parseFloat(p.minStock)} {p.unit}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Evolução (receita diária)</CardTitle>
                <CardDescription>Período: {rangeDays} dias</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={dailySeries}>
                      <defs>
                        <linearGradient id="mkRev" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.28} />
                          <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                      <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} minTickGap={18} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `MT ${v}`} />
                      <Tooltip
                        contentStyle={{ backgroundColor: 'hsl(var(--card))', borderRadius: '12px', border: '1px solid hsl(var(--border))' }}
                        formatter={(val: number) => formatCurrency(Number(val))}
                      />
                      <Area type="monotone" dataKey="total" stroke="hsl(var(--primary))" fill="url(#mkRev)" strokeWidth={2} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Top produtos (receita)</CardTitle>
                <CardDescription>
                  {drillCategory ? `Top 10 em: ${drillCategory}` : 'Top 10 produtos no período'}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={drilledTopProducts} layout="vertical" margin={{ left: 8, right: 12 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                      <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`} />
                      <YAxis dataKey="name" type="category" width={140} stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                      <Tooltip
                        cursor={{ fill: 'transparent' }}
                        contentStyle={{ backgroundColor: 'hsl(var(--card))', borderRadius: '12px', border: '1px solid hsl(var(--border))' }}
                        formatter={(val: number) => formatCurrency(Number(val))}
                      />
                      <Bar dataKey="revenue" fill="hsl(32 95% 55%)" radius={[0, 8, 8, 0]} barSize={26} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="trends" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <Card className="lg:col-span-2">
              <CardHeader>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <CardTitle>Tendência</CardTitle>
                    <CardDescription>Por dia (padrão) · mude para hora quando precisar</CardDescription>
                  </div>
                  <div className="flex w-full gap-1 rounded-2xl bg-muted/60 p-1 sm:w-auto">
                    {(['day', 'hour'] as const).map((g) => (
                      <Button
                        key={g}
                        type="button"
                        size="sm"
                        variant={trendGranularity === g ? 'secondary' : 'ghost'}
                        className={cn(
                          'h-9 flex-1 rounded-xl text-xs sm:flex-none',
                          trendGranularity === g
                            ? 'bg-card font-black text-foreground shadow-sm ring-1 ring-primary/20'
                            : 'font-semibold text-muted-foreground hover:text-foreground',
                        )}
                        onClick={() => setTrendGranularity(g)}
                      >
                        {g === 'day' ? 'Dia' : 'Hora'}
                      </Button>
                    ))}
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={trendGranularity === 'day' ? trendSeriesDaily : trendSeriesHourly}>
                      <defs>
                        <linearGradient id="mkTrend" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="hsl(var(--primary))" stopOpacity={0.22} />
                          <stop offset="95%" stopColor="hsl(var(--primary))" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                      <XAxis dataKey="label" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} minTickGap={18} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(v) => `${Math.round(Number(v) / 1000)}k`} />
                      <Tooltip formatter={(val: number) => formatCurrency(Number(val))} />
                      <Area type="monotone" dataKey="value" stroke="hsl(var(--primary))" strokeWidth={2.5} fill="url(#mkTrend)" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>Métodos de pagamento</CardTitle>
                <CardDescription>Receita por método</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie data={paymentBreakdown} dataKey="value" nameKey="name" innerRadius={60} outerRadius={100} paddingAngle={2}>
                        {paymentBreakdown.map((_, idx) => (
                          <Cell key={idx} fill={PAYMENT_COLORS[idx % PAYMENT_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(val: number) => formatCurrency(Number(val))} />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
                <div className="mt-3 space-y-2">
                  {paymentBreakdown.slice(0, 5).map((p, idx) => (
                    <div key={p.name} className="flex items-center justify-between text-sm">
                      <div className="flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full" style={{ background: PAYMENT_COLORS[idx % PAYMENT_COLORS.length] }} />
                        <span className="font-semibold">{p.name}</span>
                      </div>
                      <span className="font-black tabular-nums">{formatCurrency(p.value)}</span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="breakdown" className="space-y-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle>Vendas por categoria</CardTitle>
                <CardDescription>Distribuição de receita por categoria</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={categoryBreakdown.slice(0, 12)} layout="vertical" margin={{ left: 8, right: 12 }}>
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                      <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                      <YAxis dataKey="name" type="category" width={140} stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                      <Tooltip formatter={(val: number) => formatCurrency(Number(val))} />
                      <Bar
                        dataKey="value"
                        fill="hsl(150 60% 35%)"
                        radius={[0, 8, 8, 0]}
                        barSize={26}
                        onClick={(d: any) => setDrillCategory(d?.name || null)}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  Dica: clique numa barra para fazer drilldown dessa categoria.
                </p>
              </CardContent>
            </Card>

            <Card className={cn(isSeller && 'opacity-80')}>
              <CardHeader>
                <CardTitle>Performance por vendedor</CardTitle>
                <CardDescription>{isSeller ? 'Disponível para admin/gestor' : 'Top vendedores no período'}</CardDescription>
              </CardHeader>
              <CardContent>
                {!isSeller ? (
                  <div className="h-[260px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={sellerPerformance} layout="vertical" margin={{ left: 8, right: 12 }}>
                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="hsl(var(--border))" />
                        <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                        <YAxis dataKey="name" type="category" width={140} stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                        <Tooltip formatter={(val: number) => formatCurrency(Number(val))} />
                        <Bar dataKey="total" fill="hsl(var(--primary))" radius={[0, 8, 8, 0]} barSize={26} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <div className="h-[260px] flex items-center justify-center text-sm text-muted-foreground">
                    Sem permissão para ver vendedores.
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="detailed" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <p className="text-lg font-black">Relatório detalhado</p>
              <p className="text-sm text-muted-foreground">Lista de vendas do período com export CSV.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                className="gap-2 rounded-xl"
                onClick={() =>
                  exportCsv(
                    `relatorio_detalhado_${format(new Date(), 'dd-MM-yyyy')}.csv`,
                    detailedRows.map((r) => ({
                      id: r.shortId,
                      data: format(r.createdAt, 'dd/MM/yyyy HH:mm', { locale: ptBR }),
                      vendedor: r.seller,
                      pagamento: r.paymentMethod,
                      itens: r.items,
                      total: r.total.toFixed(2),
                    })),
                  )
                }
              >
                <FileDown className="h-4 w-4" /> CSV (Detalhado)
              </Button>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Vendas</CardTitle>
              <CardDescription>{detailedRows.length} registros</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto -mx-6 px-6">
                <div className="min-w-[860px]">
                  <div className="grid grid-cols-[120px_180px_1fr_140px_100px_140px] gap-2 rounded-xl border border-border bg-muted/30 px-3 py-2 text-xs font-bold text-muted-foreground">
                    <div>ID</div>
                    <div>Data</div>
                    <div>Vendedor</div>
                    <div>Pagamento</div>
                    <div>Itens</div>
                    <div className="text-right">Total</div>
                  </div>
                  <div className="mt-2 divide-y rounded-xl border border-border bg-card">
                    {detailedRows.length === 0 ? (
                      <div className="p-6 text-sm text-muted-foreground">Sem dados no período.</div>
                    ) : (
                      detailedRows.slice(0, 200).map((r) => (
                        <div key={r.id} className="grid grid-cols-[120px_180px_1fr_140px_100px_140px] gap-2 px-3 py-2 text-sm">
                          <div className="font-mono font-bold">#{r.shortId}</div>
                          <div className="text-muted-foreground">{format(r.createdAt, 'dd/MM HH:mm', { locale: ptBR })}</div>
                          <div className="font-semibold truncate">{r.seller}</div>
                          <div className="text-muted-foreground">{r.paymentMethod}</div>
                          <div className="text-muted-foreground tabular-nums">{r.items}</div>
                          <div className="text-right font-black tabular-nums">{formatCurrency(r.total)}</div>
                        </div>
                      ))
                    )}
                  </div>
                  {detailedRows.length > 200 && (
                    <p className="mt-2 text-xs text-muted-foreground">
                      Mostrando 200 de {detailedRows.length}. Use o CSV para export completo.
                    </p>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
