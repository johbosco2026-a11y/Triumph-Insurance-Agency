import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { clientKey, rateLimit } from '@/lib/security/rate-limit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(request: Request) {
  const session = await auth.api.getSession({ headers: await headers() });
  if (!session?.user) return new Response('Unauthorized', { status: 401 });
  const streamLimit = await rateLimit(`notification-stream:${session.user.id}:${clientKey(request)}`, 5, 60_000);
  if (!streamLimit.allowed) return new Response('Too many notification streams', { status: 429, headers: { 'Retry-After': String(streamLimit.retryAfter) } });

  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      let closed = false;
      let lastSeen = new Date(0);
      let timer: ReturnType<typeof setInterval> | undefined;
      const close = () => {
        if (closed) return;
        closed = true;
        if (timer) clearInterval(timer);
        try { controller.close(); } catch {}
      };
      const send = (event: string, data: unknown) => {
        if (closed) return;
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };
      const poll = async () => {
        try {
          const rows = await prisma.notification.findMany({
            where: { userId: session.user.id, createdAt: { gt: lastSeen } },
            orderBy: { createdAt: 'asc' },
            take: 25,
          });
          for (const row of rows) {
            lastSeen = row.createdAt;
            send('notification', row);
          }
          send('heartbeat', { at: new Date().toISOString() });
        } catch {
          send('error', { message: 'Notification stream temporarily unavailable.' });
        }
      };
      await poll();
      timer = setInterval(poll, 3000);
      request.signal.addEventListener('abort', close, { once: true });
      setTimeout(close, 25 * 60 * 1000);
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  });
}
