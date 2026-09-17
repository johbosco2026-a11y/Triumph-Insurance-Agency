import { test, expect } from '@playwright/test';

test.describe('Triumph public application', () => {
  test('public pages render', async ({ page }) => {
    for (const path of ['/', '/insurance', '/claims', '/faqs', '/contact', '/get-a-quote']) {
      await page.goto(path);
      await expect(page.locator('body')).not.toContainText('Application error');
    }
  });

  test('protected dashboard redirects guests to login', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });

  test('quote endpoint rejects invalid payloads', async ({ request }) => {
    const response = await request.post('/api/quote', { data: { email: 'not-an-email' } });
    expect(response.status()).toBe(400);
  });
});

test.describe('authenticated smoke', () => {
  test.skip(!process.env.E2E_EMAIL || !process.env.E2E_PASSWORD, 'Set E2E_EMAIL and E2E_PASSWORD to run authenticated checks.');

  test('user can sign in and reach dashboard', async ({ page }) => {
    await page.goto('/login');
    await page.getByLabel(/email/i).fill(process.env.E2E_EMAIL!);
    await page.getByLabel(/password/i).fill(process.env.E2E_PASSWORD!);
    await page.getByRole('button', { name: /sign in|login/i }).click();
    await expect(page).toHaveURL(/\/dashboard/);
    await expect(page.locator('body')).toContainText(/Triumph|dashboard/i);
  });
});
