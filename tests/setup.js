import { readFileSync } from 'fs';
import { join } from 'path';
import { vi } from 'vitest';

const html = readFileSync(join(process.cwd(), 'index.html'), 'utf8');
document.documentElement.innerHTML = html;

// Mocks
global.ResizeObserver = vi.fn().mockImplementation(() => ({
    observe: vi.fn(),
    unobserve: vi.fn(),
    disconnect: vi.fn(),
}));

global.alert = vi.fn();
global.confirm = vi.fn(() => true);
global.prompt = vi.fn();

const files = [
    'core.js',
    'back-handler.js',
    'modal.js',
    'bottom-sheet.js',
    'scorepad.js',
    'app.js',
    'action-views.js',
    'actions.js',
    'boot.js'
];

files.forEach(file => {
    const content = readFileSync(join(process.cwd(), file), 'utf8');
    try {
        (new Function(content))();
    } catch (e) {
        // console.error(`Error loading ${file}:`, e);
    }
});
