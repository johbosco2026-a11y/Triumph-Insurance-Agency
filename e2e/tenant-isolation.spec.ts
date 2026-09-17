import { test, expect } from '@playwright/test';
import { createOnboardedUser, addMemberToOrg } from './fixtures/api';

test.describe('Cross-tenant isolation', () => {
  test("flow 13: one workspace cannot read or modify another workspace's request", async () => {
    const orgA = await createOnboardedUser({ label: 'tenant-a-requests', globalRole: 'MANAGER' });
    const orgB = await createOnboardedUser({ label: 'tenant-b-requests', globalRole: 'MANAGER' });

    const createRes = await orgB.context.post('/api/requests', {
      data: {
        name: 'Org B Confidential Customer',
        email: `orgb.${Date.now()}@example.test`,
        type: 'Motor',
        message: 'Confidential to org B.',
      },
    });
    expect(createRes.ok()).toBeTruthy();
    const orgBRequest = await createRes.json();

    // Direct-object-reference attempts from org A return 404 - not the
    // data, and not a 403 that would at least confirm the record exists.
    const statusAttempt = await orgA.context.patch(`/api/requests/${orgBRequest.id}`, { data: { status: 'IN_REVIEW' } });
    expect(statusAttempt.status()).toBe(404);

    const assignAttempt = await orgA.context.patch(`/api/requests/${orgBRequest.id}/assign`, {
      data: { assigneeId: null },
    });
    expect(assignAttempt.status()).toBe(404);

    const noteAttempt = await orgA.context.post(`/api/requests/${orgBRequest.id}/notes`, {
      data: { body: 'Attempted cross-tenant note.' },
    });
    expect(noteAttempt.status()).toBe(404);
  });

  test('customers are scoped per workspace', async () => {
    const orgA = await createOnboardedUser({ label: 'tenant-a-customers' });
    const orgB = await createOnboardedUser({ label: 'tenant-b-customers' });
    const email = `org-b-only.${Date.now()}@example.test`;
    const createRes = await orgB.context.post('/api/customers', { data: { name: 'Org B Only Customer', email } });
    expect(createRes.ok()).toBeTruthy();

    const listRes = await orgA.context.get('/api/customers');
    const rows: { email: string }[] = await listRes.json();
    expect(rows.some((c) => c.email === email)).toBeFalsy();
  });

  test('team membership is scoped per workspace', async () => {
    const orgA = await createOnboardedUser({ label: 'tenant-a-team' });
    const orgB = await createOnboardedUser({ label: 'tenant-b-team' });
    await addMemberToOrg(orgB, { label: 'tenant-b-only-member' });

    const teamRes = await orgA.context.get('/api/team');
    const members: { user: { email: string } }[] = await teamRes.json();
    expect(members.some((m) => m.user.email === orgB.email)).toBeFalsy();
  });

  test('reports are scoped per workspace', async () => {
    const orgA = await createOnboardedUser({ label: 'tenant-a-reports', globalRole: 'MANAGER' });
    const orgB = await createOnboardedUser({ label: 'tenant-b-reports', globalRole: 'MANAGER' });
    const uniqueType = `TenantIsolationType${Date.now()}`;
    const createRes = await orgB.context.post('/api/requests', {
      data: { name: 'Org B', email: `orgb-report.${Date.now()}@example.test`, type: uniqueType, message: 'x' },
    });
    expect(createRes.ok()).toBeTruthy();

    const reportRes = await orgA.context.get('/api/reports');
    const report = await reportRes.json();
    expect(report.byType.some((x: { type: string }) => x.type === uniqueType)).toBeFalsy();
  });

  test('an invitation token from one workspace cannot be redeemed to join a different membership context', async () => {
    const orgA = await createOnboardedUser({ label: 'tenant-a-invite' });
    const invitedEmail = `cross-tenant-invitee.${Date.now()}@example.test`;
    const inviteRes = await orgA.context.post('/api/team/invite', { data: { email: invitedEmail, role: 'MEMBER' } });
    const invite = await inviteRes.json();
    const token: string = invite.acceptUrl.split('/invite/')[1];

    // A different, already-signed-up person (wrong email) must not be able
    // to redeem org A's invitation for themselves.
    const orgB = await createOnboardedUser({ label: 'tenant-b-wrong-acceptor' });
    const acceptRes = await orgB.context.post(`/api/invite/${token}`);
    expect(acceptRes.status()).toBe(403);

    const teamRes = await orgA.context.get('/api/team');
    const members: { user: { email: string } }[] = await teamRes.json();
    expect(members.some((m) => m.user.email === orgB.email)).toBeFalsy();
  });
});
