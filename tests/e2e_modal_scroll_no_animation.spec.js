import { test, expect } from '@playwright/test';
import { pathToFileURL } from 'url';
import { join } from 'path';

const indexUrl = pathToFileURL(join(process.cwd(), 'index.html')).href;

test.describe('Modal scroll without animations', () => {
    test('should keep the assignment and roster managers scrollable when animations are off', async ({ page }) => {
        await page.addInitScript(() => {
            localStorage.setItem('tracker_anim', 'false');
            localStorage.setItem('tracker_roster', JSON.stringify(Array.from({ length: 40 }, (_, i) => `${String(i + 1).padStart(2, '0')} 学生${i + 1}`)));
            localStorage.setItem('tracker_db', JSON.stringify(Array.from({ length: 18 }, (_, i) => ({
                id: i + 1,
                name: `任务${i + 1}`,
                subject: '英语',
                records: {}
            }))));
        });

        await page.goto(indexUrl);
        await expect(page.locator('body')).toHaveClass(/no-animations/);

        await page.click('#btnMenu');
        await page.click('button[act="asgManage"]');

        const asgScroll = page.locator('.modal-body .st-scroll-area').first();
        await expect(page.locator('.asg-card')).toHaveCount(18);

        const asgScrollState = await asgScroll.evaluate(el => {
            el.scrollTop = 120;
            return {
                clientHeight: el.clientHeight,
                scrollHeight: el.scrollHeight,
                scrollTop: el.scrollTop
            };
        });

        expect(asgScrollState.scrollHeight).toBeGreaterThan(asgScrollState.clientHeight);
        expect(asgScrollState.scrollTop).toBeGreaterThan(0);

        await page.keyboard.press('Escape');
        await expect(page.locator('#modal')).not.toHaveClass(/is-open/);

        await page.click('#btnMenu');
        await page.click('button[act="roster"]');

        const rosterScroll = page.locator('.modal-body .st-scroll-area').first();
        await expect(page.locator('.roster-row')).toHaveCount(40);

        const rosterScrollState = await rosterScroll.evaluate(el => {
            el.scrollTop = 160;
            return {
                clientHeight: el.clientHeight,
                scrollHeight: el.scrollHeight,
                scrollTop: el.scrollTop
            };
        });

        expect(rosterScrollState.scrollHeight).toBeGreaterThan(rosterScrollState.clientHeight);
        expect(rosterScrollState.scrollTop).toBeGreaterThan(0);
    });
});
