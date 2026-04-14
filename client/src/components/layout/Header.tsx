import { useAuth } from '@/lib/auth';
import { Bell, Search, Menu, AlertTriangle, CheckCircle, Info, XCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { notificationsApi } from '@/lib/api';
import { format, formatDistanceToNow } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useState, useEffect } from 'react';

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

  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!user) return null;

  const dateShort = format(now, 'EEE, d MMM', { locale: ptBR });
  const dateFull = format(now, "EEEE, dd MMM yyyy", { locale: ptBR });
  const dateCap = dateFull.charAt(0).toUpperCase() + dateFull.slice(1);
  const timeStr = format(now, 'HH:mm:ss');

  return (
    <header className="hdr-root sticky top-0 z-30 border-b border-gray-200 bg-white">
      <div className="flex h-[58px] items-center justify-between gap-3 px-4 md:px-7 md:justify-end">

        {/* Mobile: menu + logo */}
        <div className="flex items-center gap-2.5 md:hidden">
          <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9 shrink-0 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-900"
            onClick={onMenuClick}
            aria-label="Abrir menu"
          >
            <Menu className="h-5 w-5" />
          </Button>
          {/* Logo mark mobile */}
          <div className="flex items-center gap-2">
            <div className="hdr-logomark flex h-7 w-7 items-center justify-center rounded-lg text-[12px] font-black text-white">
              NG
            </div>
            <span className="font-heading text-sm font-bold text-gray-900">
              Makira <span className="text-red-600">Sales</span>
            </span>
          </div>
        </div>


        {/* Right side */}
        <div className="flex shrink-0 items-center gap-3">
          {/* Date + clock */}
          <div className="hidden items-center gap-3 md:flex">
            <div className="h-7 w-px bg-gray-200" />
            <div className="flex flex-col items-end gap-0.5">
              <span className="text-[0.65rem] font-semibold uppercase tracking-widest text-gray-500">
                {dateCap}
              </span>
              <span className="font-mono text-[0.78rem] font-bold tabular-nums tracking-widest text-gray-900">
                {timeStr}
              </span>
            </div>
          </div>

          {/* Notifications */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="relative h-9 w-9 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-900"
                data-testid="button-notifications"
              >
                <Bell className={`h-5 w-5 ${criticalCount > 0 ? 'animate-bounce text-red-500' : ''}`} />
                {unreadCount > 0 && (
                  <span
                    className={`absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full text-[9px] font-bold text-white ${
                      criticalCount > 0 ? 'bg-red-600' : 'bg-[#C41C1C]'
                    }`}
                    data-testid="badge-unread"
                  >
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-80 p-0">
              <DropdownMenuLabel className="border-b border-border px-4 py-3">Notificações</DropdownMenuLabel>
              <div className="max-h-[300px] overflow-y-auto">
                {notifications.length === 0 ? (
                  <div className="p-4 text-center text-sm text-muted-foreground">Nenhuma notificação</div>
                ) : (
                  notifications.map((notif) => (
                    <div
                      key={notif.id}
                      data-testid={`notification-${notif.id}`}
                      className={`cursor-pointer border-b border-border p-3 transition-all last:border-0 hover:bg-muted/50 ${
                        !notif.read
                          ? notif.type === 'warning' || notif.type === 'error'
                            ? 'animate-pulse border-l-4 border-l-red-500 bg-red-50'
                            : 'bg-accent/10'
                          : ''
                      }`}
                      onClick={() => handleMarkRead(notif.id)}
                    >
                      <div className="flex items-start gap-3">
                        <div className="shrink-0">{getNotificationIcon(notif.type)}</div>
                        <div className="flex-1 space-y-1">
                          <p className={`text-sm leading-tight ${!notif.read ? 'font-semibold text-foreground' : 'text-muted-foreground'} ${notif.type === 'warning' || notif.type === 'error' ? 'font-bold' : ''}`}>
                            {notif.message}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(notif.createdAt), { addSuffix: true, locale: ptBR })}
                          </p>
                        </div>
                        {!notif.read && (
                          <div className={`mt-1 h-2 w-2 shrink-0 rounded-full ${notif.type === 'warning' || notif.type === 'error' ? 'bg-red-500' : notif.type === 'success' ? 'bg-green-500' : 'bg-blue-500'}`} />
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Avatar */}
          <div
            className="hdr-avatar flex h-[34px] w-[34px] items-center justify-center rounded-full text-[13px] font-bold text-white ring-2 ring-red-200"
            title={user.name}
          >
            {(user.avatar || user.name).charAt(0).toUpperCase()}
          </div>
        </div>
      </div>

      {/* Mobile search bar */}
      <div className="border-t border-gray-100 px-3 pb-2 pt-2 md:hidden">
        <div className="relative">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <Input
            type="search"
            placeholder="Buscar produtos, pedidos…"
            className="h-9 w-full rounded-lg border-gray-200 bg-gray-50 pl-10 text-sm text-gray-800 placeholder:text-gray-400 focus-visible:border-red-400/60 focus-visible:ring-red-400/20"
          />
        </div>
      </div>
    </header>
  );
}
