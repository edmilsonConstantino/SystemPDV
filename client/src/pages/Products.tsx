import { useAuth } from '@/lib/auth';
import { useState, useRef } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Search, Plus, FileDown, FileUp, AlertTriangle, Pencil, Trash2, AlertCircle, ArrowUp, Camera, Package, PackageX, TrendingDown, Clock } from 'lucide-react';
import { BarcodeCameraScan } from '@/components/BarcodeCameraScan';
import { formatCurrency } from '@/lib/utils';
import { Product, productsApi, categoriesApi, systemApi } from '@/lib/api';
import * as XLSX from 'xlsx';
import { toast } from '@/hooks/use-toast';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function Products() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState('');
  const [view, setView] = useState<'all' | 'out' | 'low' | 'recent'>('all');
  const [isAddOpen, setIsAddOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [newCategory, setNewCategory] = useState({ name: '', color: 'bg-blue-100 text-blue-800' });

  const { data: products = [], isLoading: productsLoading } = useQuery({
    queryKey: ['/api/products'],
    queryFn: productsApi.getAll
  });

  const { data: categories = [], isLoading: categoriesLoading } = useQuery({
    queryKey: ['/api/categories'],
    queryFn: categoriesApi.getAll
  });

  const { data: editCount } = useQuery({
    queryKey: ['/api/system/edit-count'],
    queryFn: systemApi.getEditCount
  });

  const [newProduct, setNewProduct] = useState({
    name: '',
    sku: '',
    barcode: '',
    price: '',
    costPrice: '',
    stock: '',
    unit: 'un' as 'un' | 'kg' | 'g' | 'pack' | 'box',
    categoryId: '',
    minStock: '5',
    image: '',
  });

  const createProductMutation = useMutation({
    mutationFn: productsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/products'] });
      queryClient.invalidateQueries({ queryKey: ['/api/system/edit-count'] });
      setIsAddOpen(false);
      setNewProduct({ name: '', sku: '', barcode: '', price: '', costPrice: '', stock: '', unit: 'un', categoryId: '', minStock: '5', image: '' });
      toast({ title: "Sucesso", description: "Produto cadastrado!" });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Erro", 
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const updateProductMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => productsApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/products'] });
      queryClient.invalidateQueries({ queryKey: ['/api/system/edit-count'] });
      toast({ title: "Sucesso", description: "Produto atualizado!" });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Erro", 
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const deleteProductMutation = useMutation({
    mutationFn: productsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/products'] });
      toast({ title: "Sucesso", description: "Produto deletado!" });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Erro", 
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const [increaseStockOpen, setIncreaseStockOpen] = useState(false);
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [increaseQuantity, setIncreaseQuantity] = useState('');
  const [increasePrice, setIncreasePrice] = useState('');
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [barcodeScanOpen, setBarcodeScanOpen] = useState<'add' | 'edit' | null>(null);

  const increaseStockMutation = useMutation({
    mutationFn: ({ id, quantity, price }: { id: string; quantity: number; price?: number }) => 
      productsApi.increaseStock(id, quantity, price),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/products'] });
      setIncreaseStockOpen(false);
      setIncreaseQuantity('');
      setIncreasePrice('');
      toast({ title: "Sucesso", description: "Estoque e preço atualizados!" });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Erro", 
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const createCategoryMutation = useMutation({
    mutationFn: categoriesApi.create,
    onSuccess: (createdCategory) => {
      queryClient.invalidateQueries({ queryKey: ['/api/categories'] });
      setNewProduct({...newProduct, categoryId: createdCategory.id});
      setIsCategoryDialogOpen(false);
      setNewCategory({ name: '', color: 'bg-blue-100 text-blue-800' });
      toast({ title: "Sucesso", description: "Categoria criada!" });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Erro", 
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const searchText = search.trim().toLowerCase();

  const outOfStockCount = products.filter(p => parseFloat(p.stock) <= 0).length;
  const lowStockCount = products.filter(p => {
    const s = parseFloat(p.stock);
    const m = parseFloat(p.minStock);
    return s > 0 && s <= m;
  }).length;
  const recentlyEditedCount = products.filter(p => {
    const updated = new Date(p.updatedAt as any).getTime();
    return Number.isFinite(updated) && (Date.now() - updated) <= 24 * 60 * 60 * 1000;
  }).length;

  const filteredProducts = products
    .filter(p =>
      !searchText
        ? true
        : p.name.toLowerCase().includes(searchText) ||
          p.sku.toLowerCase().includes(searchText),
    )
    .filter(p => {
      if (view === 'all') return true;
      const s = parseFloat(p.stock);
      const m = parseFloat(p.minStock);
      if (view === 'out') return s <= 0;
      if (view === 'low') return s > 0 && s <= m;
      const updated = new Date(p.updatedAt as any).getTime();
      return Number.isFinite(updated) && (Date.now() - updated) <= 24 * 60 * 60 * 1000;
    });

  const handleExport = () => {
    const exportData = products.map(p => ({
      Nome: p.name,
      SKU: p.sku,
      Preço: parseFloat(p.price),
      Custo: parseFloat(p.costPrice),
      Estoque: parseFloat(p.stock),
      Minimo: parseFloat(p.minStock),
      Unidade: p.unit,
      Categoria: categories.find(c => c.id === p.categoryId)?.name || ''
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Produtos");
    XLSX.writeFile(wb, "produtos.xlsx");
    toast({ title: "Sucesso", description: "Produtos exportados com sucesso!" });
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  const handleImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (evt) => {
      const bstr = evt.target?.result;
      const wb = XLSX.read(bstr, { type: 'binary' });
      const wsname = wb.SheetNames[0];
      const ws = wb.Sheets[wsname];
      const data = XLSX.utils.sheet_to_json(ws) as any[];
      
      data.forEach((row: any) => {
        const categoryId = categories.find(c => c.name === row.Categoria)?.id || categories[0]?.id || null;
        
        createProductMutation.mutate({
          name: row.Nome || row.name || 'Produto Importado',
          sku: row.SKU || row.sku || `IMP-${Date.now()}`,
          price: String(row.Preço || row.price || 0),
          costPrice: String(row.Custo || row.costPrice || 0),
          stock: String(row.Estoque || row.stock || 0),
          minStock: String(row.Minimo || row.minStock || 5),
          unit: (row.Unidade || row.unit || 'un') as any,
          categoryId,
          image: ''
        });
      });

      toast({ title: "Sucesso", description: `Importando ${data.length} produtos...` });
    };
    reader.readAsBinaryString(file);
  };

  const handleSaveProduct = () => {
    if (!newProduct.name || !newProduct.price) {
      toast({ 
        title: "Erro", 
        description: "Nome e preço são obrigatórios",
        variant: "destructive"
      });
      return;
    }

    if (editCount && !editCount.canEdit) {
      toast({ 
        title: "Limite atingido", 
        description: `Você atingiu o limite de ${editCount.limit} edições diárias`,
        variant: "destructive"
      });
      return;
    }
    
    createProductMutation.mutate({
      name: newProduct.name,
      sku: newProduct.sku || newProduct.barcode || `SKU-${Date.now()}`,
      categoryId: newProduct.categoryId || categories[0]?.id || null,
      price: newProduct.price,
      costPrice: newProduct.costPrice || '0',
      stock: newProduct.stock || '0',
      minStock: newProduct.minStock || '5',
      unit: newProduct.unit,
      image: newProduct.image || ''
    });
  };

  const handleDeleteProduct = (id: string) => {
    if (confirm('Tem certeza que deseja deletar este produto?')) {
      deleteProductMutation.mutate(id);
    }
  };

  const handleEditProduct = (product: Product) => {
    setEditingProduct(product);
    setIsEditOpen(true);
  };

  const handleSaveEdit = () => {
    if (!editingProduct || !editingProduct.name || !editingProduct.price) {
      toast({ 
        title: "Erro", 
        description: "Nome e preço são obrigatórios",
        variant: "destructive"
      });
      return;
    }

    if (editCount && !editCount.canEdit) {
      toast({ 
        title: "Limite atingido", 
        description: `Você atingiu o limite de ${editCount.limit} edições diárias`,
        variant: "destructive"
      });
      return;
    }

    updateProductMutation.mutate({
      id: editingProduct.id,
      data: {
        name: editingProduct.name,
        sku: editingProduct.sku || (editingProduct as any).barcode || `SKU-${Date.now()}`,
        price: editingProduct.price,
        costPrice: editingProduct.costPrice,
        stock: editingProduct.stock,
        minStock: editingProduct.minStock,
        unit: editingProduct.unit,
        categoryId: editingProduct.categoryId,
        image: editingProduct.image
      }
    });
    setIsEditOpen(false);
  };

  if (productsLoading || categoriesLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <div className="animate-spin h-12 w-12 border-4 border-primary border-t-transparent rounded-full mx-auto"></div>
          <p className="text-muted-foreground">Carregando produtos...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">

      {/* ── CABEÇALHO ── */}
      <div className="overflow-hidden rounded-3xl shadow-sm">
        {/* Banner vermelho — padrão POS */}
        <div className="relative bg-[#B71C1C] px-4 py-4 sm:px-6 sm:py-5">
          <div className="banner-texture" />
          <div className="relative flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            {/* Título */}
            <div className="flex items-center gap-4">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/25">
                <Package className="h-5 w-5 text-white" strokeWidth={2.5} />
              </div>
              <div className="space-y-1">
                <div className="flex items-baseline gap-2">
                  <h1 className="text-xl font-extrabold tracking-tight text-white">Produtos</h1>
                  <span className="hidden text-sm font-normal text-white/50 sm:inline">Catálogo &amp; Inventário</span>
                </div>
                <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                  <span className="text-xs font-semibold text-white/70">
                    {products.length} produto{products.length !== 1 ? 's' : ''}
                  </span>
                  {outOfStockCount > 0 && (
                    <span className="flex items-center gap-1 text-xs font-semibold text-red-200">
                      <span className="h-1 w-1 rounded-full bg-red-300" />
                      {outOfStockCount} sem estoque
                    </span>
                  )}
                  {lowStockCount > 0 && (
                    <span className="flex items-center gap-1 text-xs font-semibold text-amber-200">
                      <span className="h-1 w-1 rounded-full bg-amber-300" />
                      {lowStockCount} abaixo do mínimo
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Acções */}
            <div className="flex flex-wrap items-center gap-2">
              <input type="file" ref={fileInputRef} onChange={handleImport} className="hidden" accept=".xlsx,.xls" title="Importar ficheiro Excel" aria-label="Importar ficheiro Excel" />
              <button
                type="button"
                onClick={handleImportClick}
                className="flex items-center gap-1.5 rounded-xl border border-white/25 bg-white/10 px-3.5 py-2 text-xs font-semibold text-white backdrop-blur-sm transition hover:bg-white/20"
                data-testid="button-import"
              >
                <FileUp className="h-3.5 w-3.5" />
                Importar
              </button>
              <button
                type="button"
                onClick={handleExport}
                className="flex items-center gap-1.5 rounded-xl border border-white/25 bg-white/10 px-3.5 py-2 text-xs font-semibold text-white backdrop-blur-sm transition hover:bg-white/20"
                data-testid="button-export"
              >
                <FileDown className="h-3.5 w-3.5" />
                Exportar
              </button>

          <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
            <DialogTrigger asChild>
              <button
                type="button"
                className="flex items-center gap-1.5 rounded-xl bg-white px-4 py-2 text-xs font-bold text-[#B71C1C] shadow-md shadow-black/20 transition hover:bg-gray-50 active:scale-[0.98]"
                data-testid="button-add-product"
              >
                <Plus className="h-3.5 w-3.5" />
                Novo Produto
              </button>
            </DialogTrigger>
            <DialogContent className="w-[calc(100%-2rem)] max-w-2xl overflow-hidden rounded-[2rem] border-none bg-white p-0 shadow-2xl">
              {/* Header */}
              <div className="relative overflow-hidden rounded-t-[2rem] bg-[#B71C1C] px-5 py-4 sm:px-6 sm:py-5">
                <div className="banner-texture" />
                <div className="relative flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/25">
                    <Package className="h-4 w-4 text-white" strokeWidth={2.5} />
                  </div>
                  <div>
                    <DialogTitle className="text-sm font-extrabold text-white sm:text-base">Novo Produto</DialogTitle>
                    <p className="text-[11px] text-white/60">Preencha os detalhes para registar no inventário.</p>
                  </div>
                </div>
              </div>

              {/* Body */}
              <div className="max-h-[65vh] space-y-5 overflow-y-auto px-5 py-4 sm:px-6 sm:py-5">

                {editCount && !editCount.canEdit && (
                  <Alert variant="destructive">
                    <AlertCircle className="h-4 w-4" />
                    <AlertDescription>
                      Você atingiu o limite de {editCount.limit} edições diárias. Você já fez {editCount.count} edições hoje.
                    </AlertDescription>
                  </Alert>
                )}

                {/* Seção: Identificação */}
                <section className="space-y-4">
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-1 rounded-full bg-[#B71C1C]" />
                    <h3 className="text-[0.65rem] font-bold uppercase tracking-wider text-gray-400">Informações Básicas</h3>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label className="ml-1 text-xs font-bold text-gray-600">Nome do Produto</Label>
                      <Input
                        className="h-11 rounded-xl border-gray-200 focus-visible:border-[#B71C1C]/40 focus-visible:ring-[#B71C1C]/15"
                        placeholder="Ex: Coca-Cola 2L"
                        value={newProduct.name}
                        onChange={e => setNewProduct({...newProduct, name: e.target.value})}
                        data-testid="input-product-name"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="ml-1 text-xs font-bold text-gray-600">Código (SKU)</Label>
                      <Input
                        className="h-11 rounded-xl border-gray-200 bg-gray-50/60 focus-visible:border-[#B71C1C]/40 focus-visible:ring-[#B71C1C]/15"
                        placeholder="Gerado automaticamente se vazio"
                        value={newProduct.sku}
                        onChange={e => setNewProduct({...newProduct, sku: e.target.value})}
                        data-testid="input-product-sku"
                      />
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="ml-1 text-xs font-bold text-gray-600">Código de Barras <span className="font-normal text-gray-400">(opcional)</span></Label>
                    <div className="flex gap-2">
                      <Input
                        className="h-11 flex-1 rounded-xl border-gray-200 focus-visible:border-[#B71C1C]/40 focus-visible:ring-[#B71C1C]/15"
                        placeholder="EAN-13, UPC — ou use o botão para escanear"
                        value={newProduct.barcode}
                        onChange={e => setNewProduct({...newProduct, barcode: e.target.value})}
                        data-testid="input-product-barcode"
                      />
                      <Button
                        type="button"
                        variant="outline"
                        className="h-11 w-11 shrink-0 rounded-xl border-gray-200 p-0 hover:border-[#B71C1C]/30 hover:bg-[#B71C1C]/5 hover:text-[#B71C1C]"
                        onClick={() => setBarcodeScanOpen('add')}
                        title="Escanear código de barras"
                      >
                        <Camera className="h-4 w-4" />
                      </Button>
                    </div>
                    <p className="ml-1 text-[11px] text-gray-400">SKU e barcode são ambos aceites no scanner — o sistema gera automaticamente se vazio.</p>
                  </div>
                </section>

                {/* Seção: Valores */}
                <section className="space-y-4">
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-1 rounded-full bg-[#B71C1C]" />
                    <h3 className="text-[0.65rem] font-bold uppercase tracking-wider text-gray-400">Valores e Quantidades</h3>
                  </div>

                  <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                    <div className="space-y-1.5">
                      <Label className="ml-1 text-xs font-bold text-[#B71C1C]">Preço Venda (MT)</Label>
                      <Input
                        type="number"
                        className="h-11 rounded-xl border-red-100 bg-red-50/40 text-base font-bold text-[#B71C1C] focus-visible:border-[#B71C1C]/50 focus-visible:ring-[#B71C1C]/20"
                        value={newProduct.price}
                        onChange={e => setNewProduct({...newProduct, price: e.target.value})}
                        data-testid="input-product-price"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="ml-1 text-xs font-bold text-gray-600">Preço Custo (MT)</Label>
                      <Input
                        type="number"
                        className="h-11 rounded-xl border-gray-200 focus-visible:border-[#B71C1C]/40 focus-visible:ring-[#B71C1C]/15"
                        value={newProduct.costPrice}
                        onChange={e => setNewProduct({...newProduct, costPrice: e.target.value})}
                        data-testid="input-product-cost"
                      />
                    </div>
                    <div className="col-span-2 space-y-1.5 sm:col-span-1">
                      <Label className="ml-1 text-xs font-bold text-gray-600">Unidade de Medida</Label>
                      <Select
                        value={newProduct.unit}
                        onValueChange={(val: any) => setNewProduct({...newProduct, unit: val})}
                      >
                        <SelectTrigger className="h-11 rounded-xl border-gray-200" data-testid="select-product-unit">
                          <SelectValue placeholder="Unidade" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="un">Unidade (un)</SelectItem>
                          <SelectItem value="kg">Quilograma (kg)</SelectItem>
                          <SelectItem value="g">Grama (g)</SelectItem>
                          <SelectItem value="pack">Pacote</SelectItem>
                          <SelectItem value="box">Caixa</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="ml-1 text-xs font-bold text-gray-600">Estoque Inicial</Label>
                      <Input
                        type="number"
                        className="h-11 rounded-xl border-gray-200 font-bold focus-visible:border-[#B71C1C]/40 focus-visible:ring-[#B71C1C]/15"
                        value={newProduct.stock}
                        onChange={e => setNewProduct({...newProduct, stock: e.target.value})}
                        data-testid="input-product-stock"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="ml-1 text-xs font-bold text-gray-600">Estoque Mínimo <span className="font-normal text-gray-400">(alerta)</span></Label>
                      <Input
                        type="number"
                        className="h-11 rounded-xl border-gray-200 focus-visible:border-[#B71C1C]/40 focus-visible:ring-[#B71C1C]/15"
                        value={newProduct.minStock}
                        onChange={e => setNewProduct({...newProduct, minStock: e.target.value})}
                        data-testid="input-product-minstock"
                      />
                    </div>
                  </div>
                </section>

                {/* Seção: Categoria e Imagem */}
                <section className="space-y-4">
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-1 rounded-full bg-[#B71C1C]" />
                    <h3 className="text-[0.65rem] font-bold uppercase tracking-wider text-gray-400">Categoria e Imagem</h3>
                  </div>

                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label className="ml-1 text-xs font-bold text-gray-600">Categoria</Label>
                      <div className="flex gap-2">
                        <Select
                          value={newProduct.categoryId}
                          onValueChange={(val) => setNewProduct({...newProduct, categoryId: val})}
                        >
                          <SelectTrigger className="h-11 flex-1 rounded-xl border-gray-200" data-testid="select-product-category">
                            <SelectValue placeholder="Selecione..." />
                          </SelectTrigger>
                          <SelectContent>
                            {categories.map(cat => (
                              <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Dialog open={isCategoryDialogOpen} onOpenChange={setIsCategoryDialogOpen}>
                          <DialogTrigger asChild>
                            <Button variant="outline" size="icon" type="button" className="h-11 w-11 shrink-0 rounded-xl border-gray-200 hover:border-[#B71C1C]/30 hover:bg-[#B71C1C]/5 hover:text-[#B71C1C]">
                              <Plus className="h-4 w-4" />
                            </Button>
                          </DialogTrigger>
                          <DialogContent className="sm:max-w-md">
                            <DialogHeader>
                              <DialogTitle>Nova Categoria</DialogTitle>
                            </DialogHeader>
                            <div className="space-y-4 py-4">
                              <div className="space-y-2">
                                <Label>Nome da Categoria</Label>
                                <Input
                                  value={newCategory.name}
                                  onChange={(e) => setNewCategory({...newCategory, name: e.target.value})}
                                  placeholder="Ex: Bebidas, Limpeza..."
                                />
                              </div>
                              <div className="space-y-2">
                                <Label>Cor da Categoria</Label>
                                <Select
                                  value={newCategory.color}
                                  onValueChange={(val) => setNewCategory({...newCategory, color: val})}
                                >
                                  <SelectTrigger><SelectValue /></SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="bg-blue-100 text-blue-800">Azul</SelectItem>
                                    <SelectItem value="bg-green-100 text-green-800">Verde</SelectItem>
                                    <SelectItem value="bg-yellow-100 text-yellow-800">Amarelo</SelectItem>
                                    <SelectItem value="bg-red-100 text-red-800">Vermelho</SelectItem>
                                    <SelectItem value="bg-purple-100 text-purple-800">Roxo</SelectItem>
                                    <SelectItem value="bg-orange-100 text-orange-800">Laranja</SelectItem>
                                    <SelectItem value="bg-pink-100 text-pink-800">Rosa</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </div>
                            <Button
                              onClick={() => createCategoryMutation.mutate(newCategory)}
                              disabled={!newCategory.name || createCategoryMutation.isPending}
                            >
                              {createCategoryMutation.isPending ? 'Criando...' : 'Criar Categoria'}
                            </Button>
                          </DialogContent>
                        </Dialog>
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="ml-1 text-xs font-bold text-gray-600">URL da Imagem <span className="font-normal text-gray-400">(opcional)</span></Label>
                      <Input
                        className="h-11 rounded-xl border-gray-200 focus-visible:border-[#B71C1C]/40 focus-visible:ring-[#B71C1C]/15"
                        placeholder="https://exemplo.com/imagem.jpg"
                        value={newProduct.image}
                        onChange={e => setNewProduct({...newProduct, image: e.target.value})}
                        data-testid="input-product-image"
                      />
                    </div>
                  </div>
                </section>
              </div>

              {/* Footer */}
              <div className="border-t border-gray-100 bg-gray-50/50 px-5 py-4 sm:px-6">
                <Button
                  className="h-13 w-full rounded-2xl bg-gradient-to-r from-[#B71C1C] to-[#7f1d1d] text-base font-bold text-white shadow-lg shadow-[#B71C1C]/20 transition-all hover:opacity-90 active:scale-[0.98] disabled:opacity-60"
                  onClick={handleSaveProduct}
                  disabled={createProductMutation.isPending || (editCount && !editCount.canEdit)}
                  data-testid="button-save-product"
                >
                  {createProductMutation.isPending ? 'A guardar...' : 'Salvar Produto'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
            </div>{/* end actions flex */}
          </div>{/* end flex row */}
        </div>{/* end bg-[#B71C1C] banner */}
      </div>{/* end rounded-3xl wrapper */}

      {editCount && editCount.count > 0 && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription>
            Você fez {editCount.count} de {editCount.limit} edições permitidas hoje.
            {!editCount.canEdit && ' Limite atingido!'}
          </AlertDescription>
        </Alert>
      )}

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {/* Total */}
        <div className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:shadow-md">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[0.7rem] font-bold uppercase tracking-widest text-gray-400">Total</p>
              <p className="mt-1 text-2xl font-extrabold tabular-nums text-gray-900">{products.length}</p>
            </div>
            <div className="rounded-xl bg-gray-100 p-2">
              <Package className="h-5 w-5 text-gray-500" />
            </div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 rounded-b-2xl bg-gray-300" />
        </div>
        {/* Sem estoque */}
        <div className="relative overflow-hidden rounded-2xl border border-red-100 bg-red-50 p-5 shadow-sm transition hover:shadow-md">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[0.7rem] font-bold uppercase tracking-widest text-[#B71C1C]/70">Sem estoque</p>
              <p className="mt-1 text-2xl font-extrabold tabular-nums text-[#B71C1C]">{outOfStockCount}</p>
            </div>
            <div className="rounded-xl bg-red-100 p-2">
              <PackageX className="h-5 w-5 text-[#B71C1C]" />
            </div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 rounded-b-2xl bg-[#B71C1C]" />
        </div>
        {/* Abaixo do mínimo */}
        <div className="relative overflow-hidden rounded-2xl border border-amber-100 bg-amber-50 p-5 shadow-sm transition hover:shadow-md">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[0.7rem] font-bold uppercase tracking-widest text-amber-500">Abaixo do mínimo</p>
              <p className="mt-1 text-2xl font-extrabold tabular-nums text-amber-700">{lowStockCount}</p>
            </div>
            <div className="rounded-xl bg-amber-100 p-2">
              <TrendingDown className="h-5 w-5 text-amber-600" />
            </div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 rounded-b-2xl bg-amber-400" />
        </div>
        {/* Editados 24h */}
        <div className="relative overflow-hidden rounded-2xl border border-gray-200 bg-white p-5 shadow-sm transition hover:shadow-md">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[0.7rem] font-bold uppercase tracking-widest text-gray-400">Editados (24h)</p>
              <p className="mt-1 text-2xl font-extrabold tabular-nums text-gray-900">{recentlyEditedCount}</p>
            </div>
            <div className="rounded-xl bg-gray-100 p-2">
              <Clock className="h-5 w-5 text-gray-500" />
            </div>
          </div>
          <div className="absolute bottom-0 left-0 right-0 h-1 rounded-b-2xl bg-gray-300" />
        </div>
      </div>

      {/* Modal de Edição de Produtos */}
      <Dialog open={isEditOpen} onOpenChange={setIsEditOpen}>
        <DialogContent className="w-[calc(100%-2rem)] max-w-2xl max-h-[90dvh] overflow-y-auto rounded-[2rem] border-none p-0 shadow-2xl">
          {/* cabeçalho */}
          <div className="relative overflow-hidden rounded-t-[2rem] bg-[#B71C1C] px-5 py-4 sm:px-6 sm:py-5">
            <div className="banner-texture" />
            <div className="relative flex items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/25">
                <Package className="h-4 w-4 text-white" strokeWidth={2.5} />
              </div>
              <div>
                <DialogTitle className="text-sm font-extrabold text-white sm:text-base">Editar Produto</DialogTitle>
                <p className="text-[11px] text-white/60">{editingProduct?.name}</p>
              </div>
            </div>
          </div>

          {editingProduct && (
            <div className="space-y-4 px-5 py-4 sm:px-6 sm:py-5">
              {/* Identificação */}
              <div className="flex items-center gap-2">
                <span className="h-4 w-1 rounded-full bg-[#B71C1C]" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Identificação</span>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Nome</Label>
                  <Input value={editingProduct.name} onChange={e => setEditingProduct({...editingProduct, name: e.target.value})} data-testid="input-edit-product-name" className="h-10 rounded-xl border-gray-200 bg-gray-50" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-bold uppercase tracking-wider text-gray-400">SKU</Label>
                  <Input value={editingProduct.sku} onChange={e => setEditingProduct({...editingProduct, sku: e.target.value})} data-testid="input-edit-product-sku" className="h-10 rounded-xl border-gray-200 bg-gray-50" />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Código de barras</Label>
                <div className="flex gap-2">
                  <Input value={(editingProduct as any).barcode || ''} onChange={e => setEditingProduct({...editingProduct, barcode: e.target.value} as any)} placeholder="EAN-13, UPC…" data-testid="input-edit-product-barcode" className="h-10 flex-1 rounded-xl border-gray-200 bg-gray-50" />
                  <Button type="button" variant="outline" size="icon" onClick={() => setBarcodeScanOpen('edit')} title="Escanear" className="h-10 w-10 rounded-xl border-gray-200">
                    <Camera className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {/* Preços */}
              <div className="flex items-center gap-2 pt-1">
                <span className="h-4 w-1 rounded-full bg-[#B71C1C]" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Preços & Stock</span>
              </div>
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Preço venda</Label>
                  <Input type="number" value={editingProduct.price} onChange={e => setEditingProduct({...editingProduct, price: e.target.value})} data-testid="input-edit-product-price" className="h-10 rounded-xl border-gray-200 bg-gray-50" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Preço custo</Label>
                  <Input type="number" value={editingProduct.costPrice} onChange={e => setEditingProduct({...editingProduct, costPrice: e.target.value})} data-testid="input-edit-product-cost" className="h-10 rounded-xl border-gray-200 bg-gray-50" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Stock actual</Label>
                  <Input type="number" value={editingProduct.stock} onChange={e => setEditingProduct({...editingProduct, stock: e.target.value})} data-testid="input-edit-product-stock" className="h-10 rounded-xl border-gray-200 bg-gray-50" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Stock mínimo</Label>
                  <Input type="number" value={editingProduct.minStock} onChange={e => setEditingProduct({...editingProduct, minStock: e.target.value})} data-testid="input-edit-product-minstock" className="h-10 rounded-xl border-gray-200 bg-gray-50" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Unidade</Label>
                  <Select value={editingProduct.unit} onValueChange={(val) => setEditingProduct({...editingProduct, unit: val as any})}>
                    <SelectTrigger data-testid="select-edit-product-unit" className="h-10 rounded-xl border-gray-200 bg-gray-50">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="un">Un</SelectItem>
                      <SelectItem value="kg">Kg</SelectItem>
                      <SelectItem value="g">g</SelectItem>
                      <SelectItem value="pack">Pack</SelectItem>
                      <SelectItem value="box">Box</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Categoria & Imagem */}
              <div className="flex items-center gap-2 pt-1">
                <span className="h-4 w-1 rounded-full bg-[#B71C1C]" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Categoria & Imagem</span>
              </div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Categoria</Label>
                  <Select value={editingProduct.categoryId || ''} onValueChange={(val) => setEditingProduct({...editingProduct, categoryId: val})}>
                    <SelectTrigger data-testid="select-edit-product-category" className="h-10 rounded-xl border-gray-200 bg-gray-50">
                      <SelectValue placeholder="Selecione…" />
                    </SelectTrigger>
                    <SelectContent>
                      {categories.map(cat => (
                        <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-[11px] font-bold uppercase tracking-wider text-gray-400">URL imagem</Label>
                  <Input value={editingProduct.image || ''} onChange={e => setEditingProduct({...editingProduct, image: e.target.value})} placeholder="https://…" data-testid="input-edit-product-image" className="h-10 rounded-xl border-gray-200 bg-gray-50" />
                </div>
              </div>
            </div>
          )}

          {/* rodapé */}
          <div className="flex items-center justify-end gap-2 border-t border-gray-100 bg-gray-50/60 px-5 py-4 rounded-b-[2rem] sm:px-6">
            <button type="button" onClick={() => setIsEditOpen(false)} className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50">Cancelar</button>
            <button type="button" onClick={handleSaveEdit} disabled={updateProductMutation.isPending} data-testid="button-save-edit-product" className="rounded-xl bg-gradient-to-r from-[#B71C1C] to-[#7f1d1d] px-5 py-2 text-sm font-semibold text-white shadow-sm hover:opacity-90 disabled:opacity-60">
              {updateProductMutation.isPending ? 'A guardar...' : 'Guardar alterações'}
            </button>
          </div>
        </DialogContent>
      </Dialog>

      <div className="rounded-3xl border border-gray-200 bg-white shadow-sm">
        {/* Barra de pesquisa + filtros */}
        <div className="flex flex-col gap-3 border-b border-gray-100 px-6 py-4 md:flex-row md:items-center md:justify-between">
          <div className="relative max-w-sm w-full">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
            <Input
              placeholder="Buscar por nome ou SKU..."
              className="h-9 rounded-full border-gray-200 pl-9 text-sm focus-visible:ring-red-400/30"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              data-testid="input-search-products"
            />
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            {(['all','out','low','recent'] as const).map((v) => {
              const labels = { all: 'Todos', out: 'Sem estoque', low: 'Abaixo do mínimo', recent: 'Recentes' };
              const active = view === v;
              return (
                <button
                  key={v}
                  type="button"
                  onClick={() => setView(v)}
                  className={`h-8 rounded-lg px-3 text-xs font-semibold transition-all ${
                    active
                      ? 'bg-gradient-to-r from-[#B71C1C] to-[#7f1d1d] text-white shadow-md shadow-[#B71C1C]/25'
                      : 'border border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  {labels[v]}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tabela */}
        <div className="overflow-x-auto">
            <Table>
            <TableHeader>
              <TableRow className="border-gray-100 bg-gray-50/60">
                <TableHead className="text-xs font-bold uppercase tracking-wider text-gray-500">Produto</TableHead>
                <TableHead className="text-xs font-bold uppercase tracking-wider text-gray-500">Categoria</TableHead>
                <TableHead className="text-xs font-bold uppercase tracking-wider text-gray-500">Preço</TableHead>
                <TableHead className="text-xs font-bold uppercase tracking-wider text-gray-500">Estoque</TableHead>
                <TableHead className="text-xs font-bold uppercase tracking-wider text-gray-500">Unidade</TableHead>
                <TableHead className="text-right text-xs font-bold uppercase tracking-wider text-gray-500">Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredProducts.map((product) => {
                const category = categories.find(c => c.id === product.categoryId);
                const parsedStock = parseFloat(product.stock);
                const parsedMinStock = parseFloat(product.minStock);

                return (
                  <TableRow key={product.id} className="group border-b border-gray-50 transition-colors hover:bg-red-50/30" data-testid={`row-product-${product.id}`}>
                    <TableCell className="py-3.5 font-medium">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 shrink-0 overflow-hidden rounded-xl border border-gray-200 bg-gray-100">
                          {product.image ? (
                            <img
                              src={product.image}
                              alt={product.name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center">
                              <Package className="h-5 w-5 text-gray-400" />
                            </div>
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            {parsedStock <= parsedMinStock && (
                              <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                            )}
                            <p className="truncate font-bold leading-none text-gray-900">{product.name}</p>
                          </div>
                          <p className="mt-0.5 font-mono text-[10px] uppercase tracking-wide text-gray-400">{product.sku}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ${category?.color || 'bg-gray-100 text-gray-600'}`}>
                        {category?.name || 'Geral'}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-base font-extrabold tabular-nums text-[#CC2936]">{formatCurrency(parseFloat(product.price))}</span>
                        <span className="text-[10px] tabular-nums text-gray-400">Custo: {formatCurrency(parseFloat(product.costPrice))}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className={parsedStock <= parsedMinStock ? 'font-bold text-[#B71C1C]' : 'font-semibold text-gray-700'}>
                        {parsedStock}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs font-semibold uppercase text-gray-500">{product.unit}</TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                      <button
                        type="button"
                        className="rounded-lg p-2 text-gray-400 transition-all hover:bg-white hover:text-amber-600 hover:shadow-sm"
                        onClick={() => handleEditProduct(product)}
                        title="Editar produto"
                        data-testid={`button-edit-${product.id}`}
                      >
                        <Pencil className="h-4 w-4" />
                      </button>
                      <Dialog open={increaseStockOpen && selectedProductId === product.id} onOpenChange={(open) => { setIncreaseStockOpen(open); if (!open) setSelectedProductId(''); }}>
                        <button
                          type="button"
                          className="rounded-lg p-2 text-gray-400 transition-all hover:bg-white hover:text-[#B71C1C] hover:shadow-sm"
                          onClick={() => { setSelectedProductId(product.id); setIncreaseStockOpen(true); }}
                          title="Aumentar estoque"
                          data-testid={`button-increase-stock-${product.id}`}
                        >
                          <ArrowUp className="h-4 w-4" />
                        </button>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Aumentar Estoque: {product.name}</DialogTitle>
                          </DialogHeader>
                          <div className="space-y-4 py-4">
                            <div className="grid gap-2">
                              <Label>Quantidade a Adicionar</Label>
                              <Input 
                                type="number" 
                                placeholder="Ex: 10"
                                value={increaseQuantity}
                                onChange={(e) => setIncreaseQuantity(e.target.value)}
                                data-testid="input-increase-quantity"
                              />
                              <p className="text-xs text-muted-foreground">
                                Estoque atual: {parsedStock} {product.unit}
                              </p>
                            </div>
                            <div className="grid gap-2">
                              <Label>Novo Preço (Opcional)</Label>
                              <Input 
                                type="number" 
                                step="0.01"
                                placeholder={formatCurrency(parseFloat(product.price))}
                                value={increasePrice}
                                onChange={(e) => setIncreasePrice(e.target.value)}
                                data-testid="input-increase-price"
                              />
                              <p className="text-xs text-muted-foreground">
                                Preço atual: {formatCurrency(parseFloat(product.price))}
                              </p>
                            </div>
                            <Button 
                              onClick={() => increaseStockMutation.mutate({ 
                                id: product.id, 
                                quantity: parseFloat(increaseQuantity),
                                price: increasePrice ? parseFloat(increasePrice) : undefined
                              })}
                              disabled={increaseStockMutation.isPending || !increaseQuantity}
                              className="w-full"
                              data-testid="button-save-increase-stock"
                            >
                              {increaseStockMutation.isPending ? 'Atualizando...' : 'Aumentar Estoque'}
                            </Button>
                          </div>
                        </DialogContent>
                      </Dialog>
                      <button
                        type="button"
                        className="rounded-lg p-2 text-gray-400 transition-all hover:bg-white hover:text-red-600 hover:shadow-sm disabled:opacity-50"
                        onClick={() => handleDeleteProduct(product.id)}
                        disabled={deleteProductMutation.isPending}
                        title="Eliminar produto"
                        data-testid={`button-delete-${product.id}`}
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </div>

      <Dialog open={!!barcodeScanOpen} onOpenChange={(o) => !o && setBarcodeScanOpen(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Ler código de barras</DialogTitle>
          </DialogHeader>
          <BarcodeCameraScan
            id="products-barcode-scan"
            onScan={(code) => {
              if (barcodeScanOpen === 'add') {
                setNewProduct(p => ({ ...p, barcode: code, sku: p.sku || code }));
              } else if (barcodeScanOpen === 'edit' && editingProduct) {
                setEditingProduct({ ...editingProduct, barcode: code } as any);
              }
              setBarcodeScanOpen(null);
            }}
            onClose={() => setBarcodeScanOpen(null)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}
