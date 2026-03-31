import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';

beforeAll(async () => {
    const coreContent = readFileSync(join(__dirname, '..', 'core.js'), 'utf8');
    (new Function(coreContent))();
});

describe('ColorUtil', () => {
    it('should clamp values', () => {
        expect(ColorUtil.clamp(300)).toBe(255);
        expect(ColorUtil.clamp(-10)).toBe(0);
        expect(ColorUtil.clamp(128)).toBe(128);
    });

    it('should normalize hex codes', () => {
        expect(ColorUtil.normalizeHex('#f00')).toBe('#ff0000');
        expect(ColorUtil.normalizeHex('f00')).toBe('#ff0000');
        expect(ColorUtil.normalizeHex('#ff0000')).toBe('#ff0000');
        expect(ColorUtil.normalizeHex('invalid', '#123456')).toBe('#123456');
    });

    it('should convert hex to rgb', () => {
        const rgb = ColorUtil.hexToRgb('#ff0000');
        expect(rgb).toEqual({ r: 255, g: 0, b: 0 });
    });

    it('should mix colors', () => {
        const mixed = ColorUtil.mix('#ff0000', '#0000ff', 0.5);
        expect(mixed).toBe('#800080');
    });
});

describe('formatBackupFileName', () => {
    it('should generate a detailed backup file name with project slug', () => {
        const fileName = formatBackupFileName(new Date(2026, 2, 23, 14, 5, 7));
        expect(fileName).toBe('assignmentcheck2_backup_20260323_140507.json');
    });
});
