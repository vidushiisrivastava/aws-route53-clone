import { expect, Locator, Page } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

export const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
export const SCREENSHOTS_DIR = path.resolve(__dirname, '../../docs/screenshots');

/**
 * Ensures the docs/screenshots output directory exists and saves a clean,
 * full-page PNG screenshot for README documentation.
 */
export async function captureDocScreenshot(
  page: Page,
  filename: string,
  options: { dismissFlashbars?: boolean; waitMs?: number } = {}
): Promise<string> {
  const { dismissFlashbars = false, waitMs = 350 } = options;
  fs.mkdirSync(SCREENSHOTS_DIR, { recursive: true });

  // Wait for fonts and Cloudscape layout transitions to settle
  await page.evaluate(() => document.fonts?.ready);
  if (dismissFlashbars) {
    const dismissButtons = page.getByRole('button', { name: 'Dismiss notification' });
    const count = await dismissButtons.count();
    for (let i = 0; i < count; i++) {
      await dismissButtons.first().click({ timeout: 2000 }).catch(() => {});
    }
  }
  await page.waitForTimeout(waitMs);

  const outputPath = path.join(SCREENSHOTS_DIR, filename);
  await page.screenshot({ path: outputPath, fullPage: true });
  return outputPath;
}

/**
 * Logs in via the /login page using the 1-Click Demo Sign-In button and waits
 * until authenticated session state is persisted.
 */
export async function signInWithDemoAccount(page: Page): Promise<void> {
  await page.goto('/login');
  await expect(page.getByRole('button', { name: '1-Click Demo Sign-In (Vidushi)' })).toBeVisible();
  await page.getByRole('button', { name: '1-Click Demo Sign-In (Vidushi)' }).click();
  await page.waitForURL('**/hosted-zones');
  await expect(page.getByRole('heading', { name: /Hosted zones/i })).toBeVisible();

  const token = await page.evaluate(() => window.localStorage.getItem('r53_access_token'));
  expect(token).toBeTruthy();
}

/**
 * Creates a hosted zone through the Create Hosted Zone UI wizard and waits
 * for the zone details page to finish loading.
 */
export async function createHostedZoneViaUI(
  page: Page,
  params: { domain: string; description?: string; type?: 'Public' | 'Private' }
): Promise<void> {
  await page.goto('/hosted-zones/create');
  await expect(page.getByRole('heading', { name: 'Create hosted zone' })).toBeVisible();

  await page.locator('input[name="domain_name"]').fill(params.domain);
  if (params.description !== undefined) {
    await page.locator('textarea[name="description"]').fill(params.description);
  }
  if (params.type === 'Private') {
    await page.getByText('Private hosted zone', { exact: true }).click();
  }

  await page.getByRole('button', { name: 'Create hosted zone' }).click();
  await page.waitForURL(`**/hosted-zones/${encodeURIComponent(params.domain)}*`);
  await expect(page.getByRole('heading', { name: params.domain, exact: true })).toBeVisible();
  await expect(page.getByText('Hosted zone details')).toBeVisible();
}

/**
 * Selects an option from a Cloudscape Select component given its trigger locator.
 */
export async function selectCloudscapeOption(
  page: Page,
  trigger: Locator,
  optionLabel: string | RegExp
): Promise<void> {
  await trigger.click();
  const option = page.getByRole('option', { name: optionLabel }).first();
  await expect(option).toBeVisible();
  await option.click();
}

/**
 * Cleans up any leftover test hosted zones via the backend REST API using
 * the active browser JWT token (safe to call in afterAll/afterEach).
 */
export async function cleanupZonesByPrefix(page: Page, prefix: string): Promise<void> {
  const token = await page.evaluate(() => window.localStorage.getItem('r53_access_token')).catch(() => null);
  if (!token) return;

  const listRes = await page.request.get(`${API_BASE_URL}/zones/`, {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!listRes.ok()) return;

  const zones = (await listRes.json()) as Array<{ id: number; name: string }>;
  const matchingIds = zones.filter((z) => z.name.includes(prefix)).map((z) => z.id);
  if (matchingIds.length > 0) {
    await page.request.post(`${API_BASE_URL}/zones/bulk-delete`, {
      headers: { Authorization: `Bearer ${token}` },
      data: { ids: matchingIds },
    });
  }
}

