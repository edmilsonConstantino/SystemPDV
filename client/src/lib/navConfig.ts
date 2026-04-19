import type { LucideIcon } from 'lucide-react';
import {
  LayoutDashboard,
  ShoppingCart,
  Package,
  BarChart3,
  Settings,
  CheckSquare,
  Boxes,
  FileText,
  Store,
  History,
} from 'lucide-react';

export type AppRole = 'admin' | 'manager' | 'seller';

export interface MainNavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  roles: AppRole[];
  /** Usa <a target="_blank"> — útil para fluxo público fora do painel */
  openInNewTab?: boolean;
}

/**
 * Navegação principal (desktop + mobile). Manter uma única lista evita links em falta.
 */
export const mainNavItems: MainNavItem[] = [
  {
    label: 'Dashboard',
    href: '/',
    icon: LayoutDashboard,
    roles: ['admin', 'manager', 'seller'],
  },
  {
    label: 'PDV (Vendas)',
    href: '/pos',
    icon: ShoppingCart,
    roles: ['admin', 'manager', 'seller'],
  },
  {
    label: 'Produtos',
    href: '/products',
    icon: Package,
    roles: ['admin', 'manager'],
  },
  {
    label: 'Pedidos',
    href: '/orders',
    icon: Boxes,
    roles: ['admin', 'manager'],
  },
  {
    label: 'Loja pública',
    href: '/pedidos',
    icon: Store,
    roles: ['admin', 'manager', 'seller'],
    openInNewTab: true,
  },
  {
    label: 'Relatórios',
    href: '/reports',
    icon: BarChart3,
    roles: ['admin', 'manager'],
  },
  {
    label: 'Tarefas',
    href: '/tasks',
    icon: CheckSquare,
    roles: ['admin', 'manager', 'seller'],
  },
  {
    label: 'Histórico',
    href: '/history',
    icon: History,
    roles: ['admin', 'manager'],
  },
  {
    label: 'Rastreamento',
    href: '/tracking',
    icon: FileText,
    roles: ['admin', 'manager'],
  },
  {
    label: 'Configurações',
    href: '/settings',
    icon: Settings,
    roles: ['admin', 'manager'],
  },
];
