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

    test('present mode bar does not cover the first row', async ({ page }) => {
        await page.setViewportSize({ width: 430, height: 932 });
        await page.goto(indexUrl);

        await page.click('#btnMenu');
        await page.click('button[act="present"]');

        const bar = page.locator('.present-floating-bar');
        const grid = page.locator('.present-grid');
        const firstItem = page.locator('.present-item').first();

        await expect(bar).toBeVisible();
        await expect(grid).toBeVisible();
        await expect(firstItem).toBeVisible();

        const barBox = await bar.boundingBox();
        const gridBox = await grid.boundingBox();
        const itemBox = await firstItem.boundingBox();

        expect(barBox).not.toBeNull();
        expect(gridBox).not.toBeNull();
        expect(itemBox).not.toBeNull();

        expect(gridBox.y).toBeGreaterThan(barBox.y + barBox.height - 4);
        expect(itemBox.y).toBeGreaterThan(barBox.y + barBox.height - 4);
    });
});
