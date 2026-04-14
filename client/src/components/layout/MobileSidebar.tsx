import { useAuth } from '@/lib/auth';
import { cn } from '@/lib/utils';
import { Link, useLocation } from 'wouter';
import { LogOut, Store, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Sheet, SheetContent } from '@/components/ui/sheet';
import { toast } from '@/hooks/use-toast';
import { mainNavItems, type AppRole } from '@/lib/navConfig';

interface MobileSidebarProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function MobileSidebar({ open, onOpenChange }: MobileSidebarProps) {
  const { user, logout } = useAuth();
  const [location, setLocation] = useLocation();

  if (!user) return null;

  const role = user.role as AppRole;

  const handleLogout = async () => {
    try {
      await logout();
      toast({
        title: 'Logout realizado',
        description: 'Até logo!',
      });
      setLocation('/login');
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'Erro desconhecido';
      toast({
        variant: 'destructive',
        title: 'Erro ao fazer logout',
        description: message,
      });
    } finally {
      onOpenChange(false);
    }
  };

  const handleNavClick = () => {
    onOpenChange(false);
  };

  const filteredNav = mainNavItems.filter((item) => item.roles.includes(role));

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="left"
        className="flex w-[min(92vw,20rem)] flex-col border-r border-border bg-card p-0 shadow-2xl shadow-primary/10"
      >
        <div className="relative overflow-hidden bg-[#B71C1C] px-5 pb-6 pt-5">
          <div className="banner-texture" />
          <div className="absolute -right-6 -top-6 h-24 w-24 rounded-full bg-white/8 blur-2xl" />
          <div className="relative flex items-center gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl bg-white/15 ring-1 ring-white/25">
              <Store className="h-5 w-5 text-white" strokeWidth={2.25} />
            </div>
            <div className="min-w-0">
              <h1 className="text-base font-extrabold leading-tight tracking-tight text-white">Makira Sales</h1>
              <p className="mt-0.5 text-[0.6rem] font-bold uppercase tracking-[0.22em] text-white/60">
                Sistema de vendas
              </p>
            </div>
          </div>
        </div>

        <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
          {filteredNav.map((item) => {
            const isActive = !item.openInNewTab && location === item.href;
            const className = cn(
              'flex items-center gap-3 rounded-2xl px-4 py-3.5 text-sm font-semibold transition-all active:scale-[0.98]',
              isActive
                ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/25 ring-1 ring-primary/30'
                : 'bg-muted/40 text-foreground hover:bg-muted/80',
            );
            const iconCls = cn(
              'h-5 w-5 shrink-0',
              isActive ? 'text-primary-foreground' : 'text-primary',
            );

            if (item.openInNewTab) {
              return (
                <a
                  key={item.href}
                  href={item.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={handleNavClick}
                  className={className}
                >
                  <item.icon className={iconCls} />
                  <span className="flex-1">{item.label}</span>
                  <ExternalLink className="h-4 w-4 shrink-0 opacity-70" aria-hidden />
                </a>
              );
            }

            return (
              <Link key={item.href} href={item.href} onClick={handleNavClick} className={className}>
                <item.icon className={iconCls} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-border bg-muted/25 p-4">
          <div className="mb-4 flex items-center gap-3 rounded-2xl border border-border/80 bg-card px-3 py-3 shadow-sm">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-primary to-accent text-sm font-bold text-primary-foreground">
              {(user.avatar || user.name).charAt(0).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold text-foreground">{user.name}</p>
              <p className="truncate text-xs font-medium text-muted-foreground capitalize">
                {user.role === 'manager' ? 'Gestor' : user.role === 'seller' ? 'Vendedor' : 'Admin'}
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            className="h-11 w-full justify-center rounded-xl border-destructive/25 font-semibold text-destructive hover:bg-destructive/10"
            onClick={handleLogout}
          >
            <LogOut className="mr-2 h-4 w-4" />
            Sair
          </Button>
        </div>
      </SheetContent>
    </Sheet>
  );
}
