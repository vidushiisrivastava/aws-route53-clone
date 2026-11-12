import { expect, test } from '@playwright/test';
import {
  captureDocScreenshot,
  cleanupZonesByPrefix,
  createHostedZoneViaUI,
  signInWithDemoAccount,
} from './helpers';

test.describe('Hosted Zones Lifecycle (Create, Verify, Edit, Delete, Re-create)', () => {
  const uniquePrefix = `e2e-zone-${Date.now()}`;
  const domainName = `${uniquePrefix}.example.com`;
  const initialDescription = 'Initial E2E production zone description';
  const updatedDescription = 'Updated E2E zone description after edit';
  const recreatedDescription = 'Re-created E2E zone after deletion';

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

  test('creates a zone, verifies domain & initial record count, edits description, deletes, and re-creates @screenshot', async ({
    page,
  }) => {
    // 1. Open Create Hosted Zone page and capture clean documentation screenshot
    await page.goto('/hosted-zones/create');
    await expect(page.getByRole('heading', { name: 'Create hosted zone' })).toBeVisible();
    await page.locator('input[name="domain_name"]').fill(domainName);
    await page.locator('textarea[name="description"]').fill(initialDescription);
    await captureDocScreenshot(page, '04-create-hosted-zone.png', { dismissFlashbars: true });

    // Submit creation
    await page.getByRole('button', { name: 'Create hosted zone' }).click();
    await page.waitForURL(`**/hosted-zones/${encodeURIComponent(domainName)}*`);

    // 2. Verify domain name, type, description, and initial record count (2: apex NS + SOA)
    await expect(page.getByRole('heading', { name: domainName, exact: true })).toBeVisible();
    await expect(page.getByText('Public hosted zone')).toBeVisible();
    await expect(page.getByText(initialDescription)).toBeVisible();

    const recordCountValue = page
      .getByText('Record count', { exact: true })
      .locator('xpath=../following-sibling::*[1]');
    await expect(recordCountValue).toHaveText('2');
    await expect(page.getByRole('heading', { name: 'Records (2)' })).toBeVisible();

    // Verify default NS and SOA records exist in the table
    const recordsBody = page.locator('main tbody').first();
    await expect(recordsBody.getByText(`${domainName}.`).first()).toBeVisible();
    await expect(recordsBody.getByText('NS', { exact: true })).toBeVisible();
    await expect(recordsBody.getByText('SOA', { exact: true })).toBeVisible();

    // 3. Edit hosted zone description via Edit hosted zone modal
    await page.getByRole('button', { name: 'Edit hosted zone' }).click();
    const editDialog = page.getByRole('dialog');
    await expect(editDialog).toBeVisible();
    await editDialog.locator('textarea[name="edit_zone_comment"]').fill(updatedDescription);
    await editDialog.getByRole('button', { name: 'Save changes' }).click();
    await expect(editDialog).toBeHidden();

    // Verify updated description persists on detail page and in hosted zones list
    await expect(page.getByRole('main').getByText(updatedDescription)).toBeVisible();
    await page.reload();
    await expect(page.getByRole('main').getByText(updatedDescription)).toBeVisible();

    await page.goto('/hosted-zones');
    await page.locator('#hosted-zones-filter').fill(domainName);
    const zoneRow = page.locator('tbody tr').filter({ hasText: domainName });
    await expect(zoneRow).toHaveCount(1);
    await expect(zoneRow).toContainText(updatedDescription);
    await expect(zoneRow).toContainText('2');

    // 4. Delete the hosted zone
    await zoneRow.getByRole('checkbox').click();
    await page.getByRole('button', { name: 'Delete', exact: true }).click();
    const deleteDialog = page.getByRole('dialog');
    await expect(deleteDialog.getByRole('heading', { name: 'Delete hosted zone' })).toBeVisible();
    await deleteDialog.getByPlaceholder(domainName).fill(domainName);
    await deleteDialog.getByRole('button', { name: 'Delete', exact: true }).click();
    await expect(deleteDialog).toBeHidden();

    // Verify zone is gone after deletion
    await page.locator('#hosted-zones-filter').fill(domainName);
    await expect(page.locator('main tbody tr').filter({ hasText: domainName })).toHaveCount(0);

    // 5. Re-create the same hosted zone and verify fresh state
    await createHostedZoneViaUI(page, {
      domain: domainName,
      description: recreatedDescription,
      type: 'Public',
    });

    await expect(page.getByText(recreatedDescription)).toBeVisible();
    await expect(recordCountValue).toHaveText('2');
    await expect(page.getByRole('heading', { name: 'Records (2)' })).toBeVisible();
  });
});

