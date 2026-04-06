import { useAuth } from '@/lib/auth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
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
import { Shield, UserPlus, Lock, Activity, History, Search, Eye, AlertCircle, ShoppingCart, Package, Trash2, Edit, Plus, DollarSign, Calendar, TrendingUp, Users, Receipt } from 'lucide-react';
import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { formatCurrency } from '@/lib/utils';
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

  const { data: users = [], isLoading: usersLoading } = useQuery({
    queryKey: ['/api/users'],
    queryFn: usersApi.getAll
  });

  const { data: auditLogs = [], isLoading: auditLogsLoading } = useQuery({
    queryKey: ['/api/audit-logs'],
    queryFn: auditLogsApi.getAll
  });

  const { data: sales = [], isLoading: salesLoading } = useQuery({
    queryKey: ['/api/sales'],
    queryFn: salesApi.getAll
  });

  const { data: products = [], isLoading: productsLoading } = useQuery({
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-heading font-bold text-foreground">Administração</h1>
          <p className="text-muted-foreground">Gerenciamento de usuários, permissões e auditoria.</p>
        </div>
      </div>

      <Tabs defaultValue="users" value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList>
          <TabsTrigger value="users" className="gap-2" data-testid="tab-users"><UserPlus className="h-4 w-4" /> Usuários</TabsTrigger>
          <TabsTrigger value="permissions" className="gap-2" data-testid="tab-permissions"><Shield className="h-4 w-4" /> Permissões</TabsTrigger>
          <TabsTrigger value="audit" className="gap-2" data-testid="tab-audit"><History className="h-4 w-4" /> Rastreio & Auditoria</TabsTrigger>
          <TabsTrigger value="invoices" className="gap-2" data-testid="tab-invoices"><Receipt className="h-4 w-4" /> Recibos & Faturas</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-4">
          <div className="flex justify-end">
             <Dialog open={isAddUserOpen} onOpenChange={setIsAddUserOpen}>
              <DialogTrigger asChild>
                <Button className="shadow-lg shadow-primary/20" disabled={user?.role !== 'admin'} data-testid="button-add-user">
                  <UserPlus className="mr-2 h-4 w-4" />
                  Novo Usuário
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Adicionar Usuário</DialogTitle>
                  <DialogDescription>Crie um novo perfil de acesso ao sistema.</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label>Nome Completo</Label>
                    <Input 
                      placeholder="Ex: João Silva" 
                      value={newUser.name}
                      onChange={(e) => setNewUser({...newUser, name: e.target.value})}
                      data-testid="input-user-name"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Nome de Usuário</Label>
                    <Input 
                      placeholder="Ex: joao.silva" 
                      value={newUser.username}
                      onChange={(e) => setNewUser({...newUser, username: e.target.value})}
                      data-testid="input-username"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Senha</Label>
                    <Input 
                      type="password" 
                      placeholder="Senha inicial" 
                      value={newUser.password}
                      onChange={(e) => setNewUser({...newUser, password: e.target.value})}
                      data-testid="input-password"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Função (Grupo)</Label>
                    <Select value={newUser.role} onValueChange={(val: any) => setNewUser({...newUser, role: val})}>
                      <SelectTrigger data-testid="select-user-role">
                        <SelectValue placeholder="Selecione..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="admin">Administrador</SelectItem>
                        <SelectItem value="manager">Gestor</SelectItem>
                        <SelectItem value="seller">Vendedor</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button onClick={handleSaveUser} disabled={createUserMutation.isPending} data-testid="button-save-user">
                    {createUserMutation.isPending ? 'Salvando...' : 'Salvar'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Usuários do Sistema</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto -mx-6 px-6">
                <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Usuário</TableHead>
                    <TableHead>Grupo</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u) => (
                    <TableRow key={u.id} data-testid={`row-user-${u.id}`}>
                      <TableCell className="font-medium flex items-center gap-3">
                        <div className="h-8 w-8 rounded-full bg-muted overflow-hidden flex items-center justify-center text-sm font-bold">
                          {u.avatar ? (
                            <img src={u.avatar} alt="" className="h-full w-full object-cover" />
                          ) : (
                            u.name.charAt(0).toUpperCase()
                          )}
                        </div>
                        {u.name}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{u.username}</TableCell>
                      <TableCell>
                        <Badge variant="outline" className="capitalize">
                          {u.role === 'manager' ? 'Gestor' : u.role === 'seller' ? 'Vendedor' : 'Admin'}
                        </Badge>
                      </TableCell>
                      <TableCell><Badge variant="secondary" className="bg-green-100 text-green-800">Ativo</Badge></TableCell>
                      <TableCell className="text-right gap-2 flex justify-end">
                        <Dialog open={isEditOpen && editingUser?.id === u.id} onOpenChange={(open) => { setIsEditOpen(open); if (!open) setEditingUser(null); }}>
                          <Button 
                            variant="ghost" 
                            size="icon"
                            onClick={() => { setEditingUser({...u}); setIsEditOpen(true); }}
                            data-testid={`button-edit-user-${u.id}`}
                          >
                            <Edit className="h-4 w-4" />
                          </Button>
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Editar Usuário: {editingUser?.name}</DialogTitle>
                            </DialogHeader>
                            {editingUser && (
                              <div className="grid gap-4 py-4">
                                <div className="grid gap-2">
                                  <Label>Nome Completo</Label>
                                  <Input 
                                    value={editingUser.name}
                                    onChange={(e) => setEditingUser({...editingUser, name: e.target.value})}
                                    data-testid="input-edit-name"
                                  />
                                </div>
                                <div className="grid gap-2">
                                  <Label>Nome de Usuário</Label>
                                  <Input 
                                    value={editingUser.username}
                                    onChange={(e) => setEditingUser({...editingUser, username: e.target.value})}
                                    data-testid="input-edit-username"
                                  />
                                </div>
                                <div className="grid gap-2">
                                  <Label>Nova Senha (deixe em branco para manter)</Label>
                                  <Input 
                                    type="password" 
                                    placeholder="Nova senha"
                                    onChange={(e) => setEditingUser({...editingUser, password: e.target.value})}
                                    data-testid="input-edit-password"
                                  />
                                </div>
                                <div className="grid gap-2">
                                  <Label>Função</Label>
                                  <Select value={editingUser.role} onValueChange={(val) => setEditingUser({...editingUser, role: val})}>
                                    <SelectTrigger data-testid="select-edit-role">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="admin">Administrador</SelectItem>
                                      <SelectItem value="manager">Gestor</SelectItem>
                                      <SelectItem value="seller">Vendedor</SelectItem>
                                    </SelectContent>
                                  </Select>
                                </div>
                              </div>
                            )}
                            <DialogFooter>
                              <Button onClick={() => updateUserMutation.mutate({ id: editingUser.id, data: editingUser })} disabled={updateUserMutation.isPending} data-testid="button-save-edit-user">
                                {updateUserMutation.isPending ? 'Salvando...' : 'Salvar Alterações'}
                              </Button>
                            </DialogFooter>
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
                          <DialogContent>
                            <DialogHeader>
                              <DialogTitle>Confirmar Exclusão</DialogTitle>
                              <DialogDescription>
                                Tem certeza que deseja deletar o usuário "{u.name}"? Esta ação não pode ser desfeita.
                              </DialogDescription>
                            </DialogHeader>
                            <DialogFooter>
                              <Button variant="outline" onClick={() => setDeletingUserId(null)}>Cancelar</Button>
                              <Button variant="destructive" onClick={() => deleteUserMutation.mutate(u.id)} disabled={deleteUserMutation.isPending} data-testid="button-confirm-delete-user">
                                {deleteUserMutation.isPending ? 'Deletando...' : 'Deletar'}
                              </Button>
                            </DialogFooter>
                          </DialogContent>
                        </Dialog>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
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

        <TabsContent value="audit" className="space-y-6">
          {/* Estatísticas de Auditoria */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card className="border-l-4 border-l-primary">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Total de Ações</p>
                    <h3 className="text-3xl font-bold mt-2">{auditStats.total}</h3>
                  </div>
                  <div className="h-12 w-12 rounded-full bg-primary/10 flex items-center justify-center">
                    <Activity className="h-6 w-6 text-primary" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-emerald-500">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Hoje</p>
                    <h3 className="text-3xl font-bold mt-2">{auditStats.today}</h3>
                  </div>
                  <div className="h-12 w-12 rounded-full bg-emerald-100 flex items-center justify-center">
                    <Calendar className="h-6 w-6 text-emerald-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-green-500">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Criações</p>
                    <h3 className="text-3xl font-bold mt-2">{auditStats.creates}</h3>
                  </div>
                  <div className="h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
                    <Plus className="h-6 w-6 text-green-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-l-4 border-l-orange-500">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Vendas</p>
                    <h3 className="text-3xl font-bold mt-2">{auditStats.sales}</h3>
                  </div>
                  <div className="h-12 w-12 rounded-full bg-orange-100 flex items-center justify-center">
                    <DollarSign className="h-6 w-6 text-orange-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filtros e Busca */}
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col md:flex-row gap-4">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
                  <Input 
                    placeholder="Buscar ação, usuário ou entidade..." 
                    className="pl-9" 
                    value={searchHistory}
                    onChange={(e) => setSearchHistory(e.target.value)}
                    data-testid="input-search-audit"
                  />
                </div>
                <Select value={actionFilter} onValueChange={setActionFilter}>
                  <SelectTrigger className="w-full md:w-[180px]">
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
                  <SelectTrigger className="w-full md:w-[200px]">
                    <SelectValue placeholder="Filtrar por usuário" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0">Todos Usuários</SelectItem>
                    {users.map(u => (
                      <SelectItem key={u.id} value={u.id}>{u.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

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
                  filteredAuditLogs.map((log, index) => {
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
          <div className="grid gap-4 lg:grid-cols-[1fr_420px]">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Receipt className="h-5 w-5 text-primary" />
                  Recibos & Faturas
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-2">
                  <div className="grid gap-2">
                    <Label>Nome da loja</Label>
                    <Input
                      value={invoiceSettings.seller.name}
                      onChange={(e) =>
                        setInvoiceSettings((prev) => ({ ...prev, seller: { ...prev.seller, name: e.target.value } }))
                      }
                      placeholder="Ex: Makira Sales"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>NIF (opcional)</Label>
                    <Input
                      value={invoiceSettings.seller.taxId ?? ''}
                      onChange={(e) =>
                        setInvoiceSettings((prev) => ({ ...prev, seller: { ...prev.seller, taxId: e.target.value } }))
                      }
                      placeholder="Ex: 400123456"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Telefone (opcional)</Label>
                    <Input
                      value={invoiceSettings.seller.phone ?? ''}
                      onChange={(e) =>
                        setInvoiceSettings((prev) => ({ ...prev, seller: { ...prev.seller, phone: e.target.value } }))
                      }
                      placeholder="Ex: +258 84 000 0000"
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label>Moeda</Label>
                    <Input
                      value={invoiceSettings.currencyLabel}
                      onChange={(e) => setInvoiceSettings((prev) => ({ ...prev, currencyLabel: e.target.value }))}
                      placeholder="Ex: MT"
                    />
                  </div>
                </div>

                <Separator />

                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <Label>Endereço</Label>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setAddressLines((prev) => [...prev, ''])}
                    >
                      + Adicionar linha
                    </Button>
                  </div>
                  <div className="space-y-2">
                    {(addressLines.length ? addressLines : ['']).map((val, idx) => (
                      <div key={idx} className="flex gap-2">
                        <Input
                          value={val}
                          onChange={(e) =>
                            setAddressLines((prev) => prev.map((x, i) => (i === idx ? e.target.value : x)))
                          }
                          placeholder={idx === 0 ? 'Ex: Av. 25 de Setembro' : 'Ex: Maputo'}
                        />
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setAddressLines((prev) => prev.filter((_, i) => i !== idx))}
                          disabled={addressLines.length <= 1}
                        >
                          Remover
                        </Button>
                      </div>
                    ))}
                  </div>
                </div>

                <Separator />

                <div className="space-y-3">
                  <div>
                    <p className="text-sm font-black">Transferências (Mpesa/Emola)</p>
                    <p className="text-xs text-muted-foreground">
                      Estes números aparecem no checkout do cliente quando ele escolher Mpesa/Emola.
                    </p>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="grid gap-2">
                      <Label>Número Mpesa</Label>
                      <Input
                        value={invoiceSettings.transferAccounts?.mpesa ?? ''}
                        onChange={(e) =>
                          setInvoiceSettings((prev) => ({
                            ...prev,
                            transferAccounts: { ...(prev.transferAccounts ?? {}), mpesa: e.target.value },
                          }))
                        }
                        placeholder="Ex: 84 000 0000"
                      />
                    </div>
                    <div className="grid gap-2">
                      <Label>Número Emola</Label>
                      <Input
                        value={invoiceSettings.transferAccounts?.emola ?? ''}
                        onChange={(e) =>
                          setInvoiceSettings((prev) => ({
                            ...prev,
                            transferAccounts: { ...(prev.transferAccounts ?? {}), emola: e.target.value },
                          }))
                        }
                        placeholder="Ex: 86 000 0000"
                      />
                    </div>
                  </div>
                </div>

                <Separator />

                <div className="grid gap-4 md:grid-cols-2">
                  <div className="grid gap-2">
                    <Label>Modelo padrão</Label>
                    <Select
                      value={invoiceSettings.defaultModel}
                      onValueChange={(v) => setInvoiceSettings((prev) => ({ ...prev, defaultModel: v as any }))}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Escolher modelo" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="classic">Clássico</SelectItem>
                        <SelectItem value="compact">Compacto</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between rounded-xl border border-border px-3 py-2">
                      <div>
                        <p className="text-sm font-semibold">Mostrar QR</p>
                        <p className="text-xs text-muted-foreground">Exibe QR na fatura</p>
                      </div>
                      <Checkbox
                        checked={invoiceSettings.showQr}
                        onCheckedChange={(v) => setInvoiceSettings((prev) => ({ ...prev, showQr: Boolean(v) }))}
                      />
                    </div>
                    <div className="flex items-center justify-between rounded-xl border border-border px-3 py-2">
                      <div>
                        <p className="text-sm font-semibold">Mostrar Barcode</p>
                        <p className="text-xs text-muted-foreground">Exibe código de barras</p>
                      </div>
                      <Checkbox
                        checked={invoiceSettings.showBarcode}
                        onCheckedChange={(v) => setInvoiceSettings((prev) => ({ ...prev, showBarcode: Boolean(v) }))}
                      />
                    </div>
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  {(['classic', 'compact'] as const).map((m) => {
                    const active = invoiceSettings.defaultModel === m;
                    return (
                      <button
                        key={m}
                        type="button"
                        onClick={() => setInvoiceSettings((prev) => ({ ...prev, defaultModel: m }))}
                        className={`overflow-hidden rounded-2xl border text-left transition ${
                          active ? 'border-primary/40 ring-2 ring-primary/20' : 'border-border hover:bg-muted/30'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
                          <div>
                            <p className="text-sm font-black">{m === 'classic' ? 'Clássico' : 'Compacto'}</p>
                            <p className="text-xs text-muted-foreground">Toque para definir como padrão</p>
                          </div>
                          <Badge variant={active ? 'default' : 'outline'} className="rounded-xl">
                            {active ? 'Padrão' : 'Selecionar'}
                          </Badge>
                        </div>
                        <div className="bg-muted/20 p-4">
                          <div className="grid grid-cols-3 gap-2">
                            <div className="h-3 rounded bg-white" />
                            <div className="h-3 rounded bg-white/80" />
                            <div className="h-3 rounded bg-white/60" />
                            <div className="col-span-3 h-12 rounded bg-white/70" />
                            <div className="col-span-2 h-8 rounded bg-white/60" />
                            <div className="h-8 rounded bg-white/60" />
                          </div>
                          <p className="mt-3 text-xs text-muted-foreground">
                            Preview completo ao lado.
                          </p>
                        </div>
                      </button>
                    );
                  })}
                </div>

                <div className="grid gap-2">
                  <Label>Notas padrão (uma por linha)</Label>
                  <Textarea
                    value={notesText}
                    onChange={(e) => {
                      setNotesText(e.target.value);
                      setInvoiceSettings((prev) => ({
                        ...prev,
                        defaultNotes: e.target.value.split('\n').map((x) => x.trim()).filter(Boolean).slice(0, 5),
                      }));
                    }}
                    placeholder="Ex:\nObrigado pela preferência\nTrocas até 7 dias"
                    className="min-h-[90px]"
                  />
                </div>

                <div className="flex flex-wrap gap-2">
                  <Button
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
                  >
                    Salvar configurações
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      const fresh = loadInvoiceSettings();
                      setInvoiceSettings(fresh);
                      setAddressLines(fresh.seller.addressLines ?? []);
                      setNotesText(fresh.defaultNotes.join('\n'));
                      toast({ title: 'Recarregado', description: 'Configuração atual recarregada.' });
                    }}
                  >
                    Recarregar
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card className="h-fit lg:sticky lg:top-20">
              <CardHeader>
                <CardTitle className="text-base">Preview (A7)</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="mx-auto w-fit rounded-2xl border border-border bg-white p-3 shadow-sm">
                  <InvoiceA7Template model={invoiceSettings.defaultModel} data={invoicePreviewData} />
                </div>
                <p className="mt-3 text-xs text-muted-foreground">
                  Este preview muda em tempo real conforme você edita.
                </p>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
