import { test, expect } from '@playwright/test';
import { createOnboardedUser, createBareUser, addMemberToOrg, uniqueEmail } from './fixtures/api';

test.describe('Team management', () => {
  test('flows 9 & 10: inviting and accepting adds a real member to the workspace', async ({ browser }) => {
    const owner = await createOnboardedUser({ label: 'invite-owner' });
    const ownerContext = await browser.newContext({ storageState: await owner.context.storageState() });
    const ownerPage = await ownerContext.newPage();

    await ownerPage.goto('/dashboard/team');
    const inviteEmail = uniqueEmail('invited-member');
    await ownerPage.locator('#invite-email').fill(inviteEmail);
    await ownerPage.locator('#invite-role').selectOption('MEMBER');
    await ownerPage.getByRole('button', { name: 'Create invitation' }).click();

    const successMsg = ownerPage.locator('.notice.success');
    await expect(successMsg).toContainText('Invitation created');
    const msgText = (await successMsg.textContent()) ?? '';
    const acceptUrlMatch = msgText.match(/https?:\/\/\S+/);
    expect(acceptUrlMatch).not.toBeNull();
    const token = acceptUrlMatch![0].split('/invite/')[1];

    // The invited person signs up with exactly the invited email, then accepts.
    const invited = await createBareUser({ label: 'invited-member', email: inviteEmail });
    const invitedContext = await browser.newContext({ storageState: await invited.context.storageState() });
    const invitedPage = await invitedContext.newPage();
    await invitedPage.goto(`/invite/${token}`);
    await invitedPage.getByRole('button', { name: 'Accept invitation' }).click();
    await expect(invitedPage).toHaveURL(/\/dashboard$/);

    // Confirm via the owner's team list, not just the redirect.
    await ownerPage.goto('/dashboard/team');
    await expect(ownerPage.getByText(inviteEmail)).toBeVisible();

    await ownerContext.close();
    await invitedContext.close();
  });

  test('an invitation can only be accepted by the invited email', async () => {
    const owner = await createOnboardedUser({ label: 'wrong-email-owner' });
    const inviteEmail = uniqueEmail('invited-correct');
    const inviteRes = await owner.context.post('/api/team/invite', { data: { email: inviteEmail, role: 'MEMBER' } });
    const invite = await inviteRes.json();
    const token: string = invite.acceptUrl.split('/invite/')[1];

    const someoneElse = await createBareUser({ label: 'invited-wrong' });
    const acceptRes = await someoneElse.context.post(`/api/invite/${token}`);
    expect(acceptRes.status()).toBe(403);
  });

  test('inviting the same email twice while a first invite is pending is rejected', async () => {
    const owner = await createOnboardedUser({ label: 'dup-invite-owner' });
    const email = uniqueEmail('dup-invite-target');
    const first = await owner.context.post('/api/team/invite', { data: { email, role: 'MEMBER' } });
    expect(first.status()).toBe(201);
    const second = await owner.context.post('/api/team/invite', { data: { email, role: 'MEMBER' } });
    expect(second.status()).toBe(409);
  });

  test('flow 11: changing a member role updates it, notifies them, and is audit-logged', async ({ browser }) => {
    const owner = await createOnboardedUser({ label: 'role-change-owner' });
    const member = await addMemberToOrg(owner, { label: 'role-change-member' });

    const ownerContext = await browser.newContext({ storageState: await owner.context.storageState() });
    const ownerPage = await ownerContext.newPage();
    await ownerPage.goto('/dashboard/team');

    const roleSelect = ownerPage.getByTestId(`role-select-${member.userId}`);
    await roleSelect.selectOption('ADMIN');
    await expect(roleSelect).toHaveValue('ADMIN');

    await ownerPage.goto('/dashboard/audit');
    await expect(ownerPage.getByRole('cell', { name: 'ROLE_CHANGED' })).toBeVisible();

    const notifications = await (await member.context.get('/api/notifications')).json();
    expect(
      notifications.some(
        (n: { type: string; title: string }) => n.type === 'SYSTEM' && n.title === 'Workspace role updated'
      )
    ).toBeTruthy();

    await ownerContext.close();
  });

  test('inviting and changing roles requires workspace admin access, not just membership', async () => {
    const owner = await createOnboardedUser({ label: 'team-guard-owner' });
    const member = await addMemberToOrg(owner, { label: 'team-guard-member' }); // plain MEMBER

    const inviteRes = await member.context.post('/api/team/invite', {
      data: { email: uniqueEmail('blocked-invite'), role: 'MEMBER' },
    });
    expect(inviteRes.status()).toBe(403);

    const roleRes = await member.context.patch('/api/team/role', {
      data: { userId: owner.userId, role: 'VIEWER' },
    });
    expect(roleRes.status()).toBe(403);
  });

  test('the workspace audit log is restricted to workspace admins', async ({ browser }) => {
    const owner = await createOnboardedUser({ label: 'audit-guard-owner' });
    const member = await addMemberToOrg(owner, { label: 'audit-guard-member' });

    const context = await browser.newContext({ storageState: await member.context.storageState() });
    const page = await context.newPage();
    await page.goto('/dashboard/audit');
    await expect(page.getByRole('heading', { name: 'Access restricted' })).toBeVisible();
    await context.close();
  });
});
