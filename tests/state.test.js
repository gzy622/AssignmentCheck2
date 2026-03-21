import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('State', () => {
    beforeEach(() => {
        State._draftTimer = 0;
        State._draftDirty = false;
    });

    afterEach(() => {
        if (Modal.isOpen) Modal.forceClose(false);
        vi.useRealTimers();
        vi.restoreAllMocks();
        clearTimeout(State._draftTimer);
        State._draftTimer = 0;
        State._draftDirty = false;
    });

    it('should parse roster correctly', () => {
        State.list = [
            '01 张三',
            '02 李四 #非英语',
            '03 王五'
        ];
        State.parseRoster();
        
        expect(State.roster.length).toBe(3);
        expect(State.roster[0].name).toBe('张三');
        expect(State.roster[1].name).toBe('李四');
        expect(State.roster[1].noEnglish).toBe(true);
        
        // Check noEnglishIds
        expect(State.noEnglishIds).toContain('02');
    });

    it('should normalize assignments', () => {
        const raw = { id: 123456, name: 'Test', records: { '01': 100 } };
        const normalized = State.normalizeAsg(raw);
        expect(normalized.id).toBe(123456);
        expect(normalized.records).toEqual({ '01': 100 });
    });

    it('should calculate stats rows correctly', () => {
        State.list = [
            '01 张三',
            '02 李四 #非英语',
            '03 王五'
        ];
        State.parseRoster();
        
        // Add two assignments
        State.data = [];
        State.addAsg('Assignment 1'); // English task
        State.addAsg('Assignment 2'); // Let's make it English too
        
        const a1 = State.data[0];
        const a2 = State.data[1];
        
        // 01 done both, 02 none (excluded), 03 done one
        a1.records = { '01': { done: true }, '02': { done: true }, '03': { done: true } };
        a2.records = { '01': { done: true }, '02': { done: true }, '03': { done: false } };
        
        State.invalidateDerived();
        const { tgs, rows, avgRate } = State.getStatsRows([a1.id, a2.id]);
        
        expect(tgs.length).toBe(2);
        
        // Student 02 (李四) is #非英语, so they should be excluded from English tasks.
        // If they are excluded, their "total" in stats row should be 0, and they should be filtered out.
        // Student 01: total 2, done 2, rate 100%
        // Student 03: total 2, done 1, rate 50%
        
        expect(rows.length).toBe(2); 
        expect(rows[0].id).toBe('01');
        expect(rows[0].rate).toBe(100);
        expect(rows[1].id).toBe('03');
        expect(rows[1].rate).toBe(50);
        
        expect(avgRate).toBe(75); // (100 + 50) / 2
    });

    it('should log detailed score changes when updating records', () => {
        State.list = ['01 张三'];
        State.parseRoster();
        State.data = [State.normalizeAsg({ id: 1, name: '英语作业', subject: '英语', records: {} })];
        State.rebuildAsgIndex();
        State.curId = 1;
        State.view = {
            init: vi.fn(),
            render: vi.fn(),
            renderStudent: vi.fn(),
            renderProgress: vi.fn(),
            isReady: () => false
        };
        const logSpy = vi.spyOn(Debug, 'log').mockImplementation(() => {});

        State.updRec('01', { score: '100', done: true }, { source: 'score-panel', action: 'preset-100', studentName: '张三' });

        expect(logSpy).toHaveBeenCalledWith(
            expect.stringContaining('动作=preset-100'),
            'warn'
        );
        expect(logSpy).toHaveBeenCalledWith(
            expect.stringContaining('分数 空 -> 100'),
            'warn'
        );
        expect(logSpy).toHaveBeenCalledWith(
            expect.stringContaining('完成 未完成 -> 已完成'),
            'warn'
        );
    });

    it('should batch recovery draft writes until flushed', () => {
        vi.useFakeTimers();
        State.list = ['01 张三'];
        State.data = [State.normalizeAsg({ id: 1, name: '英语作业', subject: '英语', records: {} })];
        State.prefs = State.normalizePrefs({ cardDoneColor: '#123456' });
        State.curId = 1;

        const setSpy = vi.spyOn(LS, 'set').mockImplementation(() => {});

        State.queueRecoveryDraft();
        State.queueRecoveryDraft();

        expect(setSpy).not.toHaveBeenCalled();

        State.flushRecoveryDraft();

        expect(setSpy).toHaveBeenCalledTimes(1);
        expect(setSpy).toHaveBeenCalledWith(
            KEYS.DRAFT,
            expect.objectContaining({
                version: 1,
                list: ['01 张三'],
                curId: 1
            })
        );

        vi.advanceTimersByTime(500);
        expect(setSpy).toHaveBeenCalledTimes(1);
    });

    it('should keep stats cache on rename but refresh it on subject change', () => {
        State.list = [
            '01 张三',
            '02 李四 #非英语'
        ];
        State.parseRoster();
        State.data = [
            State.normalizeAsg({
                id: 1,
                name: '英语作业',
                subject: '英语',
                records: {
                    '01': { done: true },
                    '02': { done: true }
                }
            })
        ];
        State.rebuildAsgIndex();
        State.curId = 1;

        const invalidateSpy = vi.spyOn(State, 'invalidateDerived');

        expect(State.getAsgTotalCount(State.cur)).toBe(1);

        State.renameAsg(1, '新名字');

        expect(invalidateSpy).not.toHaveBeenCalled();
        expect(State.getAsgTotalCount(State.cur)).toBe(1);

        State.updateAsgMeta(1, { name: '语文作业', subject: '语文' });

        expect(invalidateSpy).toHaveBeenCalledTimes(1);
        expect(State.getAsgTotalCount(State.cur)).toBe(2);
    });

    it('should update roster summary without rebuilding rows on input', () => {
        State.list = Array.from({ length: 50 }, (_, i) => `${String(i + 1).padStart(2, '0')} 学生${i + 1}`);
        Actions.roster();

        const listEl = document.querySelector('.roster-list');
        const countEl = document.querySelector('[data-role="count"]');
        const firstRow = listEl.querySelector('.roster-row');
        const [idInput, nameInput] = firstRow.querySelectorAll('[data-r]');
        const appendSpy = vi.spyOn(listEl, 'appendChild');

        idInput.value = '';
        idInput.dispatchEvent(new Event('input', { bubbles: true }));
        nameInput.value = '';
        nameInput.dispatchEvent(new Event('input', { bubbles: true }));

        expect(appendSpy).not.toHaveBeenCalled();
        expect(countEl.textContent).toBe('共 49 人');
    });

    it('should open score action on card click when scoring mode is enabled', () => {
        State.list = ['01 张三'];
        State.parseRoster();
        State.data = [State.normalizeAsg({ id: 1, name: '英语作业', subject: '英语', records: {} })];
        State.rebuildAsgIndex();
        State.curId = 1;
        State.scoring = true;

        UI.gridEl = document.createElement('div');
        UI.actions = {
            has: vi.fn(),
            run: vi.fn(),
            handleFile: vi.fn(),
            score: vi.fn()
        };
        UI.setupGrid();

        const card = UI.createCard();
        card.dataset.id = '01';
        card.dataset.name = '张三';
        card.dataset.excluded = '0';
        UI.gridEl.appendChild(card);

        card.dispatchEvent(new MouseEvent('click', { bubbles: true }));

        expect(UI.actions.score).toHaveBeenCalledWith('01', '张三');
    });
});
