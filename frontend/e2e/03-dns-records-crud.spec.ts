import { expect, test } from '@playwright/test';
import {
  captureDocScreenshot,
  cleanupZonesByPrefix,
  createHostedZoneViaUI,
  selectCloudscapeOption,
  signInWithDemoAccount,
} from './helpers';

test.describe('DNS Records CRUD & Parent Zone Record Count Sync', () => {
  const uniquePrefix = `e2e-records-${Date.now()}`;
  const domainName = `${uniquePrefix}.example.com`;

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

  test('adds, edits, filters, and deletes DNS records while verifying parent zone record count updates @screenshot', async ({
    page,
  }) => {
    await createHostedZoneViaUI(page, {
      domain: domainName,
      description: 'E2E DNS records CRUD verification zone',
    });

    const recordCountValue = page
      .getByText('Record count', { exact: true })
      .locator('xpath=../following-sibling::*[1]');

    // Starts with 2 apex records (NS + SOA)
    await expect(recordCountValue).toHaveText('2');

    // 1. Add A record (www) and capture Create record modal screenshot
    await page.getByRole('button', { name: 'Create record' }).click();
    const recordDialog = page.getByRole('dialog');
    await expect(recordDialog.getByRole('heading', { name: 'Create record' })).toBeVisible();

    await recordDialog.locator('input[name="record_name"]').fill('www');
    await recordDialog.getByLabel('Value').fill('203.0.113.10');
    await captureDocScreenshot(page, '06-create-dns-record-modal.png', { dismissFlashbars: true });

    await recordDialog.getByRole('button', { name: 'Create records' }).click();
    await expect(recordDialog).toBeHidden();
    await expect(recordCountValue).toHaveText('3');
    await expect(page.getByRole('heading', { name: 'Records (3)' })).toBeVisible();

    // 2. Add CNAME record (api)
    await page.getByRole('button', { name: 'Create record' }).click();
    await expect(recordDialog).toBeVisible();
    await recordDialog.locator('input[name="record_name"]').fill('api');
    await selectCloudscapeOption(page, recordDialog.getByLabel('Record type'), /CNAME/);
    await recordDialog.getByLabel('Value').fill(`www.${domainName}.`);
    await recordDialog.getByRole('button', { name: 'Create records' }).click();
    await expect(recordDialog).toBeHidden();
    await expect(recordCountValue).toHaveText('4');

    // 3. Add TXT record (_verify)
    await page.getByRole('button', { name: 'Create record' }).click();
    await expect(recordDialog).toBeVisible();
    await recordDialog.locator('input[name="record_name"]').fill('_verify');
    await selectCloudscapeOption(page, recordDialog.getByLabel('Record type'), /TXT/);
    await recordDialog.getByLabel('Value').fill('"e2e-verification=route53-ok"');
    await recordDialog.getByRole('button', { name: 'Create records' }).click();
    await expect(recordDialog).toBeHidden();
    await expect(recordCountValue).toHaveText('5');
    await expect(page.getByRole('heading', { name: 'Records (5)' })).toBeVisible();

    // Capture full hosted zone details + records table screenshot
    await captureDocScreenshot(page, '05-hosted-zone-details-records.png', { dismissFlashbars: true });

    // Verify parent zone row in Hosted Zones list reflects updated record count (5)
    await page.goto('/hosted-zones');
    await page.locator('#hosted-zones-filter').fill(domainName);
    const parentRow = page.locator('tbody tr').filter({ hasText: domainName });
    await expect(parentRow).toHaveCount(1);
    await expect(parentRow.locator('td').nth(2)).toHaveText('5');

    // Return to zone detail page via row link
    await parentRow.getByText(domainName, { exact: true }).click();
    await expect(page.getByRole('heading', { name: domainName, exact: true })).toBeVisible();
    await expect(recordCountValue).toHaveText('5');

    // 4. Filter records by search text and by record type
    const recordsSearch = page.locator('#zone-records-filter');
    await recordsSearch.fill('api');
    await expect(page.locator('main tbody tr')).toHaveCount(1);
    await expect(page.locator('main tbody tr').first()).toContainText(`api.${domainName}.`);
    await recordsSearch.fill('');
    await expect(page.locator('main tbody tr')).toHaveCount(5);

    const typeFilterTrigger = page.locator('.r53-filter-select button').first();
    await selectCloudscapeOption(page, typeFilterTrigger, 'TXT');
    await expect(page.locator('main tbody tr')).toHaveCount(1);
    await expect(page.locator('main tbody tr').first()).toContainText(`_verify.${domainName}.`);

    await selectCloudscapeOption(page, typeFilterTrigger, 'All record types');
    await expect(page.locator('main tbody tr')).toHaveCount(5);

    // 5. Edit the www A record (value + TTL)
    const wwwRow = page
      .locator('main tbody tr')
      .filter({ has: page.locator('th', { hasText: `www.${domainName}.` }) });
    await wwwRow.getByRole('checkbox').click();
    await page.getByRole('button', { name: 'Edit record' }).click();
    await expect(recordDialog.getByRole('heading', { name: 'Edit record' })).toBeVisible();
    await recordDialog.getByLabel('Value').fill('203.0.113.99');
    await selectCloudscapeOption(page, recordDialog.getByLabel('TTL (seconds)'), '1 hour (3600)');
    await recordDialog.getByRole('button', { name: 'Save', exact: true }).click();
    await expect(recordDialog).toBeHidden();

    await expect(wwwRow).toContainText('203.0.113.99');
    await expect(wwwRow).toContainText('3600');

    // 6. Verify apex SOA record cannot be deleted (Delete record stays disabled)
    const soaRow = page
      .locator('main tbody tr')
      .filter({ has: page.locator('td', { hasText: /^SOA$/ }) });
    await soaRow.getByRole('checkbox').click();
    await expect(page.getByRole('button', { name: 'Delete record' })).toBeDisabled();
    await soaRow.getByRole('checkbox').click();

    // 7. Delete the _verify TXT record and verify count drops to 4
    const txtRow = page
      .locator('main tbody tr')
      .filter({ has: page.locator('th', { hasText: `_verify.${domainName}.` }) });
    await txtRow.getByRole('checkbox').click();
    await page.getByRole('button', { name: 'Delete record' }).click();
    const deleteDialog = page.getByRole('dialog');
    await expect(deleteDialog.getByRole('heading', { name: 'Delete record' })).toBeVisible();
    await deleteDialog.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(deleteDialog).toBeHidden();

    await expect(recordCountValue).toHaveText('4');
    await expect(page.getByRole('heading', { name: 'Records (4)' })).toBeVisible();

    // Verify parent zone's record count updated to 4 on /hosted-zones
    await page.goto('/hosted-zones');
    await page.locator('#hosted-zones-filter').fill(domainName);
    const updatedParentRow = page.locator('main tbody tr').filter({ hasText: domainName });
    await expect(updatedParentRow.locator('td').nth(2)).toHaveText('4');
  });
});

