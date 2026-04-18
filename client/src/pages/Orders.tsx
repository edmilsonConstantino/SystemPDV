import { useEffect, useMemo, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';
import { Check, X, Clock, AlertTriangle, RotateCcw, Search, PackageCheck, Truck, Copy, MessageSquareText, ReceiptText, ClipboardList } from 'lucide-react';
import { cn, formatCurrency } from '@/lib/utils';
import { notificationsApi, ordersApi, type Order } from '@/lib/api';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { InvoicePreviewDialog } from '@/components/invoice/InvoicePreviewDialog';
import type { InvoiceData } from '@/lib/invoiceModels';
import { loadInvoiceSettings } from '@/lib/invoiceSettings';

type OrderStatus = Order['status'];
type OrderTab = 'new' | 'accepted' | 'ready' | 'completed' | 'cancelled';

export default function Orders() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchCode, setSearchCode] = useState('');
  const [tab, setTab] = useState<OrderTab>('new');
  const [draftMessage, setDraftMessage] = useState<Record<string, string>>({});
  const [checkoutOpen, setCheckoutOpen] = useState(false);
  const [checkoutOrder, setCheckoutOrder] = useState<Order | null>(null);
  const [checkoutCustomerName, setCheckoutCustomerName] = useState('');
  const [checkoutLast3, setCheckoutLast3] = useState('');
  const [checkoutPaymentMethod, setCheckoutPaymentMethod] = useState<Order['paymentMethod']>('cash');
  const [checkoutProof, setCheckoutProof] = useState('');
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [invoiceData, setInvoiceData] = useState<InvoiceData | null>(null);

  const { data: orders = [] } = useQuery({
    queryKey: ['/api/orders'],
    queryFn: ordersApi.getAll,
    placeholderData: (prev) => prev,
    staleTime: 10_000,
  });



  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications'],
    queryFn: notificationsApi.getAll,
    enabled: !!user,
  });

  // Quando o utilizador abrir Pedidos, consumir notificações de "novo pedido"
  useEffect(() => {
    const toConsume = (notifications as any[]).filter((n) => !n.read && n.metadata?.action === 'new_order');
    if (toConsume.length === 0) return;
    Promise.all(
      toConsume.map(async (n) => {
        try {
          await notificationsApi.markAsRead(n.id);
          await notificationsApi.delete(n.id);
        } catch {
          // silencioso; badge vai sumir no próximo refresh
        }
      }),
    ).finally(() => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    });
  }, [notifications]);

  const acceptMutation = useMutation({
    mutationFn: (orderId: string) => ordersApi.accept(orderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
      toast({ title: 'Sucesso', description: 'Pedido aceite.' });
    },
    onError: (error: any) => {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    }
  });

  const readyMutation = useMutation({
    mutationFn: (orderId: string) => ordersApi.ready(orderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
      toast({ title: 'Atualizado', description: 'Pedido marcado como pronto.' });
    },
    onError: (error: any) => {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    }
  });

  const completeMutation = useMutation({
    mutationFn: (orderId: string) => ordersApi.complete(orderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
      toast({ title: 'Concluído', description: 'Pedido marcado como entregue.' });
    },
    onError: (error: any) => {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    }
  });

  const cancelMutation = useMutation({
    mutationFn: (orderId: string) => ordersApi.cancel(orderId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
      toast({ title: 'Sucesso', description: 'Pedido cancelado!' });
    },
    onError: (error: any) => {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    }
  });

  const checkoutMutation = useMutation({
    mutationFn: (payload: { orderId: string; last3Phone: string; paymentMethod: Order['paymentMethod']; paymentProof?: string; customerName?: string }) =>
      ordersApi.checkout(payload.orderId, {
        last3Phone: payload.last3Phone,
        paymentMethod: payload.paymentMethod,
        paymentProof: payload.paymentProof,
        customerName: payload.customerName,
      }),
    onSuccess: ({ order, sale }: any) => {
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
      queryClient.invalidateQueries({ queryKey: ['/api/sales'] });
      toast({ title: 'Venda criada', description: `Pedido ${order.orderCode} finalizado com sucesso.` });

      const cfg = loadInvoiceSettings();
      const preview = (sale?.preview || {}) as any;
      const lines = Array.isArray(preview.items)
        ? preview.items.map((it: any) => ({
            name: it.productName ?? 'Produto',
            qty: Number(it.quantity ?? 0),
            unitLabel: it.productUnit ?? 'un',
            unitPrice: Number(it.priceAtSale ?? 0),
            total: Number(it.quantity ?? 0) * Number(it.priceAtSale ?? 0),
          }))
        : [];

      const invoice: InvoiceData = {
        invoiceNo: String(order.orderCode || sale?.id || 'VENDA'),
        issuedAt: new Date(),
        currencyLabel: cfg.currencyLabel,
        seller: cfg.seller,
        customer: {
          name: checkoutCustomerName.trim() || order.customerName,
          phone: order.customerPhone,
        },
        paymentMethod: checkoutPaymentMethod,
        lines,
        subtotal: Number(preview.subtotal ?? order.total ?? 0),
        discount: Number(preview.discountAmount ?? 0) || 0,
        total: Number(preview.total ?? order.total ?? 0),
        notes: cfg.defaultNotes,
        qrValue: cfg.showQr ? `Pedido: ${order.orderCode}` : undefined,
        barcodeValue: cfg.showBarcode ? String(order.orderCode) : undefined,
      };

      setInvoiceData(invoice);
      setInvoiceOpen(true);
      setCheckoutOpen(false);
      setCheckoutOrder(null);
    },
    onError: (error: any) => {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    }
  });

  function openCheckout(order: Order) {
    setCheckoutOrder(order);
    setCheckoutCustomerName(order.customerName || '');
    setCheckoutLast3('');
    setCheckoutPaymentMethod(order.paymentMethod || 'cash');
    setCheckoutProof(order.paymentProof || '');
    setCheckoutOpen(true);
  }

  const reopenMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const res = await fetch(`/api/orders/${orderId}/reopen`, {
        method: 'PATCH',
        credentials: 'include'
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.message || error.error || 'Erro ao reabrir pedido');
      }
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
      toast({ title: 'Sucesso', description: 'Pedido reaberto!' });
    },
    onError: (error: any) => {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    }
  });

  const setMessageMutation = useMutation({
    mutationFn: ({ orderId, message }: { orderId: string; message: string }) =>
      ordersApi.setMessage(orderId, message),
    onSuccess: (updated: Order) => {
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
      setDraftMessage((prev) => ({ ...prev, [updated.id]: updated.staffMessage ?? '' }));
      toast({ title: 'Enviado', description: 'Resposta salva e visível no tracking.' });
    },
    onError: (error: any) => {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    }
  });

  const filteredOrders = useMemo(() => {
    const code = searchCode.trim().toUpperCase();
    if (!code) return orders as Order[];
    return (orders as Order[]).filter((o) => o.orderCode.includes(code));
  }, [orders, searchCode]);

  const byStatus = useMemo(() => {
    const result: Record<OrderStatus, Order[]> = {
      pending: [],
      accepted: [],
      ready: [],
      completed: [],
      cancelled: [],
    };
    for (const o of filteredOrders) result[o.status].push(o);
    return result;
  }, [filteredOrders]);

  const ordersInTab = useMemo(() => {
    switch (tab) {
      case 'new':
        return byStatus.pending;
      case 'accepted':
        return byStatus.accepted;
      case 'ready':
        return byStatus.ready;
      case 'completed':
        return byStatus.completed;
      case 'cancelled':
        return byStatus.cancelled;
    }
  }, [byStatus, tab]);

  const tabDefs: Array<{ id: OrderTab; label: string; icon: any; count: number; hint: string }> = [
    { id: 'new', label: 'Novos', icon: Clock, count: byStatus.pending.length, hint: 'Aguardando aceitação' },
    { id: 'accepted', label: 'Aceites', icon: Check, count: byStatus.accepted.length, hint: 'Em preparação' },
    { id: 'ready', label: 'Prontos', icon: PackageCheck, count: byStatus.ready.length, hint: 'Aguardando recolha' },
    { id: 'completed', label: 'Entregues', icon: Truck, count: byStatus.completed.length, hint: 'Finalizados' },
    { id: 'cancelled', label: 'Cancelados', icon: X, count: byStatus.cancelled.length, hint: 'Arquivados' },
  ];

  const getStatusBadge = (status: OrderStatus) => {
    switch (status) {
      case 'pending':
        return <Badge className="bg-[hsl(48_96%_90%)] text-[hsl(38_92%_30%)]">Novo</Badge>;
      case 'accepted':
        return <Badge className="bg-primary/15 text-primary">Aceite</Badge>;
      case 'ready':
        return <Badge className="bg-accent/15 text-accent">Pronto</Badge>;
      case 'completed':
        return <Badge className="bg-[hsl(142_70%_90%)] text-[hsl(142_65%_24%)]">Entregue</Badge>;
      case 'cancelled':
        return <Badge className="bg-muted text-muted-foreground">Cancelado</Badge>;
    }
  };

  const copy = async (text: string, okMsg: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast({ title: 'Copiado', description: okMsg });
    } catch {
      toast({ title: 'Erro', description: 'Não foi possível copiar.', variant: 'destructive' });
    }
  };

  if (!user) return null;

  return (
    <div className="space-y-6">

      {/* ── CABEÇALHO — padrão POS/Produtos ── */}
      <div className="overflow-hidden rounded-3xl shadow-sm">
        {/* Banner vermelho */}
        <div className="relative bg-[#B71C1C] px-4 py-4 sm:px-6 sm:py-5">
          <div className="banner-texture" />
          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            {/* Título */}
            <div className="flex items-center gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/25">
                <ClipboardList className="h-5 w-5 text-white" strokeWidth={2.5} />
              </div>
              <div className="space-y-1">
                <div className="flex items-baseline gap-2">
                  <h1 className="text-xl font-extrabold tracking-tight text-white">Pedidos</h1>
                  <span className="hidden text-sm font-normal text-white/50 sm:inline">Gestão &amp; Entrega</span>
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="text-xs font-semibold text-white/70">
                    {filteredOrders.length} pedido{filteredOrders.length !== 1 ? 's' : ''}
                  </span>
                  {byStatus.pending.length > 0 && (
                    <span className="flex items-center gap-1 text-xs font-semibold text-amber-200">
                      <span className="h-1 w-1 rounded-full bg-amber-300" />
                      {byStatus.pending.length} aguardando aceitação
                    </span>
                  )}
                  {byStatus.cancelled.length > 0 && (
                    <span className="flex items-center gap-1 text-xs font-semibold text-red-200">
                      <span className="h-1 w-1 rounded-full bg-red-300" />
                      {byStatus.cancelled.length} cancelado{byStatus.cancelled.length !== 1 ? 's' : ''}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Search + Tabs + hint */}
        <div className="bg-white px-4 py-3 sm:px-6 sm:py-4">
          {/* Search */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" strokeWidth={2.5} />
              <Input
                placeholder="Código do pedido..."
                value={searchCode}
                onChange={(e) => setSearchCode(e.target.value)}
                className="h-10 rounded-xl border-gray-200 bg-gray-50 pl-10 text-sm focus-visible:border-[#B71C1C]/40 focus-visible:ring-[#B71C1C]/15"
              />
            </div>
            {searchCode && (
              <button
                type="button"
                onClick={() => setSearchCode('')}
                className="rounded-xl border border-gray-200 bg-white px-3.5 py-2 text-xs font-semibold text-gray-600 transition hover:bg-gray-50"
              >
                Limpar
              </button>
            )}
          </div>

          {/* Tabs */}
          <div className="mt-3 grid grid-cols-2 gap-1.5">
            {tabDefs.map((t, i) => {
              const Icon = t.icon;
              const active = tab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setTab(t.id)}
                  className={cn(
                    'flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-[11px] font-bold transition-all',
                    i === 4 && 'col-span-2',
                    active
                      ? 'bg-[#B71C1C] text-white shadow-sm shadow-[#B71C1C]/30'
                      : 'border border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50',
                  )}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  {t.label}
                  <span className={cn(
                    'ml-0.5 shrink-0 rounded-full px-1.5 py-0.5 text-[10px] tabular-nums',
                    active ? 'bg-white/20 text-white' : 'bg-gray-100 text-gray-500'
                  )}>
                    {t.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Hint */}
          <p className="mt-2 text-[11px] font-medium text-gray-400">
            {tabDefs.find((t) => t.id === tab)?.hint}
          </p>
        </div>
      </div>

      {/* Lista */}
      <Card className="border-border/70">
        <CardHeader>
          <CardTitle className="text-base font-bold">Lista</CardTitle>
          <CardDescription>
            {ordersInTab.length === 0 ? 'Nenhum pedido aqui ainda.' : 'Clique para copiar, responder e atualizar o status.'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {ordersInTab.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border p-8 text-center">
              <p className="text-sm font-semibold text-muted-foreground">Sem pedidos</p>
            </div>
          ) : (
            <div className="space-y-4">
              {ordersInTab.map((order) => {
                const hasOverstock = (order as any).hasAnyInsufficientStock || (order.items as any[]).some((i: any) => i.hasInsufficientStock);
                const msgValue = draftMessage[order.id] ?? (order.staffMessage ?? '');
                return (
                  <div
                    key={order.id}
                    className={cn(
                      'rounded-2xl border p-4 shadow-sm',
                      hasOverstock ? 'border-destructive/30 bg-destructive/5' : 'border-border/70 bg-card',
                    )}
                  >
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-heading text-xl font-black tracking-tight">{order.orderCode}</p>
                          {getStatusBadge(order.status)}
                          {hasOverstock && (
                            <Badge className="bg-destructive text-destructive-foreground">
                              <AlertTriangle className="mr-1 h-3 w-3" /> Estoque insuficiente
                            </Badge>
                          )}
                        </div>
                        <p className="mt-1 text-sm font-semibold text-foreground">{order.customerName}</p>
                        <p className="text-xs font-medium text-muted-foreground">{order.customerPhone}</p>
                      </div>
                      <div className="shrink-0 text-left sm:text-right">
                        <p className="text-2xl font-black text-primary tabular-nums">{formatCurrency(parseFloat(order.total))}</p>
                        <p className="text-xs font-medium text-muted-foreground">{order.items.length} itens</p>
                      </div>
                    </div>

                    <div className="mt-3 grid gap-2">
                      {(order.items as any[]).slice(0, 6).map((item: any, idx: number) => (
                        <div
                          key={idx}
                          className={cn(
                            'rounded-xl border px-3 py-2 text-sm',
                            item.hasInsufficientStock ? 'border-destructive/30 bg-destructive/5' : 'border-border/60 bg-muted/20',
                          )}
                        >
                          <span className="font-semibold">{item.productName ?? item.productId}</span>
                          <span className="text-muted-foreground"> · {item.quantity}x {formatCurrency(item.priceAtSale)}</span>
                          {item.hasInsufficientStock && (
                            <span className="ml-2 text-xs font-semibold text-destructive">
                              (Disp.: {item.currentStock})
                            </span>
                          )}
                        </div>
                      ))}
                      {order.items.length > 6 && (
                        <p className="text-xs font-medium text-muted-foreground">+{order.items.length - 6} itens…</p>
                      )}
                    </div>

                    <div className="mt-4 grid gap-2 sm:grid-cols-3">
                      <Button
                        type="button"
                        variant="outline"
                        className="justify-start gap-2"
                        onClick={() => copy(order.orderCode, 'Código do pedido copiado.')}
                      >
                        <Copy className="h-4 w-4" /> Copiar código
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        className="justify-start gap-2"
                        onClick={() =>
                          copy(
                            `Pedido ${order.orderCode}\nCliente: ${order.customerName}\nTotal: ${formatCurrency(parseFloat(order.total))}`,
                            'Resumo copiado.',
                          )
                        }
                      >
                        <MessageSquareText className="h-4 w-4" /> Copiar resumo
                      </Button>
                      {order.status !== 'cancelled' && (
                        <Button
                          type="button"
                          variant="destructive"
                          className="justify-start gap-2"
                          onClick={() => cancelMutation.mutate(order.id)}
                          disabled={cancelMutation.isPending}
                        >
                          <X className="h-4 w-4" /> Cancelar
                        </Button>
                      )}
                    </div>

                    <div className="mt-4 rounded-2xl border border-border/70 bg-muted/20 p-3">
                      <div className="mb-2 flex items-center justify-between gap-2">
                        <p className="text-sm font-bold">Resposta para o cliente</p>
                        {order.staffMessageAt && (
                          <span className="text-xs font-medium text-muted-foreground">
                            Atualizado
                          </span>
                        )}
                      </div>
                      <Textarea
                        value={msgValue}
                        onChange={(e) => setDraftMessage((prev) => ({ ...prev, [order.id]: e.target.value }))}
                        placeholder="Ex.: Seu pedido está pronto. Pode vir levantar no balcão."
                        className="min-h-[80px] resize-none bg-card"
                      />
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Button
                          type="button"
                          className="gap-2"
                          onClick={() => setMessageMutation.mutate({ orderId: order.id, message: msgValue })}
                          disabled={setMessageMutation.isPending}
                        >
                          <MessageSquareText className="h-4 w-4" /> Enviar / Atualizar
                        </Button>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setDraftMessage((prev) => ({ ...prev, [order.id]: order.staffMessage ?? '' }))}
                        >
                          Reverter
                        </Button>
                      </div>
                    </div>

                    <div className="mt-4 flex flex-wrap gap-2">
                      {order.status === 'pending' && (
                        <Button
                          type="button"
                          className="gap-2 bg-primary hover:bg-primary/90"
                          onClick={() => acceptMutation.mutate(order.id)}
                          disabled={acceptMutation.isPending}
                        >
                          <Check className="h-4 w-4" /> Aceitar
                        </Button>
                      )}
                      {order.status === 'accepted' && (
                        <Button
                          type="button"
                          className="gap-2 bg-accent hover:bg-accent/90"
                          onClick={() => readyMutation.mutate(order.id)}
                          disabled={readyMutation.isPending}
                        >
                          <PackageCheck className="h-4 w-4" /> Marcar pronto
                        </Button>
                      )}
                      {order.status === 'ready' && (
                        <Button
                          type="button"
                          className="gap-2 bg-[hsl(142_72%_36%)] text-white hover:bg-[hsl(142_72%_32%)]"
                          onClick={() => completeMutation.mutate(order.id)}
                          disabled={completeMutation.isPending}
                        >
                          <Truck className="h-4 w-4" /> Marcar entregue
                        </Button>
                      )}
                      {order.status !== 'cancelled' && order.status !== 'completed' && (
                        <Button type="button" variant="outline" className="gap-2" onClick={() => openCheckout(order)}>
                          <ReceiptText className="h-4 w-4" /> Finalizar venda
                        </Button>
                      )}
                      {order.status === 'cancelled' && (
                        <Button
                          type="button"
                          variant="outline"
                          className="gap-2"
                          onClick={() => reopenMutation.mutate(order.id)}
                          disabled={reopenMutation.isPending}
                        >
                          <RotateCcw className="h-4 w-4" /> Reabrir
                        </Button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={checkoutOpen} onOpenChange={setCheckoutOpen}>
        <DialogContent className="sm:max-w-[620px]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ReceiptText className="h-5 w-5" /> Finalizar venda
            </DialogTitle>
            <DialogDescription>
              Confirme o pedido, registre pagamento/comprovativo e emita fatura/recibo.
            </DialogDescription>
          </DialogHeader>

          {checkoutOrder && (
            <div className="grid gap-4">
              <div className="rounded-2xl border border-border/70 bg-muted/20 p-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <p className="text-sm font-semibold">
                    Código: <span className="font-mono">{checkoutOrder.orderCode}</span>
                  </p>
                  <Badge variant="secondary">Total: {formatCurrency(parseFloat(checkoutOrder.total))}</Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  Cliente: {checkoutOrder.customerName} · {checkoutOrder.customerPhone}
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label>Nome do cliente (opcional)</Label>
                  <Input value={checkoutCustomerName} onChange={(e) => setCheckoutCustomerName(e.target.value)} />
                </div>
                <div className="grid gap-1.5">
                  <Label>Últimos 3 dígitos do telefone</Label>
                  <Input
                    inputMode="numeric"
                    maxLength={3}
                    value={checkoutLast3}
                    onChange={(e) => setCheckoutLast3(e.target.value.replace(/\D/g, '').slice(0, 3))}
                    placeholder="Ex.: 123"
                  />
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="grid gap-1.5">
                  <Label>Método de pagamento</Label>
                  <Select value={checkoutPaymentMethod} onValueChange={(v) => setCheckoutPaymentMethod(v as any)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Escolha" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Dinheiro</SelectItem>
                      <SelectItem value="transfer">Transferência</SelectItem>
                      <SelectItem value="mpesa">Mpesa</SelectItem>
                      <SelectItem value="emola">Emola</SelectItem>
                      <SelectItem value="bank">Banco</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-1.5">
                  <Label>Comprovativo (opcional)</Label>
                  <Input
                    value={checkoutProof}
                    onChange={(e) => setCheckoutProof(e.target.value)}
                    placeholder="Link/Referência do comprovativo"
                  />
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" onClick={() => setCheckoutOpen(false)}>
              Cancelar
            </Button>
            <Button
              type="button"
              className="gap-2"
              disabled={!checkoutOrder || checkoutMutation.isPending || checkoutLast3.trim().length !== 3}
              onClick={() => {
                if (!checkoutOrder) return;
                checkoutMutation.mutate({
                  orderId: checkoutOrder.id,
                  last3Phone: checkoutLast3.trim(),
                  paymentMethod: checkoutPaymentMethod,
                  paymentProof: checkoutProof.trim() || undefined,
                  customerName: checkoutCustomerName.trim() || undefined,
                });
              }}
            >
              <ReceiptText className="h-4 w-4" /> Criar venda & emitir
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <InvoicePreviewDialog open={invoiceOpen} onOpenChange={setInvoiceOpen} data={invoiceData} />
    </div>
  );
}
