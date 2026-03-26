import { test, expect } from '@playwright/test';
import { pathToFileURL } from 'url';
import { join } from 'path';

const indexUrl = pathToFileURL(join(process.cwd(), 'index.html')).href;

test.describe('Roster topbar', () => {
    test('should use the compact topbar for roster actions and save changes', async ({ page }) => {
        await page.addInitScript(() => {
            localStorage.setItem('tracker_roster', JSON.stringify(['01 张三', '02 李四 #非英语']));
            localStorage.setItem('tracker_db', JSON.stringify([{
                id: 1,
                name: '英语作业',
                subject: '英语',
                records: {}
            }]));
        });
        await page.goto(indexUrl);

        await page.click('#btnMenu');
        await page.click('button[act="roster"]');

        const topbar = page.locator('.roster-topbar');
        const footer = page.locator('.modal-footer');
        const firstName = page.locator('.roster-row [data-r="name"]').first();

        await expect(topbar).toBeVisible();
        await expect(page.locator('.roster-hint-card')).toHaveCount(0);
        await expect(page.locator('[data-role="actions"] [data-act="add"]')).toBeVisible();
        await expect(page.locator('[data-role="actions"] [data-act="autonum"]')).toBeVisible();
        await expect(page.locator('[data-role="actions"] [data-act="sort-seat"]')).toBeVisible();
        await expect(page.locator('[data-role="actions"] [data-act="clean"]')).toBeVisible();
        await expect(page.locator('[data-role="submit"] [data-act="cancel"]')).toBeVisible();
        await expect(page.locator('[data-role="submit"] [data-act="save"]')).toBeVisible();
        await expect(footer).toHaveCSS('display', 'none');

        await firstName.fill('王五');
        await page.click('[data-role="submit"] [data-act="save"]');
        await expect(topbar).not.toBeVisible();

        const storedRoster = await page.evaluate(() => JSON.parse(localStorage.getItem('tracker_roster')));
        expect(storedRoster).toEqual(['01 王五', '02 李四 #非英语']);
    });
});
