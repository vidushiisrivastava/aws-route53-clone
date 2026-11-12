import { test, expect } from '@playwright/test';
import { signInWithDemoAccount } from './helpers';

test.describe('Supporting Route 53 Services & DNS Query Simulator', () => {
  test.beforeEach(async ({ page }) => {
    await signInWithDemoAccount(page);
  });

  test('can navigate to health checks and traffic policies and test DNS simulation in a hosted zone', async ({
    page,
  }) => {
    // 1. Health checks page loads cleanly with auth
    await page.goto('/health-checks');
    await expect(page.getByRole('heading', { name: 'Health checks' })).toBeVisible();
    await page.getByRole('button', { name: 'Create health check' }).first().click();
    const hcDialog = page.locator('[role="dialog"]:visible').first();
    await expect(hcDialog).toBeVisible();
    await hcDialog.getByRole('button', { name: 'Cancel' }).click();

    // 2. Traffic policies page loads cleanly and creates a policy
    const policyName = `e2e-policy-${Date.now()}`;
    await page.goto('/traffic-policies');
    await expect(page.getByRole('heading', { name: 'Traffic policies' })).toBeVisible();
    await page.getByRole('button', { name: 'Create traffic policy' }).first().click();
    const tpDialog = page.locator('[role="dialog"]:visible').first();
    await tpDialog.getByLabel('Policy name').fill(policyName);
    await tpDialog.getByRole('button', { name: 'Create traffic policy' }).click();
    await expect(page.locator('main tbody tr').filter({ hasText: policyName })).toBeVisible();

    // Clean up created traffic policy
    await page.locator('main tbody tr').filter({ hasText: policyName }).locator('input[type="radio"]').check();
    await page.getByRole('button', { name: 'Delete' }).click();
    await page.locator('[role="dialog"]:visible').first().getByRole('button', { name: 'Delete' }).click();
    await expect(page.locator('main tbody tr').filter({ hasText: policyName })).toHaveCount(0);

    // 3. Create a hosted zone + A record and verify the Test DNS response simulator
    const domain = `sim-${Date.now()}.example.com`;
    await page.goto('/hosted-zones/create');
    await page.getByLabel('Domain name').fill(domain);
    await page.getByRole('button', { name: 'Create hosted zone' }).click();
    await expect(page).toHaveURL(new RegExp(`/hosted-zones/${domain.replace(/\./g, '\\.')}`));

    await page.getByRole('button', { name: 'Create record' }).first().click();
    const recDialog = page.locator('[role="dialog"]:visible').first();
    await recDialog.getByLabel('Record name').fill('api');
    await recDialog.getByLabel('Value').fill('203.0.113.55');
    await recDialog.getByRole('button', { name: 'Create record' }).click();
    await expect(page.locator('main tbody tr').filter({ hasText: `api.${domain}.` })).toBeVisible();

    await page.getByRole('button', { name: 'Test record' }).click();
    const simDialog = page.locator('[role="dialog"]:visible').first();
    await simDialog.getByLabel('Record name').fill('api');
    await simDialog.getByRole('button', { name: 'Get response' }).click();
    await expect(simDialog.getByText('DNS Response: NOERROR')).toBeVisible();
    await expect(simDialog.getByText('203.0.113.55')).toBeVisible();
    await simDialog.getByRole('button', { name: 'Close' }).click();

    // Clean up hosted zone
    await page.getByRole('button', { name: 'Delete zone' }).click();
    const delDialog = page.locator('[role="dialog"]:visible').first();
    await delDialog.getByPlaceholder(domain).fill(domain);
    await delDialog.getByRole('button', { name: 'Delete' }).click();
    await expect(page).toHaveURL(/\/hosted-zones$/);
  });
});
