import { APIRequestContext, request as pwRequest } from '@playwright/test';
import { promoteGlobalRole, type GlobalRole } from './db';

/**
 * User fixtures for the RBAC/API-level specs.
 *
 * These create accounts through Better Auth's real REST endpoints
 * (POST /api/auth/sign-up/email) rather than inserting rows directly, so
 * password hashing and session issuance are exactly what production uses -
 * only global-role promotion (see fixtures/db.ts) bypasses the app, because
 * nothing in the app exposes that.
 *
 * The dashboard UI itself calls fetch() endpoints directly rather than a
 * shared API client (see app/dashboard/*), which is why these helpers talk
 * to the same REST routes instead of a typed SDK.
 */

export const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:3000';
export const TEST_PASSWORD = 'Test-Passw0rd!23';

export function uniqueEmail(label: string): string {
  return `${label}.${Date.now()}.${Math.random().toString(36).slice(2, 8)}@example.test`;
}

export interface TestUser {
  name: string;
  email: string;
  password: string;
  userId: string;
  /** Authenticated APIRequestContext - cookies from sign-up are already set. */
  context: APIRequestContext;
}

export interface OnboardedUser extends TestUser {
  orgId: string;
  orgSlug: string;
}

async function signUp(label: string, name?: string, email?: string): Promise<TestUser> {
  const context = await pwRequest.newContext({ baseURL: BASE_URL });
  const finalEmail = email ?? uniqueEmail(label);
  const displayName = name ?? label;
  const res = await context.post('/api/auth/sign-up/email', {
    data: { name: displayName, email: finalEmail, password: TEST_PASSWORD },
  });
  if (!res.ok()) {
    throw new Error(`Sign-up failed for ${finalEmail}: ${res.status()} ${await res.text()}`);
  }
  const body = await res.json();
  return { name: displayName, email: finalEmail, password: TEST_PASSWORD, userId: body.user.id, context };
}

/**
 * Real sign-up + real POST /api/onboarding (creates a workspace, matching
 * what the signup UI does automatically). Optionally promotes the user's
 * global role afterward for tests that need an AGENT/MANAGER/ADMIN fixture.
 */
export async function createOnboardedUser(opts: {
  label: string;
  name?: string;
  globalRole?: GlobalRole;
}): Promise<OnboardedUser> {
  const user = await signUp(opts.label, opts.name);
  const onboardRes = await user.context.post('/api/onboarding');
  if (!onboardRes.ok()) {
    throw new Error(`Onboarding failed for ${user.email}: ${onboardRes.status()} ${await onboardRes.text()}`);
  }
  const org = await onboardRes.json();
  if (opts.globalRole) {
    await promoteGlobalRole(user.userId, opts.globalRole);
  }
  return { ...user, orgId: org.id, orgSlug: org.slug };
}

/**
 * Real sign-up with NO workspace provisioned - used for the invited-user
 * flow, so the only membership the user ends up with is the one created by
 * accepting the invitation (see e2e/team.spec.ts).
 */
export async function createBareUser(opts: { label: string; name?: string; email?: string }): Promise<TestUser> {
  return signUp(opts.label, opts.name, opts.email);
}

export interface OrgMember extends TestUser {
  membershipRole: 'MEMBER' | 'VIEWER';
}

/**
 * Adds a second real person to `owner`'s workspace via the actual
 * invite -> accept flow (POST /api/team/invite as the owner, then the new
 * user signs up and POSTs /api/invite/[token]) rather than writing a
 * Membership row directly. Optionally promotes their global role afterward
 * for tests that need an AGENT/MANAGER/ADMIN fixture inside a shared
 * workspace (e.g. "manager assigns a request to an agent").
 */
export async function addMemberToOrg(
  owner: OnboardedUser,
  opts: { label: string; name?: string; inviteRole?: 'MEMBER' | 'VIEWER'; globalRole?: GlobalRole }
): Promise<OrgMember> {
  const email = uniqueEmail(opts.label);
  const inviteRes = await owner.context.post('/api/team/invite', {
    data: { email, role: opts.inviteRole ?? 'MEMBER' },
  });
  if (!inviteRes.ok()) {
    throw new Error(`Invite failed for ${email}: ${inviteRes.status()} ${await inviteRes.text()}`);
  }
  const invite = await inviteRes.json();
  const token: string = invite.acceptUrl.split('/invite/')[1];

  const member = await signUp(opts.label, opts.name, email);
  const acceptRes = await member.context.post(`/api/invite/${token}`);
  if (!acceptRes.ok()) {
    throw new Error(`Invite accept failed for ${email}: ${acceptRes.status()} ${await acceptRes.text()}`);
  }

  if (opts.globalRole) {
    await promoteGlobalRole(member.userId, opts.globalRole);
  }
  return { ...member, membershipRole: opts.inviteRole ?? 'MEMBER' };
}
