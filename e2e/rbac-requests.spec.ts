import { test, expect } from '@playwright/test';
import { createOnboardedUser, addMemberToOrg } from './fixtures/api';

async function createTestRequest(actor: { context: import('@playwright/test').APIRequestContext }) {
  const res = await actor.context.post('/api/requests', {
    data: {
      name: `RBAC Test Customer ${Date.now()}`,
      email: `rbac.${Date.now()}.${Math.random().toString(36).slice(2, 6)}@example.test`,
      type: 'Motor',
      message: 'Need a quote.',
    },
  });
  expect(res.ok(), await res.text()).toBeTruthy();
  return res.json();
}

test.describe('Request assignment and status RBAC', () => {
  // NOTE: the dashboard has no UI to trigger assignment at all - the API
  // (app/api/requests/[id]/assign/route.ts) is fully built and guarded, but
  // nothing in app/dashboard calls it. These are genuine API-level tests,
  // not a stand-in for a UI test that could have been written instead.
  test('flow 5: a manager can assign a request to a workspace member, who is notified', async () => {
    const manager = await createOnboardedUser({ label: 'assign-manager', globalRole: 'MANAGER' });
    const agent = await addMemberToOrg(manager, { label: 'assign-agent', globalRole: 'AGENT' });
    const created = await createTestRequest(manager);

    const assignRes = await manager.context.patch(`/api/requests/${created.id}/assign`, {
      data: { assigneeId: agent.userId },
    });
    expect(assignRes.status()).toBe(200);
    expect((await assignRes.json()).assignedToId).toBe(agent.userId);

    const notifications = await (await agent.context.get('/api/notifications')).json();
    expect(
      notifications.some(
        (n: { type: string; title: string }) => n.type === 'REQUEST_ASSIGNED' && n.title === 'New insurance request assigned'
      )
    ).toBeTruthy();
  });

  test('assigning a request requires manager/admin access', async () => {
    const owner = await createOnboardedUser({ label: 'assign-guard-owner' }); // default global role: USER
    const created = await createTestRequest(owner);
    const res = await owner.context.patch(`/api/requests/${created.id}/assign`, { data: { assigneeId: null } });
    expect(res.status()).toBe(403);
  });

  test('assigning to someone outside the workspace is rejected', async () => {
    const manager = await createOnboardedUser({ label: 'assign-outsider-manager', globalRole: 'MANAGER' });
    const outsider = await createOnboardedUser({ label: 'assign-outsider' }); // separate org entirely
    const created = await createTestRequest(manager);
    const res = await manager.context.patch(`/api/requests/${created.id}/assign`, {
      data: { assigneeId: outsider.userId },
    });
    expect(res.status()).toBe(400);
  });

  test('flow 6: changing a request status notifies the assigned member', async () => {
    const manager = await createOnboardedUser({ label: 'status-manager', globalRole: 'MANAGER' });
    const agent = await addMemberToOrg(manager, { label: 'status-agent', globalRole: 'AGENT' });
    const created = await createTestRequest(manager);
    await manager.context.patch(`/api/requests/${created.id}/assign`, { data: { assigneeId: agent.userId } });

    // The manager (not the assignee) changes the status, since the API only
    // notifies when the actor differs from the assignee (see
    // app/api/requests/[id]/route.ts).
    const statusRes = await manager.context.patch(`/api/requests/${created.id}`, { data: { status: 'IN_REVIEW' } });
    expect(statusRes.status()).toBe(200);

    const notifications = await (await agent.context.get('/api/notifications')).json();
    expect(notifications.some((n: { type: string }) => n.type === 'STATUS_CHANGED')).toBeTruthy();
  });

  test('changing status requires agent/manager/admin access', async () => {
    const owner = await createOnboardedUser({ label: 'status-guard-owner' }); // default global role: USER
    const created = await createTestRequest(owner);
    const res = await owner.context.patch(`/api/requests/${created.id}`, { data: { status: 'IN_REVIEW' } });
    expect(res.status()).toBe(403);
  });

  test('flow 7: approving/rejecting a request requires manager/admin access, not just agent', async () => {
    const manager = await createOnboardedUser({ label: 'approve-manager', globalRole: 'MANAGER' });
    const agent = await addMemberToOrg(manager, { label: 'approve-agent', globalRole: 'AGENT' });
    const created = await createTestRequest(manager);

    const agentAttempt = await agent.context.patch(`/api/requests/${created.id}`, { data: { status: 'APPROVED' } });
    expect(agentAttempt.status()).toBe(403);

    const managerAttempt = await manager.context.patch(`/api/requests/${created.id}`, { data: { status: 'APPROVED' } });
    expect(managerAttempt.status()).toBe(200);
    expect((await managerAttempt.json()).status).toBe('APPROVED');
  });
});
