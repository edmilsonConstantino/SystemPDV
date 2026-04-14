import { useAuth } from '@/lib/auth';
import { useCart } from '@/lib/cart';
import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { motion, AnimatePresence } from 'framer-motion';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Search, ShoppingCart, Trash2, Plus, Minus, CreditCard, Banknote, QrCode, AlertCircle, ShoppingBag, ArrowRight, Percent, Scale, Check, LayoutGrid, List, ScanLine, Smartphone, Camera, RefreshCw, Monitor, Share2, History, Sparkles, GripHorizontal } from 'lucide-react';
import { QRCode } from 'react-qr-code';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { formatCurrency, cn } from '@/lib/utils';
import { Product, productsApi, categoriesApi, salesApi, scannerApi, networkApi, ScannerSessionInfo } from '@/lib/api';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from '@/hooks/use-toast';
import { BarcodeCameraScan } from '@/components/BarcodeCameraScan';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet';
import { useMediaQuery } from '@/hooks/use-media-query';
import { InvoicePreviewDialog } from '@/components/invoice/InvoicePreviewDialog';
import type { InvoiceData } from '@/lib/invoiceModels';
import { loadInvoiceSettings } from '@/lib/invoiceSettings';
import {
  loadPosPrefs,
  savePosPrefs,
  loadRecentProductIds,
  recordRecentProduct,
  migratePosPrefsIfNeeded,
  type PosPrefs,
} from '@/lib/posLocalStorage';

const POS_LIST_VIRTUAL_MIN = 72;

function formatStockRemaining(unit: string, n: number): string {
  if (unit === 'kg') return n.toFixed(3);
  if (unit === 'g') return String(Math.round(n));
  return String(Math.max(0, Math.round(n)));
}

/** Pesquisa imediata + tolerância a acentos */
function normalizeForSearch(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '');
}

