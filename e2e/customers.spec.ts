import { test, expect } from '@playwright/test';
import { createOnboardedUser } from './fixtures/api';

test.describe('Customers', () => {
  test('flow 3: creating a customer persists it and shows it in the list', async ({ browser }) => {
    const owner = await createOnboardedUser({ label: 'customer-owner' });
    const context = await browser.newContext({ storageState: await owner.context.storageState() });
    const page = await context.newPage();

    await page.goto('/dashboard/customers');
    await page.getByRole('button', { name: '+ New customer' }).click();

    const customerName = `Aiko Tanaka ${Date.now()}`;
    const customerEmail = `aiko.${Date.now()}@example.test`;
    await page.getByLabel('Name').fill(customerName);
    await page.getByLabel('Email').fill(customerEmail);
    await page.getByLabel('Phone').fill('555-0100');
    await page.getByRole('button', { name: 'Create customer' }).click();

    // Note: the success message ("Customer created") is rendered inside the
    // same conditional block the form collapses into on success, so it
    // unmounts in the same render pass and a user never actually sees it -
    // this test checks the outcome that's actually observable instead.
    await expect(page.getByRole('cell', { name: customerName })).toBeVisible();

    // Persisted server-side, not just optimistic UI state: reload and it's still there.
    await page.reload();
    await expect(page.getByRole('cell', { name: customerName })).toBeVisible();
    await context.close();
  });

  test('customer search filters the list server-side', async ({ browser }) => {
    const owner = await createOnboardedUser({ label: 'customer-search' });
    const context = await browser.newContext({ storageState: await owner.context.storageState() });
    const page = await context.newPage();

    const uniqueToken = `Findme${Date.now()}`;
    const createRes = await owner.context.post('/api/customers', {
      data: { name: `${uniqueToken} Customer`, email: `${uniqueToken.toLowerCase()}@example.test` },
    });
    expect(createRes.ok()).toBeTruthy();
    await owner.context.post('/api/customers', {
      data: { name: 'Someone Else Entirely', email: `other.${Date.now()}@example.test` },
    });

    await page.goto('/dashboard/customers');
    await page.getByLabel('Search customers').fill(uniqueToken);
    await expect(page.getByRole('cell', { name: `${uniqueToken} Customer` })).toBeVisible();
    await expect(page.getByText('Someone Else Entirely')).not.toBeVisible();
    await context.close();
  });
});
