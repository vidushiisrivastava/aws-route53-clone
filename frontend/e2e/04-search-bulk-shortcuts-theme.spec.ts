import { expect, test } from '@playwright/test';
import {
  captureDocScreenshot,
  cleanupZonesByPrefix,
  createHostedZoneViaUI,
  selectCloudscapeOption,
  signInWithDemoAccount,
} from './helpers';

test.describe('Search Bar, Bulk Actions, Keyboard Shortcuts & Dark/Light Mode', () => {
  const uniquePrefix = `e2e-bulk-${Date.now()}`;
  const zoneAlpha = `${uniquePrefix}-alpha.example.com`;
  const zoneBeta = `${uniquePrefix}-beta.example.com`;

  test.beforeEach(async ({ page }) => {
    await signInWithDemoAccount(page);
  });

  test.afterAll(async ({ browser }) => {
    const context = await browser.newContext();
    const page = await context.newPage();
    await signInWithDemoAccount(page);
    await cleanupZonesByPrefix(page, uniquePrefix);
    await context.close();
  });

  test('tests Hosted Zones search, bulk actions, keyboard shortcuts, and Dark/Light mode toggle @screenshot', async ({
    page,
  }) => {
    // Seed 2 hosted zones for search & bulk operations
    await createHostedZoneViaUI(page, {
      domain: zoneAlpha,
      description: 'Alpha search & bulk test zone',
    });

    // Add 2 custom records inside zoneAlpha to verify record bulk actions (bulk TTL & bulk delete)
    const recordDialog = page.getByRole('dialog');
    for (const sub of ['app1', 'app2']) {
      await page.getByRole('button', { name: 'Create record' }).click();
      await recordDialog.locator('input[name="record_name"]').fill(sub);
      await recordDialog.getByLabel('Value').fill('198.51.100.10');
      await recordDialog.getByRole('button', { name: 'Create records' }).click();
      await expect(recordDialog).toBeHidden();
    }

    // Bulk edit TTL on both custom records
    const app1Row = page.locator('tbody tr').filter({ hasText: `app1.${zoneAlpha}.` });
    const app2Row = page.locator('tbody tr').filter({ hasText: `app2.${zoneAlpha}.` });
    await app1Row.getByRole('checkbox').click();
    await app2Row.getByRole('checkbox').click();

    await page.getByRole('button', { name: 'Bulk edit TTL' }).click();
    const ttlDialog = page.getByRole('dialog');
    await expect(ttlDialog.getByRole('heading', { name: /Bulk edit TTL \(2 records\)/i })).toBeVisible();
    await ttlDialog.getByLabel('New TTL (seconds)').fill('600');
    await ttlDialog.getByRole('button', { name: 'Apply TTL' }).click();
    await expect(ttlDialog).toBeHidden();

    await expect(app1Row).toContainText('600');
    await expect(app2Row).toContainText('600');

    // Bulk delete both custom records
    await app1Row.getByRole('checkbox').click();
    await app2Row.getByRole('checkbox').click();
    await page.getByRole('button', { name: 'Delete records (2)' }).click();
    const bulkDeleteRecDialog = page.getByRole('dialog');
    await expect(bulkDeleteRecDialog.getByRole('heading', { name: 'Delete 2 records' })).toBeVisible();
    await bulkDeleteRecDialog.getByRole('button', { name: 'Delete selected records' }).click();
    await expect(bulkDeleteRecDialog).toBeHidden();
    await expect(page.getByRole('heading', { name: 'Records (2)' })).toBeVisible();

    // Create second zone for Hosted Zones search & bulk actions
    await createHostedZoneViaUI(page, {
      domain: zoneBeta,
      description: 'Beta search & bulk test zone',
    });

    // Navigate to Hosted Zones list
    await page.goto('/hosted-zones');
    await expect(page.getByText('Loading hosted zones...')).toBeHidden();
    await captureDocScreenshot(page, '03-hosted-zones-list.png', { dismissFlashbars: true });

    // 1. Hosted Zones Search Bar & Type Filter
    const zonesSearch = page.locator('#hosted-zones-filter');
    await zonesSearch.fill(zoneAlpha);
    await expect(page.locator('main tbody tr')).toHaveCount(1);
    await expect(page.locator('main tbody tr').first()).toContainText(zoneAlpha);

    // Search by shared unique prefix matches both
    await zonesSearch.fill(uniquePrefix);
    await expect(page.locator('main tbody tr')).toHaveCount(2);

    // Type filter check
    const zoneTypeFilter = page.locator('.r53-filter-select button').first();
    await selectCloudscapeOption(page, zoneTypeFilter, 'Private hosted zone');
    await expect(page.getByText('No hosted zones', { exact: true })).toBeVisible();
    await selectCloudscapeOption(page, zoneTypeFilter, 'All types');
    await expect(page.locator('main tbody tr')).toHaveCount(2);

    // 2. Dark / Light Mode Toggle (button click + Alt+T keyboard shortcut)
    const htmlEl = page.locator('html');
    await expect(htmlEl).toHaveClass(/awsui-dark-mode/);

    const themeButton = page.getByRole('button', { name: /☀ Light/i });
    await expect(themeButton).toBeVisible();
    await themeButton.click();

    await expect(htmlEl).not.toHaveClass(/awsui-dark-mode/);
    await expect(page.getByRole('button', { name: /☾ Dark/i })).toBeVisible();
    const lightPref = await page.evaluate(() => window.localStorage.getItem('r53_dark_mode'));
    expect(lightPref).toBe('false');

    await captureDocScreenshot(page, '07-hosted-zones-light-mode.png', { dismissFlashbars: true });

    // Toggle back to Dark mode via Alt+T keyboard shortcut
    await page.keyboard.press('Alt+t');
    await expect(htmlEl).toHaveClass(/awsui-dark-mode/);
    await expect(page.getByRole('button', { name: /☀ Light/i })).toBeVisible();
    const darkPref = await page.evaluate(() => window.localStorage.getItem('r53_dark_mode'));
    expect(darkPref).toBe('true');

    // 3. Keyboard Shortcuts (?, Escape, Alt+D, Alt+N, Alt+C, Alt+H, Alt+S)
    // Clear focus from any input before pressing '?'
    await zonesSearch.fill('');
    await page.locator('h1').first().click();
    await page.keyboard.press('?');
    const shortcutsDialog = page.getByRole('dialog');
    await expect(shortcutsDialog.getByRole('heading', { name: 'Keyboard shortcuts' })).toBeVisible();
    await captureDocScreenshot(page, '08-keyboard-shortcuts-modal.png', { dismissFlashbars: true });
    await page.keyboard.press('Escape');
    await expect(shortcutsDialog).toBeHidden();

    // Alt+D -> Dashboard
    await page.keyboard.press('Alt+d');
    await page.waitForURL('**/dashboard');
    await expect(page.getByRole('heading', { name: 'Route 53 Dashboard' })).toBeVisible();

    // Alt+N -> Create hosted zone
    await page.keyboard.press('Alt+n');
    await page.waitForURL('**/hosted-zones/create');
    await expect(page.getByRole('heading', { name: 'Create hosted zone' })).toBeVisible();

    // Alt+C -> Health checks
    await page.keyboard.press('Alt+c');
    await page.waitForURL('**/health-checks');
    await expect(page.getByRole('heading', { name: /Health checks/i })).toBeVisible();

    // Alt+S -> Focus global search and jump to Hosted zones
    await page.keyboard.press('Alt+s');
    const globalSearch = page.locator('#aws-console-search');
    await expect(globalSearch).toBeFocused();
    await globalSearch.fill('Hosted zones');
    await globalSearch.press('Enter');
    await page.waitForURL('**/hosted-zones');

    // Alt+H check from dashboard
    await page.keyboard.press('Alt+d');
    await page.waitForURL('**/dashboard');
    await page.keyboard.press('Alt+h');
    await page.waitForURL('**/hosted-zones');

    // 4. Bulk Export & Bulk Delete on Hosted Zones table
    await page.locator('#hosted-zones-filter').fill(uniquePrefix);
    const alphaRow = page.locator('tbody tr').filter({ hasText: zoneAlpha });
    const betaRow = page.locator('tbody tr').filter({ hasText: zoneBeta });
    await expect(alphaRow).toHaveCount(1);
    await expect(betaRow).toHaveCount(1);

    await alphaRow.getByRole('checkbox').click();
    await betaRow.getByRole('checkbox').click();

    // Bulk export JSON triggers download
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Export' }).click();
    await page.getByRole('menuitem', { name: /Export JSON \(\.json\) \(2\)/i }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe('hosted-zones-export.json');

    // Bulk delete 2 zones
    await page.getByRole('button', { name: 'Delete (2)' }).click();
    const bulkDeleteDialog = page.getByRole('dialog');
    await expect(bulkDeleteDialog.getByRole('heading', { name: 'Delete 2 hosted zones' })).toBeVisible();
    await bulkDeleteDialog.getByPlaceholder('delete').fill('delete');
    await bulkDeleteDialog.getByRole('button', { name: 'Delete 2 zones' }).click();
    await expect(bulkDeleteDialog).toBeHidden();

    // Verify both zones are deleted
    await page.locator('#hosted-zones-filter').fill(uniquePrefix);
    await expect(page.getByText('No hosted zones', { exact: true })).toBeVisible();
  });
});

