'use client';
import { useRouter } from 'next/navigation';
import { authClient } from '@/lib/auth-client';
export function LogoutButton(){ const router=useRouter(); return <button className="sidebar-logout" onClick={async()=>{await authClient.signOut(); router.replace('/'); router.refresh();}}>Sign out</button>; }
