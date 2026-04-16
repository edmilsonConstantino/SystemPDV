import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Shield, UserPlus, Activity, History, Search, AlertCircle, ShoppingCart, Package, Trash2, Edit, Plus, DollarSign, Calendar, Users, Receipt } from 'lucide-react';
import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { usersApi, auditLogsApi, salesApi, productsApi } from '@/lib/api';
import { Badge } from '@/components/ui/badge';
import { toast } from '@/hooks/use-toast';
import { Textarea } from '@/components/ui/textarea';
import { loadInvoiceSettings, saveInvoiceSettings, type InvoiceSettings } from '@/lib/invoiceSettings';
import { useLocation } from 'wouter';
import { Separator } from '@/components/ui/separator';
import { InvoiceA7Template } from '@/components/invoice/InvoiceA7Templates';
import type { InvoiceData } from '@/lib/invoiceModels';

export default function SettingsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [location, setLocation] = useLocation();
  const [activeTab, setActiveTab] = useState("users");
  const [isAddUserOpen, setIsAddUserOpen] = useState(false);
  const [searchHistory, setSearchHistory] = useState('');
  const [orderAuditCode, setOrderAuditCode] = useState('');
  const [orderAuditData, setOrderAuditData] = useState<any>(null);
  const [orderAuditOpen, setOrderAuditOpen] = useState(false);

  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ['/api/users'],
    queryFn: usersApi.getAll,
    enabled: user?.role === 'admin' || user?.role === 'manager',
  });

  const { data: auditLogs = [], isLoading: auditLogsLoading } = useQuery({
    queryKey: ['/api/audit-logs'],
    queryFn: auditLogsApi.getAll
  });

  const orderAuditMutation = useMutation({
    mutationFn: async (code: string) => {
      const c = code.trim().toUpperCase();
      if (!c) throw new Error('Informe o código do pedido');
      const res = await fetch(`/api/orders/${c}/audit`, { credentials: 'include' });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || 'Sem permissão ou pedido não encontrado');
      }
      return res.json();
    },
    onSuccess: (data) => {
      setOrderAuditData(data);
      setOrderAuditOpen(true);
    },
    onError: (error: any) => {
      toast({ title: 'Auditoria do pedido', description: error.message, variant: 'destructive' });
    }
  });

  const { isLoading: salesLoading } = useQuery({
    queryKey: ['/api/sales'],
    queryFn: salesApi.getAll
  });

  const { isLoading: productsLoading } = useQuery({
    queryKey: ['/api/products'],
    queryFn: productsApi.getAll
  });

  const [newUser, setNewUser] = useState({
    username: '',
    name: '',
    password: '',
    role: 'seller' as 'admin' | 'manager' | 'seller'
  });

  const [editingUser, setEditingUser] = useState<any>(null);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [deletingUserId, setDeletingUserId] = useState<string | null>(null);
  const [userFilter, setUserFilter] = useState('');

  const createUserMutation = useMutation({
    mutationFn: usersApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      setIsAddUserOpen(false);
      setNewUser({ username: '', name: '', password: '', role: 'seller' });
      toast({ title: "Sucesso", description: "Usuário criado com sucesso!" });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Erro", 
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const updateUserMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => usersApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      setIsEditOpen(false);
      setEditingUser(null);
      toast({ title: "Sucesso", description: "Usuário atualizado com sucesso!" });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Erro", 
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const deleteUserMutation = useMutation({
    mutationFn: usersApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/users'] });
      setDeletingUserId(null);
      toast({ title: "Sucesso", description: "Usuário deletado com sucesso!" });
    },
    onError: (error: Error) => {
      toast({ 
        title: "Erro", 
        description: error.message,
        variant: "destructive"
      });
    }
  });

  const [permissions, setPermissions] = useState({
    admin: { canEditProducts: true, canViewReports: true, canManageUsers: true, canSell: true, canDiscount: true },
    manager: { canEditProducts: true, canViewReports: true, canManageUsers: false, canSell: true, canDiscount: true },
    seller: { canEditProducts: false, canViewReports: false, canManageUsers: false, canSell: true, canDiscount: false },
  });

  const handlePermissionChange = (role: 'admin' | 'manager' | 'seller', key: string, value: boolean) => {
    setPermissions({
      ...permissions,
      [role]: { ...permissions[role as keyof typeof permissions], [key]: value }
    });
  };

  const [actionFilter, setActionFilter] = useState<string>('all');
  const [invoiceSettings, setInvoiceSettings] = useState<InvoiceSettings>(() => loadInvoiceSettings());
  const [notesText, setNotesText] = useState(() => loadInvoiceSettings().defaultNotes.join('\n'));
  const [addressLines, setAddressLines] = useState<string[]>(() => loadInvoiceSettings().seller.addressLines ?? []);

  const invoicePreviewData: InvoiceData = {
    invoiceNo: 'MK-2026-000042',
    issuedAt: new Date(),
    currencyLabel: invoiceSettings.currencyLabel,
    seller: { ...invoiceSettings.seller, addressLines },
    customer: { name: 'Cliente exemplo', phone: '+258 84 000 0000' },
    paymentMethod: 'Dinheiro',
    lines: [
      { name: 'Arroz integral 5kg', qty: 1, unit: 'un', unitPrice: 350, total: 350 },
      { name: 'Banana', qty: 2, unit: 'kg', unitPrice: 60, total: 120 },
      { name: 'Leite 1L', qty: 1, unit: 'un', unitPrice: 90, total: 90 },
    ],
    subtotal: 560,
    discount: 20,
    total: 540,
    notes: invoiceSettings.defaultNotes,
    qrValue: invoiceSettings.showQr ? 'MK-2026-000042' : undefined,
    barcodeValue: invoiceSettings.showBarcode ? 'MK-2026-000042' : undefined,
  };

  // Permite abrir uma tab específica via URL: /settings?tab=invoices
  useEffect(() => {
    const qs = location.split('?')[1] ?? '';
    const params = new URLSearchParams(qs);
    const tab = params.get('tab');
    if (tab === 'invoices') setActiveTab('invoices');
    else if (tab === 'audit') setActiveTab('audit');
    else if (tab === 'permissions') setActiveTab('permissions');
    else if (tab === 'users') setActiveTab('users');
  }, [location]);

  // Mantém o URL sincronizado ao trocar tabs (para o sidebar apontar direto)
  useEffect(() => {
    const base = '/settings';
    const target = activeTab === 'users' ? base : `${base}?tab=${activeTab}`;
    if (location !== target) setLocation(target, { replace: true });
  }, [activeTab]);

  const filteredAuditLogs = auditLogs.filter(log => {
    const logUser = users.find(u => u.id === log.userId);
    const matchesSearch = log.action.toLowerCase().includes(searchHistory.toLowerCase()) ||
      (log.userId && log.userId.toLowerCase().includes(searchHistory.toLowerCase())) ||
      (logUser?.name.toLowerCase().includes(searchHistory.toLowerCase())) ||
      (logUser?.username.toLowerCase().includes(searchHistory.toLowerCase())) ||
      (log.entityId && log.entityId.toLowerCase().includes(searchHistory.toLowerCase()));
    
    const matchesFilter = actionFilter === 'all' || log.action.includes(actionFilter.toUpperCase());
    
    const matchesUserFilter = userFilter === '0' || userFilter === '' || log.userId === userFilter;
    
    return matchesSearch && matchesFilter && matchesUserFilter;
  });

  const getActionIcon = (action: string) => {
    if (action.includes('CREATE')) return <Plus className="h-4 w-4" />;
    if (action.includes('UPDATE') || action.includes('EDIT')) return <Edit className="h-4 w-4" />;
    if (action.includes('DELETE')) return <Trash2 className="h-4 w-4" />;
    if (action.includes('SALE')) return <ShoppingCart className="h-4 w-4" />;
    if (action.includes('PRODUCT')) return <Package className="h-4 w-4" />;
    if (action.includes('USER')) return <Users className="h-4 w-4" />;
    return <Activity className="h-4 w-4" />;
  };

  const getActionColor = (action: string) => {
    if (action.includes('CREATE')) return 'bg-green-100 text-green-800 border-green-300';
    if (action.includes('UPDATE') || action.includes('EDIT')) return 'bg-blue-100 text-blue-800 border-blue-300';
    if (action.includes('DELETE')) return 'bg-red-100 text-red-800 border-red-300';
    if (action.includes('SALE')) return 'bg-emerald-100 text-emerald-800 border-emerald-300';
    return 'bg-gray-100 text-gray-800 border-gray-300';
  };

  const auditStats = {
    total: auditLogs.length,
    today: auditLogs.filter(log => {
      const logDate = new Date(log.createdAt);
      const today = new Date();
      return logDate.toDateString() === today.toDateString();
    }).length,
    creates: auditLogs.filter(log => log.action.includes('CREATE')).length,
    sales: auditLogs.filter(log => log.action.includes('SALE')).length,
  };

  const handleSaveUser = () => {
    if (!newUser.username || !newUser.name || !newUser.password) {
      toast({ 
        title: "Erro", 
        description: "Todos os campos são obrigatórios",
        variant: "destructive"
      });
      return;
    }

    if (user?.role !== 'admin') {
      toast({ 
        title: "Acesso negado", 
        description: "Apenas administradores podem criar usuários",
        variant: "destructive"
      });
      return;
    }

    createUserMutation.mutate({
      username: newUser.username,
      name: newUser.name,
      password: newUser.password,
      role: newUser.role
    });
  };

  const isLoading = usersLoading || auditLogsLoading || salesLoading || productsLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center space-y-4">
          <div className="animate-spin h-12 w-12 border-4 border-primary border-t-transparent rounded-full mx-auto"></div>
          <p className="text-muted-foreground">Carregando configurações...</p>
        </div>
      </div>
    );
  }

  const tabDefs = [
    ...(user?.role === 'admin' || user?.role === 'manager'
      ? [{ id: 'users', label: 'Utilizadores', icon: Users, testId: 'tab-users' }]
      : []),
    ...(user?.role === 'admin'
      ? [{ id: 'permissions', label: 'Permissões', icon: Shield, testId: 'tab-permissions' }]
      : []),
    ...(user?.role === 'admin' || user?.role === 'manager'
      ? [
          { id: 'audit', label: 'Rastreio & Auditoria', icon: History, testId: 'tab-audit' },
          { id: 'invoices', label: 'Recibos & Faturas', icon: Receipt, testId: 'tab-invoices' },
        ]
      : []),
  ];

  return (
    <div className="space-y-6">

      {/* ── CABEÇALHO — padrão POS/Produtos/Pedidos ── */}
      <div className="overflow-hidden rounded-3xl shadow-sm">
        {/* Banner vermelho */}
        <div className="relative bg-[#B71C1C] px-4 py-4 sm:px-6 sm:py-5">
          <div className="banner-texture" />
          <div className="relative flex items-center gap-4">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/25">
              <Shield className="h-5 w-5 text-white" strokeWidth={2.5} />
            </div>
            <div className="space-y-1">
              <div className="flex items-baseline gap-2">
                <h1 className="text-xl font-extrabold tracking-tight text-white">Administração</h1>
                <span className="hidden text-sm font-normal text-white/50 sm:inline">Sistema &amp; Permissões</span>
              </div>
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="text-xs font-semibold text-white/70">
                  {users.length} utilizador{users.length !== 1 ? 'es' : ''}
                </span>
                {auditLogs.length > 0 && (
                  <span className="flex items-center gap-1 text-xs font-semibold text-white/60">
                    <span className="h-1 w-1 rounded-full bg-white/40" />
                    {auditLogs.length} evento{auditLogs.length !== 1 ? 's' : ''} de auditoria
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Tabs */}
        <div className="bg-white px-4 py-3 sm:px-6">
          <div className="grid grid-cols-2 gap-1.5">
            {tabDefs.map((t) => {
              const Icon = t.icon;
              const active = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setActiveTab(t.id)}
                  data-testid={t.testId}
                  className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-[11px] font-semibold transition-all ${
                    active
                      ? 'bg-[#B71C1C] text-white shadow-sm shadow-[#B71C1C]/25'
                      : 'border border-gray-200 bg-white text-gray-600 hover:border-gray-300 hover:bg-gray-50'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5 shrink-0" />
                  {t.label}
                </button>
              );
            })}
          </div>
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-5">
        <TabsList className="sr-only" />

        <TabsContent value="users" className="space-y-4">
          {/* Barra de acções */}
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-foreground">{users.length} utilizador{users.length !== 1 ? 'es' : ''} registado{users.length !== 1 ? 's' : ''}</p>
            </div>
            <Dialog open={isAddUserOpen} onOpenChange={setIsAddUserOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="h-9 gap-2 rounded-xl" disabled={user?.role !== 'admin'} data-testid="button-add-user">
                  <UserPlus className="h-4 w-4" />
                  Novo Utilizador
                </Button>
              </DialogTrigger>
              <DialogContent className="w-[calc(100%-2rem)] max-h-[90dvh] overflow-y-auto rounded-[2rem] border-none p-0 shadow-2xl sm:max-w-md">
                {/* cabeçalho */}
                <div className="relative overflow-hidden rounded-t-[2rem] bg-[#B71C1C] px-6 py-5">
                  <div className="banner-texture" />
                  <div className="relative flex items-center gap-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/25">
                      <UserPlus className="h-5 w-5 text-white" strokeWidth={2.5} />
                    </div>
                    <div>
                      <DialogTitle className="text-base font-extrabold text-white">Novo Utilizador</DialogTitle>
                      <DialogDescription className="text-[11px] text-white/60">Crie um novo perfil de acesso ao sistema</DialogDescription>
                    </div>
                  </div>
                </div>

                {/* corpo */}
                <div className="space-y-4 px-6 py-5">
                  {/* avatar preview */}
                  <div className="flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#B71C1C]/10 text-base font-black text-[#B71C1C]">
                      {newUser.name ? newUser.name.charAt(0).toUpperCase() : '?'}
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-800">{newUser.name || 'Nome do utilizador'}</p>
                      <p className="text-[11px] text-gray-400">@{newUser.username || 'username'}</p>
                    </div>
                  </div>

                  {/* divider */}
                  <div className="flex items-center gap-2">
                    <span className="h-4 w-1 rounded-full bg-[#B71C1C]" />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Dados de acesso</span>
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="col-span-2 space-y-1.5">
                      <Label className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Nome completo</Label>
                      <Input
                        placeholder="Ex: João Silva"
                        value={newUser.name}
                        onChange={(e) => setNewUser({...newUser, name: e.target.value})}
                        data-testid="input-user-name"
                        autoComplete="off"
                        className="h-11 rounded-xl border-gray-200 bg-gray-50 focus-visible:border-[#B71C1C]/40 focus-visible:ring-[#B71C1C]/15"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Username</Label>
                      <Input
                        placeholder="joao.silva"
                        value={newUser.username}
                        onChange={(e) => setNewUser({...newUser, username: e.target.value})}
                        data-testid="input-username"
                        autoComplete="off"
                        className="h-11 rounded-xl border-gray-200 bg-gray-50 focus-visible:border-[#B71C1C]/40 focus-visible:ring-[#B71C1C]/15"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Senha inicial</Label>
                      <Input
                        type="password"
                        placeholder="••••••••"
                        value={newUser.password}
                        onChange={(e) => setNewUser({...newUser, password: e.target.value})}
                        data-testid="input-password"
                        className="h-11 rounded-xl border-gray-200 bg-gray-50 focus-visible:border-[#B71C1C]/40 focus-visible:ring-[#B71C1C]/15"
                      />
                    </div>
                  </div>

                  {/* divider função */}
                  <div className="flex items-center gap-2">
                    <span className="h-4 w-1 rounded-full bg-[#B71C1C]" />
                    <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Função & permissões</span>
                  </div>

                  <div className="flex gap-2">
                    {(['admin', 'manager', 'seller'] as const).map((role) => {
                      const labels = { admin: 'Administrador', manager: 'Gestor', seller: 'Vendedor' };
                      const active = newUser.role === role;
                      return (
                        <button
                          key={role}
                          type="button"
                          onClick={() => setNewUser({...newUser, role})}
                          className={`flex-1 rounded-xl border py-2.5 text-[11px] font-bold transition-all ${
                            active
                              ? 'border-[#B71C1C]/30 bg-[#B71C1C] text-white shadow-sm shadow-[#B71C1C]/25'
                              : 'border-gray-200 bg-gray-50 text-gray-500 hover:border-gray-300 hover:bg-gray-100'
                          }`}
                        >
                          {labels[role]}
                        </button>
                      );
                    })}
                  </div>
                  {/* hidden select para manter data-testid */}
                  <select className="sr-only" value={newUser.role} onChange={(e) => setNewUser({...newUser, role: e.target.value as any})} data-testid="select-user-role">
                    <option value="admin">Administrador</option>
                    <option value="manager">Gestor</option>
                    <option value="seller">Vendedor</option>
                  </select>
                </div>

                {/* rodapé */}
                <div className="flex items-center justify-end gap-2 border-t border-gray-100 bg-gray-50/60 px-6 py-4 rounded-b-[2rem]">
                  <button type="button" onClick={() => setIsAddUserOpen(false)} className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50">
                    Cancelar
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveUser}
                    disabled={createUserMutation.isPending}
                    data-testid="button-save-user"
                    className="rounded-xl bg-gradient-to-r from-[#B71C1C] to-[#7f1d1d] px-5 py-2 text-sm font-semibold text-white shadow-sm shadow-[#B71C1C]/25 hover:opacity-90 disabled:opacity-60"
                  >
                    {createUserMutation.isPending ? 'A guardar...' : 'Criar utilizador'}
                  </button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <Card className="overflow-hidden border border-border/60 shadow-sm">
            <CardContent className="p-0 overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40 hover:bg-muted/40">
                    <TableHead className="py-3 pl-5 text-xs font-bold uppercase tracking-wider text-muted-foreground">Utilizador</TableHead>
                    <TableHead className="py-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Username</TableHead>
                    <TableHead className="py-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Grupo</TableHead>
                    <TableHead className="py-3 text-xs font-bold uppercase tracking-wider text-muted-foreground">Estado</TableHead>
                    <TableHead className="py-3 pr-5 text-right text-xs font-bold uppercase tracking-wider text-muted-foreground">Acções</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u) => (
                    <TableRow key={u.id} className="border-border/50 hover:bg-muted/20" data-testid={`row-user-${u.id}`}>
                      <TableCell className="py-3.5 pl-5">
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary/20 to-accent/20 text-xs font-bold text-primary">
                            {u.avatar ? (
                              <img src={u.avatar} alt="" className="h-full w-full rounded-full object-cover" />
                            ) : (
                              u.name.charAt(0).toUpperCase()
                            )}
                          </div>
                          <span className="text-sm font-semibold text-foreground">{u.name}</span>
                        </div>
                      </TableCell>
                      <TableCell className="py-3.5 font-mono text-xs text-muted-foreground">{u.username}</TableCell>
                      <TableCell className="py-3.5">
                        <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ${
                          u.role === 'admin' ? 'bg-primary/10 text-primary' :
                          u.role === 'manager' ? 'bg-accent/10 text-accent' :
                          'bg-muted text-muted-foreground'
                        }`}>
                          {u.role === 'manager' ? 'Gestor' : u.role === 'seller' ? 'Vendedor' : 'Admin'}
                        </span>
                      </TableCell>
                      <TableCell className="py-3.5">
                        <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          Activo
                        </span>
                      </TableCell>
                      <TableCell className="py-3.5 pr-5 text-right">
                        <Dialog open={isEditOpen && editingUser?.id === u.id} onOpenChange={(open) => { setIsEditOpen(open); if (!open) setEditingUser(null); }}>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => { setEditingUser({...u}); setIsEditOpen(true); }}
                            data-testid={`button-edit-user-${u.id}`}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <DialogContent className="w-[calc(100%-2rem)] max-h-[90dvh] overflow-y-auto rounded-[2rem] border-none p-0 shadow-2xl sm:max-w-md">
                            {/* cabeçalho */}
                            <div className="relative overflow-hidden rounded-t-[2rem] bg-[#1A1A2E] px-6 py-5">
                              <div className="banner-texture" />
                              <div className="relative flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 ring-1 ring-white/25">
                                  <Edit className="h-5 w-5 text-white" strokeWidth={2.5} />
                                </div>
                                <div>
                                  <DialogTitle className="text-base font-extrabold text-white">Editar Utilizador</DialogTitle>
                                  <DialogDescription className="text-[11px] text-white/50">{editingUser?.name}</DialogDescription>
                                </div>
                              </div>
                            </div>

                            {editingUser && (
                              <div className="space-y-4 px-6 py-5">
                                {/* avatar */}
                                <div className="flex items-center gap-3 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
                                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#1A1A2E]/10 text-base font-black text-[#1A1A2E]">
                                    {editingUser.name?.charAt(0).toUpperCase() || '?'}
                                  </div>
                                  <div>
                                    <p className="text-sm font-semibold text-gray-800">{editingUser.name}</p>
                                    <p className="text-[11px] text-gray-400">@{editingUser.username}</p>
                                  </div>
                                </div>

                                <div className="flex items-center gap-2">
                                  <span className="h-4 w-1 rounded-full bg-[#1A1A2E]" />
                                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Dados de acesso</span>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                  <div className="col-span-2 space-y-1.5">
                                    <Label className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Nome completo</Label>
                                    <Input
                                      value={editingUser.name}
                                      onChange={(e) => setEditingUser({...editingUser, name: e.target.value})}
                                      data-testid="input-edit-name"
                                      className="h-11 rounded-xl border-gray-200 bg-gray-50 focus-visible:border-[#1A1A2E]/30 focus-visible:ring-[#1A1A2E]/10"
                                    />
                                  </div>
                                  <div className="space-y-1.5">
                                    <Label className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Username</Label>
                                    <Input
                                      value={editingUser.username}
                                      onChange={(e) => setEditingUser({...editingUser, username: e.target.value})}
                                      data-testid="input-edit-username"
                                      className="h-11 rounded-xl border-gray-200 bg-gray-50 focus-visible:border-[#1A1A2E]/30 focus-visible:ring-[#1A1A2E]/10"
                                    />
                                  </div>
                                  <div className="space-y-1.5">
                                    <Label className="text-[11px] font-bold uppercase tracking-wider text-gray-400">Nova senha</Label>
                                    <Input
                                      type="password"
                                      placeholder="deixe vazio p/ manter"
                                      onChange={(e) => setEditingUser({...editingUser, password: e.target.value})}
                                      data-testid="input-edit-password"
                                      className="h-11 rounded-xl border-gray-200 bg-gray-50 focus-visible:border-[#1A1A2E]/30 focus-visible:ring-[#1A1A2E]/10"
                                    />
                                  </div>
                                </div>

                                <div className="flex items-center gap-2">
                                  <span className="h-4 w-1 rounded-full bg-[#1A1A2E]" />
                                  <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">Função</span>
                                </div>
                                <div className="flex gap-2">
                                  {(['admin', 'manager', 'seller'] as const).map((role) => {
                                    const labels = { admin: 'Admin', manager: 'Gestor', seller: 'Vendedor' };
                                    const active = editingUser.role === role;
                                    return (
                                      <button
                                        key={role}
                                        type="button"
                                        onClick={() => setEditingUser({...editingUser, role})}
                                        className={`flex-1 rounded-xl border py-2.5 text-[11px] font-bold transition-all ${
                                          active
                                            ? 'border-[#1A1A2E]/30 bg-[#1A1A2E] text-white'
                                            : 'border-gray-200 bg-gray-50 text-gray-500 hover:bg-gray-100'
                                        }`}
                                      >
                                        {labels[role]}
                                      </button>
                                    );
                                  })}
                                </div>
                                <select className="sr-only" value={editingUser.role} onChange={(e) => setEditingUser({...editingUser, role: e.target.value})} data-testid="select-edit-role">
                                  <option value="admin">Administrador</option>
                                  <option value="manager">Gestor</option>
                                  <option value="seller">Vendedor</option>
                                </select>
                              </div>
                            )}

                            <div className="flex items-center justify-end gap-2 border-t border-gray-100 bg-gray-50/60 px-6 py-4 rounded-b-[2rem]">
                              <button type="button" onClick={() => setIsEditOpen(false)} className="rounded-xl border border-gray-200 bg-white px-4 py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50">
                                Cancelar
                              </button>
                              <button
                                type="button"
                                onClick={() => updateUserMutation.mutate({ id: editingUser!.id, data: editingUser! })}
                                disabled={updateUserMutation.isPending}
                                data-testid="button-save-edit-user"
                                className="rounded-xl bg-[#1A1A2E] px-5 py-2 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
                              >
                                {updateUserMutation.isPending ? 'A guardar...' : 'Guardar alterações'}
                              </button>
                            </div>
                          </DialogContent>
                        </Dialog>
                        <Dialog open={deletingUserId === u.id} onOpenChange={(open) => { if (!open) setDeletingUserId(null); }}>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            className="text-destructive hover:text-destructive"
                            onClick={() => setDeletingUserId(u.id)}
                            data-testid={`button-delete-user-${u.id}`}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                          <DialogContent className="w-[calc(100%-2rem)] rounded-[2rem] border-none p-0 shadow-2xl sm:max-w-sm">
                            <div className="px-6 pt-6 pb-5 text-center">
                              <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 border border-red-100">
                                <Trash2 className="h-6 w-6 text-red-600" strokeWidth={2} />
                              </div>
                              <DialogTitle className="text-base font-bold text-gray-900">Eliminar utilizador</DialogTitle>
                              <DialogDescription className="mt-1.5 text-sm text-gray-500">
                                Tem a certeza que pretende eliminar <span className="font-semibold text-gray-800">"{u.name}"</span>? Esta acção não pode ser desfeita.
                              </DialogDescription>
                            </div>
                            <div className="flex gap-2 border-t border-gray-100 bg-gray-50/60 px-6 py-4 rounded-b-[2rem]">
                              <button type="button" onClick={() => setDeletingUserId(null)} className="flex-1 rounded-xl border border-gray-200 bg-white py-2 text-sm font-semibold text-gray-600 hover:bg-gray-50">
                                Cancelar
                              </button>
                              <button
                                type="button"
                                onClick={() => deleteUserMutation.mutate(u.id)}
                                disabled={deleteUserMutation.isPending}
                                data-testid="button-confirm-delete-user"
                                className="flex-1 rounded-xl bg-red-600 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:opacity-60"
                              >
                                {deleteUserMutation.isPending ? 'A eliminar...' : 'Eliminar'}
                              </button>
                            </div>
                          </DialogContent>
                        </Dialog>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="permissions" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Controle de Acesso por Grupo</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto -mx-6 px-6">
                <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Permissão</TableHead>
                    <TableHead className="text-center">Administrador</TableHead>
                    <TableHead className="text-center">Gestor</TableHead>
                    <TableHead className="text-center">Vendedor</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  <TableRow>
                    <TableCell>Editar Produtos</TableCell>
                    <TableCell className="text-center"><Checkbox checked={permissions.admin.canEditProducts} onCheckedChange={(c) => handlePermissionChange('admin', 'canEditProducts', !!c)} /></TableCell>
                    <TableCell className="text-center"><Checkbox checked={permissions.manager.canEditProducts} onCheckedChange={(c) => handlePermissionChange('manager', 'canEditProducts', !!c)} /></TableCell>
                    <TableCell className="text-center"><Checkbox checked={permissions.seller.canEditProducts} onCheckedChange={(c) => handlePermissionChange('seller', 'canEditProducts', !!c)} /></TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Ver Relatórios Financeiros</TableCell>
                    <TableCell className="text-center"><Checkbox checked={permissions.admin.canViewReports} onCheckedChange={(c) => handlePermissionChange('admin', 'canViewReports', !!c)} /></TableCell>
                    <TableCell className="text-center"><Checkbox checked={permissions.manager.canViewReports} onCheckedChange={(c) => handlePermissionChange('manager', 'canViewReports', !!c)} /></TableCell>
                    <TableCell className="text-center"><Checkbox checked={permissions.seller.canViewReports} onCheckedChange={(c) => handlePermissionChange('seller', 'canViewReports', !!c)} /></TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Gerenciar Usuários</TableCell>
                    <TableCell className="text-center"><Checkbox checked={permissions.admin.canManageUsers} onCheckedChange={(c) => handlePermissionChange('admin', 'canManageUsers', !!c)} /></TableCell>
                    <TableCell className="text-center"><Checkbox checked={permissions.manager.canManageUsers} onCheckedChange={(c) => handlePermissionChange('manager', 'canManageUsers', !!c)} /></TableCell>
                    <TableCell className="text-center"><Checkbox checked={permissions.seller.canManageUsers} onCheckedChange={(c) => handlePermissionChange('seller', 'canManageUsers', !!c)} /></TableCell>
                  </TableRow>
                  <TableRow>
                    <TableCell>Aplicar Descontos no PDV</TableCell>
                    <TableCell className="text-center"><Checkbox checked={permissions.admin.canDiscount} onCheckedChange={(c) => handlePermissionChange('admin', 'canDiscount', !!c)} /></TableCell>
                    <TableCell className="text-center"><Checkbox checked={permissions.manager.canDiscount} onCheckedChange={(c) => handlePermissionChange('manager', 'canDiscount', !!c)} /></TableCell>
                    <TableCell className="text-center"><Checkbox checked={permissions.seller.canDiscount} onCheckedChange={(c) => handlePermissionChange('seller', 'canDiscount', !!c)} /></TableCell>
                  </TableRow>
                </TableBody>
              </Table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="audit" className="space-y-4">
          <Card className="border border-border/70">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ShoppingCart className="h-5 w-5 text-primary" />
                Rastrear Pedido (Por Código)
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-col gap-2">
                <Label className="text-sm font-medium">Código do pedido</Label>
                <div className="flex items-center gap-2">
                  <Input
                    value={orderAuditCode}
                    onChange={(e) => setOrderAuditCode(e.target.value)}
                    placeholder="Ex: ABC12345"
                    className="font-mono"
                  />
                  <Button
                    type="button"
                    className="shrink-0"
                    onClick={() => orderAuditMutation.mutate(orderAuditCode)}
                    disabled={orderAuditMutation.isPending}
                  >
                    {orderAuditMutation.isPending ? 'Consultando…' : 'Consultar auditoria'}
                  </Button>
                </div>
              </div>

              <Dialog open={orderAuditOpen} onOpenChange={setOrderAuditOpen}>
                <DialogContent className="max-w-4xl">
                  <DialogHeader>
                    <DialogTitle>Auditoria profunda do pedido</DialogTitle>
                    <DialogDescription>
                      Eventos do pedido e da venda associada (se existir).
                    </DialogDescription>
                  </DialogHeader>
                  {!orderAuditData ? (
                    <div className="py-6 text-sm text-muted-foreground">Sem dados.</div>
                  ) : (
                    <div className="space-y-4">
                      <div className="rounded-2xl border border-border bg-muted/20 p-4">
                        <p className="text-sm font-black">
                          Pedido <span className="font-mono">#{orderAuditData.order?.orderCode}</span> · {orderAuditData.order?.status}
                        </p>
                        <p className="mt-1 text-xs text-muted-foreground">
                          SaleId: {orderAuditData.order?.saleId || '—'} · Last3: {orderAuditData.order?.last3Phone || '—'} · Pagamento: {orderAuditData.order?.paymentMethod || '—'}
                        </p>
                      </div>

                      <div className="grid gap-3 md:grid-cols-2">
                        <div className="rounded-2xl border border-border bg-white p-4">
                          <p className="text-sm font-black mb-2">Eventos (Order)</p>
                          <div className="space-y-2">
                            {(orderAuditData.audit?.order || []).slice(0, 80).map((l: any) => (
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
                            {(orderAuditData.audit?.sale || []).slice(0, 80).map((l: any) => (
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
            </CardContent>
          </Card>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              { label: 'Total de ações', value: auditStats.total, Icon: Activity, color: 'text-primary bg-primary/10' },
              { label: 'Hoje', value: auditStats.today, Icon: Calendar, color: 'text-emerald-600 bg-emerald-50' },
              { label: 'Criações', value: auditStats.creates, Icon: Plus, color: 'text-blue-600 bg-blue-50' },
              { label: 'Vendas', value: auditStats.sales, Icon: DollarSign, color: 'text-orange-600 bg-orange-50' },
            ].map(({ label, value, Icon, color }) => (
              <Card key={label} className="border border-border/60 shadow-sm">
                <CardContent className="flex items-center justify-between p-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{label}</p>
                    <p className="mt-1 text-2xl font-bold text-foreground">{value}</p>
                  </div>
                  <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${color}`}>
                    <Icon className="h-4 w-4" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Filtros */}
          <div className="flex flex-col gap-2 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Buscar ação, usuário ou entidade..."
                className="h-9 pl-9 text-sm"
                value={searchHistory}
                onChange={(e) => setSearchHistory(e.target.value)}
                data-testid="input-search-audit"
              />
            </div>
            <Select value={actionFilter} onValueChange={setActionFilter}>
              <SelectTrigger className="h-9 w-full text-sm md:w-[160px]">
                <SelectValue placeholder="Serviço" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos Serviços</SelectItem>
                <SelectItem value="product">Produtos</SelectItem>
                <SelectItem value="user">Usuários</SelectItem>
                <SelectItem value="sale">Vendas</SelectItem>
                <SelectItem value="stock">Estoque</SelectItem>
              </SelectContent>
            </Select>
            <Select value={userFilter} onValueChange={setUserFilter}>
              <SelectTrigger className="h-9 w-full text-sm md:w-[180px]">
                <SelectValue placeholder="Utilizador" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="0">Todos Usuários</SelectItem>
                {users.map(u => (
                  <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Timeline de Auditoria */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5" />
                Linha do Tempo de Atividades
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {filteredAuditLogs.length === 0 ? (
                  <div className="text-center py-12 text-muted-foreground">
                    <AlertCircle className="h-12 w-12 mx-auto mb-4 opacity-50" />
                    <p>Nenhuma atividade encontrada</p>
                  </div>
                ) : (
                  filteredAuditLogs.map((log) => {
                    const logUser = users.find(u => u.id === log.userId);
                    return (
                      <div 
                        key={log.id} 
                        data-testid={`row-audit-${log.id}`}
                        className="relative pl-8 pb-8 border-l-2 border-border last:border-0 last:pb-0"
                      >
                        {/* Timeline dot */}
                        <div className={`absolute -left-[9px] top-0 h-4 w-4 rounded-full border-2 border-background ${getActionColor(log.action).replace('text-', 'bg-').split(' ')[0]}`} />
                        
                        <div className="bg-muted/30 rounded-lg p-4 hover:bg-muted/50 transition-colors">
                          <div className="flex items-start justify-between gap-4 mb-3">
                            <div className="flex items-center gap-3">
                              <Badge variant="outline" className={`${getActionColor(log.action)} border font-medium flex items-center gap-1`}>
                                {getActionIcon(log.action)}
                                {log.action}
                              </Badge>
                              <span className="text-sm font-mono text-muted-foreground">
                                {log.entityType}
                                {log.entityId && <span className="ml-1">#{log.entityId.slice(-6)}</span>}
                              </span>
                            </div>
                            <span className="text-xs text-muted-foreground whitespace-nowrap">
                              {format(new Date(log.createdAt), "dd/MM/yy 'às' HH:mm", { locale: ptBR })}
                            </span>
                          </div>

                          <div className="flex items-center gap-3 mb-2">
                            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                              {logUser?.name?.charAt(0)?.toUpperCase() ?? 'S'}
                            </div>
                            <div>
                              <p className="text-sm font-medium">{logUser?.name || 'Sistema'}</p>
                              <p className="text-xs text-muted-foreground">@{logUser?.username || 'sistema'}</p>
                            </div>
                          </div>

                          {log.details && (
                            <div className="mt-3 p-3 bg-background/50 rounded border border-border">
                              <p className="text-xs font-semibold text-muted-foreground mb-2">Detalhes da Ação:</p>
                              <pre className="text-xs overflow-x-auto">
                                {JSON.stringify(log.details, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="invoices" className="space-y-4">
          <div className="grid gap-6 lg:grid-cols-[1fr_420px]">

            {/* Formulário */}
            <div className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">

              {/* Header da secção */}
              <div className="flex items-center gap-3 border-b border-gray-100 bg-gray-50/60 px-6 py-4">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#B71C1C]/10">
                  <Receipt className="h-4 w-4 text-[#B71C1C]" />
                </div>
                <div>
                  <p className="text-sm font-extrabold text-gray-900">Recibos &amp; Faturas</p>
                  <p className="text-[11px] text-gray-500">Configurações impressas em cada fatura gerada</p>
                </div>
              </div>

              <div className="space-y-7 px-6 py-6">

                {/* Seção: Identidade */}
                <section className="space-y-4">
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-1 rounded-full bg-[#B71C1C]" />
                    <h3 className="text-[0.65rem] font-bold uppercase tracking-wider text-gray-400">Identidade da Loja</h3>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label className="ml-1 text-xs font-bold text-gray-600">Nome da loja</Label>
                      <Input
                        className="h-11 rounded-xl border-gray-200 focus-visible:border-[#B71C1C]/40 focus-visible:ring-[#B71C1C]/15"
                        value={invoiceSettings.seller.name}
                        onChange={(e) => setInvoiceSettings((prev) => ({ ...prev, seller: { ...prev.seller, name: e.target.value } }))}
                        placeholder="Ex: Makira Sales"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="ml-1 text-xs font-bold text-gray-600">NIF <span className="font-normal text-gray-400">(opcional)</span></Label>
                      <Input
                        className="h-11 rounded-xl border-gray-200 focus-visible:border-[#B71C1C]/40 focus-visible:ring-[#B71C1C]/15"
                        value={invoiceSettings.seller.taxId ?? ''}
                        onChange={(e) => setInvoiceSettings((prev) => ({ ...prev, seller: { ...prev.seller, taxId: e.target.value } }))}
                        placeholder="Ex: 400123456"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="ml-1 text-xs font-bold text-gray-600">Telefone <span className="font-normal text-gray-400">(opcional)</span></Label>
                      <Input
                        className="h-11 rounded-xl border-gray-200 focus-visible:border-[#B71C1C]/40 focus-visible:ring-[#B71C1C]/15"
                        value={invoiceSettings.seller.phone ?? ''}
                        onChange={(e) => setInvoiceSettings((prev) => ({ ...prev, seller: { ...prev.seller, phone: e.target.value } }))}
                        placeholder="Ex: +258 84 000 0000"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="ml-1 text-xs font-bold text-gray-600">Moeda</Label>
                      <Input
                        className="h-11 rounded-xl border-gray-200 focus-visible:border-[#B71C1C]/40 focus-visible:ring-[#B71C1C]/15"
                        value={invoiceSettings.currencyLabel}
                        onChange={(e) => setInvoiceSettings((prev) => ({ ...prev, currencyLabel: e.target.value }))}
                        placeholder="Ex: MT"
                      />
                    </div>
                  </div>
                </section>

                {/* Seção: Endereço */}
                <section className="space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="h-4 w-1 rounded-full bg-[#B71C1C]" />
                      <h3 className="text-[0.65rem] font-bold uppercase tracking-wider text-gray-400">Endereço</h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => setAddressLines((prev) => [...prev, ''])}
                      className="flex items-center gap-1 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-semibold text-gray-600 transition hover:border-[#B71C1C]/30 hover:bg-[#B71C1C]/5 hover:text-[#B71C1C]"
                    >
                      <Plus className="h-3.5 w-3.5" /> Adicionar linha
                    </button>
                  </div>
                  <div className="space-y-2">
                    {(addressLines.length ? addressLines : ['']).map((val, idx) => (
                      <div key={idx} className="flex gap-2">
                        <Input
                          className="h-11 flex-1 rounded-xl border-gray-200 focus-visible:border-[#B71C1C]/40 focus-visible:ring-[#B71C1C]/15"
                          value={val}
                          onChange={(e) => setAddressLines((prev) => prev.map((x, i) => (i === idx ? e.target.value : x)))}
                          placeholder={idx === 0 ? 'Ex: Av. 25 de Setembro' : 'Ex: Maputo'}
                        />
                        <button
                          type="button"
                          onClick={() => setAddressLines((prev) => prev.filter((_, i) => i !== idx))}
                          disabled={addressLines.length <= 1}
                          className="rounded-xl border border-gray-200 px-3 text-xs font-semibold text-gray-500 transition hover:border-red-200 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                        >
                          Remover
                        </button>
                      </div>
                    ))}
                  </div>
                </section>

                {/* Seção: Transferências */}
                <section className="space-y-4">
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-1 rounded-full bg-[#B71C1C]" />
                    <div>
                      <h3 className="text-[0.65rem] font-bold uppercase tracking-wider text-gray-400">Transferências (Mpesa / Emola)</h3>
                      <p className="mt-0.5 text-[10px] text-gray-400">Visíveis no checkout quando o cliente escolhe transferência</p>
                    </div>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-1.5">
                      <Label className="ml-1 text-xs font-bold text-gray-600">Número Mpesa</Label>
                      <Input
                        className="h-11 rounded-xl border-gray-200 focus-visible:border-[#B71C1C]/40 focus-visible:ring-[#B71C1C]/15"
                        value={invoiceSettings.transferAccounts?.mpesa ?? ''}
                        onChange={(e) => setInvoiceSettings((prev) => ({ ...prev, transferAccounts: { ...(prev.transferAccounts ?? {}), mpesa: e.target.value } }))}
                        placeholder="Ex: 84 000 0000"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="ml-1 text-xs font-bold text-gray-600">Número Emola</Label>
                      <Input
                        className="h-11 rounded-xl border-gray-200 focus-visible:border-[#B71C1C]/40 focus-visible:ring-[#B71C1C]/15"
                        value={invoiceSettings.transferAccounts?.emola ?? ''}
                        onChange={(e) => setInvoiceSettings((prev) => ({ ...prev, transferAccounts: { ...(prev.transferAccounts ?? {}), emola: e.target.value } }))}
                        placeholder="Ex: 86 000 0000"
                      />
                    </div>
                  </div>
                </section>

                {/* Seção: Modelo e Opções */}
                <section className="space-y-4">
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-1 rounded-full bg-[#B71C1C]" />
                    <h3 className="text-[0.65rem] font-bold uppercase tracking-wider text-gray-400">Modelo &amp; Opções</h3>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    {(['classic', 'compact'] as const).map((m) => {
                      const active = invoiceSettings.defaultModel === m;
                      return (
                        <button
                          key={m}
                          type="button"
                          onClick={() => setInvoiceSettings((prev) => ({ ...prev, defaultModel: m }))}
                          className={`overflow-hidden rounded-2xl border text-left transition-all ${
                            active
                              ? 'border-[#B71C1C]/40 bg-[#B71C1C]/3 ring-2 ring-[#B71C1C]/20'
                              : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                          }`}
                        >
                          <div className="flex items-center justify-between gap-2 border-b border-gray-100 px-4 py-3">
                            <div>
                              <p className="text-sm font-bold text-gray-900">{m === 'classic' ? 'Clássico' : 'Compacto'}</p>
                              <p className="text-[11px] text-gray-400">Toque para definir como padrão</p>
                            </div>
                            <span className={`rounded-full px-2.5 py-1 text-[10px] font-bold ${
                              active ? 'bg-[#B71C1C] text-white' : 'border border-gray-200 text-gray-500'
                            }`}>
                              {active ? 'Padrão' : 'Selecionar'}
                            </span>
                          </div>
                          <div className="bg-gray-50 p-4">
                            <div className="grid grid-cols-3 gap-2">
                              <div className="h-2.5 rounded-md bg-gray-200" />
                              <div className="h-2.5 rounded-md bg-gray-200/80" />
                              <div className="h-2.5 rounded-md bg-gray-200/60" />
                              <div className="col-span-3 h-10 rounded-md bg-gray-200/70" />
                              <div className="col-span-2 h-7 rounded-md bg-gray-200/60" />
                              <div className="h-7 rounded-md bg-gray-200/60" />
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50/50 px-4 py-3">
                      <div>
                        <p className="text-sm font-semibold text-gray-800">Mostrar QR Code</p>
                        <p className="text-[11px] text-gray-400">Exibe QR na fatura impressa</p>
                      </div>
                      <Checkbox
                        checked={invoiceSettings.showQr}
                        onCheckedChange={(v) => setInvoiceSettings((prev) => ({ ...prev, showQr: Boolean(v) }))}
                      />
                    </div>
                    <div className="flex items-center justify-between rounded-xl border border-gray-200 bg-gray-50/50 px-4 py-3">
                      <div>
                        <p className="text-sm font-semibold text-gray-800">Mostrar Barcode</p>
                        <p className="text-[11px] text-gray-400">Exibe código de barras na fatura</p>
                      </div>
                      <Checkbox
                        checked={invoiceSettings.showBarcode}
                        onCheckedChange={(v) => setInvoiceSettings((prev) => ({ ...prev, showBarcode: Boolean(v) }))}
                      />
                    </div>
                  </div>
                </section>

                {/* Seção: Notas */}
                <section className="space-y-4">
                  <div className="flex items-center gap-2">
                    <div className="h-4 w-1 rounded-full bg-[#B71C1C]" />
                    <h3 className="text-[0.65rem] font-bold uppercase tracking-wider text-gray-400">Notas Padrão</h3>
                  </div>
                  <Textarea
                    value={notesText}
                    onChange={(e) => {
                      setNotesText(e.target.value);
                      setInvoiceSettings((prev) => ({
                        ...prev,
                        defaultNotes: e.target.value.split('\n').map((x) => x.trim()).filter(Boolean).slice(0, 5),
                      }));
                    }}
                    placeholder={"Obrigado pela preferência\nTrocas até 7 dias"}
                    className="min-h-[80px] rounded-xl border-gray-200 text-sm focus-visible:border-[#B71C1C]/40 focus-visible:ring-[#B71C1C]/15"
                  />
                  <p className="ml-1 text-[11px] text-gray-400">Máximo 5 linhas — aparecem no rodapé da fatura</p>
                </section>

              </div>

              {/* Footer com botões */}
              <div className="flex flex-wrap gap-2 border-t border-gray-100 bg-gray-50/60 px-6 py-4">
                <button
                  type="button"
                  onClick={() => {
                    const merged: InvoiceSettings = {
                      ...invoiceSettings,
                      seller: { ...invoiceSettings.seller, addressLines: addressLines.map((x) => x.trim()).filter(Boolean).slice(0, 6) },
                    };
                    setInvoiceSettings(merged);
                    saveInvoiceSettings(merged);
                    toast({ title: 'Salvo', description: 'Configurações de fatura aplicadas.' });
                  }}
                  className="rounded-xl bg-gradient-to-r from-[#B71C1C] to-[#7f1d1d] px-5 py-2.5 text-sm font-bold text-white shadow-md shadow-[#B71C1C]/20 transition hover:opacity-90 active:scale-[0.98]"
                >
                  Salvar configurações
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const fresh = loadInvoiceSettings();
                    setInvoiceSettings(fresh);
                    setAddressLines(fresh.seller.addressLines ?? []);
                    setNotesText(fresh.defaultNotes.join('\n'));
                    toast({ title: 'Recarregado', description: 'Configuração atual recarregada.' });
                  }}
                  className="rounded-xl border border-gray-200 bg-white px-5 py-2.5 text-sm font-semibold text-gray-600 transition hover:bg-gray-50"
                >
                  Recarregar
                </button>
              </div>
            </div>

            {/* Preview */}
            <div className="h-fit overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm lg:sticky lg:top-20">
              <div className="flex items-center gap-2 border-b border-gray-100 bg-gray-50/60 px-5 py-3.5">
                <div className="h-4 w-1 rounded-full bg-[#B71C1C]" />
                <p className="text-xs font-bold uppercase tracking-wider text-gray-500">Preview (A7)</p>
              </div>
              <div className="p-5">
                <div className="mx-auto w-fit rounded-2xl border border-gray-100 bg-white p-3 shadow-sm">
                  <InvoiceA7Template model={invoiceSettings.defaultModel} data={invoicePreviewData} />
                </div>
                <p className="mt-3 text-center text-[11px] text-gray-400">
                  Actualiza em tempo real conforme edita
                </p>
              </div>
            </div>

          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
