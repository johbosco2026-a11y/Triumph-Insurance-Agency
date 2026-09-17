import { NextResponse } from 'next/server';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { enforceRateLimit, enforceSameOrigin } from '@/lib/security/request';

export async function POST(req: Request, { params }: { params: Promise<{ token: string }> }) {
  const originError = enforceSameOrigin(req); if (originError) return originError;
  const limitError = await enforceRateLimit(req, 'invite-accept', 10); if (limitError) return limitError;
  const s = await auth.api.getSession({ headers: await headers() });
  if (!s?.user) return NextResponse.json({ error: 'Please sign in first.' }, { status: 401 });
  const { token } = await params;
  const invite = await prisma.invitation.findUnique({ where: { token } });
  if (!invite || invite.acceptedAt || invite.expiresAt < new Date()) return NextResponse.json({ error: 'This invitation is invalid or expired.' }, { status: 400 });
  if (invite.email.toLowerCase() !== s.user.email.toLowerCase()) return NextResponse.json({ error: 'This invitation was sent to a different email address.' }, { status: 403 });
  const membership = await prisma.membership.upsert({ where: { userId_organizationId: { userId: s.user.id, organizationId: invite.organizationId } }, update: { role: invite.role }, create: { userId: s.user.id, organizationId: invite.organizationId, role: invite.role } });
  await prisma.invitation.update({ where: { id: invite.id }, data: { acceptedAt: new Date() } });
  await prisma.auditLog.create({ data: { userId: s.user.id, organizationId: invite.organizationId, action: 'INVITATION_ACCEPTED', resource: invite.id } });
  return NextResponse.json({ ok: true, membership });
}
