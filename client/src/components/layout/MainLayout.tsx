import { ReactNode, useState, useEffect } from 'react';
import { Sidebar } from './Sidebar';
import { MobileSidebar } from './MobileSidebar';
import { MobileDock } from './MobileDock';
import { Header } from './Header';
import { useAuth } from '@/lib/auth';
import { Redirect, useLocation } from 'wouter';
import { cn } from '@/lib/utils';
import { RotateCcw, Lock, Unlock } from 'lucide-react';

export function MainLayout({ children }: { children: ReactNode }) {
  const { user, isLoading, readOnly, unlockSystem } = useAuth();
  const [, setLocation] = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    const saved = localStorage.getItem('sidebar-collapsed');
    return saved === 'true';
  });

  useEffect(() => {
    const handleStorageChange = () => {
      const saved = localStorage.getItem('sidebar-collapsed');
      setSidebarCollapsed(saved === 'true');
    };
    
    window.addEventListener('storage', handleStorageChange);
    const interval = setInterval(handleStorageChange, 100);
    
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      clearInterval(interval);
    };
  }, []);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-3">
          <div className="h-11 w-11 animate-pulse rounded-2xl bg-gradient-to-br from-primary to-accent shadow-lg shadow-primary/25" />
          <p className="text-sm font-semibold text-muted-foreground">A carregar…</p>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Redirect to="/login" />;
  }

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar onCollapsedChange={setSidebarCollapsed} />
      <MobileSidebar open={mobileMenuOpen} onOpenChange={setMobileMenuOpen} />
      <MobileDock onOpenMenu={() => setMobileMenuOpen(true)} />

      <main
        className={cn(
          'flex min-w-0 flex-1 flex-col transition-all duration-300',
          /* Mobile: altura natural → scroll no documento; Desktop: painel com scroll interno */
          'md:h-[100dvh] md:min-h-0 md:overflow-hidden',
          sidebarCollapsed ? 'md:ml-16' : 'md:ml-[220px]',
        )}
      >
        <Header onMenuClick={() => setMobileMenuOpen(true)} />

        {/* ── BANNER MODO SÓ DE LEITURA ── */}
        {readOnly && (
          <div className="flex items-center gap-3 border-b border-amber-300 bg-amber-100 px-4 py-3">
            <Lock className="h-4 w-4 shrink-0 text-amber-700" />
            <div className="flex-1 text-sm">
              <span className="font-bold text-amber-800">Sistema em modo só de leitura</span>
              <span className="ml-2 text-amber-700">— Foi feita uma reversão de dados. Deseja editar os dados?</span>
            </div>
            {user?.role === 'admin' && (
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={unlockSystem}
                  className="flex items-center gap-1.5 rounded-lg bg-amber-700 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-amber-800"
                >
                  <Unlock className="h-3 w-3" />
                  Sim, desbloquear
                </button>
                <button
                  type="button"
                  onClick={() => setLocation('/settings?tab=rollback')}
                  className="flex items-center gap-1.5 rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-bold text-amber-700 transition hover:bg-amber-50"
                >
                  <RotateCcw className="h-3 w-3" />
                  Ver reversões
                </button>
              </div>
            )}
            {user?.role !== 'admin' && (
              <span className="shrink-0 text-xs font-semibold text-amber-600">Contacte o administrador para desbloquear</span>
            )}
          </div>
        )}

        <div
          className={cn(
            'w-full p-3 pb-28 sm:p-4',
            'md:min-h-0 md:flex-1 md:overflow-y-auto md:overscroll-y-contain md:p-6 md:pb-6',
          )}
        >
          <div className="mx-auto max-w-7xl animate-in fade-in duration-150">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
