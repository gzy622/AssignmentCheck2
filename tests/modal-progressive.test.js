import { describe, it, expect, afterEach, vi } from 'vitest';

const mockRafQueue = () => {
    const rafQueue = [];
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(cb => {
        rafQueue.push(cb);
        return rafQueue.length;
    });
    vi.spyOn(window, 'cancelAnimationFrame').mockImplementation(id => {
        if (id > 0 && id <= rafQueue.length) rafQueue[id - 1] = () => {};
    });
    return {
        flush() {
            while (rafQueue.length) rafQueue.shift()(0);
        }
    };
};

describe('Modal progressive work', () => {
    afterEach(() => {
        if (Modal.isOpen) Modal.forceClose(false);
        State.animations = true;
        State.applyAnim();
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it('should schedule above-the-fold and heavy fullscreen work in separate stages', () => {
        vi.useFakeTimers();
        const raf = mockRafQueue();
        const root = document.createElement('div');

        Modal.show({ title: '', content: root, type: 'full' });
        const controller = Modal.getProgressiveController(root);
        const stages = [];

        expect(controller).toBeTruthy();

        controller.schedule(() => stages.push('aboveFold'), { phase: 'aboveFold', frame: false });
        controller.schedule(() => stages.push('heavy'), { phase: 'heavy', frame: false });

        expect(stages).toEqual([]);

        raf.flush();
        vi.advanceTimersByTime(Modal.FULL_ENTER_MS - 1);
        expect(stages).toEqual([]);

        vi.advanceTimersByTime(1);
        expect(stages).toEqual(['aboveFold']);

        vi.advanceTimersByTime(71);
        expect(stages).toEqual(['aboveFold']);

        vi.advanceTimersByTime(1);
        expect(stages).toEqual(['aboveFold', 'heavy']);
    });

    it('should cancel pending fullscreen work when the modal closes', () => {
        vi.useFakeTimers();
        mockRafQueue();
        const root = document.createElement('div');

        Modal.show({ title: '', content: root, type: 'full' });
        const controller = Modal.getProgressiveController(root);
        const task = vi.fn();

        controller.schedule(task, { phase: 'heavy', frame: false });
        Modal.close(false);
        vi.runAllTimers();

        expect(task).not.toHaveBeenCalled();
    });

    it('should render fullscreen staged work immediately when animations are disabled', () => {
        State.animations = false;
        State.applyAnim();
        const root = document.createElement('div');

        Modal.show({ title: '', content: root, type: 'full' });
        const controller = Modal.getProgressiveController(root);
        const stages = [];

        controller.schedule(() => stages.push('aboveFold'), { phase: 'aboveFold', frame: false });
        controller.schedule(() => stages.push('heavy'), { phase: 'heavy', frame: false });

        expect(stages).toEqual(['aboveFold', 'heavy']);
    });
});
