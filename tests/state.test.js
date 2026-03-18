import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('State', () => {
    beforeEach(() => {
        // Clear state before each test if necessary
        // Since State is global, we might need to reset its properties
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
});
