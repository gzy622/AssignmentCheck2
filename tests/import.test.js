import { describe, it, expect, afterEach, vi } from 'vitest';

describe('Import backup', () => {
    afterEach(() => {
        if (Modal.isOpen) Modal.forceClose(false);
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
    });

    it('should show file info for a valid backup even when the file name has no json suffix', () => {
        const payload = {
            list: ['01 张三', '02 李四'],
            data: [{ id: 2, name: '数学作业', subject: '数学', records: {} }],
            prefs: { cardDoneColor: '#123456' }
        };

        vi.spyOn(Toast, 'show').mockImplementation(() => {});
        vi.stubGlobal('FileReader', class {
            readAsText() {
                this.onload?.({ target: { result: JSON.stringify(payload) } });
            }
        });

        Actions.imp();

        const input = document.querySelector('[data-role="file-input"]');
        const file = new File([JSON.stringify(payload)], 'backup', { type: 'application/json' });

        Object.defineProperty(input, 'files', {
            configurable: true,
            value: [file]
        });
        input.dispatchEvent(new Event('change', { bubbles: true }));

        expect(document.querySelector('.import-fileinfo').hidden).toBe(false);
        expect(document.querySelector('[data-role="filename"]').textContent).toBe('backup');
        expect(document.querySelector('[data-role="preview"]').textContent).toContain('2 人');
        expect(document.querySelector('[data-role="preview"]').textContent).toContain('1 个');
        expect(document.querySelector('.import-status').textContent).toContain('文件已就绪');
        expect(document.querySelector('[data-role="apply"]').disabled).toBe(false);
    });
});
