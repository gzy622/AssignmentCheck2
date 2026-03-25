import { test, expect } from '@playwright/test';
import { pathToFileURL } from 'url';
import { join } from 'path';

const indexUrl = pathToFileURL(join(process.cwd(), 'index.html')).href;

test.describe('Statistics score trend', () => {
    test('shows score trend chart only for students with numeric scores in selected assignments', async ({ page }) => {
        await page.setViewportSize({ width: 430, height: 932 });
        await page.addInitScript(() => {
            localStorage.setItem('tracker_roster', JSON.stringify([
                '01 张三',
                '02 李四'
            ]));
            localStorage.setItem('tracker_db', JSON.stringify([
                {
                    id: 1,
                    name: '作业一',
                    subject: '语文',
                    records: {
                        '01': { done: true, score: '80' },
                        '02': { done: true }
                    }
                },
                {
                    id: 2,
                    name: '作业二',
                    subject: '语文',
                    records: {
                        '01': { done: true, score: '95' },
                        '02': { done: true, score: '缺考' }
                    }
                }
            ]));
        });
        await page.goto(indexUrl);

        await page.click('#btnMenu');
        await page.click('button[act="stats"]');

        const rows = page.locator('.st-row').filter({ has: page.locator('.st-name') });
        await expect(rows).toHaveCount(2);

        const row01 = rows.filter({ has: page.locator('.st-name', { hasText: '张三' }) });
        const row02 = rows.filter({ has: page.locator('.st-name', { hasText: '李四' }) });

        await expect(page.locator('.st-rate')).toHaveCount(0);
        await expect(row01.locator('.st-user-rate')).toContainText('100%');
        await expect(row01.locator('.st-score-chart')).toHaveCount(1);
        await expect(row01.locator('.st-score-line')).toHaveCount(1);
        await expect(row01.locator('.st-score-meta')).toContainText('80 → 95');
        await expect(row02.locator('.st-score-chart')).toHaveCount(0);
    });
});
