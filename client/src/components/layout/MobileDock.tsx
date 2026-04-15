import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { Link, useLocation } from 'wouter';
import { LayoutDashboard, ShoppingCart, Package, Boxes, CheckSquare, Menu } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import type { AppRole } from '@/lib/navConfig';
import { useQuery } from '@tanstack/react-query';
import { notificationsApi } from '@/lib/api';

interface MobileDockProps {
  onOpenMenu: () => void;
}

function DockItem({
  href,
  icon: Icon,
  label,
  active,
  badgeCount,
}: {
  href: string;
  icon: LucideIcon;
  label: string;
  active: boolean;
  badgeCount?: number;
}) {
  return (
    <Link
      href={href}
      className={cn(
        'flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-xl py-1.5 transition-transform active:scale-95',
        active ? 'text-[#B71C1C]' : 'text-gray-400 hover:text-gray-600',
      )}
    >
      <span
        className={cn(
          'relative flex h-9 w-9 items-center justify-center rounded-xl transition-colors',
          active ? 'bg-[#B71C1C]/10' : 'bg-transparent',
        )}
      >
        <Icon className="h-[1.15rem] w-[1.15rem] shrink-0" strokeWidth={active ? 2.5 : 2.25} />
        {!!badgeCount && badgeCount > 0 && (
          <span
            className="absolute -right-1 -top-1 flex h-4.5 min-w-4.5 items-center justify-center rounded-full bg-[#B71C1C] px-1 text-[10px] font-black leading-none text-white ring-2 ring-background"
            aria-label={`${badgeCount} novos pedidos`}
          >
            {badgeCount > 9 ? '9+' : badgeCount}
          </span>
        )}
      </span>
      <span className="max-w-full truncate px-0.5 text-[0.65rem] font-bold leading-none tracking-tight">{label}</span>
    </Link>
  );
}

const posFabButtonClass =
  'absolute -top-6 flex h-[3.25rem] w-[3.25rem] items-center justify-center rounded-2xl bg-gradient-to-b from-[#CC2936] to-[#7f1d1d] text-white shadow-[0_8px_24px_-6px_rgba(183,28,28,0.55)] ring-[3px] ring-background transition active:scale-95';

function PosFab() {
  const [location] = useLocation();
  const onPos = location === '/pos';

  return (
    <div className="relative flex min-w-0 flex-1 flex-col items-center px-0.5">
      {onPos ? (
        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent('makira:pos-open-cart'))}
          className={posFabButtonClass}
          aria-label="Abrir carrinho do PDV"
        >
          <ShoppingCart className="h-6 w-6" strokeWidth={2.25} />
        </button>
      ) : (
        <Link href="/pos" className={posFabButtonClass} aria-label="Abrir PDV">
          <ShoppingCart className="h-6 w-6" strokeWidth={2.25} />
        </Link>
      )}
      <span className="mt-7 text-[0.65rem] font-bold leading-none text-[#B71C1C]">PDV</span>
    </div>
  );
}

export function MobileDock({ onOpenMenu }: MobileDockProps) {
  const { user } = useAuth();
  const [location] = useLocation();
  const role = user?.role as AppRole | undefined;

  if (!user) return null;

  const isSeller = role === 'seller';

  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications'],
    queryFn: notificationsApi.getAll,
    enabled: !!user && !isSeller,
    refetchInterval: 10000,
    retry: (failureCount, error: any) => error?.status !== 401 && failureCount < 2,
  });

  const newOrdersUnread = notifications.filter((n: any) => !n.read && n.metadata?.action === 'new_order').length;

  return (
    <div
      className="pointer-events-none fixed inset-x-0 bottom-0 z-40 md:hidden"
      style={{ paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom, 0px))' }}
    >
      <div className="pointer-events-auto mx-auto max-w-lg px-3">
        <nav
          className="relative flex items-end justify-between gap-0.5 rounded-[1.35rem] border border-border/90 bg-card/90 px-1 pb-1 pt-2 shadow-[0_-12px_48px_-16px_rgba(15,23,42,0.18),0_0_0_1px_rgba(255,255,255,0.6)_inset] backdrop-blur-xl"
          aria-label="Navegação rápida"
        >
          <DockItem href="/" icon={LayoutDashboard} label="Início" active={location === '/'} />

          {isSeller ? (
            <DockItem href="/tasks" icon={CheckSquare} label="Tarefas" active={location === '/tasks'} />
          ) : (
            <DockItem href="/products" icon={Package} label="Produtos" active={location === '/products'} />
          )}

          <PosFab />

          {!isSeller && (
            <DockItem
              href="/orders"
              icon={Boxes}
              label="Pedidos"
              active={location === '/orders'}
              badgeCount={newOrdersUnread}
            />
          )}

          <button
            type="button"
            onClick={onOpenMenu}
            className="flex min-w-0 flex-1 flex-col items-center gap-0.5 rounded-xl py-1.5 text-gray-400 transition active:scale-95 hover:text-gray-600"
          >
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-transparent">
              <Menu className="h-[1.15rem] w-[1.15rem]" strokeWidth={2.25} />
            </span>
            <span className="max-w-full truncate px-0.5 text-[0.65rem] font-bold leading-none">Mais</span>
          </button>
        </nav>
      </div>
    </div>
  );
}
