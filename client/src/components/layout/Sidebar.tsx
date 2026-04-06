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
      "hidden md:flex flex-col bg-sidebar border-r border-sidebar-border h-screen fixed left-0 top-0 z-20 transition-all duration-300",
      collapsed ? "w-16" : "w-64"
    )}>
      <div className={cn("p-4 flex items-center gap-3", collapsed ? "justify-center" : "px-6")}>
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary via-[hsl(239_78%_48%)] to-accent shadow-lg shadow-primary/30 ring-2 ring-primary/20">
          <Store className="h-5 w-5 text-primary-foreground" strokeWidth={2.25} />
        </div>
        {!collapsed && (
          <div>
            <h1 className="font-heading font-bold text-xl tracking-tight text-sidebar-foreground leading-none">
              Makira Sales
            </h1>
            <span className="text-xs font-medium text-muted-foreground">Sistema de vendas</span>
          </div>
        )}
      </div>

      <Button
        variant="ghost"
        size="icon"
        onClick={toggleCollapsed}
        className="absolute -right-3 top-20 h-6 w-6 rounded-full border border-sidebar-border bg-sidebar shadow-md z-30"
        data-testid="button-toggle-sidebar"
      >
        {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
      </Button>

      <nav className={cn("flex-1 py-4 space-y-1 overflow-y-auto", collapsed ? "px-2" : "px-4")}>
        {filteredNav.map((item) => {
          const isActive = !item.openInNewTab && location === item.href;
          const showOrdersBadge = item.href === '/orders' && newOrdersUnread > 0;
          const itemClass = (compact: boolean) =>
            cn(
              compact
                ? 'flex items-center justify-center p-2.5 rounded-md transition-all duration-200 group no-underline'
                : 'flex items-center gap-3 px-3 py-2.5 rounded-md transition-all duration-200 group no-underline',
              isActive
                ? 'bg-gradient-to-r from-primary to-[hsl(239_70%_48%)] text-primary-foreground shadow-md shadow-primary/25 font-semibold ring-1 ring-primary/20'
                : 'text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground',
            );

          const iconClass = cn(
            'h-5 w-5 shrink-0',
            isActive ? 'text-current' : 'text-muted-foreground group-hover:text-current',
          );

          const inner = (
            <>
              <span className="relative">
                <item.icon className={iconClass} />
                {showOrdersBadge && (
                  <span
                    className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-accent px-1 text-[10px] font-black text-accent-foreground ring-2 ring-background"
                    aria-label={`${newOrdersUnread} novos pedidos`}
                  >
                    {newOrdersUnread > 9 ? '9+' : newOrdersUnread}
                  </span>
                )}
              </span>
              {!collapsed && (
                <>
                  <span className="flex-1">{item.label}</span>
                  {item.openInNewTab && (
                    <ExternalLink className="h-3.5 w-3.5 shrink-0 opacity-60" aria-hidden />
                  )}
                </>
              )}
            </>
          );

          if (item.openInNewTab) {
            if (collapsed) {
              return (
                <Tooltip key={item.href} delayDuration={0}>
                  <TooltipTrigger asChild>
                    <a
                      href={item.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={itemClass(true)}
                    >
                      <item.icon className={iconClass} />
                    </a>
                  </TooltipTrigger>
                  <TooltipContent side="right" className="font-medium">
                    {item.label} (abre novo separador)
                  </TooltipContent>
                </Tooltip>
              );
            }
            return (
              <a
                key={item.href}
                href={item.href}
                target="_blank"
                rel="noopener noreferrer"
                className={itemClass(false)}
              >
                {inner}
              </a>
            );
          }

          if (collapsed) {
            return (
              <Tooltip key={item.href} delayDuration={0}>
                <TooltipTrigger asChild>
                  <Link href={item.href} className={itemClass(true)}>
                    <item.icon className={iconClass} />
                  </Link>
                </TooltipTrigger>
                <TooltipContent side="right" className="font-medium">
                  {item.label}
                </TooltipContent>
              </Tooltip>
            );
          }

          return (
            <Link key={item.href} href={item.href} className={itemClass(false)}>
              <item.icon className={iconClass} />
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>

      <div className={cn("p-4 border-t border-sidebar-border bg-sidebar/50 backdrop-blur-sm", collapsed && "px-2")}>
        {!collapsed ? (
          <>
            <div className="flex items-center gap-3 mb-4 px-2">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary to-accent text-sm font-bold text-primary-foreground ring-2 ring-primary/15">
                {user.avatar || user.name.charAt(0).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-sidebar-foreground truncate">{user.name}</p>
                <p className="text-xs text-muted-foreground capitalize truncate">
                  {user.role === 'manager' ? 'Gestor' : user.role === 'seller' ? 'Vendedor' : 'Admin'}
                </p>
              </div>
            </div>
            <Button 
              variant="outline" 
              data-testid="button-logout"
              className="w-full justify-start text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/20"
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
                variant="outline" 
                size="icon"
                data-testid="button-logout"
                className="w-full text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/20"
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
