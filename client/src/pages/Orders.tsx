import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';
import { Check, X, Clock, AlertTriangle, RotateCcw, Search } from 'lucide-react';
import { formatCurrency } from '@/lib/utils';

interface Order {
  id: string;
  orderCode: string;
  customerName: string;
  customerPhone: string;
  items: any[];
  total: string;
  status: 'pending' | 'approved' | 'cancelled';
  createdAt: Date;
  approvedAt?: Date;
}

export default function Orders() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [searchCode, setSearchCode] = useState('');

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['/api/orders'],
    queryFn: async () => {
      const res = await fetch('/api/orders', { credentials: 'include' });
      if (!res.ok) throw new Error('Erro ao buscar pedidos');
      return res.json();
    }
  });

  const approveMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const res = await fetch(`/api/orders/${orderId}/approve`, {
        method: 'PATCH',
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Erro ao aprovar pedido');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
      toast({ title: 'Sucesso', description: 'Pedido aprovado!' });
    },
    onError: (error: any) => {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    }
  });

  const cancelMutation = useMutation({
    mutationFn: async (orderId: string) => {
      const res = await fetch(`/api/orders/${orderId}/cancel`, {
        method: 'PATCH',
        credentials: 'include'
      });
      if (!res.ok) throw new Error('Erro ao cancelar pedido');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/orders'] });
      toast({ title: 'Sucesso', description: 'Pedido cancelado!' });
    },
    onError: (error: any) => {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    }
  });

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

  const getStatusColor = (status: string, hasOverstock: boolean) => {
    if (hasOverstock) return 'bg-red-100 text-red-800';
    if (status === 'approved') return 'bg-green-100 text-green-800';
    if (status === 'cancelled') return 'bg-gray-100 text-gray-800';
    return 'bg-yellow-100 text-yellow-800';
  };

  const filteredOrders = searchCode 
    ? orders.filter((o: any) => o.orderCode.includes(searchCode.toUpperCase()))
    : orders;

  const pendingOrders = filteredOrders.filter((o: any) => o.status === 'pending');
  const approvedOrders = filteredOrders.filter((o: any) => o.status === 'approved');
  const cancelledOrders = filteredOrders.filter((o: any) => o.status === 'cancelled');

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <div className="animate-spin h-12 w-12 border-4 border-primary border-t-transparent rounded-full mx-auto"></div>
          <p className="text-muted-foreground">Carregando pedidos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Gerenciar Pedidos</h1>
        <p className="text-muted-foreground">Aprovar, revisar e acompanhar pedidos dos clientes</p>
      </div>

      {/* Search Bar */}
      <Card className="border-emerald-200">
        <CardContent className="pt-6">
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por código do pedido (ex: ABC1234)..."
                value={searchCode}
                onChange={(e) => setSearchCode(e.target.value)}
                className="pl-10 border-emerald-200"
              />
            </div>
            {searchCode && (
              <Button
                variant="outline"
                onClick={() => setSearchCode('')}
              >
                Limpar
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Pedidos Pendentes */}
      <Card className="border-yellow-200 bg-yellow-50/30">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5 text-yellow-600" />
            Pedidos Pendentes ({pendingOrders.length})
          </CardTitle>
          <CardDescription>Aguardando sua aprovação</CardDescription>
        </CardHeader>
        <CardContent>
          {pendingOrders.length === 0 ? (
            <p className="text-muted-foreground">Nenhum pedido pendente</p>
          ) : (
            <div className="space-y-4">
              {pendingOrders.map((order: Order) => {
                const hasOverstock = order.items.some((item: any) => item.quantity > 100); // Simplified check
                return (
                  <div key={order.id} className={`p-4 rounded-lg border-2 ${getStatusColor(order.status, hasOverstock)}`}>
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="font-bold text-lg">{order.orderCode}</p>
                          {hasOverstock && (
                            <Badge className="bg-red-500 text-white text-xs">
                              <AlertTriangle className="h-3 w-3 mr-1" />
                              Estoque Insuficiente
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm font-medium">{order.customerName}</p>
                        <p className="text-xs text-muted-foreground">{order.customerPhone}</p>
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xl font-bold text-primary">{formatCurrency(parseFloat(order.total))}</p>
                        <p className="text-xs text-muted-foreground">{order.items.length} itens</p>
                      </div>
                    </div>
                    <div className="mb-3 space-y-1">
                      {order.items.map((item: any, idx: number) => (
                        <div key={idx} className={`text-sm p-2 rounded ${item.hasInsufficientStock ? 'bg-red-50 border border-red-200' : ''}`}>
                          <p>
                            • <strong>{item.productName}</strong> - {item.quantity}x {formatCurrency(item.priceAtSale)}
                            {item.hasInsufficientStock && (
                              <span className="text-red-600 text-xs ml-2">
                                (Disponível: {item.currentStock})
                              </span>
                            )}
                          </p>
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        onClick={() => approveMutation.mutate(order.id)}
                        disabled={approveMutation.isPending}
                        className="flex-1 bg-green-600 hover:bg-green-700 gap-2"
                      >
                        <Check className="h-4 w-4" />
                        Aprovar
                      </Button>
                      <Button
                        onClick={() => cancelMutation.mutate(order.id)}
                        disabled={cancelMutation.isPending}
                        variant="destructive"
                        className="flex-1"
                      >
                        <X className="h-4 w-4" />
                        Cancelar
                      </Button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pedidos Aprovados */}
      <Card className="border-green-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Check className="h-5 w-5 text-green-600" />
            Pedidos Aprovados ({approvedOrders.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {approvedOrders.length === 0 ? (
            <p className="text-muted-foreground">Nenhum pedido aprovado</p>
          ) : (
            <div className="space-y-3">
              {approvedOrders.map((order: Order) => (
                <div key={order.id} className="p-3 bg-green-50 rounded-lg border border-green-200">
                  <div className="flex justify-between items-center gap-2 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <span className="font-semibold text-sm truncate block">{order.orderCode} - {order.customerName}</span>
                      <span className="font-bold text-green-600 text-sm">{formatCurrency(parseFloat(order.total))}</span>
                    </div>
                    <Button
                      onClick={() => reopenMutation.mutate(order.id)}
                      disabled={reopenMutation.isPending}
                      variant="outline"
                      size="sm"
                      className="gap-1 shrink-0"
                    >
                      <RotateCcw className="h-3 w-3" />
                      Reabrir
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Pedidos Cancelados */}
      <Card className="border-gray-200">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <X className="h-5 w-5 text-gray-600" />
            Pedidos Cancelados ({cancelledOrders.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {cancelledOrders.length === 0 ? (
            <p className="text-muted-foreground">Nenhum pedido cancelado</p>
          ) : (
            <div className="space-y-3">
              {cancelledOrders.map((order: Order) => (
                <div key={order.id} className="p-3 bg-gray-50 rounded-lg border border-gray-200">
                  <div className="flex justify-between items-center gap-2 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <span className="font-semibold text-gray-600 text-sm truncate block">{order.orderCode} - {order.customerName}</span>
                      <span className="text-gray-500 text-sm">{formatCurrency(parseFloat(order.total))}</span>
                    </div>
                    <Button
                        onClick={() => reopenMutation.mutate(order.id)}
                        disabled={reopenMutation.isPending}
                        variant="outline"
                        size="sm"
                        className="gap-1 shrink-0"
                      >
                        <RotateCcw className="h-3 w-3" />
                        Reabrir
                      </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
