import { useAuth } from '@/lib/auth';
import { Bell, Search, Menu, AlertTriangle, CheckCircle, Info, XCircle, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationsApi } from '@/lib/api';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';

interface HeaderProps {
  onMenuClick: () => void;
}

export function Header({ onMenuClick }: HeaderProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications'],
    queryFn: notificationsApi.getAll,
    enabled: !!user,
    refetchInterval: 10000 // Refetch every 10 seconds for real-time feel
  });

  const markAsReadMutation = useMutation({
    mutationFn: notificationsApi.markAsRead,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    }
  });

  const unreadCount = notifications.filter(n => !n.read).length;
  const criticalCount = notifications.filter(n => !n.read && (n.type === 'warning' || n.type === 'error')).length;

  const handleMarkRead = (id: string) => {
    markAsReadMutation.mutate(id);
    setTimeout(() => {
      notificationsApi.delete(id).then(() => {
        queryClient.invalidateQueries({ queryKey: ['notifications'] });
      }).catch(e => console.error("Delete notification error:", e));
    }, 5000);
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'warning':
        return <AlertTriangle className="h-5 w-5 text-[hsl(16_88%_48%)]" />;
      case 'error':
        return <XCircle className="h-5 w-5 text-destructive" />;
      case 'success':
        return <CheckCircle className="h-5 w-5 text-primary" />;
      default:
        return <Info className="h-5 w-5 text-accent" />;
    }
  };

  if (!user) return null;

  const dateShort = format(new Date(), 'EEE, d MMM', { locale: ptBR });

  return (
    <header className="sticky top-0 z-30 border-b border-border bg-card/90 shadow-sm shadow-primary/5 backdrop-blur-xl">
      <div className="flex h-14 items-center justify-between gap-3 px-3 sm:h-16 sm:px-4 md:px-6">
        <div className="flex min-w-0 flex-1 items-center gap-2 sm:gap-3 md:mr-4 md:flex-initial">
          <Button
            variant="ghost"
            size="icon"
            className="h-10 w-10 shrink-0 rounded-xl md:hidden"
            onClick={onMenuClick}
            aria-label="Abrir menu"
          >
            <Menu className="h-5 w-5" />
          </Button>
          <div className="min-w-0 md:hidden">
            <p className="truncate font-heading text-sm font-bold tracking-tight text-foreground">Makira Sales</p>
            <p className="truncate text-[0.65rem] font-semibold uppercase tracking-wider text-muted-foreground">
              {dateShort}
            </p>
          </div>
        </div>

        <div className="relative hidden max-w-md flex-1 md:flex">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary/70" />
          <Input
            type="search"
            placeholder="Buscar produtos, pedidos ou clientes…"
            className="h-10 w-full rounded-xl border-border bg-muted/40 pl-10 shadow-inner focus-visible:border-primary/40 focus-visible:ring-primary/20"
          />
        </div>

        <div className="flex shrink-0 items-center gap-1.5 sm:gap-2">
          <div className="hidden items-center gap-1.5 rounded-xl border border-border/80 bg-muted/30 px-2.5 py-1 sm:flex md:hidden">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            <span className="text-[0.7rem] font-semibold capitalize text-muted-foreground">{dateShort}</span>
          </div>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="relative h-10 w-10 rounded-xl hover:bg-primary/10"
                data-testid="button-notifications"
              >
                <Bell className={`h-5 w-5 ${criticalCount > 0 ? 'text-destructive animate-bounce' : 'text-muted-foreground'}`} />
                {unreadCount > 0 && (
                  <span
                    className={`absolute -right-0.5 -top-0.5 flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold text-destructive-foreground ${
                      criticalCount > 0
                        ? 'bg-destructive shadow-md shadow-destructive/40'
                        : 'bg-accent shadow-md shadow-accent/30'
                    }`}
                    data-testid="badge-unread"
                  >
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-80 p-0">
            <DropdownMenuLabel className="px-4 py-3 border-b border-border">Notificações</DropdownMenuLabel>
            <div className="max-h-[300px] overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-4 text-center text-sm text-muted-foreground">
                  Nenhuma notificação
                </div>
              ) : (
                notifications.map((notif) => (
                  <div 
                    key={notif.id} 
                    data-testid={`notification-${notif.id}`}
                    className={`p-3 border-b border-border last:border-0 hover:bg-muted/50 transition-all cursor-pointer ${
                      !notif.read ? (
                        notif.type === 'warning' ? 'bg-red-50 border-l-4 border-l-red-500 animate-pulse' :
                        notif.type === 'error' ? 'bg-red-50 border-l-4 border-l-red-500 animate-pulse' :
                        'bg-accent/10'
                      ) : ''
                    }`}
                    onClick={() => handleMarkRead(notif.id)}
                  >
                    <div className="flex items-start gap-3">
                      <div className="shrink-0">
                        {getNotificationIcon(notif.type)}
                      </div>
                      <div className="flex-1 space-y-1">
                        <p className={`text-sm leading-tight ${
                          !notif.read ? 'font-semibold text-foreground' : 'text-muted-foreground'
                        } ${
                          notif.type === 'warning' || notif.type === 'error' ? 'font-bold' : ''
                        }`}>
                          {notif.message}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(notif.createdAt), { addSuffix: true, locale: ptBR })}
                        </p>
                      </div>
                      {!notif.read && (
                        <div className={`mt-1 h-2 w-2 rounded-full shrink-0 ${
                          notif.type === 'warning' ? 'bg-red-500' : 
                          notif.type === 'success' ? 'bg-green-500' : 
                          notif.type === 'error' ? 'bg-red-500' : 'bg-blue-500'
                        }`} />
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </DropdownMenuContent>
        </DropdownMenu>

          <div
            className="ml-0.5 flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent text-sm font-bold text-primary-foreground shadow-md shadow-primary/25 ring-2 ring-background sm:h-10 sm:w-10"
            title={user.name}
          >
            {(user.avatar || user.name).charAt(0).toUpperCase()}
          </div>
        </div>
      </div>

      <div className="border-t border-border/60 px-3 pb-2 pt-2 md:hidden">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-primary/70" />
          <Input
            type="search"
            placeholder="Buscar produtos, pedidos…"
            className="h-10 w-full rounded-xl border-border bg-muted/35 pl-10 text-sm shadow-inner focus-visible:border-primary/40 focus-visible:ring-primary/20"
          />
        </div>
      </div>
    </header>
  );
}
