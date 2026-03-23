import { test, expect } from '@playwright/test';
import { pathToFileURL } from 'url';
import { join } from 'path';

const indexUrl = pathToFileURL(join(process.cwd(), 'index.html')).href;

test.describe('Score Preset Buttons', () => {
    test('clicking 0 or 100 preset button should save score and close modal', async ({ page }) => {
        await page.goto(indexUrl);
        
        // Enable scoring mode
        await page.click('#btnMenu');
        await page.click('#btnScoreMenu');
        
        // Click on a student card
        const card = page.locator('.student-card').first();
        await card.click();
        
        // Verify scorepad is open
        const scorepad = page.locator('.scorepad');
        await expect(scorepad).toHaveClass(/is-open/);
        
        // Click "100" preset button
        await page.click('button[data-act="preset-100"]');
        
        // Verify scorepad is closed
        await expect(scorepad).not.toHaveClass(/is-open/);
        
        // Verify the score is saved
        const scoreBadge = card.locator('.card-score');
        await expect(scoreBadge).toHaveText('100');
    });

    test('clicking 0 preset button should save score and close modal', async ({ page }) => {
        await page.goto(indexUrl);
        
        // Enable scoring mode
        await page.click('#btnMenu');
        await page.click('#btnScoreMenu');
        
        // Click on the second student card
        const card = page.locator('.student-card').nth(1);
        await card.click();
        
        // Click "0" preset button
        await page.click('button[data-act="preset-0"]');
        
        // Verify scorepad is closed
        const scorepad = page.locator('.scorepad');
        await expect(scorepad).not.toHaveClass(/is-open/);
        
        // Verify the score is saved
        const scoreBadge = card.locator('.card-score');
        await expect(scoreBadge).toHaveText('0');
    });

    test('debug panel should show detailed score change log', async ({ page }) => {
        await page.goto(indexUrl);

        await page.click('#btnMenu');
        await page.click('#btnDebug');
        await page.click('#btnMenu');
        await page.click('#btnScoreMenu');

        const card = page.locator('.student-card').first();
        await card.click();
        await page.click('button[data-act="preset-100"]');

        const debugContent = page.locator('#debugContent');
        await expect(debugContent).toContainText('动作=preset-100');
        await expect(debugContent).toContainText('分数 空 -> 100');
        await expect(debugContent).toContainText('完成 未完成 -> 已完成');
    });
});
