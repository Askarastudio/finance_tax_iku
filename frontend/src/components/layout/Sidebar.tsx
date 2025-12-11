
import { Link, useLocation } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { useAuthStore } from '@/store/authStore';
import { UserRole } from '@/types/auth';
import {
  LayoutDashboard,
  Users,
  FileText,
  Calculator,
  TrendingUp,
  Settings,
  Upload,
  BookOpen,
  Shield,
} from 'lucide-react';

interface NavItem {
  title: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
  roles?: UserRole[];
}

const navItems: NavItem[] = [
  {
    title: 'Dashboard',
    href: '/dashboard',
    icon: LayoutDashboard,
  },
  {
    title: 'Bagan Akun',
    href: '/accounts',
    icon: BookOpen,
    roles: [UserRole.ADMIN, UserRole.ACCOUNTANT, UserRole.BOOKKEEPER],
  },
  {
    title: 'Transaksi',
    href: '/transactions',
    icon: FileText,
    roles: [UserRole.ADMIN, UserRole.ACCOUNTANT, UserRole.BOOKKEEPER],
  },
  {
    title: 'Laporan Keuangan',
    href: '/reports',
    icon: TrendingUp,
    roles: [UserRole.ADMIN, UserRole.ACCOUNTANT, UserRole.FINANCIAL_MANAGER],
  },
  {
    title: 'Analytics',
    href: '/analytics',
    icon: TrendingUp,
    roles: [UserRole.ADMIN, UserRole.FINANCIAL_MANAGER, UserRole.ACCOUNTANT],
  },
  {
    title: 'Pajak',
    href: '/tax',
    icon: Calculator,
    roles: [UserRole.ADMIN, UserRole.TAX_OFFICER, UserRole.ACCOUNTANT],
  },
  {
    title: 'Import/Export',
    href: '/import-export',
    icon: Upload,
    roles: [UserRole.ADMIN, UserRole.ACCOUNTANT],
  },
  {
    title: 'Pengguna',
    href: '/users',
    icon: Users,
    roles: [UserRole.ADMIN],
  },
  {
    title: 'Administrasi',
    href: '/admin',
    icon: Shield,
    roles: [UserRole.ADMIN],
  },
  {
    title: 'Pengaturan',
    href: '/settings',
    icon: Settings,
    roles: [UserRole.ADMIN],
  },
];

export function Sidebar() {
  const location = useLocation();
  const { user } = useAuthStore();

  console.log('Sidebar rendered, user:', user);

  const filteredNavItems = navItems.filter(item => {
    if (!item.roles) return true;
    return user && item.roles.includes(user.role);
  });

  console.log('Filtered nav items:', filteredNavItems);

  return (
    <div className="h-full">
      <div className="p-6">
        <h2 className="text-xl font-bold text-gray-900">
          Finance Tax IKU
        </h2>
        <p className="text-sm text-gray-500 mt-1">
          Sistem Keuangan & Pajak
        </p>
      </div>
      
      <nav className="mt-6">
        <ul className="space-y-1 px-3">
          {filteredNavItems.map((item) => {
            const isActive = location.pathname === item.href;
            return (
              <li key={item.href}>
                <Link
                  to={item.href}
                  className={cn(
                    'flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors',
                    isActive
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-700 hover:bg-gray-100 hover:text-gray-900'
                  )}
                >
                  <item.icon className="mr-3 h-5 w-5" />
                  {item.title}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}