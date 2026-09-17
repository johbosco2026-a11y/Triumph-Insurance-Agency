import { prisma } from '@/lib/prisma';

export async function rateLimit(key: string, limit: number, windowMs: number) {
  const now = new Date();
  const resetAt = new Date(now.getTime() + windowMs);
  const current = await prisma.rateLimitBucket.findUnique({ where: { key } });

  if (!current || current.resetAt <= now) {
    await prisma.rateLimitBucket.upsert({
      where: { key },
      create: { key, count: 1, resetAt },
      update: { count: 1, resetAt },
    });
    return { allowed: true, remaining: Math.max(0, limit - 1), retryAfter: 0 };
  }

  if (current.count >= limit) {
    return { allowed: false, remaining: 0, retryAfter: Math.ceil((current.resetAt.getTime() - now.getTime()) / 1000) };
  }

  const updated = await prisma.rateLimitBucket.update({
    where: { key },
    data: { count: { increment: 1 } },
  });
  return { allowed: updated.count <= limit, remaining: Math.max(0, limit - updated.count), retryAfter: Math.ceil((updated.resetAt.getTime() - now.getTime()) / 1000) };
}

export function clientKey(request: Request, fallback = 'unknown') {
  const forwarded = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  return forwarded || request.headers.get('x-real-ip') || fallback;
}
