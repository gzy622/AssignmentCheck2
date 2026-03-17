import { test, expect } from '@playwright/test';
import { pathToFileURL } from 'url';
import { join } from 'path';

const indexUrl = pathToFileURL(join(process.cwd(), 'index.html')).href;

test.describe('AssignmentCheck2 E2E', () => {
    test('should load the page', async ({ page }) => {
        await page.goto(indexUrl);
        await expect(page).toHaveTitle(/作业登记/);
    });

    test('should show the menu when clicking the menu button', async ({ page }) => {
        await page.goto(indexUrl);
        await page.click('#btnMenu');
        const menu = page.locator('#menu');
        await expect(menu).toBeVisible();
    });

    test('should show toast message (mock example)', async ({ page }) => {
        await page.goto(indexUrl);
        // We can evaluate scripts in the page context
        await page.evaluate(() => {
            Toast.show('测试消息');
        });
        const toast = page.locator('#toast');
        await expect(toast).toBeVisible();
        await expect(toast).toHaveText('测试消息');
    });

    test('should toggle debug panel and clear logs', async ({ page }) => {
        await page.goto(indexUrl);
        await page.click('#btnMenu');
        await page.click('#btnDebug');
        const debugPanel = page.locator('#debugPanel');
        await expect(debugPanel).toBeVisible();

        // Check buttons exist
        await expect(page.locator('#debugLock')).toBeVisible();
        await expect(page.locator('#debugFilter')).toBeVisible();
        await expect(page.locator('#debugClear')).toBeVisible();
        await expect(page.locator('#debugClose')).toBeVisible();

        // Toggle filter
        await page.click('#debugFilter');
        // It cycles: all -> info -> warn -> error
        // Just verify it's clickable and doesn't crash
        await page.click('#debugFilter');
        await page.click('#debugFilter');
        await page.click('#debugFilter');

        // Clear logs
        await page.click('#debugClear');
        const debugContent = page.locator('#debugContent');
        await expect(debugContent).toContainText('Logs cleared');

        // Close panel
        await page.click('#debugClose');
        await expect(debugPanel).not.toBeVisible();
    });
});
