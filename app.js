        const State = {
            list: [], roster: [], data: [], curId: null, mode: 'id', scoring: false, animations: true, debug: false,
            prefs: { cardDoneColor: '#68c490' },
            asgMap: new Map(),
            rosterIndexMap: new Map(),
            noEnglishIds: [],
            view: {
                init() { },
                render() { },
                renderStudent() { },
                renderProgress() { },
                isReady() { return false; }
            },
            _persistTimer: 0,
            _metricsToken: 0,
            _statsCache: new Map(),
            _dirtyData: false,
            _dirtyList: false,
            _asgListVersion: 0,
            _rosterVersion: 0,
            _gridDirtyFull: true,
            _gridDirtyStudentIds: new Set(),
            init() {
                this.list = LS.get(KEYS.LIST, [
                    '01 蓝慧婷',
                    '02 陈静',
                    '03 李智豪',
                    '04 朱佑豪',
                    '05 张伟芬',
                    '06 许俊熠',
                    '07 李凤君',
                    '08 黄文涛',
                    '09 黄泺绮',
                    '10 利子见',
                    '11 蔡嘉乐',
                    '12 刘静娴',
                    '13 蓝烽',
                    '14 张思琪',
                    '15 卢佳慧',
                    '16 钟佳渝',
                    '17 叶帆',
                    '18 吴梦婷',
                    '19 彭文佳',
                    '20 吴思静',
                    '21 刘嘉莹',
                    '22 温秋茹',
                    '23 李乐',
                    '24 温沁钰',
                    '25 林思婷',
                    '26 巫依霞',
                    '27 刘雅淇',
                    '28 侯润楹',
                    '29 叶塘美',
                    '30 黄宇凡',
                    '31 叶煌',
                    '32 张清雅',
                    '33 杨梓豪',
                    '34 王政铭',
                    '35 陈圆',
                    '36 刘斌',
                    '37 丘雅莹',
                    '38 罗燕',
                    '39 何苑琦',
                    '40 赵玉婷',
                    '41 曾宝茹',
                    '42 张栩瑜',
                    '43 李孝霖',
                    '44 杨欢',
                    '45 彭嘉红',
                    '46 丘瑜诗',
                    '47 李欣',
                    '48 吴嘉钰',
                    '49 刘依婷',
                    '50 曾誉宸'
                ]);
                this.data = LS.get(KEYS.DATA, []);
                this.data = this.data.map(a => this.normalizeAsg(a)).filter(Boolean);
                this.animations = LS.get(KEYS.ANIM, true);
                this.debug = !!LS.get(KEYS.DEBUG, false);
                this.prefs = this.normalizePrefs(LS.get(KEYS.PREFS, this.prefs));
                const recovered = this.applyRecoveryDraft();
                try {
                    this.parseRoster();
                } catch (err) {
                    window.alert(`名单数据异常：${err.message}\n请先修复本地名单后再使用。`);
                    throw err;
                }
                if (!this.data.length) this.addAsg('任务 1');
                const repairedIds = this.sanitizeAsgIds();
                this.rebuildAsgIndex();
                if (repairedIds) Toast.show('已自动修复异常任务 ID');
                this.curId = this.resolveCurId(this.curId);
                this.applyAnim();
                this.applyCardColor();
                window.addEventListener('beforeunload', () => this.flushPersist());
                this.view.init();
                if (recovered) Toast.show('已恢复上次未完成的临时登记数据');
            },
            normalizePrefs(raw) {
                const prefs = raw && typeof raw === 'object' ? raw : {};
                return {
                    cardDoneColor: ColorUtil.normalizeHex(prefs.cardDoneColor, '#68c490')
                };
            },
            rebuildAsgIndex() {
                this.asgMap = new Map(this.data.map(a => [a.id, a]));
            },
            resolveCurId(candidate) {
                if (this.asgMap.has(candidate)) return candidate;
                return this.data[this.data.length - 1]?.id ?? null;
            },
            getRecoveryDraft() {
                const draft = LS.get(KEYS.DRAFT, null);
                if (!draft || typeof draft !== 'object') return null;
                if (!Array.isArray(draft.list) || !Array.isArray(draft.data)) return null;
                return {
                    list: draft.list.map(v => String(v ?? '').trim()).filter(Boolean),
                    data: draft.data.map(a => this.normalizeAsg(a)).filter(Boolean),
                    prefs: this.normalizePrefs(draft.prefs),
                    curId: Number(draft.curId)
                };
            },
            applyRecoveryDraft() {
                const draft = this.getRecoveryDraft();
                if (!draft) return false;
                const hasDelta =
                    JSON.stringify(draft.list) !== JSON.stringify(this.list) ||
                    JSON.stringify(draft.data) !== JSON.stringify(this.data) ||
                    JSON.stringify(draft.prefs) !== JSON.stringify(this.prefs) ||
                    Number(draft.curId) !== Number(this.curId);
                if (!hasDelta) return false;
                this.list = draft.list;
                this.data = draft.data;
                this.prefs = draft.prefs;
                this.curId = Number.isFinite(draft.curId) ? draft.curId : this.curId;
                return true;
            },
            saveRecoveryDraft() {
                LS.set(KEYS.DRAFT, {
                    version: 1,
                    updatedAt: Date.now(),
                    list: this.list,
                    data: this.data,
                    prefs: this.normalizePrefs(this.prefs),
                    curId: this.curId
                });
            },
            sanitizeAsgIds() {
                const used = new Set();
                const cleaned = [];
                let repaired = false;
                let nextId = Date.now();
                this.data.forEach(item => {
                    const asg = this.normalizeAsg(item);
                    if (!asg || asg._invalidId) {
                        repaired = true;
                        return;
                    }
                    if (used.has(asg.id)) {
                        repaired = true;
                        while (used.has(nextId)) nextId++;
                        asg.id = nextId;
                        nextId++;
                    }
                    used.add(asg.id);
                    cleaned.push(asg);
                });
                this.data = cleaned;
                return repaired;
            },
            normalizeAsg(asg) {
                if (!asg || typeof asg !== 'object') return null;
                const name = String(asg.name || '').trim();
                const legacyEnglish = /英语/.test(name);
                const subject = String(asg.subject || '').trim() || (legacyEnglish ? '英语' : '其他');
                const id = Number(asg.id);
                const invalidId = !Number.isFinite(id);
                const normalized = {
                    id: invalidId ? null : id,
                    name: name || '未命名任务',
                    subject,
                    records: asg.records && typeof asg.records === 'object' ? asg.records : {}
                };
                if (invalidId) normalized._invalidId = true;
                return normalized;
            },
            normalizeAsgInPlace(asg) {
                const normalized = this.normalizeAsg(asg);
                if (!normalized) return null;
                if (asg && typeof asg === 'object') {
                    asg.id = normalized.id;
                    asg.name = normalized.name;
                    asg.subject = normalized.subject;
                    asg.records = normalized.records;
                    return asg;
                }
                return normalized;
            },
            invalidateDerived() {
                this._metricsToken++;
                this._statsCache.clear();
            },
            markGridDirty({ full = false, ids = [] } = {}) {
                if (full) {
                    this._gridDirtyFull = true;
                    this._gridDirtyStudentIds.clear();
                    return;
                }
                if (this._gridDirtyFull) return;
                ids.forEach(id => {
                    const key = String(id || '').trim();
                    if (key) this._gridDirtyStudentIds.add(key);
                });
            },
            consumeGridDirty() {
                const dirty = {
                    full: this._gridDirtyFull,
                    ids: this._gridDirtyFull ? [] : Array.from(this._gridDirtyStudentIds)
                };
                this._gridDirtyFull = false;
                this._gridDirtyStudentIds.clear();
                return dirty;
            },
            queuePersist() {
                clearTimeout(this._persistTimer);
                this._persistTimer = setTimeout(() => this.flushPersist(), 300);
            },
            flushPersist() {
                clearTimeout(this._persistTimer);
                this._persistTimer = 0;
                if (this._dirtyData) {
                    LS.set(KEYS.DATA, this.data);
                    this._dirtyData = false;
                }
                if (this._dirtyList) {
                    LS.set(KEYS.LIST, this.list);
                    this._dirtyList = false;
                }
            },
            parseRosterLine(rawLine) {
                const lineText = String(rawLine ?? '').trim();
                const noEnglish = /\s*#(?:非英语|非英|no-en|noeng|not-en)\s*$/i.test(lineText);
                const line = lineText.replace(/\s*#(?:非英语|非英|no-en|noeng|not-en)\s*$/i, '').trim();
                const i = line.indexOf(' ');
                return i === -1 ? { id: line, name: '', noEnglish } : { id: line.slice(0, i), name: line.slice(i + 1), noEnglish };
            },
            getDuplicateIds(ids) {
                const seen = new Set();
                const dup = new Set();
                ids.forEach(id => {
                    const key = String(id || '').trim();
                    if (!key) return;
                    if (seen.has(key)) dup.add(key);
                    seen.add(key);
                });
                return Array.from(dup);
            },
            assertUniqueRosterIds(ids, sourceLabel = '名单') {
                const dup = this.getDuplicateIds(ids);
                if (dup.length) throw new Error(`${sourceLabel}存在重复学号: ${dup.join('、')}`);
            },
            parseRoster() {
                this.roster = this.list.map(l => this.parseRosterLine(l)).filter(s => s.id);
                this.assertUniqueRosterIds(this.roster.map(stu => stu.id), '名单');
                this.rosterIndexMap = new Map(this.roster.map((stu, index) => [stu.id, index]));
                this.noEnglishIds = this.roster.filter(stu => stu.noEnglish).map(stu => stu.id);
                this._rosterVersion++;
                this.invalidateDerived();
                this.markGridDirty({ full: true });
            },
            save({ render = true, immediate = false, dirtyData = true, dirtyList = false, asgListChanged = false, normalizeMode = 'all', targetAsgId = null } = {}) {
                if (normalizeMode === 'all') {
                    this.sanitizeAsgIds();
                    this.rebuildAsgIndex();
                } else if (normalizeMode === 'target' && targetAsgId != null) {
                    const asg = this.asgMap.get(targetAsgId) || this.data.find(item => item.id === targetAsgId);
                    if (asg) this.normalizeAsgInPlace(asg);
                } else if (normalizeMode === 'none') {
                    if (!this.asgMap.size || this.asgMap.size !== this.data.length) this.rebuildAsgIndex();
                }
                this.invalidateDerived();
                if (dirtyData) this._dirtyData = true;
                if (dirtyList) this._dirtyList = true;
                if (asgListChanged) this._asgListVersion++;
                if (dirtyData || dirtyList) this.saveRecoveryDraft();
                if (immediate) this.flushPersist();
                else this.queuePersist();
                if (render && this.view.isReady()) this.view.render();
            },
            saveAnim() { LS.set(KEYS.ANIM, this.animations); this.applyAnim(); },
            savePrefs() {
                this.prefs = this.normalizePrefs(this.prefs);
                this.saveRecoveryDraft();
                LS.set(KEYS.PREFS, this.prefs);
                this.applyCardColor();
            },
            applyAnim() {
                document.body.classList.toggle('no-animations', !this.animations);
                $('btnAnim').textContent = `显示动画: ${this.animations ? '开' : '关'}`;
                $('btnDebug').textContent = `调试面板: ${Debug.enabled ? '开' : '关'}`;
            },
            applyCardColor() {
                const base = ColorUtil.normalizeHex(this.prefs?.cardDoneColor, '#68c490');
                const start = ColorUtil.mix(base, '#ffffff', 0.08);
                const end = ColorUtil.mix(base, '#10261a', 0.14);
                const border = ColorUtil.mix(base, '#10261a', 0.2);
                document.documentElement.style.setProperty('--done-card-start', start);
                document.documentElement.style.setProperty('--done-card-end', end);
                document.documentElement.style.setProperty('--done-card-border', border);
                document.documentElement.style.setProperty('--done-card-shadow', ColorUtil.withAlpha(base, 0.22));
                document.documentElement.style.setProperty('--done-card-press-shadow', ColorUtil.withAlpha(base, 0.32));
            },
            applyScoring() {
                $('btnScoreMenu').textContent = `打分模式: ${this.scoring ? '开' : '关'}`;
            },
            get cur() { return this.asgMap.get(this.curId) || this.data[0]; },
            addAsg(n) {
                let id = Date.now();
                while (this.asgMap.has(id)) id++;
                const asg = this.normalizeAsg({ id, name: (n || '').trim() || '未命名任务', subject: '英语', records: {} });
                this.data.push(asg);
                this.rebuildAsgIndex();
                this.curId = id;
                this.markGridDirty({ full: true });
                this.save({ asgListChanged: true, normalizeMode: 'none' });
            },
            selectAsg(id) {
                if (!this.asgMap.has(id)) return;
                this.curId = id;
                this.markGridDirty({ full: true });
                this.view.render();
            },
            renameAsg(id, name) {
                const asg = this.asgMap.get(id);
                const safeName = (name || '').trim();
                if (!asg || !safeName) return false;
                asg.name = safeName;
                this.save({ asgListChanged: true, normalizeMode: 'target', targetAsgId: id });
                return true;
            },
            updateAsgMeta(id, payload = {}) {
                const asg = this.asgMap.get(id);
                if (!asg) return false;
                const safeName = String(payload.name ?? asg.name).trim();
                const safeSubject = String(payload.subject ?? asg.subject ?? '').trim() || '英语';
                if (!safeName) return false;
                const prevSubject = this.getAsgSubject(asg);
                asg.name = safeName;
                asg.subject = safeSubject;
                if (id === this.curId && prevSubject !== safeSubject) this.markGridDirty({ full: true });
                this.save({ asgListChanged: true, normalizeMode: 'target', targetAsgId: id });
                return true;
            },
            removeAsg(id) {
                if (this.data.length <= 1) return false;
                const idx = this.data.findIndex(a => a.id === id);
                if (idx === -1) return false;
                this.data.splice(idx, 1);
                if (this.curId === id) {
                    const fallback = this.data[Math.max(0, idx - 1)] || this.data[0];
                    this.curId = fallback.id;
                }
                this.rebuildAsgIndex();
                this.markGridDirty({ full: true });
                this.save({ asgListChanged: true, normalizeMode: 'none' });
                return true;
            },
            getAsgSubject(asg) {
                return String(asg?.subject || '').trim() || (/英语/.test(asg?.name || '') ? '英语' : '其他');
            },
            isEnglishAsg(asg) { return this.getAsgSubject(asg) === '英语'; },
            isStuIncluded(asg, stu) { return !(this.isEnglishAsg(asg) && stu.noEnglish); },
            getAsgMetrics(asg) {
                if (!asg) return { total: 0, done: 0 };
                const cached = this._statsCache.get(asg.id);
                if (cached && cached.token === this._metricsToken) return cached.metrics;
                let total = 0;
                let done = 0;
                for (const stu of this.roster) {
                    if (!this.isStuIncluded(asg, stu)) continue;
                    total++;
                    if (asg.records?.[stu.id]?.done) done++;
                }
                const metrics = { total, done };
                this._statsCache.set(asg.id, { token: this._metricsToken, metrics });
                return metrics;
            },
            getAsgTotalCount(asg) { return this.getAsgMetrics(asg).total; },
            getAsgDoneCount(asg) { return this.getAsgMetrics(asg).done; },
            getAsgRowSnapshot(asg) {
                if (!asg) return { included: [], done: [] };
                const cacheKey = `rows:${asg.id}`;
                const cached = this._statsCache.get(cacheKey);
                if (cached && cached.token === this._metricsToken) return cached.value;
                const included = new Array(this.roster.length);
                const done = new Array(this.roster.length);
                for (let i = 0; i < this.roster.length; i++) {
                    const stu = this.roster[i];
                    const isIncluded = this.isStuIncluded(asg, stu);
                    included[i] = isIncluded;
                    done[i] = isIncluded && !!asg.records?.[stu.id]?.done;
                }
                const value = { included, done };
                this._statsCache.set(cacheKey, { token: this._metricsToken, value });
                return value;
            },
            getStatsRows(selectedIds) {
                const keyIds = selectedIds.slice().sort((a, b) => a - b);
                const cacheKey = `${this._metricsToken}|${keyIds.join(',')}`;
                const cached = this._statsCache.get(cacheKey);
                if (cached) return cached;
                const tgs = keyIds.map(id => this.asgMap.get(id)).filter(Boolean);
                const snapshots = tgs.map(asg => this.getAsgRowSnapshot(asg));
                const rows = this.roster.map((s, i) => {
                    let total = 0;
                    let doneCount = 0;
                    const dones = [];
                    for (const snapshot of snapshots) {
                        if (!snapshot.included[i]) continue;
                        total++;
                        const done = snapshot.done[i];
                        dones.push(done);
                        if (done) doneCount++;
                    }
                    const rate = total ? Math.round(doneCount / total * 100) : 0;
                    return { ...s, dones, rate, total, i };
                }).filter(r => r.total > 0).sort((a, b) => b.rate - a.rate || a.i - b.i);
                const avgRate = rows.length ? Math.round(rows.reduce((sum, row) => sum + row.rate, 0) / rows.length) : 0;
                const result = { tgs, rows, avgRate };
                this._statsCache.set(cacheKey, result);
                return result;
            },
            updRec(id, val) {
                const asg = this.cur;
                if (!asg) return;
                const prev = asg.records[id] || {};
                const r = this.cur.records;
                r[id] = { ...r[id], ...val };
                const next = r[id];
                if (!next.done && (next.score == null || next.score === '')) delete r[id];
                this.invalidateDerived();
                this._dirtyData = true;
                this.markGridDirty({ ids: [id] });
                this.saveRecoveryDraft();
                this.queuePersist();
                this.view.renderStudent(id);
                const prevDone = !!prev.done;
                const nextDone = !!(r[id]?.done);
                if (prevDone !== nextDone) this.view.renderProgress(this.getAsgDoneCount(asg), this.getAsgTotalCount(asg));
            }
        };
        const UI = {
            isReady: false,
            actions: {
                has() { return false; },
                run() { },
                handleFile() { },
                score() { }
            },
            _gridFrozen: false,
            _taskSelectVersion: -1,
            _lastRenderAsgId: null,
            _lastRosterVersion: -1,
            _lastCardPoolSize: -1,
            _lastGridMetricsKey: '',
            _gridPaddingX: 0,
            _gridPaddingY: 0,
            init() {
                BackHandler.init();
                this.gridEl = $('grid');
                this.counterEl = $('counter');
                this.progressFillEl = $('progressFill');
                this.asgSelectEl = $('asgSelect');
                this.asgSelectEl.onchange = e => State.selectAsg(+e.target.value);
                $('btnView').onclick = e => { document.body.classList.toggle('mode-names', (State.mode = State.mode === 'id' ? 'name' : 'id') === 'name'); e.target.classList.toggle('active', State.mode === 'name'); };
                $('btnMenu').onclick = e => { e.stopPropagation(); $('menu').classList.toggle('show'); };
                document.onclick = () => $('menu').classList.remove('show');
                $('menu').onclick = e => {
                    const act = e.target.getAttribute('act');
                    if (!act || !this.actions.has(act)) return;
                    $('menu').classList.remove('show');
                    this.actions.run(act);
                };
                $('fileIn').onchange = e => this.actions.handleFile(e);
                Debug.init();
                this.setupGrid();
                this.setupGridSizing();
                State.applyScoring();
                this.isReady = true;
                this.render();
            },
            setupGrid() {
                let timer = null, pressCard = null, longPressed = false, moved = false, startPos = { x: 0, y: 0 };
                const grid = this.gridEl;
                const isTrackedCard = card => card && (card.dataset.id === '38' || card.dataset.id === '39' || card.dataset.id === '40');
                const cancelTimer = () => {
                    if (!timer) return;
                    clearTimeout(timer);
                    timer = null;
                };
                const handle = (card, long) => {
                    if (card.dataset.excluded === '1') return;
                    const { id, name } = card.dataset;
                    if (Debug.enabled) Debug.log(`卡片触发 id=${id} name=${name} long=${long ? 1 : 0} scoring=${State.scoring ? 1 : 0}`);
                    if (long || State.scoring) this.actions.score(id, name);
                    else State.updRec(id, { done: !State.cur.records[id]?.done });
                };
                const resetState = () => {
                    if (pressCard) pressCard.classList.remove('pressing');
                    cancelTimer();
                    pressCard = null;
                    longPressed = false;
                    moved = false;
                    startPos = { x: 0, y: 0 };
                };
                grid.onpointerdown = e => {
                    const tc = e.target.closest('.student-card');
                    if (Debug.enabled && isTrackedCard(tc)) Debug.log(`pointerdown id=${tc.dataset.id} x=${Math.round(e.clientX)} y=${Math.round(e.clientY)}`);
                    const c = e.target.closest('.student-card');
                    if (!c) return;
                    pressCard = c;
                    longPressed = false;
                    moved = false;
                    startPos = { x: e.clientX, y: e.clientY };
                    c.classList.add('pressing');
                    cancelTimer();
                    timer = setTimeout(() => {
                        timer = null;
                        longPressed = true;
                        c.classList.remove('pressing');
                        handle(c, true);
                        resetState();
                    }, 500);
                };
                grid.onpointerup = e => {
                    const tc = e.target.closest('.student-card');
                    if (Debug.enabled && isTrackedCard(tc)) Debug.log(`pointerup id=${tc.dataset.id} moved=${moved ? 1 : 0} long=${longPressed ? 1 : 0}`);
                    const c = e.target.closest('.student-card');
                    if (c && pressCard === c && !longPressed && !moved) {
                        c.classList.remove('pressing');
                        handle(c, false);
                    }
                    resetState();
                };
                grid.onpointermove = e => {
                    if (!pressCard) return;
                    const dx = Math.abs(e.clientX - startPos.x);
                    const dy = Math.abs(e.clientY - startPos.y);
                    if (dx > 10 || dy > 8) {
                        moved = true;
                        pressCard.classList.remove('pressing');
                        cancelTimer();
                    }
                };
                grid.onpointercancel = resetState;
                grid.onpointerleave = () => {
                    if (pressCard) pressCard.classList.remove('pressing');
                    cancelTimer();
                    pressCard = null;
                };
            },
            setupGridSizing() {
                const grid = this.gridEl;
                this.refreshGridPadding();
                const refresh = () => {
                    this.refreshGridPadding();
                    this.scheduleGridLayout();
                };
                this._gridResizeObserver = new ResizeObserver(refresh);
                this._gridResizeObserver.observe(grid);
                window.addEventListener('resize', refresh, { passive: true });
                if (window.visualViewport) window.visualViewport.addEventListener('resize', refresh, { passive: true });
                this.scheduleGridLayout();
            },
            refreshGridPadding() {
                const style = getComputedStyle(this.gridEl);
                this._gridPaddingX = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight);
                this._gridPaddingY = parseFloat(style.paddingTop) + parseFloat(style.paddingBottom);
            },
            setGridFrozen(frozen) {
                this._gridFrozen = !!frozen;
                if (!this._gridFrozen) this.scheduleGridLayout();
            },
            scheduleGridLayout() {
                if (this._gridFrozen) return;
                cancelAnimationFrame(this._gridLayoutRaf || 0);
                this._gridLayoutRaf = requestAnimationFrame(() => this.updateGridMetrics());
            },
            calcGridLayout(count, width, height) {
                const safeCount = Math.max(1, count || 1);
                const cols = 5;
                const rows = Math.ceil(safeCount / cols);
                const baseGap = Math.max(4, Math.min(10, Math.round(Math.min(width, height) / 95)));
                const calcSize = gap => ({
                    cellW: (width - gap * (cols - 1)) / cols,
                    cellH: (height - gap * (rows - 1)) / rows
                });
                let gap = baseGap;
                let size = calcSize(gap);
                let base = Math.min(size.cellW, size.cellH);
                if (base < 24) {
                    gap = 2;
                    size = calcSize(gap);
                    base = Math.min(size.cellW, size.cellH);
                }
                base = Math.max(18, base);

                return {
                    cols,
                    rows,
                    gap,
                    cellW: Math.max(18, size.cellW),
                    cellH: Math.max(18, size.cellH),
                    idSize: Math.max(12, Math.min(44, Math.round(base * 0.34))),
                    idCornerSize: Math.max(9, Math.min(16, Math.round(base * 0.2))),
                    nameSize: Math.max(9, Math.min(20, Math.round(base * 0.18))),
                    tagSize: Math.max(8, Math.min(13, Math.round(base * 0.12))),
                    cardPad: Math.max(3, Math.min(8, Math.round(base * 0.08))),
                    cardRadius: Math.max(8, Math.min(16, Math.round(base * 0.15)))
                };
            },
            updateGridMetrics() {
                const grid = this.gridEl;
                const count = Math.max(1, State.roster.length || 1);
                const width = Math.max(0, grid.clientWidth - this._gridPaddingX);
                const height = Math.max(0, grid.clientHeight - this._gridPaddingY);
                if (!width || !height) return;

                const metrics = this.calcGridLayout(count, width, height);
                const metricsKey = `${count}|${metrics.cols}|${metrics.rows}|${metrics.gap}|${metrics.cellW.toFixed(2)}|${metrics.cellH.toFixed(2)}|${metrics.idSize}|${metrics.nameSize}|${metrics.tagSize}|${metrics.cardPad}|${metrics.cardRadius}`;
                if (metricsKey === this._lastGridMetricsKey) return;
                this._lastGridMetricsKey = metricsKey;
                grid.style.setProperty('--grid-cols', metrics.cols);
                grid.style.setProperty('--grid-rows', metrics.rows);
                grid.style.setProperty('--grid-gap', `${metrics.gap}px`);
                grid.style.setProperty('--cell-w', `${metrics.cellW}px`);
                grid.style.setProperty('--cell-h', `${metrics.cellH}px`);
                grid.style.setProperty('--id-size', `${metrics.idSize}px`);
                grid.style.setProperty('--id-corner-size', `${metrics.idCornerSize}px`);
                grid.style.setProperty('--name-size', `${metrics.nameSize}px`);
                grid.style.setProperty('--tag-size', `${metrics.tagSize}px`);
                grid.style.setProperty('--card-pad', `${metrics.cardPad}px`);
                grid.style.setProperty('--card-radius', `${metrics.cardRadius}px`);
            },
            createCard() {
                const card = document.createElement('button');
                card.type = 'button';
                card.className = 'student-card';
                card.innerHTML = `<span class="card-id"></span><span class="card-name"></span><span class="card-score" hidden></span>`;
                return card;
            },
            syncCardPool() {
                const grid = this.gridEl;
                const target = State.roster.length;
                while (grid.children.length < target) grid.appendChild(this.createCard());
                while (grid.children.length > target) grid.lastElementChild.remove();
            },
            renderCard(card, stu, rec, excluded = false) {
                if (card.dataset.id !== stu.id) card.dataset.id = stu.id;
                if (card.dataset.name !== stu.name) card.dataset.name = stu.name;
                card.dataset.excluded = excluded ? '1' : '0';

                const idEl = card.children[0];
                const nameEl = card.children[1];
                const scoreEl = card.children[2];

                if (idEl.textContent !== stu.id) idEl.textContent = stu.id;
                if (nameEl.textContent !== stu.name) nameEl.textContent = stu.name;

                const done = !excluded && !!rec.done;
                card.classList.toggle('done', done);
                card.classList.toggle('excluded', excluded);

                if (!excluded && rec.score != null && rec.score !== '') {
                    if (scoreEl.hidden) scoreEl.hidden = false;
                    const scoreText = String(rec.score);
                    if (scoreEl.textContent !== scoreText) scoreEl.textContent = scoreText;
                } else if (!scoreEl.hidden) {
                    scoreEl.hidden = true;
                    scoreEl.textContent = '';
                }
            },
            renderStudent(id) {
                const asg = State.cur;
                const index = State.rosterIndexMap.get(id);
                if (!asg || index == null) return;
                this.syncCardPool();
                const card = this.gridEl.children[index];
                const stu = State.roster[index];
                if (!card || !stu) return;
                const rec = asg.records[id] || {};
                const excluded = !State.isStuIncluded(asg, stu);
                this.renderCard(card, stu, rec, excluded);
            },
            renderProgress(doneCount, total = State.roster.length) {
                this.counterEl.textContent = `${doneCount}/${total}`;
                this.progressFillEl.style.width = total ? `${(doneCount / total) * 100}%` : '0%';
            },
            ensureTaskOptions() {
                const sel = this.asgSelectEl;
                if (this._taskSelectVersion !== State._asgListVersion) {
                    sel.replaceChildren();
                    State.data.forEach(a => {
                        const option = document.createElement('option');
                        option.value = String(a.id);
                        option.textContent = a.name;
                        sel.append(option);
                    });
                    this._taskSelectVersion = State._asgListVersion;
                }
                if (sel.value != State.curId) sel.value = String(State.curId);
            },
            render() {
                const asg = State.cur; if (!asg) return;
                const currentPoolSize = State.roster.length;
                const isCardPoolSizeChanged = this._lastCardPoolSize !== currentPoolSize;
                const dirty = State.consumeGridDirty();
                const forceFull = dirty.full || isCardPoolSizeChanged;
                this.ensureTaskOptions();

                this.syncCardPool();
                const cards = this.gridEl.children;

                const total = State.getAsgTotalCount(asg);
                const doneCount = State.getAsgDoneCount(asg);
                if (forceFull) {
                    State.roster.forEach((stu, i) => {
                        const rec = asg.records[stu.id] || {};
                        const excluded = !State.isStuIncluded(asg, stu);
                        this.renderCard(cards[i], stu, rec, excluded);
                    });
                } else {
                    dirty.ids.forEach(id => {
                        const index = State.rosterIndexMap.get(id);
                        if (index == null) return;
                        const stu = State.roster[index];
                        if (!stu) return;
                        const rec = asg.records[stu.id] || {};
                        const excluded = !State.isStuIncluded(asg, stu);
                        this.renderCard(cards[index], stu, rec, excluded);
                    });
                }
                this.renderProgress(doneCount, total);
                this._lastRenderAsgId = asg.id;
                this._lastRosterVersion = State._rosterVersion;
                this._lastCardPoolSize = currentPoolSize;
                this.scheduleGridLayout();
            }
        };

        State.view = {
            init: () => UI.init(),
            render: () => UI.render(),
            renderStudent: id => UI.renderStudent(id),
            renderProgress: (doneCount, total) => UI.renderProgress(doneCount, total),
            isReady: () => UI.isReady
        };

        Object.assign(globalThis, { State, UI });
