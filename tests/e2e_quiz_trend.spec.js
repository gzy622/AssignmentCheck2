import { test, expect } from '@playwright/test';
import { pathToFileURL } from 'url';
import { join } from 'path';

const indexUrl = pathToFileURL(join(process.cwd(), 'index.html')).href;

test.describe('Quiz Trend View', () => {
    test('should open trend view and filter students within selected range', async ({ page }) => {
        await page.addInitScript(() => {
            localStorage.clear();
            localStorage.setItem('tracker_roster', JSON.stringify([
                '01 张三',
                '02 李四 #非英语',
                '03 王五'
            ]));
            localStorage.setItem('tracker_db', JSON.stringify([
                { id: 0, name: '0228作业', subject: '英语', records: { '01': { score: '66', done: true } } },
                { id: 1, name: '0301小测', subject: '英语', records: { '01': { score: '70', done: true }, '02': { score: '60', done: true }, '03': { score: '75', done: true } } },
                { id: 2, name: '0308小测', subject: '数学', records: { '01': { score: '82', done: true }, '02': { score: '88', done: true } } },
                { id: 3, name: '0315小测', subject: '英语', records: { '01': { score: '90', done: true }, '03': { score: '78', done: true } } }
            ]));
        });
        await page.goto(indexUrl);

        await page.click('#btnMenu');
        await page.click('button[act="quizTrend"]');

        await expect(page.locator('.trend-shell')).toBeVisible();
        await expect(page.locator('.trend-card')).toHaveCount(3);
        await expect(page.locator('.trend-assignment-chip')).toHaveCount(3);
        await expect(page.locator('.trend-assignment-strip')).not.toContainText('0228作业');
        await expect(page.locator('.trend-card').filter({ hasText: '01 张三' }).locator('.trend-badge')).toHaveText('上升');
        await expect(page.locator('.trend-card').filter({ hasText: '01 张三' }).locator('.trend-score-row')).toContainText('0308小测');

        await page.click('.trend-assignment-chip:has-text("0308小测")');
        await expect(page.locator('.trend-assignment-chip:has-text("0308小测")')).toHaveAttribute('aria-pressed', 'false');
        await expect(page.locator('.trend-card').filter({ hasText: '01 张三' }).locator('.trend-score-row')).not.toContainText('0308小测');
        await expect(page.locator('.trend-card').filter({ hasText: '01 张三' })).toContainText('均分 80');

        await page.fill('input[data-role="search"]', '李四');
        await expect(page.locator('.trend-card')).toHaveCount(1);
        await expect(page.locator('.trend-card')).toContainText('记录 0/0');

        await page.selectOption('select[data-role="start"]', '2');
        await expect(page.locator('.trend-assignment-chip')).toHaveCount(2);
        await expect(page.locator('.trend-card')).toHaveCount(1);
    });
});
