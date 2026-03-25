import { test, expect } from '@playwright/test';
import { pathToFileURL } from 'url';
import { join } from 'path';

const indexUrl = pathToFileURL(join(process.cwd(), 'index.html')).href;

test.describe('Scorepad fast ten mode', () => {
    test('should switch keypad to tens and auto confirm on click', async ({ page }) => {
        await page.setViewportSize({ width: 430, height: 932 });
        await page.addInitScript(() => {
            const roster = ['01 张三', '02 李四'];
            const data = [{
                id: 1,
                name: '英语作业',
                subject: '英语',
                records: {}
            }];
            localStorage.setItem('tracker_roster', JSON.stringify(roster));
            localStorage.setItem('tracker_db', JSON.stringify(data));
        });
        await page.goto(indexUrl);

        await page.click('#btnScore');
        const card = page.locator('.student-card').first();
        await card.click();

        const scorepad = page.locator('.scorepad');
        const toggle = page.locator('button[data-action="toggle-fast-ten"]');
        await expect(scorepad).toHaveClass(/is-open/);
        await expect(toggle).toHaveAttribute('aria-pressed', 'false');

        const toggleBox = await toggle.boundingBox();
        expect(toggleBox).not.toBeNull();
        expect(toggleBox.width).toBeLessThanOrEqual(64);
        expect(toggleBox.height).toBeLessThanOrEqual(44);

        await toggle.click();

        await expect(scorepad).toHaveClass(/fast-ten-mode/);
        await expect(toggle).toHaveAttribute('aria-pressed', 'true');
        await expect(page.locator('.scorepad-row').nth(0)).toHaveCount(1);
        await expect(page.locator('.scorepad-row').nth(3)).toHaveCount(1);
        const topRow = await page.locator('.scorepad-row').nth(0).evaluate(row => [...row.querySelectorAll('button')].map(btn => btn.textContent.trim()));
        const bottomRow = await page.locator('.scorepad-row').nth(3).evaluate(row => [...row.querySelectorAll('button')].map(btn => btn.textContent.trim()));
        expect(topRow).toEqual(['10', '20', '30']);
        expect(bottomRow).toEqual(['C', '100', '⌫']);
        await expect(page.locator('.scorepad-keypad button[data-val="10"]')).toBeVisible();
        await expect(page.locator('.scorepad-keypad button[data-val="100"]')).toBeVisible();
        await expect(page.locator('.scorepad-keypad button[data-val="1"]')).toHaveCount(0);

        await page.click('.scorepad-keypad button[data-val="10"]');

        await expect(scorepad).not.toHaveClass(/is-open/);
        await expect(card.locator('.card-score')).toHaveText('10');
    });
});
