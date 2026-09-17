import { test, expect } from '@playwright/test';
import { uniqueEmail, TEST_PASSWORD, createOnboardedUser } from './fixtures/api';
import { getLatestPasswordResetToken } from './fixtures/db';

test.describe('Authentication', () => {
  test('flow 1: signup creates a workspace and reaches the dashboard', async ({ page }) => {
    const email = uniqueEmail('signup-ui');
    await page.goto('/signup');
    await page.getByLabel('Full name').fill('Signup Flow User');
    await page.getByLabel('Email address').fill(email);
    await page.getByLabel('Password', { exact: true }).fill(TEST_PASSWORD);
    await page.getByLabel('Confirm password').fill(TEST_PASSWORD);
    await page.getByRole('button', { name: 'Create account' }).click();

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole('heading', { name: /Good morning,/ })).toBeVisible();
    // A workspace was actually provisioned (POST /api/onboarding), named after the user.
    await expect(page.locator('.eyebrow').first()).toHaveText('Signup Flow User Workspace');
  });

  test('signup rejects a second account with the same email', async ({ page }) => {
    const seeded = await createOnboardedUser({ label: 'dup-signup' });
    await page.goto('/signup');
    await page.getByLabel('Full name').fill('Duplicate User');
    await page.getByLabel('Email address').fill(seeded.email);
    await page.getByLabel('Password', { exact: true }).fill(TEST_PASSWORD);
    await page.getByLabel('Confirm password').fill(TEST_PASSWORD);
    await page.getByRole('button', { name: 'Create account' }).click();

    await expect(page).toHaveURL(/\/signup$/);
    await expect(page.getByRole('alert')).toBeVisible();
  });

  test('flow 2: an existing user logs in and reaches the protected dashboard', async ({ page }) => {
    const seeded = await createOnboardedUser({ label: 'login-ui' });
    await page.goto('/login');
    await page.getByLabel('Email address').fill(seeded.email);
    await page.getByLabel('Password', { exact: true }).fill(seeded.password);
    await page.getByRole('button', { name: 'Sign in' }).click();

    await expect(page).toHaveURL(/\/dashboard$/);
    await expect(page.getByRole('heading', { name: /Good morning,/ })).toBeVisible();
  });

  test('an anonymous visitor is redirected away from the dashboard', async ({ page }) => {
    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
  });

  test('flow 14: logging out revokes access to the protected dashboard', async ({ browser }) => {
    const seeded = await createOnboardedUser({ label: 'logout-ui' });
    const context = await browser.newContext({ storageState: await seeded.context.storageState() });
    const page = await context.newPage();

    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: /Good morning,/ })).toBeVisible();

    await page.getByRole('button', { name: 'Sign out' }).click();
    await expect(page).toHaveURL('/');

    await page.goto('/dashboard');
    await expect(page).toHaveURL(/\/login/);
    await context.close();
  });

  test('forgot/reset password: a real token round-trips to a working new password', async ({ page }) => {
    const seeded = await createOnboardedUser({ label: 'reset-flow' });
    const since = new Date().toISOString();

    await page.goto('/forgot-password');
    await page.getByLabel('Email address').fill(seeded.email);
    await page.getByRole('button', { name: 'Send reset link' }).click();
    await expect(page.getByRole('status')).toContainText('reset link is on its way');

    // Email delivery is skipped in dev (see lib/email.ts) - read the token
    // Better Auth wrote to the Verification table instead of an inbox.
    let token: string | null = null;
    await expect
      .poll(async () => {
        token = await getLatestPasswordResetToken(seeded.userId, since);
        return token;
      }, { message: 'waiting for the password-reset token to be persisted' })
      .not.toBeNull();

    const newPassword = 'New-Passw0rd!45';
    await page.goto(`/reset-password?token=${token}`);
    await page.getByLabel('Password', { exact: true }).fill(newPassword);
    await page.getByRole('button', { name: 'Update password' }).click();
    await expect(page.getByRole('status')).toContainText('Password updated');

    // The new password works...
    await page.goto('/login');
    await page.getByLabel('Email address').fill(seeded.email);
    await page.getByLabel('Password', { exact: true }).fill(newPassword);
    await page.getByRole('button', { name: 'Sign in' }).click();
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test('reset-password rejects a missing/expired token', async ({ page }) => {
    await page.goto('/reset-password');
    await page.getByLabel('Password', { exact: true }).fill('Whatever-Passw0rd1');
    await page.getByRole('button', { name: 'Update password' }).click();
    await expect(page.getByRole('alert')).toContainText(/missing or expired/i);
  });
});
