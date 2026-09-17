import Link from 'next/link';
import { redirect } from 'next/navigation';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { LogoutButton } from './logout-button';

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) redirect('/login?next=/dashboard');
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, include: { memberships: { include: { organization: true }, take: 1 } } });
  const membership = user?.memberships[0];
  const role = user?.role ?? 'USER';
  const links = [['/dashboard','Overview'],['/dashboard/requests','Insurance requests'],['/dashboard/customers','Customers'],['/dashboard/reports','Reports'],['/dashboard/notifications','Notifications'],['/dashboard/team','Team'],['/dashboard/audit','Audit logs'],['/dashboard/settings','Settings']].filter(([path]) => path !== '/dashboard/team' || ['MANAGER','ADMIN'].includes(role)).filter(([path]) => path !== '/dashboard/audit' || ['MANAGER','ADMIN'].includes(role)).filter(([path]) => path !== '/dashboard/reports' || ['MANAGER','ADMIN'].includes(role));
  return <div className="app-shell"><aside className="app-sidebar"><Link href="/" className="brand"><b className="brand-mark">T</b><span>TRIUMPH<br/><small>INSURANCE AGENCY</small></span></Link><div className="workspace"><small>WORKSPACE</small><strong>{membership?.organization.name ?? 'Personal workspace'}</strong><span>{role}</span></div><nav>{links.map(([href,label]) => <Link key={href} href={href}>{label}</Link>)}</nav><div className="sidebar-bottom"><Link href="/">← Public website</Link><LogoutButton /></div></aside><main className="app-main"><header className="app-topbar"><div><span className="mobile-brand">Triumph</span></div><div className="user-chip"><span>{user?.name?.slice(0,1).toUpperCase() ?? 'U'}</span><div><strong>{user?.name ?? session.user.email}</strong><small>{user?.email}</small></div></div></header>{children}</main></div>;
}
