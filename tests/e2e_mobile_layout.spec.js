import { test, expect } from '@playwright/test';
import { pathToFileURL } from 'url';
import { join } from 'path';

const indexUrl = pathToFileURL(join(process.cwd(), 'index.html')).href;

test.describe('Mobile layout', () => {
    test('present mode landscape keeps the grid full screen', async ({ page }) => {
        await page.setViewportSize({ width: 2400, height: 1080 });
        await page.addInitScript(() => {
            const roster = Array.from({ length: 47 }, (_, i) => {
                if (i === 0) return '01 蓝慧婷同学';
                return `${String(i + 1).padStart(2, '0')} 学生${i + 1}`;
            });
            const data = [{
                id: 1,
                name: '0306小测',
                subject: '语文',
                records: {}
            }];
            localStorage.setItem('tracker_roster', JSON.stringify(roster));
            localStorage.setItem('tracker_db', JSON.stringify(data));
        });
        await page.goto(indexUrl);

        await page.click('#btnMenu');
        await page.click('button[act="present"]');

        const presentMode = page.locator('.present-mode');
        const bar = page.locator('.present-floating-bar');
        const grid = page.locator('.present-grid');
        const firstItem = page.locator('.present-item').first();
        const badge = page.locator('.present-badge');

        await expect(presentMode).toBeVisible();
        await expect(bar).toBeVisible();
        await expect(grid).toBeVisible();
        await expect(firstItem).toBeVisible();
        await expect(badge).toHaveCount(0);

        const presentBox = await presentMode.boundingBox();
        const barBox = await bar.boundingBox();
        const gridBox = await grid.boundingBox();
        const itemBox = await firstItem.boundingBox();
        const gridTemplateColumns = await grid.evaluate(el => getComputedStyle(el).gridTemplateColumns);
        const firstNameStyles = await page.locator('.present-name').first().evaluate(el => {
            const styles = getComputedStyle(el);
            return {
                whiteSpace: styles.whiteSpace,
                lineClamp: styles.getPropertyValue('-webkit-line-clamp').trim()
            };
        });

        expect(presentBox).not.toBeNull();
        expect(barBox).not.toBeNull();
        expect(gridBox).not.toBeNull();
        expect(itemBox).not.toBeNull();

        expect(presentBox.width).toBeGreaterThanOrEqual(2390);
        expect(presentBox.height).toBeGreaterThanOrEqual(1070);
        expect(gridBox.x).toBeLessThanOrEqual(6);
        expect(gridBox.y).toBeLessThanOrEqual(8);
        expect(gridBox.width).toBeGreaterThanOrEqual(2390);
        expect(gridBox.height).toBeGreaterThanOrEqual(1070);
        expect(gridTemplateColumns.split(' ').length).toBeLessThan(10);
        expect(itemBox.height).toBeGreaterThanOrEqual(170);
        expect(firstNameStyles.whiteSpace).toBe('normal');
        expect(firstNameStyles.lineClamp).toBe('2');
        expect(barBox.y).toBeLessThanOrEqual(20);
        expect(barBox.right ?? (barBox.x + barBox.width)).toBeLessThanOrEqual(2390);
    });
});
