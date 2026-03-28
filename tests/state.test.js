import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

describe('State', () => {
    beforeEach(() => {
        State._draftTimer = 0;
        State._draftDirty = false;
    });

    afterEach(() => {
        if (Modal.isOpen) Modal.forceClose(false);
        if (ScorePad.isOpen) ScorePad.hide();
        vi.useRealTimers();
        vi.restoreAllMocks();
        clearTimeout(State._draftTimer);
        State._draftTimer = 0;
        State._draftDirty = false;
        Debug.enabled = false;
        Debug.interactive = false;
        Debug.filter = 'all';
        Debug.lines = [];
        Debug.contentEl?.replaceChildren();
        BottomSheet.activeSheet = null;
        document.querySelectorAll('.bottom-sheet-backdrop, .bottom-sheet').forEach(el => el.remove());
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

    it('should default to showing names and sync view status text', () => {
        State.mode = 'name';
        document.body.classList.remove('mode-names');
        const btnView = document.getElementById('btnView');
        const statusView = document.getElementById('statusView');

        btnView.classList.remove('active');
        statusView.textContent = '关';

        State.applyViewMode();

        expect(document.body.classList.contains('mode-names')).toBe(true);
        expect(btnView.classList.contains('active')).toBe(true);
        expect(statusView.textContent).toBe('开');
    });

    it('should normalize assignments', () => {
        const raw = { id: 123456, name: 'Test', records: { '01': 100 } };
        const normalized = State.normalizeAsg(raw);
        expect(normalized.id).toBe(123456);
        expect(normalized.records).toEqual({ '01': 100 });
    });

    it('should append debug lines incrementally without full rerender', () => {
        Debug.el = document.getElementById('debugPanel');
        Debug.contentEl = document.getElementById('debugContent');
        Debug.enabled = true;
        Debug.filter = 'all';
        Debug.lines = [];
        Debug.emptyEl = Debug.createEmptyEl();
        Debug.render();

        const renderSpy = vi.spyOn(Debug, 'render');

        Debug.log('first line', 'info');

        expect(renderSpy).not.toHaveBeenCalled();
        expect(Debug.contentEl.querySelectorAll('.debug-line')).toHaveLength(1);

        const firstNode = Debug.contentEl.firstElementChild;

        Debug.log('second line', 'warn');

        expect(renderSpy).not.toHaveBeenCalled();
        expect(Debug.contentEl.querySelectorAll('.debug-line')).toHaveLength(2);
        expect(Debug.contentEl.firstElementChild).toBe(firstNode);

        Debug.filter = 'error';
        Debug.render();
        renderSpy.mockClear();

        Debug.log('hidden info line', 'info');

        expect(renderSpy).not.toHaveBeenCalled();
        expect(Debug.contentEl.textContent).toContain('暂无日志');
    });

    it('should trim debug lines incrementally when reaching the log cap', () => {
        Debug.el = document.getElementById('debugPanel');
        Debug.contentEl = document.getElementById('debugContent');
        Debug.enabled = true;
        Debug.filter = 'all';
        Debug.lines = [];
        Debug.emptyEl = Debug.createEmptyEl();
        Debug.render();

        const renderSpy = vi.spyOn(Debug, 'render');

        for (let i = 1; i <= 201; i++) {
            Debug.log(`line-${String(i).padStart(3, '0')}`, 'info');
        }

        expect(renderSpy).not.toHaveBeenCalled();
        expect(Debug.lines).toHaveLength(200);
        expect(Debug.contentEl.querySelectorAll('.debug-line')).toHaveLength(200);
        expect(Debug.contentEl.textContent).not.toContain('line-001');
        expect(Debug.contentEl.textContent).toContain('line-002');
        expect(Debug.contentEl.textContent).toContain('line-201');
    });

    it('should compare recovery draft without relying on JSON stringify', () => {
        State.list = ['01 张三'];
        State.data = [State.normalizeAsg({ id: 1, name: '英语作业', subject: '英语', records: { '01': { score: '88', done: true } } })];
        State.prefs = State.normalizePrefs({ cardDoneColor: '#123456' });
        State.curId = 1;

        vi.spyOn(State, 'getRecoveryDraft').mockReturnValue({
            list: ['01 张三'],
            data: [State.normalizeAsg({ id: 1, name: '英语作业', subject: '英语', records: { '01': { score: '88', done: true } } })],
            prefs: State.normalizePrefs({ cardDoneColor: '#123456' }),
            curId: 1
        });
        const stringifySpy = vi.spyOn(JSON, 'stringify');

        expect(State.applyRecoveryDraft()).toBe(false);
        expect(stringifySpy).not.toHaveBeenCalled();
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

        State.updRec('01', { score: '100', done: true }, { source: 'score-panel', action: 'confirm', studentName: '张三' });

        expect(logSpy).toHaveBeenCalledWith(
            expect.stringContaining('动作=confirm'),
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

    it('should keep metrics cache on rename but refresh it on subject change', () => {
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

    it('should build student score trend report within assignment range', () => {
        State.list = [
            '01 张三',
            '02 李四 #非英语'
        ];
        State.parseRoster();
        State.data = [
            State.normalizeAsg({ id: 1, name: '0301小测', subject: '英语', records: { '01': { score: '70', done: true }, '02': { score: '60', done: true } } }),
            State.normalizeAsg({ id: 2, name: '0308小测', subject: '数学', records: { '01': { score: '82', done: true }, '02': { score: '88', done: true } } }),
            State.normalizeAsg({ id: 3, name: '0315小测', subject: '英语', records: { '01': { score: '90', done: true }, '02': { score: '95', done: true } } })
        ];
        State.rebuildAsgIndex();

        const report = State.getScoreRangeReport(1, 3);
        const zhang = report.students.find(student => student.id === '01');
        const li = report.students.find(student => student.id === '02');

        expect(report.assignments.map(item => item.name)).toEqual(['0301小测', '0308小测', '0315小测']);
        expect(zhang.entries.map(item => item.score)).toEqual([70, 82, 90]);
        expect(zhang.stats.avg).toBe(80.7);
        expect(zhang.stats.delta).toBe(20);
        expect(zhang.stats.trend).toBe('上升');
        expect(li.entries.map(item => item.score)).toEqual([88]);
        expect(li.timeline.map(item => item.included)).toEqual([false, true, false]);
        expect(li.stats.coverage).toBe('1/1');
        expect(li.stats.trend).toBe('单次记录');
    });

    it('should default trend assignments to names containing 小测 and fall back when absent', () => {
        State.data = [
            State.normalizeAsg({ id: 1, name: '0301作业', subject: '英语', records: {} }),
            State.normalizeAsg({ id: 2, name: '0308小测', subject: '数学', records: {} }),
            State.normalizeAsg({ id: 3, name: '0315小测订正', subject: '语文', records: {} })
        ];

        expect(State.getQuizTrendAssignments().map(asg => asg.name)).toEqual(['0308小测', '0315小测订正']);

        State.data = [
            State.normalizeAsg({ id: 4, name: '0320作业', subject: '英语', records: {} }),
            State.normalizeAsg({ id: 5, name: '0321默写', subject: '语文', records: {} })
        ];

        expect(State.getQuizTrendAssignments().map(asg => asg.name)).toEqual(['0320作业', '0321默写']);
    });

    it('should filter trend cards without rebuilding sparkline content on search', () => {
        State.list = [
            '01 张三',
            '02 李四 #非英语',
            '03 王五'
        ];
        State.parseRoster();
        State.data = [
            State.normalizeAsg({ id: 1, name: '0301小测', subject: '英语', records: { '01': { score: '70', done: true }, '02': { score: '60', done: true }, '03': { score: '75', done: true } } }),
            State.normalizeAsg({ id: 2, name: '0308小测', subject: '数学', records: { '01': { score: '82', done: true }, '02': { score: '88', done: true } } }),
            State.normalizeAsg({ id: 3, name: '0315小测', subject: '英语', records: { '01': { score: '90', done: true }, '03': { score: '78', done: true } } })
        ];
        State.rebuildAsgIndex();

        const sparkSpy = vi.spyOn(ActionViews, 'createTrendSparkline');

        Actions.quizTrend();

        const listEl = document.querySelector('.trend-list');
        const searchEl = document.querySelector('input[data-role="search"]');
        const zhangCard = [...listEl.querySelectorAll('.trend-card')].find(card => card.textContent.includes('01 张三'));

        expect(zhangCard).toBeTruthy();

        sparkSpy.mockClear();
        searchEl.value = '张三';
        searchEl.dispatchEvent(new Event('input', { bubbles: true }));

        expect(listEl.querySelectorAll('.trend-card')).toHaveLength(1);
        expect(listEl.firstElementChild).toBe(zhangCard);
        expect(sparkSpy).not.toHaveBeenCalled();
    });

    it('should skip rebuilding trend cards when the visible range output is unchanged', () => {
        State.list = [
            '01 张三',
            '02 李四'
        ];
        State.parseRoster();
        State.data = [
            State.normalizeAsg({ id: 1, name: '0301小测', subject: '英语', records: { '01': { score: '70', done: true }, '02': { score: '60', done: true } } }),
            State.normalizeAsg({ id: 2, name: '0308小测', subject: '数学', records: { '01': { score: '82', done: true }, '02': { score: '88', done: true } } })
        ];
        State.rebuildAsgIndex();

        Actions.quizTrend();

        const sparkSpy = vi.spyOn(ActionViews, 'createTrendSparkline');
        const startEl = document.querySelector('select[data-role="start"]');
        const firstCard = document.querySelector('.trend-card');

        startEl.dispatchEvent(new Event('change', { bubbles: true }));

        expect(document.querySelector('.trend-card')).toBe(firstCard);
        expect(sparkSpy).not.toHaveBeenCalled();
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

    it('should render roster actions in topbar without modal footer buttons', () => {
        State.list = ['01 张三'];
        Actions.roster();

        const topbar = document.querySelector('.roster-topbar');
        const toolbarActs = [...document.querySelectorAll('[data-role="actions"] [data-act]')].map(btn => btn.dataset.act);
        const submitActs = [...document.querySelectorAll('[data-role="submit"] [data-act]')].map(btn => btn.dataset.act);

        expect(topbar).toBeTruthy();
        expect(document.querySelector('.roster-hint-card')).toBeNull();
        expect(toolbarActs).toEqual(['add', 'autonum', 'sort-seat', 'clean']);
        expect(submitActs).toEqual(['cancel', 'save']);
        expect(document.querySelector('.modal-footer').style.display).toBe('none');
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

    it('should render subject select and no preset buttons in assignment manager', () => {
        State.data = [State.normalizeAsg({ id: 1, name: '英语作业', subject: '英语', records: {} })];
        State.rebuildAsgIndex();
        State.curId = 1;

        Actions.asgManage();

        expect(document.querySelector('.asg-card select[data-r="sub"]')).toBeTruthy();
        expect(document.querySelector('.asg-card [data-act="pick"]')).toBeNull();
        expect(document.querySelector('.asg-card .asg-pill')).toBeNull();
        expect(document.querySelector('.asg-card [data-act="save"]')).toBeNull();
    });

    it('should auto save assignment name after input', () => {
        vi.useFakeTimers();
        State.data = [State.normalizeAsg({ id: 1, name: '英语作业', subject: '英语', records: {} })];
        State.rebuildAsgIndex();
        State.curId = 1;

        Actions.asgManage();

        const nameInput = document.querySelector('.asg-card [data-r="name"]');
        nameInput.value = '新的任务名';
        nameInput.dispatchEvent(new Event('input', { bubbles: true }));
        vi.advanceTimersByTime(300);

        expect(State.asgMap.get(1).name).toBe('新的任务名');
    });

    it('should switch assignment when clicking assignment card blank area', () => {
        State.data = [
            State.normalizeAsg({ id: 1, name: '作业 1', subject: '英语', records: {} }),
            State.normalizeAsg({ id: 2, name: '作业 2', subject: '数学', records: {} })
        ];
        State.rebuildAsgIndex();
        State.curId = 1;

        Actions.asgManage();

        const targetCard = document.querySelector('.asg-card[data-id="2"] .asg-card-head');
        targetCard.dispatchEvent(new MouseEvent('click', { bubbles: true }));

        expect(State.curId).toBe(2);
    });

    it('should show toast instead of confirm dialog when deleting the last assignment', async () => {
        State.data = [State.normalizeAsg({ id: 1, name: '唯一作业', subject: '英语', records: {} })];
        State.rebuildAsgIndex();
        State.curId = 1;

        const toastSpy = vi.spyOn(Toast, 'show').mockImplementation(() => {});

        Actions.asgManage();
        const modalSpy = vi.spyOn(Modal, 'show');
        document.querySelector('.asg-card-delete').dispatchEvent(new MouseEvent('click', { bubbles: true }));
        await Promise.resolve();

        expect(toastSpy).toHaveBeenCalledWith('至少保留一个任务');
        expect(modalSpy).not.toHaveBeenCalled();
    });

    it('should delete assignment after full screen confirm', async () => {
        State.data = [
            State.normalizeAsg({ id: 1, name: '作业 1', subject: '英语', records: {} }),
            State.normalizeAsg({ id: 2, name: '作业 2', subject: '数学', records: {} })
        ];
        State.rebuildAsgIndex();
        State.curId = 1;

        Actions.asgManage();
        const modalSpy = vi.spyOn(Modal, 'show').mockResolvedValue(true);

        document.querySelector('.asg-card[data-id="2"] .asg-card-delete').dispatchEvent(new MouseEvent('click', { bubbles: true }));
        await Promise.resolve();

        expect(modalSpy).toHaveBeenCalledWith(expect.objectContaining({
            title: '删除作业项目'
        }));
        expect(State.asgMap.has(2)).toBe(false);
        expect(State.data).toHaveLength(1);
    });

    it('should create assignment with input placeholder when name input is empty', () => {
        State.data = [State.normalizeAsg({ id: 1, name: '作业 1', subject: '英语', records: {} })];
        State.rebuildAsgIndex();
        State.curId = 1;

        Actions.asgManage();

        const nameInput = document.querySelector('[data-role="new-name"]');
        const createBtn = document.querySelector('[data-role="new-create"]');
        const placeholderName = '使用占位文本';
        nameInput.value = '';
        nameInput.placeholder = placeholderName;
        createBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));

        expect(State.data).toHaveLength(2);
        expect(State.cur.name).toBe(placeholderName);
    });

    it('should show toast when creating assignment without input and placeholder', () => {
        State.data = [State.normalizeAsg({ id: 1, name: '作业 1', subject: '英语', records: {} })];
        State.rebuildAsgIndex();
        State.curId = 1;

        const toastSpy = vi.spyOn(Toast, 'show').mockImplementation(() => {});
        Actions.asgManage();

        const nameInput = document.querySelector('[data-role="new-name"]');
        const createBtn = document.querySelector('[data-role="new-create"]');
        nameInput.value = '';
        nameInput.placeholder = '';
        createBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));

        expect(toastSpy).toHaveBeenCalledWith('任务名称不能为空');
        expect(State.data).toHaveLength(1);
    });

    it('should create assignment with input placeholder when name input is empty', () => {
        State.data = [State.normalizeAsg({ id: 1, name: '作业 1', subject: '英语', records: {} })];
        State.rebuildAsgIndex();
        State.curId = 1;

        Actions.asgManage();

        const nameInput = document.querySelector('[data-role="new-name"]');
        const createBtn = document.querySelector('[data-role="new-create"]');
        const placeholderName = '使用占位文本';
        nameInput.value = '';
        nameInput.placeholder = placeholderName;
        createBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));

        expect(State.data).toHaveLength(2);
        expect(State.cur.name).toBe(placeholderName);
    });

    it('should show toast when creating assignment without input and placeholder', () => {
        State.data = [State.normalizeAsg({ id: 1, name: '作业 1', subject: '英语', records: {} })];
        State.rebuildAsgIndex();
        State.curId = 1;

        const toastSpy = vi.spyOn(Toast, 'show').mockImplementation(() => {});
        Actions.asgManage();

        const nameInput = document.querySelector('[data-role="new-name"]');
        const createBtn = document.querySelector('[data-role="new-create"]');
        nameInput.value = '';
        nameInput.placeholder = '';
        createBtn.dispatchEvent(new MouseEvent('click', { bubbles: true }));

        expect(toastSpy).toHaveBeenCalledWith('任务名称不能为空');
        expect(State.data).toHaveLength(1);
    });

    it('should freeze grid layout while scorepad is open', () => {
        State.list = ['01 张三'];
        State.parseRoster();
        State.data = [State.normalizeAsg({ id: 1, name: '英语作业', subject: '英语', records: {} })];
        State.rebuildAsgIndex();
        State.curId = 1;
        UI.gridEl = document.getElementById('grid');

        const freezeSpy = vi.spyOn(UI, 'setGridFrozen');

        ScorePad.show('01', '张三', { top: 200, height: 80 });
        expect(freezeSpy).toHaveBeenNthCalledWith(1, true);
        expect(UI._gridFrozen).toBe(true);

        ScorePad.hide();
        expect(freezeSpy).toHaveBeenNthCalledWith(2, false);
        expect(UI._gridFrozen).toBe(false);
    });

    it('should switch scorepad to fast ten mode and auto confirm on selection', () => {
        vi.useFakeTimers();
        State.list = ['01 张三'];
        State.parseRoster();
        State.data = [State.normalizeAsg({ id: 1, name: '英语作业', subject: '英语', records: {} })];
        State.rebuildAsgIndex();
        State.curId = 1;
        UI.gridEl = document.getElementById('grid');
        UI.syncCardPool();
        UI.renderCard(UI.gridEl.children[0], State.roster[0], {}, false);

        const updRecSpy = vi.spyOn(State, 'updRec').mockImplementation(() => {});

        ScorePad.show('01', '张三', { top: 200, height: 80 });

        expect(document.querySelector('button[data-val="100"]')).toBeNull();

        document.querySelector('button[data-action="toggle-fast-ten"]').dispatchEvent(new MouseEvent('click', { bubbles: true }));

        expect(ScorePad.el.classList.contains('fast-ten-mode')).toBe(true);
        expect(Array.from(ScorePad.el.querySelectorAll('.scorepad-row')).map(row => [...row.querySelectorAll('button')].map(btn => btn.textContent.trim()).join(' '))).toEqual([
            '10 20 30',
            '40 50 60',
            '70 80 90',
            'C 100 ⌫'
        ]);

        document.querySelector('button[data-val="10"]').dispatchEvent(new MouseEvent('click', { bubbles: true }));

        expect(updRecSpy).toHaveBeenCalledWith('01', { score: '10', done: true }, expect.objectContaining({
            source: 'scorepad',
            action: 'fast-ten',
            studentName: '张三'
        }));
        expect(ScorePad.isOpen).toBe(false);
        expect(document.querySelector('#toast').textContent).toContain('已记分 10');
        expect(document.querySelector('#toast').classList.contains('show')).toBe(true);
        const card = document.querySelector('.student-card[data-id="01"]');
        expect(card.classList.contains('score-saved-flash')).toBe(true);

        vi.advanceTimersByTime(1700);
        expect(document.querySelector('#toast').classList.contains('show')).toBe(false);
        expect(card.classList.contains('score-saved-flash')).toBe(false);
    });

    it('should show submit hint after confirming a typed score', () => {
        vi.useFakeTimers();
        State.list = ['01 张三'];
        State.parseRoster();
        State.data = [State.normalizeAsg({ id: 1, name: '英语作业', subject: '英语', records: {} })];
        State.rebuildAsgIndex();
        State.curId = 1;
        UI.gridEl = document.getElementById('grid');
        UI.syncCardPool();
        UI.renderCard(UI.gridEl.children[0], State.roster[0], {}, false);

        ScorePad.show('01', '张三', { top: 200, height: 80 });

        const display = document.querySelector('.scorepad-display');
        display.value = '88';
        display.dispatchEvent(new Event('input', { bubbles: true }));
        document.querySelector('button[data-action="confirm"]').dispatchEvent(new MouseEvent('click', { bubbles: true }));

        const hint = document.querySelector('#toast');
        const card = document.querySelector('.student-card[data-id="01"]');

        expect(hint.textContent).toContain('01 张三 已记分 88');
        expect(hint.classList.contains('show')).toBe(true);
        expect(card.classList.contains('score-saved-flash')).toBe(true);
        expect(State.cur.records['01'].score).toBe('88');
    });

    it('should persist scorepad fast ten mode across reopen', () => {
        State.list = ['01 张三'];
        State.parseRoster();
        State.data = [State.normalizeAsg({ id: 1, name: '英语作业', subject: '英语', records: {} })];
        State.rebuildAsgIndex();
        State.curId = 1;
        UI.gridEl = document.getElementById('grid');

        ScorePad.show('01', '张三', { top: 200, height: 80 });
        ScorePad._setFastTenMode(true);
        expect(LS.get(KEYS.SCOREPAD_FAST_TEN, false)).toBe(true);

        ScorePad.hide();
        ScorePad.show('01', '张三', { top: 200, height: 80 });

        expect(ScorePad.fastTenMode).toBe(true);
        expect(ScorePad.el.classList.contains('fast-ten-mode')).toBe(true);
        expect(document.querySelector('button[data-val="10"]')).toBeTruthy();
    });

    it('should avoid rereading scorepad fast ten mode from storage on show and hide', () => {
        State.list = ['01 张三'];
        State.parseRoster();
        State.data = [State.normalizeAsg({ id: 1, name: '英语作业', subject: '英语', records: {} })];
        State.rebuildAsgIndex();
        State.curId = 1;
        UI.gridEl = document.getElementById('grid');

        ScorePad.fastTenMode = true;
        ScorePad._setFastTenMode(true, { persist: false });
        const getSpy = vi.spyOn(LS, 'get');

        ScorePad.show('01', '张三', { top: 200, height: 80 });
        ScorePad.hide();

        expect(getSpy).not.toHaveBeenCalledWith(KEYS.SCOREPAD_FAST_TEN, expect.anything());
        expect(ScorePad.fastTenMode).toBe(true);
    });

    it('should route score action through indexed card lookup without document scans', () => {
        State.list = ['01 张三', '02 李四'];
        State.parseRoster();
        UI.gridEl = document.getElementById('grid');
        UI.syncCardPool();
        UI.renderCard(UI.gridEl.children[1], State.roster[1], {}, false);

        const showSpy = vi.spyOn(ScorePad, 'show').mockImplementation(() => {});
        const querySpy = vi.spyOn(document, 'querySelector');
        const queryAllSpy = vi.spyOn(document, 'querySelectorAll');

        Actions.score('02', '李四');

        expect(showSpy).toHaveBeenCalledWith('02', '李四', expect.any(Object));
        expect(querySpy).not.toHaveBeenCalled();
        expect(queryAllSpy).not.toHaveBeenCalled();
    });

    it('should reuse score range report cache until assignment metadata changes', () => {
        State.list = ['01 张三'];
        State.parseRoster();
        State.data = [
            State.normalizeAsg({ id: 1, name: '0301小测', subject: '英语', records: { '01': { score: '80', done: true } } }),
            State.normalizeAsg({ id: 2, name: '0308小测', subject: '英语', records: { '01': { score: '90', done: true } } })
        ];
        State.rebuildAsgIndex();
        State.curId = 1;

        const first = State.getScoreRangeReport(1, 2);
        const second = State.getScoreRangeReport(1, 2);

        expect(second).toBe(first);

        State.updateAsgMeta(1, { name: '0301小测补录', subject: '英语' });

        const third = State.getScoreRangeReport(1, 2);

        expect(third).not.toBe(first);
        expect(third.assignments[0].name).toBe('0301小测补录');
    });

    it('should remove bottom sheet nodes after close', () => {
        vi.useFakeTimers();
        const prevBackdropCount = document.querySelectorAll('.bottom-sheet-backdrop').length;
        const prevPanelCount = document.querySelectorAll('.bottom-sheet').length;
        const sheet = BottomSheet.create({ content: document.createElement('div') });

        sheet.show();
        expect(document.querySelectorAll('.bottom-sheet-backdrop').length).toBe(prevBackdropCount + 1);
        expect(document.querySelectorAll('.bottom-sheet').length).toBe(prevPanelCount + 1);

        sheet.hide();
        vi.advanceTimersByTime(BottomSheet.CLOSE_ANIMATION_MS);

        expect(document.querySelectorAll('.bottom-sheet-backdrop').length).toBe(prevBackdropCount);
        expect(document.querySelectorAll('.bottom-sheet').length).toBe(prevPanelCount);
    });

    it('should resolve bottom sheet confirm and prompt through sheet results', async () => {
        vi.useFakeTimers();

        const confirmPromise = BottomSheet.confirm('确认测试');
        document.querySelector('.bottom-sheet-footer .btn-p').dispatchEvent(new MouseEvent('click', { bubbles: true }));
        await expect(confirmPromise).resolves.toBe(true);
        vi.advanceTimersByTime(BottomSheet.CLOSE_ANIMATION_MS);

        const promptPromise = BottomSheet.prompt('输入测试', '12');
        vi.advanceTimersByTime(100);
        const input = document.querySelector('.bottom-sheet-prompt-input');
        input.value = '34';
        document.querySelector('.bottom-sheet-footer .btn-p').dispatchEvent(new MouseEvent('click', { bubbles: true }));
        await expect(promptPromise).resolves.toBe('34');
    });
});
