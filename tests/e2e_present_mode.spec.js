import { test, expect } from '@playwright/test';
import { pathToFileURL } from 'url';
import { join } from 'path';

const indexUrl = pathToFileURL(join(process.cwd(), 'index.html')).href;

test.describe('Presentation Mode', () => {
    test('should open presentation mode from menu', async ({ page }) => {
        await page.goto(indexUrl);
        
        // Open menu
        await page.click('#btnMenu');
        
        // Click presentation mode
        await page.click('button[act="present"]');
        
        // Verify presentation mode view is visible
        const presentMode = page.locator('.present-mode');
        await expect(presentMode).toBeVisible();
        
        // Verify it contains the assignment title
        const title = page.locator('.present-title');
        await expect(title).not.toBeEmpty();
        
        // Verify it contains student items
        const items = page.locator('.present-item');
        const count = await items.count();
        expect(count).toBeGreaterThan(0);
        
        // Click exit
        await page.click('.present-floating-bar button:has-text("退出展示")');
        
        // Verify presentation mode is closed
        await expect(presentMode).not.toBeVisible();
    });
});
