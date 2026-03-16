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

    it('should add a new assignment', () => {
        const initialCount = State.data.length;
        State.addAsg('New Assignment');
        expect(State.data.length).toBe(initialCount + 1);
        expect(State.data[State.data.length - 1].name).toBe('New Assignment');
    });
});
