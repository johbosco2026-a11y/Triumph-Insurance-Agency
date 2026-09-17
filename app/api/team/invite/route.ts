import crypto from 'node:crypto';
import { NextResponse } from 'next/server';
import { z } from 'zod';
import { headers } from 'next/headers';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { sendSecurityEmail, escapeHtml } from '@/lib/email';
import { enforceRateLimit, enforceSameOrigin } from '@/lib/security/request';

const schema = z.object({ email: z.string().email(), role: z.enum(['MEMBER', 'VIEWER']) });

export async function POST(req: Request) {
  const originError = enforceSameOrigin(req); if (originError) return originError;
  const limitError = await enforceRateLimit(req, 'team-invite', 10); if (limitError) return limitError;
  const s = await auth.api.getSession({ headers: await headers() });
  if (!s?.user) return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  const m = await prisma.membership.findFirst({ where: { userId: s.user.id }, include: { organization: true } });
  if (!m || !['OWNER', 'ADMIN'].includes(m.role)) return NextResponse.json({ error: 'Workspace admin access required' }, { status: 403 });
  const p = schema.safeParse(await req.json());
  if (!p.success) return NextResponse.json({ error: 'Valid email and role required' }, { status: 400 });
  const email = p.data.email.toLowerCase();
  const activeInvite = await prisma.invitation.findFirst({ where: { organizationId: m.organizationId, email, acceptedAt: null, expiresAt: { gt: new Date() } } });
  if (activeInvite) return NextResponse.json({ error: 'An active invitation already exists for that email.' }, { status: 409 });
  const existing = await prisma.membership.findFirst({ where: { organizationId: m.organizationId, user: { email } } });
  if (existing) return NextResponse.json({ error: 'That email is already a workspace member.' }, { status: 409 });
  const token = crypto.randomBytes(32).toString('hex');
  const invite = await prisma.invitation.create({ data: { organizationId: m.organizationId, email, role: p.data.role, token, invitedById: s.user.id, expiresAt: new Date(Date.now() + 48 * 60 * 60 * 1000) } });
  const baseUrl = process.env.BETTER_AUTH_URL ?? new URL(req.url).origin;
  const acceptUrl = `${baseUrl}/invite/${token}`;
  try {
    await sendSecurityEmail(email, `You're invited to ${m.organization.name}`, `<p>You have been invited to join <strong>${escapeHtml(m.organization.name)}</strong> on Triumph Insurance Agency.</p><p><a href="${escapeHtml(acceptUrl)}">Accept invitation</a></p><p>This invitation expires in 48 hours.</p>`);
  } catch (error) {
    await prisma.invitation.delete({ where: { id: invite.id } });
    console.error('Invitation email failed', error);
    return NextResponse.json({ error: 'Invitation could not be delivered. Check email configuration and try again.' }, { status: 502 });
  }
  await prisma.auditLog.create({ data: { userId: s.user.id, organizationId: m.organizationId, action: 'MEMBER_INVITED', resource: invite.id, metadata: { email, role: invite.role } } });
  return NextResponse.json({ id: invite.id, email: invite.email, role: invite.role, expiresAt: invite.expiresAt, acceptUrl }, { status: 201 });
}
