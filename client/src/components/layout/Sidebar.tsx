import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { Link, useLocation } from 'wouter';
import { useState, useEffect } from 'react';
import { LogOut, Store, ChevronLeft, ChevronRight, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { toast } from '@/hooks/use-toast';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { mainNavItems, type AppRole } from '@/lib/navConfig';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationsApi } from '@/lib/api';

interface SidebarProps {
  collapsed?: boolean;
  onCollapsedChange?: (collapsed: boolean) => void;
}

export function Sidebar({ collapsed: controlledCollapsed, onCollapsedChange }: SidebarProps) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const [internalCollapsed, setInternalCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebar-collapsed');
    return saved === 'true';
  });
  
  const collapsed = controlledCollapsed ?? internalCollapsed;
  
  const toggleCollapsed = () => {
    const newValue = !collapsed;
    setInternalCollapsed(newValue);
    localStorage.setItem('sidebar-collapsed', String(newValue));
    onCollapsedChange?.(newValue);
  };

  if (!user) return null;

  const role = user.role as AppRole;

  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications'],
    queryFn: notificationsApi.getAll,
    enabled: !!user && role !== 'seller',
    refetchInterval: 10000,
  });

  const markReadMutation = useMutation({
    mutationFn: notificationsApi.markAsRead,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const deleteMutation = useMutation({
    mutationFn: notificationsApi.delete,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['notifications'] }),
  });

  const newOrdersUnread = notifications.filter((n: any) => !n.read && n.metadata?.action === 'new_order').length;

  // Ao abrir a página de pedidos, consumir as notificações de novos pedidos
  useEffect(() => {
    if (location !== '/orders') return;
    const toConsume = notifications.filter((n: any) => !n.read && n.metadata?.action === 'new_order');
    toConsume.forEach((n: any) => {
      markReadMutation.mutate(n.id);
      deleteMutation.mutate(n.id);
    });
  }, [location, notifications]);

  const handleLogout = async () => {
    try {
      await logout();
      toast({
        title: "Logout realizado",
        description: "Até logo!",
      });
      setLocation('/login');
    } catch (error: any) {
      toast({
        variant: "destructive",
        title: "Erro ao fazer logout",
        description: error.message,
      });
    }
  };

  const filteredNav = mainNavItems.filter((item) => item.roles.includes(role));

  return (
    <aside className={cn(
      "sdb-root hidden md:flex flex-col h-screen fixed left-0 top-0 z-20 transition-all duration-300 border-r border-gray-200",
      collapsed ? "w-16" : "w-[220px]"
    )}>


      {/* Logo */}
      <div className={cn("flex items-center gap-3 border-b border-gray-200 py-4", collapsed ? "justify-center px-2" : "px-5")}>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-red-600 to-red-800 shadow-md ring-2 ring-red-100">
          <Store className="h-5 w-5 text-white" strokeWidth={2.25} />
        </div>
        {!collapsed && (
          <div>
            <h1 className="font-heading text-[17px] font-bold leading-none tracking-tight text-gray-900">Makira Sales</h1>
            <span className="text-[11px] font-medium text-gray-400">Sistema de vendas</span>
          </div>
        )}
      </div>

      {/* Collapse toggle */}
      <Button
        variant="ghost"
        size="icon"
        onClick={toggleCollapsed}
        className="absolute -right-3 top-[68px] h-6 w-6 rounded-full border border-gray-200 bg-white text-gray-500 shadow-md z-30 hover:bg-gray-100 hover:text-gray-800"
        data-testid="button-toggle-sidebar"
      >
        {collapsed ? <ChevronRight className="h-3.5 w-3.5" /> : <ChevronLeft className="h-3.5 w-3.5" />}
      </Button>

      {/* Nav */}
      <nav className={cn("flex-1 overflow-y-auto py-6", collapsed ? "px-2" : "px-4")}>
        {!collapsed && (
          <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-gray-400">Principal</p>
        )}
        {filteredNav.map((item) => {
          const isActive = !item.openInNewTab && location === item.href;
          const showOrdersBadge = item.href === '/orders' && newOrdersUnread > 0;

          const itemClass = (compact: boolean) => cn(
            'no-underline transition-colors duration-150 group',
            compact
              ? 'flex items-center justify-center rounded-lg p-2.5'
              : 'flex items-center gap-2.5 rounded-lg px-3 py-[9px] text-[13.5px] font-medium',
            isActive
              ? 'sdb-item-active border-l-[3px] border-red-600 pl-[9px] text-red-700'
              : 'border-l-[3px] border-transparent text-gray-600 hover:bg-gray-100 hover:text-gray-900',
          );

          const iconClass = cn('h-[18px] w-[18px] shrink-0 opacity-70 group-hover:opacity-100', isActive && 'opacity-100');

          const inner = (
            <>
              <span className="relative">
                <item.icon className={iconClass} />
                {showOrdersBadge && (
                  <span className="absolute -right-1.5 -top-1.5 flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-[#C41C1C] px-1 text-[10px] font-bold text-white">
                    {newOrdersUnread > 9 ? '9+' : newOrdersUnread}
                  </span>
                )}
              </span>
              {!collapsed && (
                <>
                  <span className="flex-1">{item.label}</span>
                  {item.openInNewTab && <ExternalLink className="h-3 w-3 shrink-0 opacity-50" aria-hidden />}
                </>
              )}
            </>
          );

          if (item.openInNewTab) {
            if (collapsed) return (
              <Tooltip key={item.href} delayDuration={0}>
                <TooltipTrigger asChild>
                  <a href={item.href} target="_blank" rel="noopener noreferrer" title={item.label} className={itemClass(true)}>
                    <item.icon className={iconClass} />
                  </a>
                </TooltipTrigger>
                <TooltipContent side="right" className="font-medium">{item.label} (abre novo separador)</TooltipContent>
              </Tooltip>
            );
            return (
              <a key={item.href} href={item.href} target="_blank" rel="noopener noreferrer"
                className={itemClass(false)}>
                {inner}
              </a>
            );
          }

          if (collapsed) return (
            <Tooltip key={item.href} delayDuration={0}>
              <TooltipTrigger asChild>
                <Link href={item.href} className={itemClass(true)}>
                  <item.icon className={iconClass} />
                </Link>
              </TooltipTrigger>
              <TooltipContent side="right" className="font-medium">{item.label}</TooltipContent>
            </Tooltip>
          );

          return (
            <Link key={item.href} href={item.href} className={itemClass(false)}
             >
              {inner}
            </Link>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className={cn("border-t border-gray-200 p-4", collapsed ? "px-2" : "")}>
        {!collapsed ? (
          <>
            {/* User row */}
            <div className="flex items-center gap-2.5 px-1 mb-3">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-[#C41C1C] to-[#5A0000] text-sm font-bold text-white">
                {user.avatar || user.name.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-medium text-gray-900">{user.name}</p>
                <p className="truncate text-[11px] capitalize text-gray-400">
                  {user.role === 'manager' ? 'Gestor' : user.role === 'seller' ? 'Vendedor' : 'Admin'}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              data-testid="button-logout"
              className="w-full justify-start rounded-lg border border-gray-200 bg-transparent text-[13px] text-gray-500 hover:bg-gray-100 hover:text-gray-900"
              onClick={handleLogout}
            >
              <LogOut className="mr-2 h-4 w-4" />
              Sair
            </Button>
          </>
        ) : (
          <Tooltip delayDuration={0}>
            <TooltipTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                data-testid="button-logout"
                className="w-full rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-800"
                onClick={handleLogout}
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="right">Sair</TooltipContent>
          </Tooltip>
        )}
      </div>
    </aside>
  );
}

export function useSidebarCollapsed() {
  const [collapsed, setCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebar-collapsed');
    return saved === 'true';
  });
  
  return { collapsed, setCollapsed };
}
