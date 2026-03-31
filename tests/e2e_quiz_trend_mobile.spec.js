import { test, expect } from '@playwright/test';
import { pathToFileURL } from 'url';
import { join } from 'path';

const indexUrl = pathToFileURL(join(process.cwd(), 'index.html')).href;

test.describe('Quiz trend mobile layout', () => {
    test('should keep trend content inside a horizontally scrollable board on portrait mobile', async ({ page }) => {
        await page.setViewportSize({ width: 390, height: 844 });
        await page.addInitScript(() => {
            localStorage.clear();
            localStorage.setItem('tracker_roster', JSON.stringify([
                '01 张三',
                '02 李四',
                '03 王五',
                '04 赵六'
            ]));
            localStorage.setItem('tracker_db', JSON.stringify([
                { id: 1, name: '0301小测', subject: '英语', records: { '01': { score: '72', done: true }, '02': { score: '88', done: true } } },
                { id: 2, name: '0308小测', subject: '数学', records: { '01': { score: '84', done: true }, '02': { score: '91', done: true } } },
                { id: 3, name: '0315小测', subject: '语文', records: { '01': { score: '80', done: true }, '02': { score: '85', done: true } } },
                { id: 4, name: '0322小测', subject: '英语', records: { '01': { score: '89', done: true }, '02': { score: '92', done: true } } }
            ]));
        });
        await page.goto(indexUrl);

        await page.waitForFunction(() => typeof document.getElementById('btnMenu')?.onclick === 'function');
        await page.click('#btnMenu');
        await expect(page.locator('button[act="quizTrend"]')).toBeVisible();
        await page.click('button[act="quizTrend"]');

        const board = page.locator('.trend-board');
        const list = page.locator('.trend-list');
        const shell = page.locator('.trend-shell');
        const cards = page.locator('.trend-card');

        await expect(shell).toBeVisible();
        await expect(board).toBeVisible();
        await expect(cards.first()).toBeVisible();

        const metrics = await board.evaluate(el => ({
            clientWidth: el.clientWidth,
            scrollWidth: el.scrollWidth,
            overflowX: getComputedStyle(el).overflowX
        }));
        const listWidth = await list.evaluate(el => el.getBoundingClientRect().width);
        const viewportWidth = page.viewportSize()?.width ?? 390;

        expect(metrics.overflowX).toBe('auto');
        expect(metrics.scrollWidth).toBeGreaterThan(metrics.clientWidth);
        expect(listWidth).toBeGreaterThan(metrics.clientWidth);
        expect(metrics.clientWidth).toBeLessThanOrEqual(viewportWidth);
    });
});
