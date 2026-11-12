import { expect, test } from '@playwright/test';
import { API_BASE_URL, captureDocScreenshot, signInWithDemoAccount } from './helpers';

test.describe('Authentication & Dashboard Stats', () => {
  test('redirects unauthenticated users from protected routes to /login', async ({ page }) => {
    await page.goto('/login');
    await page.evaluate(() => window.localStorage.clear());

    await page.goto('/dashboard');
    await page.waitForURL('**/login');
    await expect(page.getByRole('heading', { name: 'Sign in as IAM user' })).toBeVisible();
  });

  test('logs in with demo account and verifies dashboard stats @screenshot', async ({ page }) => {
    await page.goto('/login');
    await page.evaluate(() => window.localStorage.clear());

    await expect(page.getByRole('heading', { name: 'Sign in as IAM user' })).toBeVisible();
    await expect(page.getByRole('button', { name: '1-Click Demo Sign-In (Vidushi)' })).toBeVisible();

    await captureDocScreenshot(page, '01-login.png');

    await signInWithDemoAccount(page);

    // Verify top AWS console bar shows signed-in demo IAM identity & 12-digit Account ID
    await expect(page.getByRole('button', { name: /179302349211/i })).toBeVisible();

    // Fetch expected counts from backend API using the active session token
    const token = await page.evaluate(() => window.localStorage.getItem('r53_access_token'));
    expect(token).toBeTruthy();

    const headers = { Authorization: `Bearer ${token}` };
    const [zonesRes, hcRes, tpRes, prRes, epRes, rulesRes, profilesRes] = await Promise.all([
      page.request.get(`${API_BASE_URL}/zones/`, { headers }),
      page.request.get(`${API_BASE_URL}/health-checks/`, { headers }),
      page.request.get(`${API_BASE_URL}/traffic-policies/`, { headers }),
      page.request.get(`${API_BASE_URL}/policy-records/`, { headers }),
      page.request.get(`${API_BASE_URL}/resolver/endpoints/`, { headers }),
      page.request.get(`${API_BASE_URL}/resolver/rules/`, { headers }),
      page.request.get(`${API_BASE_URL}/profiles/`, { headers }),
    ]);

    expect(zonesRes.ok()).toBeTruthy();
    const zones = (await zonesRes.json()) as Array<{ id: number; name: string }>;
    const healthChecks = (await hcRes.json()) as Array<{ status: string }>;
    const policies = (await tpRes.json()) as unknown[];
    const policyRecords = (await prRes.json()) as unknown[];
    const endpoints = (await epRes.json()) as unknown[];
    const rules = (await rulesRes.json()) as unknown[];
    const profiles = (await profilesRes.json()) as unknown[];

    const healthyCount = healthChecks.filter((h) => h.status === 'Healthy').length;
    const unhealthyCount = healthChecks.filter((h) => h.status === 'Unhealthy').length;

    await page.goto('/dashboard');
    await expect(page.getByRole('heading', { name: 'Route 53 Dashboard' })).toBeVisible();

    // Wait for dashboard table to finish loading
    await expect(page.getByText('Loading hosted zones...')).toBeHidden();

    // Verify DNS management summary card stats
    const dnsSection = page
      .locator('div')
      .filter({ has: page.getByRole('heading', { name: 'DNS management', exact: true }) })
      .first();
    await expect(dnsSection).toBeVisible();

    const statValueForLabel = (label: string) =>
      page.getByText(label, { exact: true }).locator('xpath=../following-sibling::*[1]');

    await expect(statValueForLabel('Hosted zones')).toHaveText(String(zones.length));
    await expect(statValueForLabel('Health checks')).toHaveText(String(healthChecks.length));
    await expect(statValueForLabel('Traffic policies')).toHaveText(String(policies.length));
    await expect(statValueForLabel('Policy records')).toHaveText(String(policyRecords.length));
    await expect(page.getByText(`${healthyCount} healthy, ${unhealthyCount} unhealthy`)).toBeVisible();

    // Verify Resolver & Profiles summary card stats
    await expect(statValueForLabel('Resolver endpoints')).toHaveText(String(endpoints.length));
    await expect(statValueForLabel('Resolver rules')).toHaveText(String(rules.length));
    await expect(statValueForLabel('Profiles')).toHaveText(String(profiles.length));

    // Verify Service health indicators
    await expect(
      page.getByText('Amazon Route 53 (Global) – Service is operating normally')
    ).toBeVisible();

    // Verify Hosted zones summary table header counter matches total zones
    await expect(page.getByRole('heading', { name: `Hosted zones (${zones.length})` })).toBeVisible();

    await captureDocScreenshot(page, '02-dashboard.png', { dismissFlashbars: true });
  });
});

