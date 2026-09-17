import { test, expect } from '@playwright/test';
import { createOnboardedUser } from './fixtures/api';

test.describe('Insurance requests', () => {
  test('flow 4: creating a request persists it and shows it in the queue', async ({ browser }) => {
    const owner = await createOnboardedUser({ label: 'request-owner' });
    const context = await browser.newContext({ storageState: await owner.context.storageState() });
    const page = await context.newPage();

    const customerName = `Priya Shah ${Date.now()}`;
    await page.goto('/dashboard/requests/new');
    await page.getByLabel('Customer name').fill(customerName);
    await page.getByLabel('Email').fill(`priya.${Date.now()}@example.test`);
    await page.getByLabel('Insurance type').selectOption('Health');
    await page.getByLabel('What do you need?').fill('Looking for a family health plan.');
    await page.getByRole('button', { name: 'Create request' }).click();

    // Redirects straight to the new request's detail page.
    await expect(page).toHaveURL(/\/dashboard\/requests\/[a-zA-Z0-9]+$/);
    await expect(page.getByRole('heading', { name: customerName })).toBeVisible();
    await expect(page.getByText('Health')).toBeVisible();

    // And it shows up in the queue too.
    await page.goto('/dashboard/requests');
    await expect(page.getByRole('link', { name: customerName })).toBeVisible();
    await context.close();
  });

  test('flow 8: adding an internal note persists and displays it', async ({ browser }) => {
    const owner = await createOnboardedUser({ label: 'note-owner' });
    const createRes = await owner.context.post('/api/requests', {
      data: {
        name: 'Note Test Customer',
        email: `note.${Date.now()}@example.test`,
        type: 'Motor',
        message: 'Need a quote.',
      },
    });
    expect(createRes.ok()).toBeTruthy();
    const created = await createRes.json();

    const context = await browser.newContext({ storageState: await owner.context.storageState() });
    const page = await context.newPage();
    await page.goto(`/dashboard/requests/${created.id}`);

    const noteText = `Called the customer back at ${Date.now()}`;
    await page.getByPlaceholder('Add an internal note...').fill(noteText);
    await page.getByRole('button', { name: 'Add note' }).click();

    await expect(page.getByText(noteText)).toBeVisible();
    // Persisted server-side, not optimistic-only: reload and it's still there.
    await page.reload();
    await expect(page.getByText(noteText)).toBeVisible();
    await context.close();
  });
});
