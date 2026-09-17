import { test, expect } from '@playwright/test';
import { createOnboardedUser } from './fixtures/api';

test.describe('Reports', () => {
  test('flow 12: reports reflect persisted request data', async ({ browser }) => {
    const manager = await createOnboardedUser({ label: 'reports-manager', globalRole: 'MANAGER' });
    const uniqueType = `ReportType${Date.now()}`;
    const createRes = await manager.context.post('/api/requests', {
      data: {
        name: 'Reports Test Customer',
        email: `reports.${Date.now()}@example.test`,
        type: uniqueType,
        message: 'Quote please.',
      },
    });
    expect(createRes.ok(), await createRes.text()).toBeTruthy();

    const reportRes = await manager.context.get('/api/reports');
    expect(reportRes.status()).toBe(200);
    const report = await reportRes.json();
    expect(
      report.byType.some((x: { type: string; _count: { _all: number } }) => x.type === uniqueType && x._count._all === 1)
    ).toBeTruthy();
    expect(report.byStatus.some((x: { status: string }) => x.status === 'NEW')).toBeTruthy();

    // Same data, visible through the real page too.
    const context = await browser.newContext({ storageState: await manager.context.storageState() });
    const page = await context.newPage();
    await page.goto('/dashboard/reports');
    await expect(page.getByText(uniqueType)).toBeVisible();
    await context.close();
  });

  test('reports require manager/admin access', async ({ browser }) => {
    const owner = await createOnboardedUser({ label: 'reports-guard-owner' }); // default global role: USER
    const apiRes = await owner.context.get('/api/reports');
    expect(apiRes.status()).toBe(403);

    const context = await browser.newContext({ storageState: await owner.context.storageState() });
    const page = await context.newPage();
    await page.goto('/dashboard/reports');
    await expect(page.getByRole('heading', { name: 'Reports unavailable' })).toBeVisible();
    await context.close();
  });
});
