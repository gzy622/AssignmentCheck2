import { test, expect } from '@playwright/test';
import { pathToFileURL } from 'url';
import { join } from 'path';

const indexUrl = pathToFileURL(join(process.cwd(), 'index.html')).href;

test.describe('Mobile layout', () => {
    test('statistics view keeps summary, filters, and table separated', async ({ page }) => {
        await page.setViewportSize({ width: 430, height: 932 });
        await page.goto(indexUrl);

        await page.click('#btnMenu');
        await page.click('button[act="stats"]');

        const summary = page.locator('.st-summary');
        const filters = page.locator('.st-filters');
        const table = page.locator('.st-card-table');

        await expect(summary).toBeVisible();
        await expect(filters).toBeVisible();
        await expect(table).toBeVisible();

        const summaryBox = await summary.boundingBox();
        const filtersBox = await filters.boundingBox();
        const tableBox = await table.boundingBox();

        expect(summaryBox).not.toBeNull();
        expect(filtersBox).not.toBeNull();
        expect(tableBox).not.toBeNull();

        expect(filtersBox.y).toBeGreaterThan(summaryBox.y + summaryBox.height - 4);
        expect(tableBox.y).toBeGreaterThan(filtersBox.y + filtersBox.height - 4);
    });

    test('present mode landscape keeps the grid full screen', async ({ page }) => {
        await page.setViewportSize({ width: 2400, height: 1080 });
        await page.goto(indexUrl);

        await page.click('#btnMenu');
        await page.click('button[act="present"]');

        const presentMode = page.locator('.present-mode');
        const bar = page.locator('.present-floating-bar');
        const grid = page.locator('.present-grid');
        const firstItem = page.locator('.present-item').first();
        const badge = page.locator('.present-badge').first();

        await expect(presentMode).toBeVisible();
        await expect(bar).toBeVisible();
        await expect(grid).toBeVisible();
        await expect(firstItem).toBeVisible();
        await expect(badge).toBeHidden();

        const presentBox = await presentMode.boundingBox();
        const barBox = await bar.boundingBox();
        const gridBox = await grid.boundingBox();
        const itemBox = await firstItem.boundingBox();

        expect(presentBox).not.toBeNull();
        expect(barBox).not.toBeNull();
        expect(gridBox).not.toBeNull();
        expect(itemBox).not.toBeNull();

        expect(presentBox.width).toBeGreaterThanOrEqual(2390);
        expect(presentBox.height).toBeGreaterThanOrEqual(1070);
        expect(gridBox.x).toBeLessThanOrEqual(4);
        expect(gridBox.y).toBeLessThanOrEqual(4);
        expect(gridBox.width).toBeGreaterThanOrEqual(2390);
        expect(gridBox.height).toBeGreaterThanOrEqual(1070);
        expect(barBox.y).toBeLessThanOrEqual(20);
        expect(barBox.right ?? (barBox.x + barBox.width)).toBeLessThanOrEqual(2390);
    });
});
