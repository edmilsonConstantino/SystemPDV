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
        <div className="relative overflow-hidden px-5 pb-10 pt-8">
          <div
            className="absolute inset-0 opacity-95"
            style={{
              background: `
                radial-gradient(ellipse 80% 60% at 100% 0%, rgba(255,255,255,0.35) 0%, transparent 50%),
                linear-gradient(135deg, hsl(172 72% 34%) 0%, hsl(239 78% 52%) 55%, hsl(262 72% 52%) 100%)
              `,
            }}
          />
          <div className="absolute -right-8 top-4 h-24 w-24 rounded-full bg-white/10 blur-2xl" />
          <div className="relative flex items-start gap-3 text-primary-foreground">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-white/20 shadow-lg ring-1 ring-white/40 backdrop-blur-sm">
              <Store className="h-6 w-6" strokeWidth={2.25} />
            </div>
            <div className="min-w-0 pt-0.5">
              <h1 className="font-heading text-lg font-bold leading-tight tracking-tight">Makira Sales</h1>
              <p className="mt-1 text-[0.65rem] font-bold uppercase tracking-[0.2em] text-white/85">
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
