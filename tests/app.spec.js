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

    test('should default to showing names and toggle it from menu', async ({ page }) => {
        await page.goto(indexUrl);

        await expect(page.locator('body')).toHaveClass(/mode-names/);

        await page.click('#btnMenu');
        await expect(page.locator('#statusView')).toHaveText('开');
        await page.click('#btnView');

        await expect(page.locator('body')).not.toHaveClass(/mode-names/);
        await expect(page.locator('#statusView')).toHaveText('关');
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

    test('should show pending count only in top badge', async ({ page }) => {
        await page.addInitScript(() => {
            localStorage.setItem('tracker_roster', JSON.stringify(['01 张三', '02 李四']));
            localStorage.setItem('tracker_db', JSON.stringify({
                curId: 1,
                data: [{ id: 1, name: '作业1', records: { '01': { done: true } } }]
            }));
        });
        await page.goto(indexUrl);
        await expect(page.locator('#counter')).toHaveText('未交 1');
    });
});