export default function POS() {
  const { user } = useAuth();
  const { cart, addToCart, removeFromCart, updateCartQuantity, clearCart, getCartTotal } = useCart();
  const queryClient = useQueryClient();
  
  const { data: products = [], isLoading: productsLoading, isFetching: productsFetching } = useQuery({
    queryKey: ['/api/products'],
    queryFn: productsApi.getAll,
    placeholderData: (prev) => prev,
  });

  const { data: categories = [], isLoading: categoriesLoading } = useQuery({
    queryKey: ['/api/categories'],
    queryFn: categoriesApi.getAll,
    placeholderData: (prev) => prev,
  });

  const createSaleMutation = useMutation({
    mutationFn: salesApi.create,
    onSuccess: (sale) => {
      const cfg = loadInvoiceSettings();
      // Gera fatura a partir do preview (nome/uni) + valores finais
      const preview = (sale as any)?.preview;
      const previewItems = (preview?.items ?? []) as Array<any>;

      const lines = previewItems.map((it) => {
        const qty = Number(it.quantity ?? 0);
        const unitPrice = Number(it.priceAtSale ?? 0);
        return {
          name: it.productName || it.productId,
          qty,
          unit: it.productUnit,
          unitPrice,
          total: qty * unitPrice,
        };
      });

      const invoiceNo = `MK-${new Date().getFullYear()}-${String(sale.id ?? '').slice(0, 6).toUpperCase()}`;
      const issuedAt = new Date((sale as any)?.createdAt ?? Date.now());

      const invoice: InvoiceData = {
        invoiceNo,
        issuedAt,
        currencyLabel: cfg.currencyLabel,
        seller: cfg.seller,
        customer: { name: 'Consumidor final' },
        paymentMethod: preview?.paymentMethod ?? (sale as any)?.paymentMethod,
        lines,
        subtotal: Number(preview?.subtotal ?? preview?.total ?? sale.total),
        discount: Number(preview?.discountAmount ?? 0) || undefined,
        total: Number(preview?.total ?? sale.total),
        notes: cfg.defaultNotes,
        qrValue: cfg.showQr ? invoiceNo : undefined,
        barcodeValue: cfg.showBarcode ? invoiceNo : undefined,
      };

      clearCart();
      queryClient.invalidateQueries({ queryKey: ['/api/products'] });
      queryClient.invalidateQueries({ queryKey: ['/api/sales'] });
      toast({ 
        title: "Sucesso", 
        description: "Venda registrada com sucesso!" 
      });
      setCartSheetOpen(false);
      setPaymentOpen(false);
      setActiveDiscount({ type: 'none', value: 0 });
      setAmountReceived(0);
      setInvoiceData(invoice);
      setInvoiceOpen(true);
    },
    onError: (error: Error) => {
      toast({ 
        title: "Erro", 
        description: error.message,
        variant: "destructive"
      });
    }
  });
  
  const [search, setSearch] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | 'all'>('all');
  const [recentProductIds, setRecentProductIds] = useState<string[]>(() => loadRecentProductIds());
  const [stockPreview, setStockPreview] = useState<{ productId: string; remaining: number; unit: string } | null>(
    null,
  );
  const stockPreviewTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  /** Carrinho em sheet (mobile) */
  const [cartSheetOpen, setCartSheetOpen] = useState(false);
  /** Finalizar venda / pagamento */
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [discountOpen, setDiscountOpen] = useState(false);
  const [weightOpen, setWeightOpen] = useState(false);
  const [selectedWeightProduct, setSelectedWeightProduct] = useState<Product | null>(null);
  const [weightInGrams, setWeightInGrams] = useState(0);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<'cash' | 'card' | 'pix' | 'mpesa' | 'emola' | 'pos' | 'bank' | null>(null);
  const [showPreviewConfirm, setShowPreviewConfirm] = useState(false);
  const [invoiceOpen, setInvoiceOpen] = useState(false);
  const [invoiceData, setInvoiceData] = useState<InvoiceData | null>(null);
  
  const [discountValue, setDiscountValue] = useState(0);
  const [discountType, setDiscountType] = useState<'percentage' | 'fixed'>('percentage');
  const [activeDiscount, setActiveDiscount] = useState({ type: 'none', value: 0 });
  const [viewMode, setViewMode] = useState<'grid' | 'list'>(() => loadPosPrefs().viewMode);
  const [cameraScanOpen, setCameraScanOpen] = useState(false);
  const [remoteScannerOpen, setRemoteScannerOpen] = useState(false);
  const [scannerToken, setScannerToken] = useState<string | null>(null);
  const [scannerUrl, setScannerUrl] = useState<string>('');
  const [scannerSessions, setScannerSessions] = useState<ScannerSessionInfo[]>([]);
  const barcodeInputRef = useRef<HTMLInputElement>(null);
  const isMobileViewport = useMediaQuery('(max-width: 767px)');

  const canApplyDiscount = user?.role === 'admin' || user?.role === 'manager';

  /* No telemóvel o leitor é a própria câmera — não manter sessão remota nem poller */
  useEffect(() => {
    if (!isMobileViewport) return;
    setRemoteScannerOpen(false);
    setScannerToken((current) => {
      if (current) scannerApi.revoke(current).catch(() => {});
      return null;
    });
    setScannerUrl('');
    setScannerSessions([]);
  }, [isMobileViewport]);

  useEffect(() => {
    migratePosPrefsIfNeeded();
  }, []);

  useEffect(() => {
    const prefs: PosPrefs = { viewMode };
    savePosPrefs(prefs);
  }, [viewMode]);

  useEffect(() => {
    return () => {
      if (stockPreviewTimerRef.current) clearTimeout(stockPreviewTimerRef.current);
    };
  }, []);

  /** Ícone PDV no dock (mobile) abre o carrinho quando já estamos no PDV */
  useEffect(() => {
    if (!isMobileViewport) return;
    const openCart = () => setCartSheetOpen(true);
    window.addEventListener('makira:pos-open-cart', openCart);
    return () => window.removeEventListener('makira:pos-open-cart', openCart);
  }, [isMobileViewport]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const el = e.target as HTMLElement;
      const inField = el.closest('input, textarea, select, [contenteditable=true]');
      if (inField && el !== barcodeInputRef.current) return;
      if (e.key === '/' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault();
        barcodeInputRef.current?.focus();
        barcodeInputRef.current?.select();
      }
      if (e.key === 'Escape' && document.activeElement === barcodeInputRef.current) {
        setSearch('');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  const skuLookup = useMemo(() => {
    const m = new Map<string, Product>();
    for (const p of products) {
      m.set(p.sku.toLowerCase(), p);
    }
    return m;
  }, [products]);

  const bumpRecent = useCallback((productId: string) => {
    recordRecentProduct(productId);
    setRecentProductIds(loadRecentProductIds());
  }, []);

  const flashStockPreview = useCallback((product: Product, qtyInCartAfter: number) => {
    const st = parseFloat(product.stock);
    const remaining = Math.max(0, Number((st - qtyInCartAfter).toFixed(4)));
    setStockPreview({ productId: product.id, remaining, unit: product.unit });
    if (stockPreviewTimerRef.current) clearTimeout(stockPreviewTimerRef.current);
    stockPreviewTimerRef.current = setTimeout(() => setStockPreview(null), 4200);
  }, []);

  const processBarcode = (barcode: string) => {
    const code = barcode.trim();
    if (!code) return;
    const product = skuLookup.get(code.toLowerCase()) ?? products.find((p) => p.sku === code);
    if (product) {
      handleAddProduct(product);
      setSearch('');
    } else {
      toast({ variant: 'destructive', title: 'Item não encontrado', description: `Código ${code} não existe no cadastro.` });
    }
  };

  const filteredProducts = useMemo(() => {
    const norm = normalizeForSearch(search);
    const tokens = norm.split(/\s+/).filter(Boolean);
    return products.filter((p) => {
      const nameN = normalizeForSearch(p.name);
      const skuN = normalizeForSearch(p.sku);
      const matchesSearch =
        tokens.length === 0 || tokens.every((t) => nameN.includes(t) || skuN.includes(t));
      const matchesCategory = selectedCategory === 'all' || p.categoryId === selectedCategory;
      return matchesSearch && matchesCategory;
    });
  }, [products, search, selectedCategory]);

  /** Com stock mas em ou abaixo do mínimo — destaque no PDV e contagem compacta */
  const lowStockLineCount = useMemo(
    () =>
      products.filter((p) => {
        const s = parseFloat(p.stock);
        const m = parseFloat(p.minStock);
        return s > 0 && s <= m;
      }).length,
    [products],
  );

  const recentProducts = useMemo(() => {
    const map = new Map(products.map((p) => [p.id, p]));
    return recentProductIds.map((id) => map.get(id)).filter((p): p is Product => Boolean(p));
  }, [products, recentProductIds]);

  const listScrollRef = useRef<HTMLDivElement>(null);
  const useListVirtual = viewMode === 'list' && filteredProducts.length >= POS_LIST_VIRTUAL_MIN;
  const rowVirtualizer = useVirtualizer({
    count: useListVirtual ? filteredProducts.length : 0,
    getScrollElement: () => listScrollRef.current,
    estimateSize: () => 70,
    overscan: 14,
  });

  const subtotal = cart.reduce((acc, item) => acc + (item.priceAtSale * item.quantity), 0);
  
  let discountAmount = 0;
  if (activeDiscount.type === 'percentage') {
    discountAmount = subtotal * (activeDiscount.value / 100);
  } else if (activeDiscount.type === 'fixed') {
    discountAmount = activeDiscount.value;
  }

  const [amountReceived, setAmountReceived] = useState(0);
  
  const cartTotal = Math.max(0, subtotal - discountAmount);
  const change = Math.max(0, amountReceived - cartTotal);

  const handleApplyDiscount = () => {
    setActiveDiscount({ type: discountType, value: discountValue });
    setDiscountOpen(false);
  };
  
  const openCheckout = useCallback(() => {
    setAmountReceived(0);
    setCartSheetOpen(false);
    setPaymentOpen(true);
  }, []);

  const handleQuantityChange = (productId: string, change: number) => {
    const item = cart.find((i) => i.productId === productId);
    if (!item) return;

    const product = products.find((p) => p.id === productId);
    if (!product) return;

    let step = 1;
    if (product.unit === 'kg') step = 0.1;

    const newQuantity = Math.max(0, Number((item.quantity + change * step).toFixed(3)));
    const parsedStock = parseFloat(product.stock);

    if (newQuantity <= 0) {
      removeFromCart(productId);
      return;
    }

    if (newQuantity > parsedStock + 1e-9) {
      toast({
        variant: 'destructive',
        title: 'Stock insuficiente',
        description: `Máximo ${parsedStock} ${product.unit} disponível.`,
      });
      return;
    }

    updateCartQuantity(productId, newQuantity, parsedStock);
    if (change > 0) flashStockPreview(product, newQuantity);
  };

  const handleAddProduct = (product: Product) => {
    if (product.unit === 'kg') {
      setSelectedWeightProduct(product);
      setWeightInGrams(0);
      setWeightOpen(true);
    } else {
      try {
        const prevQty = cart.find((i) => i.productId === product.id)?.quantity ?? 0;
        addToCart(product, 1);
        bumpRecent(product.id);
        const after = prevQty + 1;
        const left = Math.max(0, parseFloat(product.stock) - after);
        flashStockPreview(product, after);
        toast({
          title: 'Adicionado',
          description: `Ficam ${formatStockRemaining(product.unit, left)} ${product.unit} no armazém após concluir a venda.`,
        });
      } catch (error: any) {
        toast({ 
          title: "Erro", 
          description: error.message,
          variant: "destructive"
        });
      }
    }
  };

  const confirmWeightAdd = () => {
    if (selectedWeightProduct && weightInGrams > 0) {
      const quantityInKg = weightInGrams / 1000;
      try {
        const prevQty = cart.find((i) => i.productId === selectedWeightProduct.id)?.quantity ?? 0;
        addToCart(selectedWeightProduct, quantityInKg);
        bumpRecent(selectedWeightProduct.id);
        const after = prevQty + quantityInKg;
        const left = Math.max(0, parseFloat(selectedWeightProduct.stock) - after);
        flashStockPreview(selectedWeightProduct, after);
        toast({
          title: 'Adicionado',
          description: `${weightInGrams} g · ficam ${formatStockRemaining('kg', left)} kg no armazém após a venda.`,
        });
        setWeightOpen(false);
        setSelectedWeightProduct(null);
        setWeightInGrams(0);
      } catch (error: any) {
        toast({ 
          title: "Erro", 
          description: error.message,
          variant: "destructive"
        });
      }
    }
  };

  const listRowInner = (product: Product) => {
    const parsedStock = parseFloat(product.stock);
    const parsedMin = parseFloat(product.minStock);
    const parsedPrice = parseFloat(product.price);
    const cartItem = cart.find((i) => i.productId === product.id);
    const inCartQty = cartItem?.quantity ?? 0;
    const disponivel = Math.max(0, Number((parsedStock - inCartQty).toFixed(4)));
    const qty = cartItem ? cartItem.quantity.toFixed(product.unit === 'kg' ? 1 : 0) : '0';
    const isLowStock = parsedStock > 0 && parsedStock <= parsedMin;
    const showPreview = stockPreview?.productId === product.id;
    return (
      <div
        className={cn(
          'flex min-h-[56px] w-full items-stretch overflow-hidden rounded-xl border bg-white shadow-sm transition-all',
          parsedStock <= 0 && 'pointer-events-none border-gray-100 opacity-50',
          parsedStock > 0 && cartItem && 'border-[#B71C1C]/20 bg-[#B71C1C]/5 ring-1 ring-[#B71C1C]/15',
          parsedStock > 0 && !cartItem && isLowStock && 'border-amber-200 bg-amber-50/60',
          parsedStock > 0 && !cartItem && !isLowStock && 'border-gray-200 hover:border-gray-300',
        )}
        data-testid={`card-product-${product.id}`}
      >
        <div
          className={cn(
            'w-1 shrink-0 self-stretch',
            cartItem && 'bg-[#B71C1C]',
            !cartItem && isLowStock && 'bg-amber-400',
            !cartItem && !isLowStock && 'bg-transparent',
          )}
        />
        <div className="relative m-1.5 flex aspect-square w-9 shrink-0 items-center justify-center self-center overflow-hidden rounded-lg border border-gray-200 bg-gray-50">
          {product.image ? (
            <img src={product.image} alt={product.name} className="h-full w-full object-cover" />
          ) : (
            <span className="text-sm font-bold text-gray-600">{product.name.charAt(0).toUpperCase()}</span>
          )}
          {parsedStock <= 0 && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/60">
              <span className="text-center text-[7px] font-bold leading-tight text-white">Esgotado</span>
            </div>
          )}
        </div>
        <div className="flex min-w-0 flex-1 flex-col justify-end overflow-hidden pb-2 pr-1 pt-1">
          <p className="max-w-[120px] truncate text-xs font-semibold leading-tight text-gray-800">{product.name}</p>
          <div className="mt-0.5 flex items-center gap-1">
            <span className="text-xs font-bold text-[#CC2936]">{formatCurrency(parsedPrice)}</span>
            <span className="shrink-0 text-[9px] text-gray-400">/{product.unit}</span>
            {product.unit === 'kg' && <Scale className="h-2.5 w-2.5 shrink-0 text-accent" />}
          </div>
          {isLowStock && parsedStock > 0 && (
            <p className="mt-0.5 text-[9px] font-bold uppercase tracking-wide text-amber-800 dark:text-amber-200">
              Stock baixo
            </p>
          )}
          {showPreview && parsedStock > 0 && (
            <motion.p
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              className="mt-1 text-[10px] font-bold tabular-nums text-primary"
            >
              Ficam {formatStockRemaining(product.unit, stockPreview!.remaining)} {product.unit} no armazém
            </motion.p>
          )}
        </div>
        <div className="flex w-[72px] shrink-0 flex-col items-center gap-0.5 self-center pr-2" onClick={(e) => e.stopPropagation()}>
          <div className="flex w-full items-center justify-end gap-1">
            {cartItem && (
              <>
                <button
                  type="button"
                  className="flex h-7 w-7 items-center justify-center rounded-full bg-[#B71C1C] transition-colors active:scale-95"
                  onClick={() => handleQuantityChange(product.id, -1)}
                  data-testid={`button-decrease-list-${product.id}`}
                >
                  <Minus className="h-3 w-3 text-white" />
                </button>
                <span className="w-5 text-center text-xs font-bold tabular-nums text-primary">{qty}</span>
              </>
            )}
            <button
              type="button"
              className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#B71C1C] text-white shadow-sm transition-all hover:bg-[#C62828] active:scale-95 disabled:opacity-40"
              onClick={(e) => {
                e.stopPropagation();
                if (disponivel > 0) handleAddProduct(product);
              }}
              disabled={disponivel <= 0}
              data-testid={`button-add-${product.id}`}
            >
              <Plus className="h-3 w-3 text-white" />
            </button>
          </div>
          <span className="w-full text-center text-[9px] font-semibold tabular-nums text-gray-400">
            Disp.:{formatStockRemaining(product.unit, disponivel)}
          </span>
        </div>
      </div>
    );
  };

  const handleCheckout = (method: 'cash' | 'card' | 'pix' | 'mpesa' | 'emola' | 'pos' | 'bank') => {
    if (cart.length === 0 || !user) return;
    if (method === 'cash' && amountReceived < cartTotal) {
      toast({ title: "Erro", description: "Valor insuficiente para completar a venda", variant: "destructive" });
      return;
    }
    setSelectedPaymentMethod(method);
    setShowPreviewConfirm(true);
  };

  const handleConfirmPreview = () => {
    setShowPreviewConfirm(false);
    confirmSale();
  };

  const confirmSale = () => {
    if (cart.length === 0 || !user || !selectedPaymentMethod) return;

    for (const item of cart) {
      const p = products.find((x) => x.id === item.productId);
      if (!p) continue;
      const st = parseFloat(p.stock);
      if (item.quantity > st + 1e-9) {
        toast({
          variant: 'destructive',
          title: 'Stock desactualizado',
          description: `${p.name}: pedido ${item.quantity} ${p.unit}, disponível ${st}. Actualize a lista e ajuste o carrinho.`,
        });
        return;
      }
    }

    createSaleMutation.mutate({
      userId: user.id,
      total: cartTotal.toString(),
      amountReceived: amountReceived > 0 ? amountReceived.toString() : undefined,
      change: change > 0 ? change.toString() : undefined,
      paymentMethod: selectedPaymentMethod,
      items: cart.map(item => ({
        productId: item.productId,
        quantity: item.quantity,
        priceAtSale: item.priceAtSale
      })),
      preview: {
        items: cart.map(item => {
          const product = products.find(p => p.id === item.productId);
          return {
            productId: item.productId,
            quantity: item.quantity,
            priceAtSale: item.priceAtSale,
            productName: product?.name || '',
            productUnit: product?.unit || ''
          };
        }),
        subtotal,
        discount: activeDiscount,
        discountAmount,
        total: cartTotal,
        paymentMethod: selectedPaymentMethod,
        amountReceived: amountReceived > 0 ? amountReceived : undefined,
        change: change > 0 ? change : undefined
      }
    });
    setConfirmOpen(false);
    setSelectedPaymentMethod(null);
  };

  if (productsLoading || categoriesLoading) {
    return (
      <div className="flex min-h-[50vh] flex-1 items-center justify-center py-16">
        <div className="space-y-4 text-center">
          <div className="mx-auto h-12 w-12 animate-spin rounded-2xl border-2 border-primary border-t-transparent" />
          <p className="text-sm font-semibold text-muted-foreground">A carregar produtos…</p>
        </div>
      </div>
    );
  }

  const mobileFloatingCartPad =
    isMobileViewport && cart.length > 0 && !cartSheetOpen
      ? 'pb-[calc(6.75rem+env(safe-area-inset-bottom,0px))]'
      : '';

  return (
    <div
      className={cn(
        'flex min-h-0 flex-1 flex-col gap-3 p-2 pb-2 lg:max-h-[calc(100dvh-5.5rem)] lg:flex-row lg:gap-5 lg:p-1',
        mobileFloatingCartPad,
      )}
    >
      <InvoicePreviewDialog open={invoiceOpen} onOpenChange={setInvoiceOpen} data={invoiceData} />
      {/* MOBILE: modo venda / carrinho — segmento com animação */}
      <div className="shrink-0 lg:hidden">
        <div className="relative mb-3 flex h-[3.25rem] rounded-[1.35rem] border border-border/80 bg-muted/40 p-1 shadow-inner">
          <motion.div
            className="pointer-events-none absolute inset-y-1 rounded-[1.05rem] bg-gradient-to-r from-[#B71C1C] to-[#1A1A2E] shadow-md shadow-[#B71C1C]/20"
            style={{ width: 'calc(50% - 0.375rem)' }}
            initial={false}
            animate={{
              left: cartSheetOpen ? 'calc(50% + 0.125rem)' : '0.25rem',
            }}
            transition={{ type: 'spring', stiffness: 420, damping: 34 }}
          />
          <button
            type="button"
            className={cn(
              'relative z-10 flex flex-1 items-center justify-center gap-2 rounded-[1.05rem] text-sm font-bold transition-colors',
              cartSheetOpen ? 'text-muted-foreground' : 'text-primary-foreground',
            )}
            onClick={() => setCartSheetOpen(false)}
            data-testid="button-tab-produtos"
          >
            <ShoppingBag className="h-4 w-4" />
            Vender
          </button>
          <button
            type="button"
            className={cn(
              'relative z-10 flex flex-1 items-center justify-center gap-2 rounded-[1.05rem] text-sm font-bold transition-colors',
              cartSheetOpen ? 'text-primary-foreground' : 'text-muted-foreground',
            )}
            onClick={() => setCartSheetOpen(true)}
            data-testid="button-tab-carrinho"
          >
            <ShoppingCart className="h-4 w-4" />
            Carrinho
            {cart.length > 0 && (
              <motion.span
                layout
                className={cn(
                  'flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[11px] font-black tabular-nums',
                  cartSheetOpen ? 'bg-white/25' : 'bg-primary/15 text-primary',
                )}
              >
                {cart.length}
              </motion.span>
            )}
          </button>
        </div>
      </div>

      {/* Barra flutuante arrastável — acima do dock (z acima do conteúdo, abaixo do sheet) */}
      <AnimatePresence>
        {cart.length > 0 && !cartSheetOpen && (
          <div
            className="pointer-events-none fixed inset-x-0 z-[42] flex justify-center px-3 lg:hidden"
            style={{ bottom: 'calc(5.5rem + env(safe-area-inset-bottom, 0px))' }}
          >
            <motion.div
              initial={{ opacity: 0, y: 28, scale: 0.94 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 380, damping: 28 }}
              drag
              dragMomentum={false}
              dragElastic={0.12}
              dragConstraints={{ left: -120, right: 120, top: -100, bottom: 80 }}
              className="pointer-events-auto w-full max-w-md cursor-grab active:cursor-grabbing"
              data-testid="wrapper-floating-cart"
            >
              <div className="flex flex-col gap-1 rounded-[1.35rem] border border-white/25 bg-gradient-to-r from-[#B71C1C] via-[#1A1A2E] to-[#1B3A5C] p-1.5 text-primary-foreground shadow-[0_20px_50px_-14px_rgba(183,28,28,0.4)] ring-2 ring-white/20">
                <div
                  className="flex flex-col items-center gap-0.5 rounded-xl bg-white/10 py-1.5"
                  title="Arraste para o lado se estiver a tapar um produto"
                >
                  <GripHorizontal className="h-5 w-5 opacity-90" strokeWidth={2.5} />
                  <span className="text-[0.6rem] font-bold uppercase tracking-widest text-white/90">Arrastar</span>
                </div>
                <button
                  type="button"
                  onPointerDown={(e) => e.stopPropagation()}
                  onClick={() => setCartSheetOpen(true)}
                  className="flex w-full items-center gap-3 rounded-2xl bg-black/10 px-3 py-2.5 text-left transition active:scale-[0.99]"
                  data-testid="button-floating-cart"
                >
                  <span className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/20 text-base font-black ring-2 ring-white/35">
                    {cart.length}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[0.65rem] font-bold uppercase tracking-[0.18em] text-white/90">Carrinho</p>
                    <p className="font-heading text-lg font-bold tabular-nums leading-tight">{formatCurrency(cartTotal)}</p>
                    <p className="truncate text-[11px] font-medium text-white/80">Toque para abrir · arraste a zona acima</p>
                  </div>
                  <span className="flex shrink-0 items-center gap-1 rounded-xl bg-white/15 px-2.5 py-2 text-xs font-bold ring-1 ring-white/25">
                    Abrir
                    <ArrowRight className="h-3.5 w-3.5" />
                  </span>
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* MOBILE: carrinho em sheet (bottom) */}
      <Sheet open={cartSheetOpen} onOpenChange={setCartSheetOpen}>
        <SheetContent
          side="bottom"
          className="flex h-[min(90dvh,720px)] max-h-[720px] flex-col gap-0 overflow-hidden rounded-t-[2rem] border-0 border-t border-border/60 bg-card p-0 shadow-[0_-20px_60px_-20px_rgba(15,23,42,0.2)] lg:hidden"
        >
          <div className="mx-auto mt-2 h-1 w-12 shrink-0 rounded-full bg-muted-foreground/25" aria-hidden />
          <div className="relative shrink-0 overflow-hidden bg-gradient-to-br from-[#B71C1C] via-[#1A1A2E] to-[#1B3A5C] px-5 pb-7 pt-4 text-primary-foreground">
            <div className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-white/15 blur-2xl" />
            <SheetHeader className="space-y-1 text-left">
              <SheetTitle className="font-heading text-2xl font-bold tracking-tight text-white">
                Carrinho de venda
              </SheetTitle>
              <SheetDescription className="text-sm font-medium text-white/85">
                {cart.length} {cart.length === 1 ? 'linha' : 'linhas'} · deslize para rever tudo
              </SheetDescription>
            </SheetHeader>
            <div className="mt-5 rounded-2xl border border-white/25 bg-white/15 p-4 backdrop-blur-md">
              <div className="flex items-end justify-between gap-2">
                <div>
                  <p className="text-[0.65rem] font-bold uppercase tracking-[0.2em] text-white/80">Total a pagar</p>
                  <p className="font-heading text-3xl font-bold tabular-nums">{formatCurrency(cartTotal)}</p>
                </div>
                {activeDiscount.type !== 'none' && (
                  <span className="rounded-lg bg-white/20 px-2 py-1 text-xs font-bold">−{formatCurrency(discountAmount)}</span>
                )}
              </div>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
            {cart.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center text-muted-foreground">
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
                  <ShoppingBag className="h-8 w-8 opacity-50" />
                </div>
                <p className="font-semibold text-foreground">Ainda sem itens</p>
                <p className="mt-1 max-w-[240px] text-sm">Volte a «Vender» e toque em + nos produtos.</p>
                <Button className="mt-6 rounded-xl" variant="default" onClick={() => setCartSheetOpen(false)}>
                  Adicionar produtos
                </Button>
              </div>
            ) : (
              <ul className="space-y-3">
                <AnimatePresence initial={false} mode="popLayout">
                {cart.map((item, idx) => {
                  const product = products.find((p) => p.id === item.productId);
                  if (!product) return null;
                  return (
                    <motion.li
                      key={item.productId}
                      layout
                      initial={{ opacity: 0, y: 16, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, x: -24, transition: { duration: 0.2 } }}
                      transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                      className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-[0_12px_40px_-24px_hsl(239_40%_30%/0.2)]"
                    >
                      <div className="flex gap-3 p-3">
                        <div className="relative shrink-0">
                          <span className="absolute -left-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-[#B71C1C] to-[#1B3A5C] text-[11px] font-black text-primary-foreground shadow-md">
                            {idx + 1}
                          </span>
                          <div className="h-[4.5rem] w-[4.5rem] overflow-hidden rounded-xl border border-border bg-muted">
                            {product.image ? (
                              <img src={product.image} alt="" className="h-full w-full object-cover" />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center bg-gradient-to-br from-primary/15 to-accent/15 text-lg font-bold text-primary">
                                {product.name.charAt(0).toUpperCase()}
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="min-w-0 flex-1">
                          <h4 className="line-clamp-2 text-sm font-bold leading-tight text-foreground">{product.name}</h4>
                          <p className="mt-1 text-xs text-muted-foreground">
                            {formatCurrency(item.priceAtSale)} / {product.unit}
                          </p>
                          <p className="mt-1 text-base font-bold text-primary">
                            {formatCurrency(item.priceAtSale * item.quantity)}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 border-t border-border/60 bg-muted/25 px-3 py-2.5">
                        <button
                          type="button"
                          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-destructive/10 text-destructive transition active:scale-95"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleQuantityChange(item.productId, -1);
                          }}
                          data-testid={`button-decrease-mobile-${item.productId}`}
                        >
                          <Minus className="h-5 w-5" strokeWidth={2.5} />
                        </button>
                        <Input
                          type="number"
                          step={product.unit === 'kg' ? '0.1' : '1'}
                          value={item.quantity.toFixed(product.unit === 'kg' ? 1 : 0)}
                          onChange={(e) => {
                            const newQty = parseFloat(e.target.value) || 0;
                            if (newQty > 0) {
                              updateCartQuantity(item.productId, newQty, parseFloat(product.stock));
                              if (newQty <= parseFloat(product.stock)) {
                                flashStockPreview(product, newQty);
                              }
                            }
                          }}
                          className="h-11 flex-1 border-border bg-background text-center text-lg font-bold tabular-nums"
                          data-testid={`input-quantity-${item.productId}`}
                        />
                        <button
                          type="button"
                          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground shadow-md shadow-[#B71C1C]/25 transition active:scale-95"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleQuantityChange(item.productId, 1);
                          }}
                          data-testid={`button-increase-mobile-${item.productId}`}
                        >
                          <Plus className="h-5 w-5" strokeWidth={2.5} />
                        </button>
                        <button
                          type="button"
                          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-destructive/30 text-destructive transition active:scale-95"
                          onClick={(e) => {
                            e.stopPropagation();
                            removeFromCart(item.productId);
                          }}
                          data-testid={`button-remove-mobile-${item.productId}`}
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </motion.li>
                  );
                })}
                </AnimatePresence>
              </ul>
            )}
          </div>

          <div className="shrink-0 space-y-3 border-t border-border bg-muted/20 px-4 py-4">
            {cart.length > 0 && (
              <div className="space-y-1.5 text-sm">
                <div className="flex justify-between text-muted-foreground">
                  <span>Subtotal</span>
                  <span className="font-medium text-foreground">{formatCurrency(subtotal)}</span>
                </div>
                {activeDiscount.type !== 'none' && (
                  <div className="flex justify-between font-medium text-primary">
                    <span>Desconto</span>
                    <span>−{formatCurrency(discountAmount)}</span>
                  </div>
                )}
              </div>
            )}
            <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" className="h-12 rounded-xl font-semibold" onClick={() => clearCart()} data-testid="button-clear-mobile">
                <Trash2 className="mr-2 h-4 w-4" /> Limpar
              </Button>
              <Button
                className="h-12 rounded-xl border-0 bg-gradient-to-r from-[#B71C1C] to-[#1B3A5C] font-bold text-primary-foreground shadow-lg disabled:opacity-50"
                disabled={cart.length === 0}
                onClick={() => openCheckout()}
                data-testid="button-checkout-mobile"
              >
                Finalizar <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        </SheetContent>
      </Sheet>

      {/* Produtos — grelha / lista */}
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm lg:rounded-3xl">
        {/* Header vermelho — PDV */}
        <div className="shrink-0 bg-[#B71C1C] px-4 py-3">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <ShoppingCart className="h-5 w-5 text-white" strokeWidth={2.5} />
              <h2 className="text-base font-extrabold tracking-tight text-white">
                PDV <span className="font-medium opacity-80">- Ponto de Venda</span>
              </h2>
            </div>
            <div className="flex shrink-0 gap-1 rounded-xl border border-white/20 bg-white/10 p-0.5">
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  'h-8 rounded-lg px-3 text-xs font-bold transition-all',
                  viewMode === 'list' ? 'bg-white text-[#CC2936] shadow-sm' : 'text-white hover:bg-white/15',
                )}
                onClick={() => setViewMode('list')}
                data-testid="button-view-list"
              >
                <List className="mr-1.5 h-3.5 w-3.5" />
                Lista
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className={cn(
                  'h-8 rounded-lg px-3 text-xs font-bold transition-all',
                  viewMode === 'grid' ? 'bg-white text-[#CC2936] shadow-sm' : 'text-white hover:bg-white/15',
                )}
                onClick={() => setViewMode('grid')}
                data-testid="button-view-grid"
              >
                <LayoutGrid className="mr-1.5 h-3.5 w-3.5" />
                Grade
              </Button>
            </div>
          </div>
        </div>

        <div className="sticky top-0 z-30 border-b border-gray-100 bg-white px-4 pb-3 pt-3 lg:static lg:z-0">
          {/* Search */}
          <div className="relative">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" strokeWidth={2.5} />
            <Input
              placeholder="Nome, SKU ou código de barras..."
              className="h-10 rounded-xl border-gray-200 bg-gray-50 pl-10 pr-28 text-sm font-medium placeholder:text-gray-400 focus-visible:border-[#B71C1C]/40 focus-visible:ring-[#B71C1C]/15"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              ref={barcodeInputRef}
              data-testid="input-search-products"
            />
            {/* Inline count */}
            <div className="pointer-events-none absolute right-3.5 top-1/2 -translate-y-1/2 flex items-center gap-1 text-[11px] tabular-nums">
              {productsFetching && !productsLoading ? (
                <Sparkles className="h-3 w-3 animate-pulse text-[#CC2936]" />
              ) : null}
              <span className="font-semibold text-gray-600">{filteredProducts.length}</span>
              <span className="text-gray-300">/</span>
              <span className="text-gray-400">{products.length}</span>
              {lowStockLineCount > 0 ? (
                <span className="ml-1 rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold text-amber-700">
                  {lowStockLineCount}↓
                </span>
              ) : null}
            </div>
          </div>

          {/* Scanner buttons */}
          <div className={cn('mt-2.5 flex items-center gap-2', isMobileViewport && 'flex-col')}>
            <button
              type="button"
              className={cn(
                'flex items-center gap-2 rounded-lg border border-[#B71C1C] bg-[#B71C1C] px-3.5 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-[#C62828] active:scale-[0.98]',
                isMobileViewport ? 'w-full justify-center py-3' : '',
              )}
              onClick={() => setCameraScanOpen(true)}
            >
              <Camera className="h-4 w-4" />
              {isMobileViewport ? 'Ler código — câmera' : 'Câmera'}
            </button>
            {!isMobileViewport && (
              <button
                type="button"
                className={cn(
                  'flex items-center gap-2 rounded-lg border px-3.5 py-2 text-xs font-semibold shadow-sm transition active:scale-[0.98]',
                  scannerToken
                    ? 'border-[#B71C1C] bg-[#B71C1C]/8 text-[#B71C1C] hover:bg-[#B71C1C]/15'
                    : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50',
                )}
                onClick={async () => {
                  if (scannerToken) {
                    setRemoteScannerOpen(true);
                    return;
                  }
                  try {
                    const { token, url } = await scannerApi.start();
                    setScannerToken(token);
                    setScannerUrl(url);
                    setRemoteScannerOpen(true);
                    scannerApi.sessions().then(setScannerSessions).catch(() => setScannerSessions([]));
                  } catch {
                    toast({ variant: 'destructive', title: 'Erro', description: 'Não foi possível gerar o link' });
                  }
                }}
              >
                <Smartphone className="h-4 w-4" />
                {scannerToken ? 'Scanner remoto' : 'Outro telemóvel'}
              </button>
            )}
            {/* Hint pill */}
            <div className="ml-auto hidden items-center gap-1.5 text-[11px] text-gray-400 sm:flex">
              <kbd className="rounded border border-gray-200 bg-gray-100 px-1.5 py-px font-mono text-[10px] font-semibold text-gray-500">
                /
              </kbd>
              <span>foca a pesquisa</span>
            </div>
          </div>

          {!isMobileViewport && recentProducts.length > 0 && (
            <div className="mt-2.5 rounded-lg border border-gray-100 bg-gray-50 px-3 py-2">
              <p className="mb-1.5 flex items-center gap-1.5 text-[0.62rem] font-bold uppercase tracking-[0.16em] text-gray-400">
                <History className="h-3 w-3" />
                Recentes
              </p>
              <div className="flex gap-1.5 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {recentProducts.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    className="max-w-[9rem] shrink-0 truncate rounded-lg border border-gray-200 bg-white px-2.5 py-1.5 text-left text-[11px] font-semibold text-gray-700 shadow-sm transition hover:border-[#B71C1C]/30 hover:bg-[#B71C1C]/5 hover:text-[#B71C1C]"
                    onClick={() => handleAddProduct(p)}
                  >
                    {p.name}
                  </button>
                ))}
              </div>
            </div>
          )}


          <div className="mt-2.5 flex gap-1.5 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <button
              type="button"
              className={cn(
                'h-8 shrink-0 rounded-lg px-3.5 text-[11px] font-bold tracking-wide transition-all',
                selectedCategory === 'all'
                  ? 'bg-[#B71C1C] text-white shadow-sm'
                  : 'border border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50',
              )}
              onClick={() => setSelectedCategory('all')}
              data-testid="button-category-all"
            >
              Todos
            </button>
            {categories.map((cat) => (
              <button
                key={cat.id}
                type="button"
                className={cn(
                  'h-8 shrink-0 whitespace-nowrap rounded-lg px-3.5 text-[11px] font-bold tracking-wide transition-all',
                  selectedCategory === cat.id
                    ? 'bg-[#B71C1C] text-white shadow-sm'
                    : 'border border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50',
                )}
                onClick={() => setSelectedCategory(cat.id)}
                data-testid={`button-category-${cat.id}`}
              >
                {cat.name}
              </button>
            ))}
          </div>
        </div>

        <div ref={listScrollRef} className="flex min-h-0 flex-1 flex-col overflow-hidden">
          <div
            className={cn(
              'flex-1 overflow-y-auto overscroll-contain p-1.5 lg:p-4',
              isMobileViewport && cart.length > 0 && !cartSheetOpen
                ? 'pb-[calc(7.25rem+env(safe-area-inset-bottom,0px))]'
                : '',
            )}
          >
            {viewMode === 'list' ? (
              useListVirtual ? (
                <div className="relative w-full" style={{ height: rowVirtualizer.getTotalSize() }}>
                  {rowVirtualizer.getVirtualItems().map((vi) => {
                    const product = filteredProducts[vi.index];
                    return (
                      <div
                        key={vi.key}
                        className="absolute left-0 top-0 w-full"
                        style={{ transform: `translateY(${vi.start}px)` }}
                      >
                        <div className="pb-1.5">{listRowInner(product)}</div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-1.5">
                  {filteredProducts.map((product) => (
                    <div key={product.id}>{listRowInner(product)}</div>
                  ))}
                </div>
              )
            ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 lg:gap-4">
              {filteredProducts.map(product => {
                const parsedStock = parseFloat(product.stock);
                const parsedMinStock = parseFloat(product.minStock);
                const parsedPrice = parseFloat(product.price);
                const cartItem = cart.find(i => i.productId === product.id);
                const inCart = cartItem?.quantity ?? 0;
                const disponivel = Math.max(0, Number((parsedStock - inCart).toFixed(4)));
                const isLowStock = parsedStock > 0 && parsedStock <= parsedMinStock;

                return (
                    <Card
                      key={product.id}
                      className={cn(
                        'group rounded-xl transition-all',
                        parsedStock <= 0 && 'pointer-events-none opacity-50',
                        cartItem && 'border-primary shadow-md ring-2 ring-primary/20',
                        !cartItem && parsedStock > 0 && isLowStock && 'border-amber-400/80 bg-amber-50/40 dark:border-amber-700/60 dark:bg-amber-950/25',
                        !cartItem && parsedStock > 0 && !isLowStock && 'cursor-pointer hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-lg',
                        !cartItem && parsedStock > 0 && isLowStock && 'cursor-pointer hover:-translate-y-0.5 hover:border-amber-500/60 hover:shadow-md',
                      )}
                      onClick={() => !cartItem && disponivel > 0 && handleAddProduct(product)}
                      data-testid={`card-product-${product.id}`}
                    >
                      <CardContent className="p-2 lg:p-3 space-y-2">
                        <div className="relative aspect-square overflow-hidden rounded-xl border border-primary/15 bg-gradient-to-br from-primary/10 to-accent/10">
                          {product.image ? (
                            <img src={product.image} alt={product.name} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center bg-primary/5 text-4xl font-bold text-primary lg:text-5xl">
                              {product.name.charAt(0).toUpperCase()}
                            </div>
                          )}
                          {cartItem && (
                            <div className="absolute inset-0 flex items-end justify-center bg-primary/10 pb-2">
                              <div className="rounded-full bg-gradient-to-r from-[#B71C1C] to-[#1B3A5C] px-2 py-0.5 text-xs font-bold text-primary-foreground">
                                {cartItem.quantity.toFixed(product.unit === 'kg' ? 1 : 0)} {product.unit}
                              </div>
                            </div>
                          )}
                          {parsedStock <= parsedMinStock && parsedStock > 0 && (
                            <Badge className="absolute top-2 right-2 text-[10px] px-1.5 h-5 bg-amber-600 hover:bg-amber-700">Pouco</Badge>
                          )}
                          {parsedStock <= 0 && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                              <span className="text-white font-bold text-sm">Sem Estoque</span>
                            </div>
                          )}
                          {product.unit === 'kg' && (
                            <Badge variant="secondary" className="absolute bottom-2 left-2 text-[10px] bg-white/90 backdrop-blur text-foreground border-none shadow-sm">
                              <Scale className="h-3 w-3 mr-1" /> Pesável
                            </Badge>
                          )}
                        </div>
                        <div>
                          <h3 className="font-bold text-xs lg:text-sm leading-tight line-clamp-2 text-gray-800">{product.name}</h3>
                          <div className="flex items-center justify-between mt-2">
                            <span className="text-sm font-bold text-primary lg:text-base">{formatCurrency(parsedPrice)}</span>
                            <Badge variant="outline" className="text-[10px]">{product.unit}</Badge>
                          </div>
                          {cartItem ? (
                            <>
                              <div className="flex items-center justify-between mt-2 gap-1" onClick={(e) => e.stopPropagation()}>
                                <button
                                  type="button"
                                  className="flex h-7 flex-1 items-center justify-center rounded-lg bg-destructive/90 text-destructive-foreground transition-colors hover:bg-destructive"
                                  onClick={() => handleQuantityChange(product.id, -1)}
                                >
                                  <Minus className="h-3 w-3 text-white" />
                                </button>
                                <span className="flex-1 text-center text-xs font-bold text-primary">
                                  {cartItem.quantity.toFixed(product.unit === 'kg' ? 1 : 0)}
                                </span>
                                <button
                                  type="button"
                                  className="flex h-7 flex-1 items-center justify-center rounded-lg bg-primary text-primary-foreground transition-colors hover:brightness-110 disabled:opacity-40"
                                  onClick={() => handleQuantityChange(product.id, 1)}
                                  disabled={disponivel <= 0}
                                >
                                  <Plus className="h-3 w-3 text-white" />
                                </button>
                              </div>
                              <p className="mt-1 text-center text-[9px] font-semibold tabular-nums text-muted-foreground">
                                Disp.: {formatStockRemaining(product.unit, disponivel)}
                              </p>
                            </>
                          ) : (
                            <div className="mt-1 text-[10px] font-semibold tabular-nums text-muted-foreground">
                              Disp.: {formatStockRemaining(product.unit, disponivel)}
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                );
              })}
            </div>
            )}
          </div>
        </div>
      </div>

      <div className="hidden h-full w-full flex-col overflow-hidden rounded-3xl border border-border bg-card shadow-[0_24px_60px_-40px_hsl(172_50%_30%/0.2)] lg:flex lg:w-[400px] xl:w-[420px]">
        <div className="relative shrink-0 overflow-hidden border-b border-white/10 bg-gradient-to-br from-[#B71C1C] via-[#1A1A2E] to-[#1B3A5C] px-4 py-4 text-primary-foreground">
          <div className="pointer-events-none absolute -right-8 -top-8 h-24 w-24 rounded-full bg-white/10 blur-2xl" />
          <h2 className="font-heading flex items-center gap-2 text-lg font-bold tracking-tight">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/25">
              <ShoppingCart className="h-5 w-5" />
            </span>
            Carrinho
          </h2>
          <p className="mt-1 text-sm font-medium text-white/85" data-testid="text-cart-count">
            {cart.length} {cart.length === 1 ? 'linha' : 'linhas'} · {formatCurrency(cartTotal)}
          </p>
        </div>

        <ScrollArea className="min-h-0 flex-1 p-3">
          {cart.length === 0 ? (
            <div className="flex h-full min-h-[200px] flex-col items-center justify-center gap-3 px-4 py-12 text-center text-muted-foreground">
              <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted">
                <ShoppingBag className="h-8 w-8 opacity-40" />
              </div>
              <p className="font-semibold text-foreground">Pronto para vender</p>
              <p className="text-xs leading-relaxed">Clique nos produtos à esquerda ou use o scanner.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {cart.map((item) => {
                const product = products.find((p) => p.id === item.productId);
                if (!product) return null;
                return (
                  <div
                    key={item.productId}
                    className="flex gap-3 rounded-2xl border border-border/90 bg-gradient-to-br from-card to-muted/20 p-3 shadow-sm transition hover:border-primary/25 hover:shadow-md"
                    data-testid={`cart-item-${item.productId}`}
                  >
                    <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-xl border border-border bg-muted">
                      {product.image ? (
                        <img src={product.image} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <span className="text-lg font-bold text-primary">{product.name.charAt(0).toUpperCase()}</span>
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h4 className="truncate text-sm font-bold text-foreground">{product.name}</h4>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        <span className="font-semibold text-primary">{formatCurrency(item.priceAtSale)}</span> ×{' '}
                        {item.quantity.toFixed(product.unit === 'kg' ? 3 : 0)}
                        {product.unit}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1">
                        <button
                          type="button"
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-background hover:bg-muted"
                          onClick={() => handleQuantityChange(item.productId, -1)}
                          data-testid={`button-decrease-${item.productId}`}
                        >
                          <Minus className="h-3.5 w-3.5 text-destructive" />
                        </button>
                        <span className="flex h-8 min-w-8 items-center justify-center rounded-lg border border-border bg-muted/50 px-2 text-xs font-bold tabular-nums">
                          {item.quantity.toFixed(product.unit === 'kg' ? 3 : 0)}
                        </span>
                        <button
                          type="button"
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-background hover:bg-muted"
                          onClick={() => handleQuantityChange(item.productId, 1)}
                          data-testid={`button-increase-${item.productId}`}
                        >
                          <Plus className="h-3.5 w-3.5 text-primary" />
                        </button>
                        <button
                          type="button"
                          className="flex h-8 w-8 items-center justify-center rounded-lg border border-destructive/25 text-destructive hover:bg-destructive/10"
                          onClick={() => removeFromCart(item.productId)}
                          data-testid={`button-remove-${item.productId}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-bold text-primary">{formatCurrency(item.priceAtSale * item.quantity)}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>

        <div className="shrink-0 space-y-4 border-t border-border bg-muted/15 p-4">
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Subtotal</span>
              <span data-testid="text-subtotal">{formatCurrency(subtotal)}</span>
            </div>
            <div className="flex justify-between text-sm items-center">
              <span className="text-muted-foreground flex items-center gap-2">
                Descontos
                {canApplyDiscount && cart.length > 0 && (
                  <Dialog open={discountOpen} onOpenChange={setDiscountOpen}>
                    <DialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-5 w-5 text-primary" data-testid="button-open-discount">
                        <Plus className="h-3 w-3" />
                      </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-sm">
                      <DialogHeader>
                        <DialogTitle>Aplicar Desconto</DialogTitle>
                        <DialogDescription>Defina o valor ou porcentagem.</DialogDescription>
                      </DialogHeader>
                      <div className="grid gap-4 py-4">
                        <div className="flex gap-2">
                          <Button 
                            variant={discountType === 'percentage' ? 'default' : 'outline'} 
                            className="flex-1"
                            onClick={() => setDiscountType('percentage')}
                            data-testid="button-discount-percentage"
                          >
                            <Percent className="h-4 w-4 mr-2" /> % Porcentagem
                          </Button>
                          <Button 
                            variant={discountType === 'fixed' ? 'default' : 'outline'} 
                            className="flex-1"
                            onClick={() => setDiscountType('fixed')}
                            data-testid="button-discount-fixed"
                          >
                            <Banknote className="h-4 w-4 mr-2" /> MT Fixo
                          </Button>
                        </div>
                        <div className="grid gap-2">
                          <Label>Valor do Desconto</Label>
                          <Input 
                            type="number" 
                            value={discountValue} 
                            onChange={(e) => setDiscountValue(Number(e.target.value))}
                            data-testid="input-discount-value"
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button onClick={handleApplyDiscount} data-testid="button-apply-discount">Aplicar</Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                )}
              </span>
              <span className="text-green-600" data-testid="text-discount">-{formatCurrency(discountAmount)}</span>
            </div>
            <div className="flex justify-between text-xl font-bold text-primary pt-2 border-t border-border">
              <span>Total</span>
              <span data-testid="text-total">{formatCurrency(cartTotal)}</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
             <Button 
              variant="outline" 
              className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
              onClick={() => clearCart()}
              disabled={cart.length === 0}
              data-testid="button-clear-cart"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Limpar
            </Button>
            <Button 
              className="w-full font-bold shadow-md shadow-[#B71C1C]/20" 
              disabled={cart.length === 0}
              onClick={openCheckout}
              data-testid="button-checkout"
            >
              Finalizar
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      <Dialog open={weightOpen} onOpenChange={setWeightOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle>Informar Peso (Gramas)</DialogTitle>
            <DialogDescription>
              Produto: {selectedWeightProduct?.name} ({formatCurrency(parseFloat(selectedWeightProduct?.price || '0'))}/kg)
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="flex items-center justify-center gap-2">
              <Button variant="outline" onClick={() => setWeightInGrams(100)} data-testid="button-weight-100">100g</Button>
              <Button variant="outline" onClick={() => setWeightInGrams(250)} data-testid="button-weight-250">250g</Button>
              <Button variant="outline" onClick={() => setWeightInGrams(500)} data-testid="button-weight-500">500g</Button>
              <Button variant="outline" onClick={() => setWeightInGrams(1000)} data-testid="button-weight-1000">1kg</Button>
            </div>
            <div className="grid gap-2">
              <Label>Peso Manual (g)</Label>
              <div className="relative">
                <Input 
                  type="number" 
                  value={weightInGrams} 
                  onChange={(e) => setWeightInGrams(Number(e.target.value))}
                  className="pr-8"
                  data-testid="input-weight-grams"
                />
                <span className="absolute right-3 top-2.5 text-sm text-muted-foreground">g</span>
              </div>
            </div>
            <div className="bg-muted/30 p-3 rounded text-center">
              <p className="text-sm text-muted-foreground">Preço calculado</p>
              <p className="text-xl font-bold text-primary">
                {formatCurrency(((parseFloat(selectedWeightProduct?.price || '0')) * weightInGrams) / 1000)}
              </p>
            </div>
          </div>
          <DialogFooter>
             <Button variant="outline" onClick={() => setWeightOpen(false)} data-testid="button-cancel-weight">Cancelar</Button>
             <Button onClick={confirmWeightAdd} disabled={weightInGrams <= 0} data-testid="button-confirm-weight">Confirmar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmação final — recibo mental */}
      <Dialog open={showPreviewConfirm} onOpenChange={setShowPreviewConfirm}>
        <DialogContent className="max-h-[min(90dvh,640px)] overflow-y-auto rounded-2xl border-0 p-0 sm:max-w-lg">
          <div className="bg-gradient-to-br from-[#B71C1C] via-[#1A1A2E] to-[#1B3A5C] px-6 pb-6 pt-6 text-primary-foreground">
            <DialogHeader className="space-y-1 text-left">
              <DialogTitle className="font-heading text-xl font-bold text-white">Confirmar venda</DialogTitle>
              <DialogDescription className="text-sm text-white/85">
                Última verificação antes de registar no sistema
              </DialogDescription>
            </DialogHeader>
            <div className="mt-4 rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur-md">
              <p className="text-[0.65rem] font-bold uppercase tracking-wider text-white/75">Total</p>
              <p className="font-heading text-3xl font-bold tabular-nums">{formatCurrency(cartTotal)}</p>
            </div>
          </div>
          <div className="space-y-4 px-6 py-5">
            <div className="rounded-2xl border border-border bg-muted/20 p-4">
              <h4 className="mb-3 flex items-center gap-2 text-xs font-bold uppercase tracking-wide text-muted-foreground">
                <ShoppingBag className="h-4 w-4 text-primary" />
                Itens ({cart.length})
              </h4>
              <div className="max-h-40 space-y-2 overflow-y-auto pr-1">
                {cart.map((item, idx) => {
                  const product = products.find((p) => p.id === item.productId);
                  return (
                    <div
                      key={idx}
                      className="flex items-center justify-between gap-2 rounded-xl border border-border/60 bg-card px-3 py-2 text-sm"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold">{product?.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {item.quantity.toFixed(product?.unit === 'kg' ? 3 : 0)} {product?.unit} × {formatCurrency(item.priceAtSale)}
                        </p>
                      </div>
                      <span className="shrink-0 font-bold text-primary">{formatCurrency(item.quantity * item.priceAtSale)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="space-y-2 rounded-2xl border border-border bg-card p-4 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Subtotal</span>
                <span className="font-medium">{formatCurrency(subtotal)}</span>
              </div>
              {activeDiscount.type !== 'none' && (
                <div className="flex justify-between font-medium text-primary">
                  <span>Desconto</span>
                  <span>−{formatCurrency(discountAmount)}</span>
                </div>
              )}
              <div className="flex justify-between border-t border-border pt-2 text-base font-bold">
                <span>A pagar</span>
                <span className="text-primary">{formatCurrency(cartTotal)}</span>
              </div>
            </div>
            <div className="rounded-2xl border border-dashed border-primary/25 bg-primary/5 p-4">
              <p className="text-xs font-bold uppercase tracking-wide text-primary">Pagamento</p>
              <p className="mt-1 text-lg font-bold capitalize text-foreground">{selectedPaymentMethod?.replace('-', ' ')}</p>
              {selectedPaymentMethod === 'cash' && (
                <div className="mt-3 space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Recebido</span>
                    <span className="font-semibold">{formatCurrency(amountReceived)}</span>
                  </div>
                  <div className={`flex justify-between font-bold ${change >= 0 ? 'text-primary' : 'text-destructive'}`}>
                    <span>Troco</span>
                    <span>{formatCurrency(change)}</span>
                  </div>
                </div>
              )}
            </div>
          </div>
          <DialogFooter className="flex-col gap-2 border-t border-border bg-muted/10 px-6 py-4 sm:flex-row">
            <Button variant="outline" className="h-12 w-full rounded-xl font-semibold" onClick={() => setShowPreviewConfirm(false)}>
              Ajustar
            </Button>
            <Button
              onClick={handleConfirmPreview}
              className="h-12 w-full rounded-xl border-0 bg-gradient-to-r from-[#B71C1C] to-[#1B3A5C] font-bold text-primary-foreground shadow-lg"
            >
              <Check className="mr-2 h-4 w-4" />
              Confirmar e registar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={paymentOpen} onOpenChange={setPaymentOpen}>
        <DialogContent className="max-h-[min(94dvh,780px)] overflow-y-auto rounded-2xl border-0 p-0 sm:max-w-2xl">
          <div className="relative overflow-hidden bg-gradient-to-br from-[#B71C1C] via-[#1A1A2E] to-[#1B3A5C] px-6 pb-8 pt-6 text-primary-foreground">
            <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
            <DialogHeader className="relative space-y-1 text-left">
              <DialogTitle className="font-heading text-2xl font-bold tracking-tight text-white">Finalizar venda</DialogTitle>
              <DialogDescription className="text-sm font-medium text-white/85">
                Revise linhas, valor recebido e escolha como pagou
              </DialogDescription>
            </DialogHeader>
            <div className="relative mt-5 grid grid-cols-2 gap-3 rounded-2xl border border-white/20 bg-white/10 p-4 backdrop-blur-md">
              <div>
                <p className="text-[0.65rem] font-bold uppercase tracking-wider text-white/75">Linhas</p>
                <p className="text-2xl font-bold">{cart.length}</p>
              </div>
              <div className="text-right">
                <p className="text-[0.65rem] font-bold uppercase tracking-wider text-white/75">Total</p>
                <p className="font-heading text-2xl font-bold tabular-nums">{formatCurrency(cartTotal)}</p>
              </div>
            </div>
          </div>

          <div className="grid gap-6 px-6 py-6 md:grid-cols-2">
            <div className="space-y-4">
              <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-sm">
                <div className="flex items-center gap-2 border-b border-border bg-muted/30 px-4 py-3">
                  <ShoppingBag className="h-4 w-4 text-primary" />
                  <h4 className="text-xs font-bold uppercase tracking-wide text-muted-foreground">Artigos</h4>
                </div>
                <div className="max-h-[200px] divide-y divide-border overflow-y-auto md:max-h-[260px]">
                  {cart.map((item, idx) => {
                    const product = products.find((p) => p.id === item.productId);
                    return (
                      <div key={idx} className="flex items-center gap-3 px-3 py-2.5">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-primary/15 bg-primary/10 text-xs font-bold text-primary">
                          {product?.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-xs font-semibold text-foreground">{product?.name}</p>
                          <p className="text-[10px] text-muted-foreground">
                            {item.quantity.toFixed(product?.unit === 'kg' ? 1 : 0)}
                            {product?.unit} × {formatCurrency(item.priceAtSale)}
                          </p>
                        </div>
                        <span className="shrink-0 text-sm font-bold text-primary">
                          {formatCurrency(item.quantity * item.priceAtSale)}
                        </span>
                        <button
                          type="button"
                          className="shrink-0 rounded-lg p-1.5 text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => removeFromCart(item.productId)}
                          data-testid={`button-remove-checkout-${item.productId}`}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="rounded-2xl border-2 border-primary/15 bg-gradient-to-br from-primary/5 to-accent/5 p-4">
                <Label className="text-sm font-bold text-foreground">Valor recebido (dinheiro)</Label>
                <div className="relative mt-2">
                  <Input
                    type="number"
                    className="h-12 rounded-xl border-border pr-12 text-right text-lg font-bold tabular-nums"
                    value={amountReceived === 0 ? '' : amountReceived}
                    onChange={(e) => setAmountReceived(Number(e.target.value))}
                    placeholder="0"
                    data-testid="input-amount-received"
                  />
                  <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold text-muted-foreground">
                    MT
                  </span>
                </div>
                {amountReceived > 0 && (
                  <div className="mt-3 flex items-center justify-between border-t border-border/60 pt-3">
                    <span className="text-sm font-bold text-muted-foreground">Troco</span>
                    <span
                      className={`text-xl font-bold tabular-nums ${change < 0 ? 'text-destructive' : 'text-primary'}`}
                      data-testid="text-change"
                    >
                      {formatCurrency(change)}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="space-y-3">
              <p className="text-center text-xs font-bold uppercase tracking-[0.15em] text-muted-foreground">Método de pagamento</p>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-2">
                <Button
                  variant="outline"
                  className="flex flex-col h-16 md:h-20 gap-1 text-xs md:text-sm hover:border-primary hover:bg-primary/5 hover:text-primary transition-all"
                  onClick={() => handleCheckout('cash')}
                  disabled={amountReceived < cartTotal && amountReceived > 0}
                  data-testid="button-payment-cash"
                >
                  <Banknote className="h-4 w-4 md:h-5 md:w-5" />
                  Dinheiro
                </Button>
                <Button
                  variant="outline"
                  className="flex flex-col h-16 md:h-20 gap-1 text-xs md:text-sm hover:border-primary hover:bg-primary/5 hover:text-primary transition-all"
                  onClick={() => handleCheckout('card')}
                  data-testid="button-payment-card"
                >
                  <CreditCard className="h-4 w-4 md:h-5 md:w-5" />
                  Cartão (POS)
                </Button>
                <Button
                  variant="outline"
                  className="flex flex-col h-16 md:h-20 gap-1 text-xs md:text-sm hover:border-primary hover:bg-primary/5 hover:text-primary transition-all"
                  onClick={() => handleCheckout('pix')}
                  data-testid="button-payment-pix"
                >
                  <QrCode className="h-4 w-4 md:h-5 md:w-5" />
                  M-Pesa
                </Button>
                <Button
                  variant="outline"
                  className="flex flex-col h-16 md:h-20 gap-1 text-xs md:text-sm hover:border-primary hover:bg-primary/5 hover:text-primary transition-all"
                  onClick={() => handleCheckout('emola')}
                  data-testid="button-payment-emola"
                >
                  <CreditCard className="h-4 w-4 md:h-5 md:w-5" />
                  e-Mola
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Remote scanner poller - corre em background mesmo com dialog fechado */}
      {scannerToken && (
        <RemoteScannerPoller
          token={scannerToken}
          onBarcode={processBarcode}
          onClose={() => {
            setRemoteScannerOpen(false);
            setScannerToken(null);
          }}
        />
      )}

      <RemoteScannerDialog
        open={remoteScannerOpen}
        onOpenChange={(o) => setRemoteScannerOpen(o)}
        token={scannerToken}
        url={scannerUrl}
        onTokenChange={(t, u) => { setScannerToken(t); setScannerUrl(u || ''); }}
        onSessionsChange={setScannerSessions}
      />

      {/* Scan com câmera — no telemóvel ocupa quase o ecrã */}
      <Dialog open={cameraScanOpen} onOpenChange={setCameraScanOpen}>
        <DialogContent
          className={cn(
            'max-h-[min(96dvh,920px)] gap-0 overflow-y-auto p-0 sm:max-w-lg sm:gap-4 sm:p-6',
            'max-md:fixed max-md:inset-x-0 max-md:bottom-0 max-md:top-[6dvh] max-md:h-auto max-md:max-h-[94dvh] max-md:w-full max-md:max-w-none max-md:translate-x-0 max-md:translate-y-0 max-md:rounded-t-[1.75rem] max-md:border-x-0 max-md:border-b-0',
          )}
          aria-describedby="camera-scan-desc"
        >
          <div className="max-md:bg-gradient-to-br max-md:from-[#B71C1C] max-md:via-[#1A1A2E] max-md:to-[#1B3A5C] max-md:px-5 max-md:pb-4 max-md:pt-5 max-md:text-primary-foreground sm:contents">
            <DialogHeader className="space-y-1 px-5 pt-4 text-left sm:space-y-1.5 sm:px-0 sm:pt-0 sm:text-left">
              <DialogTitle className="flex items-center gap-2 font-heading text-lg sm:text-xl">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/30 max-md:text-white sm:bg-primary/10 sm:text-primary sm:ring-primary/20">
                  <Camera className="h-5 w-5" />
                </span>
                <span className="max-md:text-white">Ler código de barras</span>
              </DialogTitle>
              <DialogDescription
                id="camera-scan-desc"
                className="text-sm max-md:text-white/85 sm:text-muted-foreground"
              >
                Escolha câmera traseira ou frontal, alinhe o código e capture.
              </DialogDescription>
            </DialogHeader>
          </div>
          <div className="px-4 pb-4 pt-2 sm:px-0 sm:pb-0 sm:pt-0">
            <BarcodeCameraScan
              id="pos-camera-scan"
              onScan={processBarcode}
              onClose={() => setCameraScanOpen(false)}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function formatTimeAgo(ms: number): string {
  const s = Math.floor(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}min`;
  const h = Math.floor(m / 60);
  return `${h}h ${m % 60}min`;
}

function formatDeviceLabel(s: ScannerSessionInfo): string {
  const dt = s.deviceType === 'mobile' ? 'Celular' : s.deviceType === 'desktop' ? 'Computador' : 'Dispositivo';
  const ua = s.userAgent && s.userAgent.length > 0
    ? (s.userAgent.length > 40 ? s.userAgent.slice(0, 40) + '…' : s.userAgent)
    : 'N/A';
  return `${dt} • ${ua}`;
}

function RemoteScannerDialog({
  open,
  onOpenChange,
  token,
  url,
  onTokenChange,
  onSessionsChange,
}: {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  token: string | null;
  url: string;
  onTokenChange: (t: string | null, u: string) => void;
  onSessionsChange: (s: ScannerSessionInfo[]) => void;
}) {
  const [sessions, setSessions] = useState<ScannerSessionInfo[]>([]);
  const [renewing, setRenewing] = useState(false);
  const [revoking, setRevoking] = useState<string | null>(null);
  const [baseUrl, setBaseUrl] = useState<string | null>(null);
  /** PDV no telemóvel: partilhar para “outro” telemóvel não faz sentido */
  const isMobileViewport = useMediaQuery('(max-width: 767px)');

  useEffect(() => {
    if (open) {
      networkApi.getLocalAccess().then((r) => setBaseUrl(r.baseUrl)).catch(() => setBaseUrl(null));
    }
  }, [open]);

  const loadSessions = () => {
    scannerApi.sessions()
      .then((list) => { setSessions(list); onSessionsChange(list); })
      .catch(() => { setSessions([]); });
  };

  useEffect(() => {
    if (open) loadSessions();
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const t = setInterval(loadSessions, 5000);
    return () => clearInterval(t);
  }, [open]);

  const handleRenew = async () => {
    if (!token) return;
    setRenewing(true);
    try {
      const { token: t, url: u } = await scannerApi.renew(token);
      onTokenChange(t, u);
      toast({
        title: 'Link renovado',
        description: 'A validade foi reposta: mais 7 dias a partir de agora.',
      });
      loadSessions();
    } catch (e) {
      toast({ variant: 'destructive', title: 'Erro', description: e instanceof Error ? e.message : 'Não foi possível renovar' });
    } finally {
      setRenewing(false);
    }
  };

  const handleRevoke = async (t: string) => {
    setRevoking(t);
    try {
      await scannerApi.revoke(t);
      toast({ title: 'Sessão revogada' });
      if (t === token) onTokenChange(null, '');
      loadSessions();
    } catch (e) {
      toast({ variant: 'destructive', title: 'Erro', description: e instanceof Error ? e.message : 'Não foi possível revogar' });
    } finally {
      setRevoking(null);
    }
  };

  const handleNewLink = async () => {
    try {
      const { token: newToken, url: newUrl } = await scannerApi.start();
      onTokenChange(newToken, newUrl);
      loadSessions();
      toast({ title: 'Novo link gerado' });
    } catch (e) {
      toast({ variant: 'destructive', title: 'Erro', description: e instanceof Error ? e.message : 'Não foi possível gerar link' });
    }
  };

  const handleShareLink = async () => {
    if (!url) return;
    try {
      if (navigator.share) {
        await navigator.share({
          title: 'Makira — Scanner remoto',
          text: 'Abra no telemóvel para ler códigos de barras no PDV.',
          url,
        });
        toast({ title: 'Partilhado', description: 'Escolha a app no telemóvel.' });
        return;
      }
    } catch (e) {
      if ((e as Error).name === 'AbortError') return;
    }
    try {
      await navigator.clipboard.writeText(url);
      toast({ title: 'Link copiado', description: 'Cole no navegador do telemóvel.' });
    } catch {
      toast({ variant: 'destructive', title: 'Não foi possível copiar' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="mx-auto flex max-h-[min(92dvh,720px)] w-full max-w-md flex-col overflow-hidden rounded-[1.75rem] border-0 p-0 sm:max-w-lg"
        aria-describedby="remote-scanner-desc"
      >
        <div className="relative shrink-0 overflow-hidden bg-gradient-to-br from-[#B71C1C] via-[#1A1A2E] to-[#1B3A5C] px-5 pb-6 pt-5 text-primary-foreground">
          <div className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-white/10 blur-3xl" />
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/30">
              <QrCode className="h-6 w-6" strokeWidth={2.25} />
            </div>
            <div>
              <DialogTitle className="font-heading text-xl font-bold tracking-tight text-white">
                Scanner no telemóvel
              </DialogTitle>
              <DialogDescription id="remote-scanner-desc" className="mt-1 text-sm font-medium text-white/85">
                Aponte a câmara para os códigos — entram no carrinho deste PDV.
              </DialogDescription>
            </div>
          </div>
          {baseUrl && (
            <p className="mt-4 rounded-xl bg-black/15 px-3 py-2 text-[0.7rem] text-white/90">
              Servidor: <span className="font-mono text-white">{baseUrl}</span>
            </p>
          )}
        </div>

        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
          {token && url ? (
            <div className="space-y-4">
              {url.startsWith('http://') && (
                <div className="flex gap-2 rounded-xl border border-amber-200/80 bg-amber-50 px-3 py-2.5 dark:border-amber-800 dark:bg-amber-950/30">
                  <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                  <p className="text-xs leading-relaxed text-amber-900 dark:text-amber-200">
                    A câmara no telemóvel precisa de <strong>HTTPS</strong>. Use{' '}
                    <code className="rounded bg-amber-100 px-1 font-mono dark:bg-amber-900">HTTPS=1</code> no .env e reinicie.
                  </p>
                </div>
              )}

              <Tabs defaultValue="qr" className="w-full">
                <TabsList className="grid h-11 w-full grid-cols-2 rounded-xl bg-muted/80 p-1">
                  <TabsTrigger value="qr" className="rounded-lg font-semibold data-[state=active]:bg-card data-[state=active]:shadow-sm">
                    <QrCode className="mr-2 h-4 w-4" />
                    QR Code
                  </TabsTrigger>
                  <TabsTrigger value="link" className="rounded-lg font-semibold data-[state=active]:bg-card data-[state=active]:shadow-sm">
                    Link
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="qr" className="mt-4 space-y-3 outline-none">
                  <p className="text-center text-xs font-medium text-muted-foreground">
                    Leia com a câmara do telemóvel ou app de QR
                  </p>
                  <div className="relative mx-auto w-fit">
                    <div
                      className="absolute -inset-1 rounded-[1.35rem] bg-gradient-to-br from-primary via-accent to-[hsl(262_72%_58%)] opacity-90 blur-[2px]"
                      aria-hidden
                    />
                    <div className="relative rounded-3xl bg-white p-4 shadow-xl">
                      <QRCode
                        value={url}
                        size={200}
                        level="M"
                        fgColor="#1A1A2E"
                        bgColor="#ffffff"
                        style={{ height: 'auto', maxWidth: '100%', width: '100%' }}
                      />
                    </div>
                  </div>
                  <div className={cn('flex flex-col gap-2', !isMobileViewport && 'sm:flex-row')}>
                    {!isMobileViewport && (
                      <Button
                        type="button"
                        className="h-11 flex-1 rounded-xl border-0 bg-gradient-to-r from-[#B71C1C] to-[#1B3A5C] font-bold text-primary-foreground shadow-md"
                        onClick={handleShareLink}
                      >
                        <Share2 className="mr-2 h-4 w-4" />
                        Partilhar link
                      </Button>
                    )}
                    <Button
                      type="button"
                      variant={isMobileViewport ? 'default' : 'outline'}
                      className={cn(
                        'h-11 rounded-xl font-semibold',
                        isMobileViewport
                          ? 'border-0 bg-gradient-to-r from-[#B71C1C] to-[#1B3A5C] font-bold text-primary-foreground shadow-md'
                          : 'flex-1',
                      )}
                      onClick={() => {
                        navigator.clipboard.writeText(url);
                        toast({ title: 'Link copiado' });
                      }}
                    >
                      Copiar URL
                    </Button>
                  </div>
                </TabsContent>
                <TabsContent value="link" className="mt-4 space-y-3 outline-none">
                  <div className="rounded-2xl border border-border bg-muted/40 p-3">
                    <p className="text-[0.65rem] font-bold uppercase tracking-wider text-muted-foreground">Endereço completo</p>
                    <div
                      className="mt-2 max-h-24 overflow-auto rounded-xl border border-border bg-background p-3"
                      style={{ WebkitOverflowScrolling: 'touch' }}
                    >
                      <p className="break-all font-mono text-[11px] leading-relaxed text-foreground">{url}</p>
                    </div>
                  </div>
                  <div className={cn('flex flex-col gap-2', !isMobileViewport && 'sm:flex-row')}>
                    <Button
                      type="button"
                      variant="default"
                      className={cn(
                        'h-11 rounded-xl font-bold',
                        !isMobileViewport && 'flex-1',
                        isMobileViewport &&
                          'border-0 bg-gradient-to-r from-[#B71C1C] to-[#1B3A5C] text-primary-foreground shadow-md',
                      )}
                      onClick={() => {
                        navigator.clipboard.writeText(url);
                        toast({ title: 'Link copiado!' });
                      }}
                    >
                      Copiar link
                    </Button>
                    {!isMobileViewport && (
                      <Button type="button" variant="outline" className="h-11 flex-1 rounded-xl font-semibold" onClick={handleShareLink}>
                        <Share2 className="mr-2 h-4 w-4" />
                        Partilhar…
                      </Button>
                    )}
                  </div>
                </TabsContent>
              </Tabs>

              <div className="grid grid-cols-2 gap-2">
                <Button variant="secondary" className="h-11 rounded-xl font-semibold" onClick={handleRenew} disabled={renewing}>
                  <RefreshCw className={cn('mr-2 h-4 w-4', renewing && 'animate-spin')} />
                  Renovar (7 dias)
                </Button>
                <Button
                  variant="outline"
                  className="h-11 rounded-xl border-destructive/35 font-semibold text-destructive hover:bg-destructive/10"
                  onClick={() => {
                    handleRevoke(token);
                    onOpenChange(false);
                  }}
                >
                  <Trash2 className="mr-2 h-4 w-4" />
                  Desligar
                </Button>
              </div>
            </div>
          ) : (
            <Button
              onClick={handleNewLink}
              className="h-12 w-full rounded-2xl border-0 bg-gradient-to-r from-[#B71C1C] via-[#1A1A2E] to-[#1B3A5C] text-base font-bold text-primary-foreground shadow-lg"
            >
              <Smartphone className="mr-2 h-5 w-5" />
              Gerar sessão e QR
            </Button>
          )}

          <div className="mt-6 border-t border-border pt-4">
            <div className="mb-2 flex items-center justify-between">
              <p className="text-sm font-bold text-foreground">Sessões ativas</p>
              {sessions.length > 0 && (
                <span className="rounded-full bg-primary/15 px-2.5 py-0.5 text-xs font-bold text-primary">{sessions.length}</span>
              )}
            </div>
            {sessions.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border py-8 text-center text-muted-foreground">
                <Monitor className="mx-auto mb-2 h-9 w-9 opacity-35" />
                <p className="text-xs">Nenhum telemóvel ligado ainda.</p>
              </div>
            ) : (
              <div className="max-h-40 divide-y overflow-y-auto rounded-2xl border border-border">
                {sessions.map((s) => (
                  <div key={s.token} className="flex items-center justify-between gap-3 bg-muted/20 px-3 py-2.5">
                    <div className="min-w-0 flex items-center gap-2">
                      {s.deviceType === 'mobile' ? (
                        <Smartphone className="h-4 w-4 shrink-0 text-primary" />
                      ) : (
                        <Monitor className="h-4 w-4 shrink-0 text-accent" />
                      )}
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium">{formatDeviceLabel(s)}</p>
                        <p className="text-xs text-muted-foreground">Há {formatTimeAgo(Date.now() - s.lastAccess)}</p>
                      </div>
                    </div>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 shrink-0 text-destructive hover:bg-destructive/10"
                      onClick={() => handleRevoke(s.token)}
                      disabled={revoking === s.token}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <p className="mt-4 text-center text-[0.7rem] leading-relaxed text-muted-foreground">
            O link expira após 7 dias sem renovar. Os códigos lidos no telemóvel entram neste PDV — revogue sessões que não
            reconhecer.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function RemoteScannerPoller({ token, onBarcode, onClose }: { token: string; onBarcode: (b: string) => void; onClose: () => void }) {
  useEffect(() => {
    const t = setInterval(async () => {
      try {
        const { barcodes } = await scannerApi.poll(token);
        barcodes.forEach(onBarcode);
      } catch {
        onClose();
      }
    }, 300);
    return () => clearInterval(t);
  }, [token, onBarcode, onClose]);
  return null;
}
