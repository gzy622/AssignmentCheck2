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
        
        // Verify modal is open
        const modal = page.locator('#modal');
        await expect(modal).toHaveClass(/is-open/);
        
        // Click "100" preset button
        await page.click('button[data-act="preset-100"]');
        
        // Verify modal is closed
        await expect(modal).not.toHaveClass(/is-open/);
        
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
        
        // Verify modal is closed
        const modal = page.locator('#modal');
        await expect(modal).not.toHaveClass(/is-open/);
        
        // Verify the score is saved
        const scoreBadge = card.locator('.card-score');
        await expect(scoreBadge).toHaveText('0');
    });
});
