import { NextRequest, NextResponse } from 'next/server';

export function proxy(request: NextRequest) {
  const protectedPath = request.nextUrl.pathname === '/dashboard' || request.nextUrl.pathname.startsWith('/dashboard/');
  if (!protectedPath) return NextResponse.next();
  // Better Auth performs the authoritative session check in the page/server layer.
  // This middleware provides a safe redirect hint when no session cookie is present.
  const hasSessionCookie = request.cookies.get('better-auth.session_token') || request.cookies.get('__Secure-better-auth.session_token');
  if (!hasSessionCookie) return NextResponse.redirect(new URL(`/login?next=${encodeURIComponent(request.nextUrl.pathname)}`, request.url));
  return NextResponse.next();
}

export const config = { matcher: ['/dashboard/:path*'] };
