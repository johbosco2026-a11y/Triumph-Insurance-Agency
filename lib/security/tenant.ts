import { TRPCError } from '@trpc/server';
import { prisma } from '@/lib/prisma';

export async function requireWorkspaceMembership(userId: string) {
  const membership = await prisma.membership.findFirst({ where: { userId }, include: { organization: true } });
  if (!membership) throw new TRPCError({ code: 'FORBIDDEN', message: 'No workspace membership.' });
  return membership;
}

export async function requireWorkspaceRole(userId: string, roles: string[]) {
  const membership = await requireWorkspaceMembership(userId);
  if (!roles.includes(membership.role)) throw new TRPCError({ code: 'FORBIDDEN', message: 'Insufficient workspace permissions.' });
  return membership;
}

export async function assertWorkspaceUser(userId: string, organizationId: string) {
  const membership = await prisma.membership.findFirst({ where: { userId, organizationId } });
  if (!membership) throw new TRPCError({ code: 'FORBIDDEN', message: 'You are not a member of this workspace.' });
  return membership;
}
