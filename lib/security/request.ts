import { NextResponse } from 'next/server';
import { rateLimit, clientKey } from './rate-limit';

export function enforceSameOrigin(request: Request) {
  const origin = request.headers.get('origin');
  if (!origin) return null;
  try {
    const originUrl = new URL(origin);
    const requestUrl = new URL(request.url);
    if (originUrl.protocol !== requestUrl.protocol || originUrl.host !== requestUrl.host) {
      return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 });
    }
  } catch {
    return NextResponse.json({ error: 'Invalid request origin' }, { status: 403 });
  }
  return null;
}

export async function enforceRateLimit(request: Request, scope: string, limit: number, windowMs = 60_000) {
  const result = await rateLimit(`${scope}:${clientKey(request)}`, limit, windowMs);
  if (!result.allowed) {
    return NextResponse.json({ error: 'Too many requests. Please try again later.' }, { status: 429, headers: { 'Retry-After': String(result.retryAfter) } });
  }
  return null;
}
