import { useState, useEffect } from 'react';
import { useLocation } from 'wouter';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { ShoppingCart, Package, Phone, User, Plus, Minus, Check, Clock, X, Store, AlertCircle, Search, Copy, Share2, Image as ImageIcon } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { formatCurrency } from '@/lib/utils';
import { toast } from '@/hooks/use-toast';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Product, Category } from '@/lib/api';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { loadInvoiceSettings } from '@/lib/invoiceSettings';
import { useAuth } from '@/lib/auth';

interface CartItem {
  productId: string;
  product?: Product;
  quantity: number;
  priceAtSale: number;
}

interface OrderData {
  orderCode?: string;
  customerName: string;
  customerPhone: string;
  items: CartItem[];
  total: number;
  status?: 'pending' | 'accepted' | 'ready' | 'completed' | 'cancelled';
  paymentMethod: 'cash' | 'transfer' | 'mpesa' | 'emola' | 'bank';
  paymentProof?: string;
  createdAt?: string;
  acceptedAt?: string;
  readyAt?: string;
  completedAt?: string;
  staffMessage?: string | null;
  staffMessageAt?: string;
}

export default function ClientOrders() {
  const { user } = useAuth();
  const [location, setLocation] = useLocation();
  const [step, setStep] = useState<'intro' | 'browse' | 'checkout' | 'tracking'>('browse');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [cartOpen, setCartOpen] = useState(false);
  const [consultOpen, setConsultOpen] = useState(false);
  const [trackingCode, setTrackingCode] = useState('');
  const [order, setOrder] = useState<OrderData | null>(null);
  const [auditOpen, setAuditOpen] = useState(false);
  const [auditData, setAuditData] = useState<any>(null);
  const [proofOpen, setProofOpen] = useState(false);
  const [formData, setFormData] = useState<{
    customerName: string;
    customerPhone: string;
    paymentMethod: 'cash' | 'transfer' | 'mpesa' | 'emola' | 'bank';
  }>({ customerName: '', customerPhone: '', paymentMethod: 'cash' });
  const [paymentProofDataUrl, setPaymentProofDataUrl] = useState<string>('');
  const [selectedCategory, setSelectedCategory] = useState('0');
  const [productSearch, setProductSearch] = useState('');
  const [weighableModalOpen, setWeighableModalOpen] = useState(false);
  const [selectedWeighableProduct, setSelectedWeighableProduct] = useState<Product | null>(null);
  const [weighableQuantity, setWeighableQuantity] = useState(100);
  const [now, setNow] = useState(() => new Date());
  const [transferInfo] = useState(() => loadInvoiceSettings().transferAccounts);
  const [isMobile, setIsMobile] = useState(() => typeof window !== 'undefined' && window.innerWidth < 768);

  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30_000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    window.addEventListener('resize', check);
    return () => window.removeEventListener('resize', check);
  }, []);

  // Fetch products and categories
  const { data: productsData = [] } = useQuery({
    queryKey: ['/api/products'],
    queryFn: async () => {
      const res = await fetch('/api/products');
      if (!res.ok) throw new Error('Erro ao buscar produtos');
      return res.json();
    }
  });

  const { data: categoriesData = [] } = useQuery({
    queryKey: ['/api/categories'],
    queryFn: async () => {
      const res = await fetch('/api/categories');
      if (!res.ok) throw new Error('Erro ao buscar categorias');
      return res.json();
    }
  });

  const createOrderMutation = useMutation({
    mutationFn: async () => {
      if (!formData.customerName || !formData.customerPhone || cart.length === 0) {
        throw new Error('Preencha todos os campos');
      }
      if (formData.paymentMethod === 'transfer' && !paymentProofDataUrl) {
        throw new Error('Anexe o comprovativo para transferência');
      }
      
      const total = cart.reduce((sum, item) => sum + (item.priceAtSale * item.quantity), 0);
      const res = await fetch('/api/orders', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerName: formData.customerName,
          customerPhone: formData.customerPhone,
          items: cart,
          total: total.toString(),
          paymentMethod: formData.paymentMethod,
          paymentProof: paymentProofDataUrl || undefined,
        })
      });
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || 'Erro ao criar pedido');
      }
      
      return res.json();
    },
    onSuccess: (data) => {
      setOrder(data);
      setStep('tracking');
      toast({ title: 'Sucesso!', description: `Pedido criado: ${data.orderCode}` });
      setCart([]);
      setPaymentProofDataUrl('');
    },
    onError: (error: any) => {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    }
  });

  const trackOrderMutation = useMutation({
    mutationFn: async () => {
      if (!trackingCode) throw new Error('Digite o código de rastreamento');
      const res = await fetch(`/api/orders/${trackingCode}`);
      if (!res.ok) throw new Error('Pedido não encontrado');
      return res.json();
    },
    onSuccess: (data) => {
      setOrder(data);
      setStep('tracking');
      toast({ title: 'Pedido encontrado!' });
    },
    onError: (error: any) => {
      toast({ title: 'Erro', description: error.message, variant: 'destructive' });
    }
  });

  const loadAuditMutation = useMutation({
    mutationFn: async (code: string) => {
      const res = await fetch(`/api/orders/${code}/audit`, { credentials: 'include' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Sem permissão ou auditoria indisponível');
      }
      return res.json();
    },
    onSuccess: (data) => {
      setAuditData(data);
      setAuditOpen(true);
    },
    onError: (error: any) => {
      toast({ title: 'Auditoria', description: error.message, variant: 'destructive' });
    }
  });

  const products = productsData as Product[];
  const categories = categoriesData as Category[];
  
  function normalizeForSearch(s: string): string {
    return s
      .trim()
      .toLowerCase()
      .normalize('NFD')
      .replace(/\p{M}/gu, '');
  }

  function levenshtein(a: string, b: string): number {
    if (a === b) return 0;
    if (!a) return b.length;
    if (!b) return a.length;
    const dp = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
    for (let i = 0; i <= a.length; i++) dp[i][0] = i;
    for (let j = 0; j <= b.length; j++) dp[0][j] = j;
    for (let i = 1; i <= a.length; i++) {
      for (let j = 1; j <= b.length; j++) {
        const cost = a[i - 1] === b[j - 1] ? 0 : 1;
        dp[i][j] = Math.min(
          dp[i - 1][j] + 1,
          dp[i][j - 1] + 1,
          dp[i - 1][j - 1] + cost,
        );
      }
    }
    return dp[a.length][b.length];
  }

  const baseByCategory =
    selectedCategory === '0' ? products : products.filter((p) => p.categoryId === selectedCategory);

  const searchNorm = normalizeForSearch(productSearch);
  const directMatches = !searchNorm
    ? baseByCategory
    : baseByCategory.filter((p) => {
        const nameN = normalizeForSearch(p.name);
        const skuN = normalizeForSearch(p.sku);
        return nameN.includes(searchNorm) || skuN.includes(searchNorm);
      });

  const fuzzySuggestions = (() => {
    if (!searchNorm || directMatches.length > 0) return [];
    const scored = baseByCategory
      .map((p) => {
        const nameN = normalizeForSearch(p.name);
        const dist = levenshtein(searchNorm, nameN.slice(0, Math.max(searchNorm.length, 12)));
        return { p, dist };
      })
      .sort((a, b) => a.dist - b.dist)
      .slice(0, 6);
    const best = scored[0]?.dist ?? 999;
    const threshold = Math.min(3, Math.max(1, Math.floor(searchNorm.length / 3)));
    if (best > threshold) return [];
    return scored.filter((x) => x.dist <= best + 1).map((x) => x.p);
  })();

  const filteredProducts = directMatches.length > 0 ? directMatches : fuzzySuggestions;

  const total = cart.reduce((sum, item) => sum + (item.priceAtSale * item.quantity), 0);
  const checkoutOpen = step === 'checkout';

  const addToCart = (product: Product) => {
    // Validar estoque
    const maxQty = parseFloat(product.stock);
    if (maxQty <= 0) {
      toast({ title: 'Indisponível', description: `${product.name} não tem estoque`, variant: 'destructive' });
      return;
    }

    // Para produtos pesáveis (kg, g), abrir modal ao invés de adicionar direto
    if (product.unit === 'kg' || product.unit === 'g') {
      setSelectedWeighableProduct(product);
      setWeighableQuantity(Math.min(100, Math.max(100, maxQty * 1000)));
      setWeighableModalOpen(true);
      return;
    }

    const existing = cart.find(item => item.productId === product.id);
    const totalQty = (existing?.quantity || 0) + 1;
    
    if (totalQty > maxQty) {
      toast({ title: 'Sem estoque', description: `Só temos ${Math.floor(maxQty)} unidades disponíveis.`, variant: 'destructive' });
      return;
    }

    if (existing) {
      existing.quantity += 1;
      setCart([...cart]);
    } else {
      setCart([...cart, {
        productId: product.id,
        product,
        quantity: 1,
        priceAtSale: parseFloat(product.price)
      }]);
    }
    toast({ title: 'Adicionado!', description: `${product.name} foi adicionado ao carrinho` });
  };

  const addWeighableToCart = () => {
    if (!selectedWeighableProduct) return;
    
    // Validar estoque em gramas
    const maxStock = parseFloat(selectedWeighableProduct.stock) * 1000;
    if (weighableQuantity > maxStock) {
      toast({ title: 'Estoque insuficiente', description: `Máximo: ${(maxStock / 1000).toFixed(2)} kg`, variant: 'destructive' });
      return;
    }

    const pricePerGram = parseFloat(selectedWeighableProduct.price) / 1000;
    const totalPrice = pricePerGram * weighableQuantity;
    
    const existing = cart.find(item => item.productId === selectedWeighableProduct.id);
    const totalQty = (existing?.quantity || 0) + weighableQuantity;
    
    if (totalQty > maxStock) {
      toast({ title: 'Estoque insuficiente', description: `Total: ${(maxStock / 1000).toFixed(2)} kg`, variant: 'destructive' });
      return;
    }

    if (existing) {
      existing.quantity += weighableQuantity;
      setCart([...cart]);
    } else {
      setCart([...cart, {
        productId: selectedWeighableProduct.id,
        product: selectedWeighableProduct,
        quantity: weighableQuantity,
        priceAtSale: totalPrice / weighableQuantity
      }]);
    }
    toast({ title: 'Adicionado!', description: `${selectedWeighableProduct.name} foi adicionado ao carrinho` });
    setWeighableModalOpen(false);
    setSelectedWeighableProduct(null);
  };

  const removeFromCart = (productId: string) => {
    setCart(cart.filter(item => item.productId !== productId));
  };

  const updateQuantity = (productId: string, quantity: number) => {
    const item = cart.find(i => i.productId === productId);
    if (item) {
      const p = item.product;
      const stock = p ? parseFloat(p.stock) : Infinity;

      if (p && (p.unit === 'kg' || p.unit === 'g')) {
        const maxGrams = Number.isFinite(stock) ? Math.floor(stock * 1000) : Infinity;
        const next = Math.max(100, quantity);
        if (next > maxGrams) {
          toast({
            title: 'Estoque insuficiente',
            description: `Só temos ${(maxGrams / 1000).toFixed(2)} kg disponíveis.`,
            variant: 'destructive',
          });
          item.quantity = Math.max(100, maxGrams);
        } else {
          item.quantity = next;
        }
      } else {
        const maxUnits = Number.isFinite(stock) ? Math.floor(stock) : Infinity;
        const next = Math.max(1, quantity);
        if (next > maxUnits) {
          toast({
            title: 'Estoque insuficiente',
            description: `Só temos ${maxUnits} unidades disponíveis.`,
            variant: 'destructive',
          });
          item.quantity = Math.max(1, maxUnits);
        } else {
          item.quantity = next;
        }
      }
      setCart([...cart]);
    }
  };

  const formatQuantityDisplay = (item: CartItem) => {
    if (item.product && (item.product.unit === 'kg' || item.product.unit === 'g')) {
      const kg = item.quantity / 1000;
      return kg >= 1 ? `${kg.toFixed(2)} kg` : `${item.quantity} g`;
    }
    return `${item.quantity}x`;
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'accepted': return 'bg-primary/15 text-primary';
      case 'ready': return 'bg-accent/15 text-accent';
      case 'completed': return 'bg-green-100 text-green-800';
      case 'pending': return 'bg-yellow-100 text-yellow-800';
      case 'cancelled': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  const getStatusIcon = (status?: string) => {
    switch (status) {
      case 'accepted': return <Check className="h-4 w-4" />;
      case 'ready': return <Package className="h-4 w-4" />;
      case 'completed': return <Check className="h-4 w-4" />;
      case 'pending': return <Clock className="h-4 w-4" />;
      case 'cancelled': return <X className="h-4 w-4" />;
      default: return null;
    }
  };

  return (
    <>
      {/* Modal para produtos pesáveis */}
      <Dialog open={weighableModalOpen} onOpenChange={setWeighableModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Quantidade em Gramas</DialogTitle>
          </DialogHeader>
          {selectedWeighableProduct && (
            <div className="space-y-6">
              <div className="bg-gray-50 p-4 rounded-lg border border-gray-200">
                <p className="font-semibold text-lg">{selectedWeighableProduct.name}</p>
                <p className="text-sm text-muted-foreground mt-1">Preço: {formatCurrency(parseFloat(selectedWeighableProduct.price))}/kg</p>
              </div>
              <div className="space-y-2">
                <Label>Quantidade (gramas)</Label>
                <div className="flex items-center gap-3">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setWeighableQuantity(Math.max(100, weighableQuantity - 100))}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <Input
                    type="number"
                    value={weighableQuantity}
                    onChange={(e) => setWeighableQuantity(Math.max(100, parseInt(e.target.value) || 100))}
                    className="text-center text-lg font-semibold border-gray-200"
                    min="100"
                    step="100"
                  />
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setWeighableQuantity(weighableQuantity + 100)}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
                <p className="text-sm text-muted-foreground">
                  = {(weighableQuantity / 1000).toFixed(2)} kg
                </p>
              </div>
              <div className="bg-blue-50 p-3 rounded-lg border border-blue-200 flex gap-2">
                <AlertCircle className="h-4 w-4 text-blue-600 shrink-0 mt-0.5" />
                <p className="text-sm text-blue-900">Preço total: {formatCurrency((parseFloat(selectedWeighableProduct.price) / 1000) * weighableQuantity)}</p>
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setWeighableModalOpen(false)}>Cancelar</Button>
            <Button onClick={addWeighableToCart} className="bg-[#B71C1C] hover:bg-[#9b1414]">Adicionar ao Carrinho</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <div className="min-h-screen bg-gray-50">
        <div className="mx-auto max-w-6xl space-y-5 px-4 pb-24 pt-5 sm:px-6 md:pb-10">

          {/* Header / Hero — banner vermelho do sistema */}
          <div className="overflow-hidden rounded-3xl shadow-sm">
            <div className="relative bg-gradient-to-br from-[#c0392b] via-[#a93226] to-[#922b21] px-5 py-5 sm:px-7 sm:py-6">
              <div className="banner-texture" />
              <div className="relative flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/25">
                    <Store className="h-5 w-5 text-white" strokeWidth={2} />
                  </div>
                  <div className="min-w-0">
                    <h1 className="text-xl font-extrabold tracking-tight text-white sm:text-2xl">
                      Makira Sales
                    </h1>
                    <p className="mt-0.5 text-[11px] font-medium text-white/60">
                      Faça o seu pedido · {now.toLocaleString('pt-PT', { weekday: 'short', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' })}
                    </p>
                  </div>
                </div>
                <div className="hidden items-center gap-2 sm:flex">
                  <Button type="button" variant="outline" className="rounded-xl border-white/30 bg-white/10 text-white hover:bg-white/20 hover:text-white" onClick={() => setStep('browse')}>
                    Produtos
                  </Button>
                  <Button type="button" className="rounded-xl bg-white font-bold text-[#B71C1C] hover:bg-gray-100 shadow-lg shadow-black/20" onClick={() => setConsultOpen(true)}>
                    Consultar pedido
                  </Button>
                </div>
              </div>
            </div>
          </div>

          {/* Consultar: bottom-sheet (mobile) + útil também no desktop via botão */}
          <Sheet open={consultOpen} onOpenChange={setConsultOpen}>
            <SheetContent
              side="bottom"
              className="max-h-[92dvh] overflow-y-auto rounded-t-[2rem] border-0 border-t border-border/70 bg-white p-0 shadow-[0_-24px_70px_-28px_rgba(99,102,241,0.35)]"
            >
              <div className="mx-auto mt-2 h-1 w-12 rounded-full bg-muted-foreground/25" aria-hidden />
              <div className="px-5 pb-6 pt-4">
                <SheetHeader className="space-y-1 text-left">
                  <SheetTitle className="font-heading text-2xl font-black">Consultar pedido</SheetTitle>
                  <SheetDescription className="text-sm font-medium">
                    Digite o código e veja o status.
                  </SheetDescription>
                </SheetHeader>

                <div className="mt-5 space-y-3">
                  <Input
                    placeholder="Ex: ABC12345"
                    value={trackingCode}
                    onChange={(e) => setTrackingCode(e.target.value.toUpperCase())}
                    maxLength={8}
                    className="h-12 rounded-2xl"
                  />
                  <Button
                    type="button"
                    onClick={() => trackOrderMutation.mutate()}
                    disabled={trackOrderMutation.isPending}
                    className="h-12 w-full rounded-2xl bg-[#B71C1C] hover:bg-[#9b1414] font-black"
                  >
                    {trackOrderMutation.isPending ? 'Consultando…' : 'Consultar'}
                  </Button>

                  <p className="text-xs text-muted-foreground">
                    Dica: o código vem quando você finaliza um pedido.
                  </p>
                </div>
              </div>
            </SheetContent>
          </Sheet>

          {/* Mobile: mini-navbar footer */}
          <div className="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-6xl px-4 pb-[max(0.5rem,env(safe-area-inset-bottom,0px))] md:hidden">
            <div className="pointer-events-auto mx-auto flex max-w-lg items-center justify-between gap-2 rounded-3xl border border-gray-200 bg-white px-3 py-2 shadow-lg">
              <button
                type="button"
                onClick={() => setStep('browse')}
                className={`flex flex-1 items-center justify-center gap-2 rounded-2xl px-3 py-2 text-xs font-bold transition ${
                  step === 'browse' ? 'bg-[#B71C1C] text-white' : 'text-gray-500'
                }`}
              >
                <Package className="h-4 w-4" />
                Produtos
              </button>
              <button
                type="button"
                onClick={() => setCartOpen(true)}
                className="relative flex flex-1 items-center justify-center gap-2 rounded-2xl px-3 py-2 text-xs font-bold text-gray-500 transition hover:text-gray-900"
              >
                <ShoppingCart className="h-4 w-4" />
                Carrinho
                {cart.length > 0 && (
                  <span className="absolute right-2 top-1 flex h-4 w-4 items-center justify-center rounded-full bg-[#B71C1C] text-[9px] font-black text-white">
                    {cart.length}
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => setConsultOpen(true)}
                className={`flex flex-1 items-center justify-center gap-2 rounded-2xl px-3 py-2 text-xs font-bold transition ${
                  consultOpen ? 'bg-[#B71C1C] text-white' : 'text-gray-500'
                }`}
              >
                <Search className="h-4 w-4" />
                Consultar
              </button>
            </div>
          </div>

          {/* Mobile: barra flutuante do carrinho */}
          {cart.length > 0 && step === 'browse' && (
            <div
              className="fixed inset-x-0 bottom-0 z-40 mx-auto flex max-w-6xl justify-center px-4 pb-[calc(max(0.75rem,env(safe-area-inset-bottom,0px))+3.75rem)] md:hidden"
              aria-live="polite"
            >
              <button
                type="button"
                onClick={() => setCartOpen(true)}
                className="w-full max-w-lg rounded-3xl border border-gray-200 bg-white px-4 py-3 shadow-xl transition active:scale-[0.99]"
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[#B71C1C] text-white font-black text-sm">
                      {cart.length}
                    </span>
                    <div className="text-left">
                      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Carrinho</p>
                      <p className="text-sm font-black text-gray-900">{formatCurrency(total)}</p>
                    </div>
                  </div>
                  <span className="rounded-2xl bg-[#B71C1C] px-4 py-2 text-sm font-bold text-white">
                    Ver carrinho
                  </span>
                </div>
              </button>
            </div>
          )}

          {/* Mobile: carrinho como bottom-sheet (estilo app) */}
          <Sheet open={cartOpen} onOpenChange={setCartOpen}>
            <SheetContent
              side="bottom"
              className="max-h-[92dvh] overflow-y-auto rounded-t-[2rem] border-0 border-t border-border/70 bg-white p-0 shadow-xl md:hidden"
            >
              <div className="mx-auto mt-2 h-1 w-12 rounded-full bg-muted-foreground/25" aria-hidden />
              <div className="px-5 pb-6 pt-4">
                <SheetHeader className="space-y-1 text-left">
                  <SheetTitle className="font-heading text-2xl font-black">Seu carrinho</SheetTitle>
                  <SheetDescription className="text-sm font-medium">
                    Ajuste quantidades e finalize.
                  </SheetDescription>
                </SheetHeader>

                {cart.length === 0 ? (
                  <div className="mt-6 rounded-3xl border border-dashed border-border p-8 text-center">
                    <p className="text-sm font-semibold text-muted-foreground">Carrinho vazio</p>
                  </div>
                ) : (
                  <div className="mt-5 space-y-4">
                    <div className="space-y-3">
                      {cart.map((item) => (
                        <div key={item.productId} className="rounded-3xl border border-border/70 bg-muted/10 p-4">
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-black text-gray-900">{item.product?.name}</p>
                              <p className="text-xs font-semibold text-muted-foreground">
                                {formatCurrency(item.priceAtSale)} · {item.product?.unit?.toUpperCase()}
                              </p>
                            </div>
                            <Button
                              variant="ghost"
                              size="icon"
                              onClick={() => removeFromCart(item.productId)}
                              className="h-9 w-9 rounded-2xl"
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>

                          <div className="mt-3 flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="icon"
                                onClick={() =>
                                  updateQuantity(
                                    item.productId,
                                    item.quantity - (item.product?.unit === 'kg' || item.product?.unit === 'g' ? 100 : 1),
                                  )
                                }
                                className="h-10 w-10 rounded-2xl"
                              >
                                <Minus className="h-4 w-4" />
                              </Button>
                              <div className="min-w-[90px] text-center">
                                <p className="text-sm font-black">{formatQuantityDisplay(item)}</p>
                                <p className="text-[11px] font-semibold text-muted-foreground">Quantidade</p>
                              </div>
                              <Button
                                variant="outline"
                                size="icon"
                                onClick={() =>
                                  updateQuantity(
                                    item.productId,
                                    item.quantity + (item.product?.unit === 'kg' || item.product?.unit === 'g' ? 100 : 1),
                                  )
                                }
                                className="h-10 w-10 rounded-2xl"
                              >
                                <Plus className="h-4 w-4" />
                              </Button>
                            </div>
                            <p className="text-sm font-black text-[#B71C1C]">
                              {formatCurrency(item.priceAtSale * item.quantity)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                      <div className="flex items-end justify-between">
                        <span className="text-sm font-bold uppercase tracking-wide text-gray-500">Total</span>
                        <span className="text-2xl font-black text-[#B71C1C]">{formatCurrency(total)}</span>
                      </div>
                      <Button
                        type="button"
                        onClick={() => {
                          setCartOpen(false);
                          setStep('checkout');
                        }}
                        className="mt-3 h-12 w-full rounded-2xl bg-[#B71C1C] hover:bg-[#9b1414] font-bold"
                      >
                        Finalizar pedido
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </SheetContent>
          </Sheet>

        {step === 'intro' && (
          <div className="space-y-4">
            <Card className="border-gray-200 bg-white">
              <CardHeader>
                <CardTitle className="text-xl">Como funciona</CardTitle>
                <CardDescription>Essencial, sem ocupar espaço.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-2 text-sm text-muted-foreground">
                  <p><strong className="text-foreground">1.</strong> Procure e adicione ao carrinho.</p>
                  <p><strong className="text-foreground">2.</strong> Finalize e receba um código.</p>
                  <p><strong className="text-foreground">3.</strong> Rastreie pelo código quando quiser.</p>
                </div>
                <div className="flex gap-2">
                  <Button onClick={() => setStep('browse')} className="flex-1 rounded-2xl bg-[#B71C1C] hover:bg-[#9b1414]">
                    Ver produtos
                  </Button>
                  <Button onClick={() => setStep('tracking')} variant="outline" className="flex-1 rounded-2xl">
                    Rastrear
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {step === 'browse' && (
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-4 md:gap-6">
            {/* Products */}
            <div className="md:col-span-2 lg:col-span-3 space-y-4">
              {/* Barra de pesquisa + categoria */}
              <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                <div className="grid gap-3 p-4 md:grid-cols-2">
                  <div className="relative">
                    <Search className="absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <Input
                      value={productSearch}
                      onChange={(e) => setProductSearch(e.target.value)}
                      placeholder="Buscar (ex: água, arroz, leite)…"
                      className="h-11 rounded-xl pl-10 border-gray-200 bg-gray-50 focus:bg-white"
                    />
                  </div>
                  <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                    <SelectTrigger className="w-full h-11 rounded-xl border-gray-200">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="0">Todas as categorias</SelectItem>
                      {categories.map(cat => (
                        <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {productSearch.trim() && directMatches.length === 0 && fuzzySuggestions.length === 0 && (
                  <div className="border-t border-gray-100 bg-gray-50 px-4 py-3">
                    <p className="text-sm font-semibold text-gray-700">Não encontramos "{productSearch.trim()}".</p>
                    <p className="mt-0.5 text-xs text-gray-400">Tenta outro nome ou verifique a categoria.</p>
                  </div>
                )}
              </div>

              {/* Products Grid */}
              <div className="grid grid-cols-2 gap-3 md:gap-4">
                {filteredProducts.map(product => {
                  const stock = parseFloat(product.stock);
                  const outOfStock = stock <= 0;
                  return (
                    <div key={product.id} className={`relative overflow-hidden rounded-2xl border bg-white shadow-sm transition-shadow hover:shadow-md ${outOfStock ? 'border-gray-200 opacity-60' : 'border-gray-200'}`}>
                      <div className="p-3.5 space-y-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-bold text-gray-900">{product.name}</p>
                            <p className="text-[11px] text-gray-400 truncate">{product.sku}</p>
                          </div>
                          <span className="shrink-0 rounded-lg border border-gray-200 bg-gray-50 px-1.5 py-0.5 text-[10px] font-bold uppercase text-gray-500">{product.unit}</span>
                        </div>
                        <div className="flex items-end justify-between">
                          <p className="text-base font-black text-[#B71C1C]">{formatCurrency(parseFloat(product.price))}</p>
                          {outOfStock
                            ? <span className="rounded-lg bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-600">Esgotado</span>
                            : <span className="rounded-lg bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-500">
                                {product.unit === 'kg' || product.unit === 'g' ? `${stock.toFixed(2)} kg` : `${Math.floor(stock)} un.`}
                              </span>
                          }
                        </div>
                        <button
                          type="button"
                          onClick={() => addToCart(product)}
                          disabled={outOfStock}
                          className="flex w-full items-center justify-center rounded-xl bg-[#B71C1C] py-2.5 text-sm font-bold text-white transition hover:bg-[#9b1414] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          Adicionar
                        </button>
                      </div>
                      <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-gradient-to-r from-[#B71C1C] to-[#7f1d1d]" />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Cart Sidebar (desktop) */}
            <div className="hidden md:block md:col-span-1">
              <div className="sticky top-4 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
                <div className="flex items-center gap-2 border-b border-gray-100 bg-gray-50/60 px-4 py-3">
                  <ShoppingCart className="h-4 w-4 text-[#B71C1C]" />
                  <p className="text-sm font-bold text-gray-800">Meu Carrinho</p>
                  {cart.length > 0 && (
                    <span className="ml-auto flex h-5 w-5 items-center justify-center rounded-full bg-[#B71C1C] text-[10px] font-black text-white">{cart.length}</span>
                  )}
                </div>
                <div className="p-4 space-y-4">
                {cart.length === 0 ? (
                  <div className="py-8 text-center">
                    <ShoppingCart className="mx-auto mb-2 h-8 w-8 text-gray-200" />
                    <p className="text-sm font-semibold text-gray-400">Carrinho vazio</p>
                  </div>
                ) : (
                  <>
                    <div className="space-y-2.5 max-h-[380px] overflow-y-auto">
                      {cart.map(item => (
                        <div key={item.productId} className="rounded-xl border border-gray-100 bg-gray-50 p-3 space-y-2">
                          <div className="flex justify-between items-start gap-2">
                            <p className="text-sm font-semibold text-gray-800 leading-tight">{item.product?.name}</p>
                            <button type="button" onClick={() => removeFromCart(item.productId)} className="shrink-0 rounded-lg p-0.5 text-gray-400 hover:text-red-600 transition">
                              <X className="h-3.5 w-3.5" />
                            </button>
                          </div>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-1.5">
                              <button type="button" onClick={() => updateQuantity(item.productId, item.quantity - (item.product?.unit === 'kg' || item.product?.unit === 'g' ? 100 : 1))} className="flex h-6 w-6 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 hover:border-gray-300">
                                <Minus className="h-3 w-3" />
                              </button>
                              <span className="min-w-[40px] text-center text-xs font-bold text-gray-800">{formatQuantityDisplay(item)}</span>
                              <button type="button" onClick={() => updateQuantity(item.productId, item.quantity + (item.product?.unit === 'kg' || item.product?.unit === 'g' ? 100 : 1))} className="flex h-6 w-6 items-center justify-center rounded-lg border border-gray-200 bg-white text-gray-600 hover:border-gray-300">
                                <Plus className="h-3 w-3" />
                              </button>
                            </div>
                            <span className="text-sm font-black text-[#B71C1C]">{formatCurrency(item.priceAtSale * item.quantity)}</span>
                          </div>
                        </div>
                      ))}
                    </div>

                    <div className="border-t border-gray-100 pt-3 space-y-2">
                      <div className="flex justify-between font-bold text-lg">
                        <span className="text-gray-600">Total:</span>
                        <span className="text-[#B71C1C]">{formatCurrency(total)}</span>
                      </div>
                      <button
                        type="button"
                        onClick={() => setStep('checkout')}
                        className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#B71C1C] py-2.5 text-sm font-bold text-white transition hover:bg-[#9b1414]"
                      >
                        <Package className="h-4 w-4" />
                        Finalizar Pedido
                      </button>
                    </div>
                  </>
                )}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Checkout: no mobile vira bottom-sheet (estilo app); no desktop mantém card */} 
        <Sheet
          open={checkoutOpen && isMobile}
          onOpenChange={(open) => setStep(open ? 'checkout' : 'browse')}
        >
          <SheetContent
            side="bottom"
            className="max-h-[92dvh] overflow-y-auto rounded-t-[2rem] border-0 border-t border-border/70 bg-white p-0 shadow-xl md:hidden"
          >
            <div className="mx-auto mt-2 h-1 w-12 rounded-full bg-muted-foreground/25" aria-hidden />
            <div className="px-5 pb-6 pt-4">
              <SheetHeader className="space-y-1 text-left">
                <SheetTitle className="font-heading text-2xl font-black">Finalizar pedido</SheetTitle>
                <SheetDescription className="text-sm font-medium">
                  Preencha em 10 segundos e confirme.
                </SheetDescription>
              </SheetHeader>

              <div className="mt-5 space-y-5">
                <div className="grid gap-3">
                  <div className="space-y-2">
                    <Label>Nome</Label>
                    <Input
                      placeholder="Seu nome"
                      value={formData.customerName}
                      onChange={(e) => setFormData({ ...formData, customerName: e.target.value })}
                      className="h-12 rounded-2xl border-gray-200 bg-gray-50"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Telefone</Label>
                    <Input
                      placeholder="+258 84 xxx xxxx"
                      value={formData.customerPhone}
                      onChange={(e) => setFormData({ ...formData, customerPhone: e.target.value })}
                      className="h-12 rounded-2xl border-gray-200 bg-gray-50"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Pagamento</Label>
                  <Select value={formData.paymentMethod} onValueChange={(val: any) => setFormData({ ...formData, paymentMethod: val })}>
                    <SelectTrigger className="h-12 rounded-2xl border-gray-200 bg-gray-50">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">Dinheiro (ao levantar)</SelectItem>
                      <SelectItem value="transfer">Transferência</SelectItem>
                      <SelectItem value="mpesa">Mpesa</SelectItem>
                      <SelectItem value="emola">Emola</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {(formData.paymentMethod === 'mpesa' || formData.paymentMethod === 'emola') && (
                  <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                    <p className="text-sm font-black text-gray-900">Pagamento por {formData.paymentMethod === 'mpesa' ? 'Mpesa' : 'Emola'}</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Use o número abaixo para transferir e depois venha levantar com o código do pedido.
                    </p>
                    <div className="mt-3 rounded-xl border border-gray-200 bg-white px-3 py-2">
                      <p className="text-xs font-semibold text-muted-foreground">Número</p>
                      <p className="mt-0.5 font-mono text-lg font-black text-[#B71C1C]">
                        {formData.paymentMethod === 'mpesa' ? (transferInfo?.mpesa || '—') : (transferInfo?.emola || '—')}
                      </p>
                    </div>
                  </div>
                )}

                {formData.paymentMethod === 'transfer' && (
                  <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                    <p className="text-sm font-black text-gray-900">Comprovativo (obrigatório)</p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Anexe uma imagem do comprovativo. (PNG/JPG)
                    </p>
                    <div className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-center">
                      <Input
                        type="file"
                        accept="image/*"
                        className="h-12 rounded-2xl border-gray-200 bg-white"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (!f) return;
                          if (!f.type.startsWith('image/')) {
                            toast({ title: 'Arquivo inválido', description: 'Escolha uma imagem (PNG/JPG).', variant: 'destructive' });
                            return;
                          }
                          if (f.size > 2.5 * 1024 * 1024) {
                            toast({ title: 'Muito grande', description: 'Use uma imagem até 2.5MB.', variant: 'destructive' });
                            return;
                          }
                          const reader = new FileReader();
                          reader.onload = () => {
                            const v = String(reader.result || '');
                            setPaymentProofDataUrl(v);
                          };
                          reader.readAsDataURL(f);
                        }}
                      />
                      <Button
                        type="button"
                        variant="outline"
                        className="h-12 rounded-2xl"
                        onClick={() => setPaymentProofDataUrl('')}
                        disabled={!paymentProofDataUrl}
                      >
                        Remover
                      </Button>
                    </div>
                    {paymentProofDataUrl && (
                      <div className="mt-3 overflow-hidden rounded-2xl border border-gray-200 bg-white">
                        <img src={paymentProofDataUrl} alt="" className="h-48 w-full object-cover" />
                      </div>
                    )}
                  </div>
                )}

                <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                  <p className="text-sm font-black text-gray-900">Resumo</p>
                  <div className="mt-2 space-y-1.5 text-sm">
                    {cart.map((item) => (
                      <div key={item.productId} className="flex justify-between gap-3">
                        <span className="min-w-0 truncate font-medium text-gray-900">
                          {item.product?.name} <span className="text-muted-foreground">× {item.quantity}</span>
                        </span>
                        <span className="shrink-0 font-black text-gray-900">{formatCurrency(item.priceAtSale * item.quantity)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 flex items-end justify-between border-t border-gray-200/60 pt-3">
                    <span className="text-sm font-black uppercase tracking-wide text-gray-900/80">Total</span>
                    <span className="font-heading text-2xl font-black text-[#B71C1C]">{formatCurrency(total)}</span>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <Button
                    variant="outline"
                    onClick={() => setStep('browse')}
                    className="h-12 rounded-2xl"
                  >
                    Voltar
                  </Button>
                  <Button
                    onClick={() => createOrderMutation.mutate()}
                    disabled={createOrderMutation.isPending}
                    className="h-12 rounded-2xl bg-[#B71C1C] hover:bg-[#9b1414] gap-2 font-black"
                  >
                    <Check className="h-4 w-4" />
                    {createOrderMutation.isPending ? 'Criando…' : 'Confirmar'}
                  </Button>
                </div>
              </div>
            </div>
          </SheetContent>
        </Sheet>

        {step === 'checkout' && (
          <div className="mx-auto hidden max-w-2xl md:block">
            <Card className="border-gray-200">
              <CardHeader>
                <CardTitle>Finalizar Pedido</CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Nome Completo</Label>
                    <Input
                      placeholder="Seu nome"
                      value={formData.customerName}
                      onChange={(e) => setFormData({...formData, customerName: e.target.value})}
                      className="border-gray-200"
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Telefone</Label>
                    <Input
                      placeholder="+258 84 xxx xxxx"
                      value={formData.customerPhone}
                      onChange={(e) => setFormData({...formData, customerPhone: e.target.value})}
                      className="border-gray-200"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>Forma de Pagamento</Label>
                  <Select value={formData.paymentMethod} onValueChange={(val: any) => setFormData({...formData, paymentMethod: val})}>
                    <SelectTrigger className="border-gray-200">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="cash">💵 Dinheiro (ao levantar)</SelectItem>
                      <SelectItem value="transfer">🏦 Transferência</SelectItem>
                      <SelectItem value="mpesa">📲 Mpesa</SelectItem>
                      <SelectItem value="emola">📲 Emola</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {(formData.paymentMethod === 'mpesa' || formData.paymentMethod === 'emola') && (
                  <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4">
                    <p className="text-sm font-black text-gray-900">Número para transferência</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {formData.paymentMethod === 'mpesa' ? 'Mpesa' : 'Emola'}:{' '}
                      <span className="font-mono font-black text-[#B71C1C]">
                        {formData.paymentMethod === 'mpesa' ? (transferInfo?.mpesa || '—') : (transferInfo?.emola || '—')}
                      </span>
                    </p>
                  </div>
                )}

                {formData.paymentMethod === 'transfer' && (
                  <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 space-y-3">
                    <div>
                      <p className="text-sm font-black text-gray-900">Comprovativo (obrigatório)</p>
                      <p className="text-xs text-muted-foreground">
                        Anexe uma imagem do comprovativo (PNG/JPG).
                      </p>
                    </div>
                    <Input
                      type="file"
                      accept="image/*"
                      className="border-gray-200 bg-white"
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (!f) return;
                        if (!f.type.startsWith('image/')) {
                          toast({ title: 'Arquivo inválido', description: 'Escolha uma imagem (PNG/JPG).', variant: 'destructive' });
                          return;
                        }
                        if (f.size > 2.5 * 1024 * 1024) {
                          toast({ title: 'Muito grande', description: 'Use uma imagem até 2.5MB.', variant: 'destructive' });
                          return;
                        }
                        const reader = new FileReader();
                        reader.onload = () => setPaymentProofDataUrl(String(reader.result || ''));
                        reader.readAsDataURL(f);
                      }}
                    />
                    {paymentProofDataUrl && (
                      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
                        <img src={paymentProofDataUrl} alt="" className="h-44 w-full object-cover" />
                      </div>
                    )}
                    <Button type="button" variant="outline" onClick={() => setPaymentProofDataUrl('')} disabled={!paymentProofDataUrl}>
                      Remover comprovativo
                    </Button>
                  </div>
                )}

                <div className="bg-gray-50 p-4 rounded-lg space-y-2">
                  <p className="font-semibold">Resumo do Pedido:</p>
                  <div className="space-y-1 text-sm">
                    {cart.map(item => (
                      <div key={item.productId} className="flex justify-between">
                        <span>{item.product?.name} x {item.quantity}</span>
                        <span className="font-medium">{formatCurrency(item.priceAtSale * item.quantity)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="border-t border-gray-200 pt-2 flex justify-between font-bold text-lg">
                    <span>Total:</span>
                    <span className="text-[#B71C1C]">{formatCurrency(total)}</span>
                  </div>
                </div>

                <div className="flex gap-3">
                  <Button
                    variant="outline"
                    onClick={() => setStep('browse')}
                    className="flex-1"
                  >
                    Voltar
                  </Button>
                  <Button
                    onClick={() => createOrderMutation.mutate()}
                    disabled={createOrderMutation.isPending}
                    className="flex-1 bg-[#B71C1C] hover:bg-[#9b1414] gap-2"
                  >
                    <Check className="h-4 w-4" />
                    {createOrderMutation.isPending ? 'Criando...' : 'Confirmar Pedido'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {step === 'tracking' && order && (
          <div className="max-w-2xl mx-auto space-y-6">
            <Card className="border-gray-200 bg-white">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-green-900">
                  <Check className="h-6 w-6 text-green-600" />
                  Pedido Confirmado!
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-white p-6 rounded-lg border-2 border-green-300 text-center space-y-2">
                  <p className="text-sm text-muted-foreground">Seu código de rastreamento:</p>
                  <p className="text-4xl font-bold text-[#B71C1C] tracking-wider font-mono">{order.orderCode}</p>
                  <p className="text-xs text-muted-foreground">Guarde este código para acompanhar seu pedido</p>
                  <div className="mt-3 flex flex-wrap justify-center gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      className="gap-2"
                      onClick={async () => {
                        try {
                          await navigator.clipboard.writeText(String(order.orderCode || '').trim());
                          toast({ title: 'Copiado', description: 'Código copiado para a área de transferência.' });
                        } catch {
                          toast({ title: 'Falhou', description: 'Não foi possível copiar.', variant: 'destructive' });
                        }
                      }}
                    >
                      <Copy className="h-4 w-4" /> Copiar código
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      className="gap-2"
                      onClick={async () => {
                        const code = String(order.orderCode || '').trim();
                        const text = `Pedido ${code} · Status: ${order.status}`;
                        try {
                          if ((navigator as any).share) {
                            await (navigator as any).share({ title: 'Pedido', text });
                            return;
                          }
                        } catch {
                          // ignore
                        }
                        try {
                          await navigator.clipboard.writeText(text);
                          toast({ title: 'Partilha rápida', description: 'Texto copiado para partilhar.' });
                        } catch {
                          toast({ title: 'Falhou', description: 'Não foi possível partilhar.', variant: 'destructive' });
                        }
                      }}
                    >
                      <Share2 className="h-4 w-4" /> Partilhar
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-white rounded-lg border border-gray-100">
                    <p className="text-xs text-muted-foreground mb-1">Cliente</p>
                    <p className="font-semibold">{order.customerName}</p>
                    <p className="text-sm text-muted-foreground">{order.customerPhone}</p>
                  </div>
                  <div className="p-4 bg-white rounded-lg border border-gray-100">
                    <p className="text-xs text-muted-foreground mb-1">Total do Pedido</p>
                    <p className="text-2xl font-bold text-[#B71C1C]">{formatCurrency(order.total)}</p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="p-4 bg-white rounded-lg border border-gray-100">
                    <p className="text-xs text-muted-foreground mb-1">Pagamento</p>
                    <p className="font-semibold capitalize">{order.paymentMethod}</p>
                  </div>
                  <div className="p-4 bg-white rounded-lg border border-gray-100">
                    <p className="text-xs text-muted-foreground mb-1">Comprovativo</p>
                    <p className="text-sm text-muted-foreground">
                      {order.paymentProof ? 'Anexado' : '—'}
                    </p>
                  </div>
                </div>

                {order.paymentProof && (
                  <button
                    type="button"
                    onClick={() => setProofOpen(true)}
                    className="group overflow-hidden rounded-xl border border-gray-200 bg-white text-left transition hover:shadow-md"
                  >
                    <div className="flex items-center justify-between gap-2 border-b border-gray-200/60 px-4 py-3">
                      <p className="text-sm font-black text-gray-900 flex items-center gap-2">
                        <ImageIcon className="h-4 w-4 text-[#B71C1C]" /> Comprovativo
                      </p>
                      <span className="text-xs font-semibold text-muted-foreground group-hover:text-foreground">Toque para ampliar</span>
                    </div>
                    <img src={order.paymentProof} alt="" className="h-44 w-full object-cover" />
                  </button>
                )}

                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <p className="font-semibold text-blue-900 mb-2">Status:</p>
                  <Badge className={`${getStatusColor(order.status)}`}>
                    {getStatusIcon(order.status)}
                    <span className="ml-2">
                      {order.status === 'pending' && 'Aguardando Aprovação'}
                      {order.status === 'accepted' && 'Aceite'}
                      {order.status === 'ready' && 'Pronto'}
                      {order.status === 'completed' && 'Entregue'}
                      {order.status === 'cancelled' && 'Cancelado'}
                    </span>
                  </Badge>
                  <p className="text-xs text-muted-foreground mt-2">
                    {order.status === 'pending' && 'Seu pedido foi recebido e está aguardando aprovação do lojista.'}
                    {order.status === 'accepted' && 'Seu pedido foi aceite e está em preparação.'}
                    {order.status === 'ready' && 'Seu pedido está pronto. Pode vir levantar.'}
                    {order.status === 'completed' && 'Pedido entregue. Obrigado!'}
                  </p>
                </div>

                <div className="rounded-lg border border-gray-200 bg-white p-4">
                  <p className="mb-2 flex items-center gap-2 font-semibold text-gray-800">
                    <Store className="h-4 w-4 text-[#B71C1C]" />
                    Resposta da loja
                  </p>
                  {order.staffMessage ? (
                    <div className="rounded-md border border-gray-100 bg-gray-50/40 p-3">
                      <p className="text-sm font-medium text-gray-900">{order.staffMessage}</p>
                      {order.staffMessageAt && (
                        <p className="mt-1 text-xs text-muted-foreground">Atualizado: {new Date(order.staffMessageAt).toLocaleString()}</p>
                      )}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground">Ainda não há mensagem. Assim que a loja responder, aparecerá aqui.</p>
                  )}
                </div>

                <div className="rounded-lg border border-border bg-white p-4">
                  <p className="mb-3 font-semibold text-gray-900">Linha do tempo</p>
                  {(() => {
                    const current =
                      order.status === 'completed' ? 4 :
                      order.status === 'ready' ? 3 :
                      order.status === 'accepted' ? 2 :
                      order.status === 'pending' ? 1 : 0;
                    const steps = [
                      { id: 1, label: 'Recebido' },
                      { id: 2, label: 'Aceite' },
                      { id: 3, label: 'Pronto' },
                      { id: 4, label: 'Entregue' },
                    ];
                    return (
                      <div className="grid grid-cols-4 gap-2">
                        {steps.map((s) => {
                          const done = current >= s.id;
                          return (
                            <div key={s.id} className="text-center">
                              <div className={`mx-auto mb-2 h-2.5 w-2.5 rounded-full ${done ? 'bg-gray-500' : 'bg-gray-300'}`} />
                              <p className={`text-xs font-semibold ${done ? 'text-gray-900' : 'text-muted-foreground'}`}>{s.label}</p>
                            </div>
                          );
                        })}
                      </div>
                    );
                  })()}
                </div>

                <Button
                  onClick={() => { setStep('browse'); setOrder(null); }}
                  className="w-full bg-[#B71C1C] hover:bg-[#9b1414]"
                >
                  Fazer Novo Pedido
                </Button>

                {user && user.role !== 'seller' && order.orderCode && (
                  <Button
                    type="button"
                    variant="outline"
                    className="w-full"
                    onClick={() => loadAuditMutation.mutate(order.orderCode!)}
                    disabled={loadAuditMutation.isPending}
                  >
                    {loadAuditMutation.isPending ? 'Carregando auditoria…' : 'Auditoria profunda (admin/gestor)'}
                  </Button>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        <Dialog open={auditOpen} onOpenChange={setAuditOpen}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle>Auditoria profunda do pedido</DialogTitle>
            </DialogHeader>
            {!auditData ? (
              <div className="py-6 text-sm text-muted-foreground">Sem dados.</div>
            ) : (
              <div className="space-y-4">
                <div className="rounded-2xl border border-border bg-muted/20 p-4">
                  <p className="text-sm font-black">
                    Pedido <span className="font-mono">#{auditData.order?.orderCode}</span> · {auditData.order?.status}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    SaleId: {auditData.order?.saleId || '—'} · Last3: {auditData.order?.last3Phone || '—'}
                  </p>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <div className="rounded-2xl border border-border bg-white p-4">
                    <p className="text-sm font-black mb-2">Eventos (Order)</p>
                    <div className="space-y-2">
                      {(auditData.audit?.order || []).slice(0, 60).map((l: any) => (
                        <div key={String(l.id) + String(l.createdAt)} className="rounded-xl border border-border/70 bg-muted/10 px-3 py-2">
                          <p className="text-sm font-semibold">{l.action}</p>
                          <p className="text-xs text-muted-foreground">{new Date(l.createdAt).toLocaleString()}</p>
                          {l.details && (
                            <pre className="mt-2 max-h-28 overflow-auto rounded-lg bg-black/90 p-2 text-[11px] text-white">
                              {JSON.stringify(l.details, null, 2)}
                            </pre>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-border bg-white p-4">
                    <p className="text-sm font-black mb-2">Eventos (Sale)</p>
                    <div className="space-y-2">
                      {(auditData.audit?.sale || []).slice(0, 60).map((l: any) => (
                        <div key={String(l.id) + String(l.createdAt)} className="rounded-xl border border-border/70 bg-muted/10 px-3 py-2">
                          <p className="text-sm font-semibold">{l.action}</p>
                          <p className="text-xs text-muted-foreground">{new Date(l.createdAt).toLocaleString()}</p>
                          {l.details && (
                            <pre className="mt-2 max-h-28 overflow-auto rounded-lg bg-black/90 p-2 text-[11px] text-white">
                              {JSON.stringify(l.details, null, 2)}
                            </pre>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        <Dialog open={proofOpen} onOpenChange={setProofOpen}>
          <DialogContent className="max-w-3xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <ImageIcon className="h-5 w-5 text-primary" /> Comprovativo
              </DialogTitle>
            </DialogHeader>
            {order?.paymentProof ? (
              <div className="overflow-hidden rounded-2xl border border-border bg-black">
                <img src={order.paymentProof} alt="" className="max-h-[70vh] w-full object-contain" />
              </div>
            ) : (
              <div className="py-6 text-sm text-muted-foreground">Sem comprovativo.</div>
            )}
          </DialogContent>
        </Dialog>

        {step !== 'tracking' && (
          <Card className="border-gray-200 bg-gray-50">
            <CardContent className="pt-6">
              <div className="flex items-center gap-3">
                <Clock className="h-5 w-5 text-[#B71C1C]" />
                <div className="text-sm">
                  <p className="font-semibold text-gray-900">Já tem um código de rastreamento?</p>
                  <p className="text-muted-foreground">Clique abaixo para acompanhar seu pedido</p>
                </div>
              </div>
              <div className="mt-4 flex gap-2">
                <Input
                  placeholder="Digite seu código (ex: ABC12345)"
                  value={trackingCode}
                  onChange={(e) => setTrackingCode(e.target.value.toUpperCase())}
                  className="border-gray-200"
                  maxLength={8}
                />
                <Button
                  onClick={() => trackOrderMutation.mutate()}
                  disabled={trackOrderMutation.isPending}
                  className="bg-[#B71C1C] hover:bg-[#9b1414]"
                >
                  Rastrear
                </Button>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
    </>
  );
}
