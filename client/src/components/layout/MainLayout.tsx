import { ReactNode, useState, useEffect } from 'react';
import { Sidebar } from './Sidebar';
import { MobileSidebar } from './MobileSidebar';
import { MobileDock } from './MobileDock';
import { Header } from './Header';
import { useAuth } from '@/lib/auth';
import { Redirect } from 'wouter';
import { cn } from '@/lib/utils';

export function MainLayout({ children }: { children: ReactNode }) {
  const { user, isLoading } = useAuth();
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
