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
});
