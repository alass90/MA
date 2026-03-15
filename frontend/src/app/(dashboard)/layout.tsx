import DashboardLayoutContent from '@/components/dashboard/layout-content';

// All dashboard pages require runtime context (auth, presence, etc.)
// Opt out of static prerendering across all dashboard routes
export const dynamic = 'force-dynamic';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export default function DashboardLayout({
  children,
}: DashboardLayoutProps) {
  return <DashboardLayoutContent>{children}</DashboardLayoutContent>;
}
