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
                try {
                    this.parseRoster();
                } catch (err) {
                    window.alert(`名单数据异常：${err.message}\n请先修复本地名单后再使用。`);
                    throw err;
                }
                this.data = LS.get(KEYS.DATA, []);
                this.data = this.data.map(a => this.normalizeAsg(a)).filter(Boolean);
                this.animations = LS.get(KEYS.ANIM, true);
                this.debug = !!LS.get(KEYS.DEBUG, false);
                this.prefs = this.normalizePrefs(LS.get(KEYS.PREFS, this.prefs));
                if (!this.data.length) this.addAsg('任务 1');
                const repairedIds = this.sanitizeAsgIds();
                this.rebuildAsgIndex();
                if (repairedIds) Toast.show('已自动修复异常任务 ID');
                this.curId = this.data[this.data.length - 1].id;
                this.applyAnim();
                this.applyCardColor();
                window.addEventListener('beforeunload', () => this.flushPersist());
                this.view.init();
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
                if (immediate) this.flushPersist();
                else this.queuePersist();
                if (render && this.view.isReady()) this.view.render();
            },
            saveAnim() { LS.set(KEYS.ANIM, this.animations); this.applyAnim(); },
            savePrefs() {
                this.prefs = this.normalizePrefs(this.prefs);
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
                this.save({ asgListChanged: true, normalizeMode: 'none' });
            },
            selectAsg(id) {
                if (!this.asgMap.has(id)) return;
                this.curId = id;
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
                asg.name = safeName;
                asg.subject = safeSubject;
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
                this.asgSelectEl.onchange = e => { State.curId = +e.target.value; this.render(); };
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
            getCardState(asg, stu) {
                const excluded = !State.isStuIncluded(asg, stu);
                const rec = asg?.records?.[stu.id] || {};
                return {
                    excluded,
                    done: !excluded && !!rec.done,
                    score: !excluded && rec.score != null && rec.score !== '' ? String(rec.score) : ''
                };
            },
            shouldRefreshCard(prevAsg, nextAsg, stu) {
                if (!prevAsg || !nextAsg) return true;
                const prevState = this.getCardState(prevAsg, stu);
                const nextState = this.getCardState(nextAsg, stu);
                return prevState.excluded !== nextState.excluded || prevState.done !== nextState.done || prevState.score !== nextState.score;
            },
            getChangedStudentIds(prevAsg, nextAsg) {
                if (!prevAsg || !nextAsg) return State.roster.map(stu => stu.id);
                const changed = new Set([
                    ...Object.keys(prevAsg.records || {}),
                    ...Object.keys(nextAsg.records || {})
                ]);
                if (State.isEnglishAsg(prevAsg) !== State.isEnglishAsg(nextAsg)) {
                    State.noEnglishIds.forEach(id => changed.add(id));
                }
                return changed;
            },
            render() {
                const asg = State.cur; if (!asg) return;
                const prevAsg = State.asgMap.get(this._lastRenderAsgId);
                const currentPoolSize = State.roster.length;
                const isFirstRender = !prevAsg;
                const isRosterChanged = this._lastRosterVersion !== State._rosterVersion;
                const isTaskSwitched = this._lastRenderAsgId != null && this._lastRenderAsgId !== asg.id;
                const isCardPoolSizeChanged = this._lastCardPoolSize !== currentPoolSize;
                const forceFull = isFirstRender || isRosterChanged || isTaskSwitched || isCardPoolSizeChanged;
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
                    this.getChangedStudentIds(prevAsg, asg).forEach(id => {
                        const index = State.rosterIndexMap.get(id);
                        if (index == null) return;
                        const stu = State.roster[index];
                        if (!stu) return;
                        if (!this.shouldRefreshCard(prevAsg, asg, stu)) return;
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

        const Actions = {
            ctx: {
                state: null,
                modal: null,
                toast: null,
                debug: null,
                colorUtil: null,
                subjectPresets: [],
                cardColorPresets: [],
                getFileInput() { return null; }
            },
            toggleScore() {
                const { state } = this.ctx;
                state.scoring = !state.scoring;
                state.applyScoring();
            },
            toggleAnim() {
                const { state } = this.ctx;
                state.animations = !state.animations;
                state.saveAnim();
            },
            toggleDebug() {
                const { debug, toast } = this.ctx;
                debug.toggle();
                toast.show(`调试面板已${debug.enabled ? '开启' : '关闭'}`);
            },
            async cardColor() {
                const { state, modal, toast, colorUtil, cardColorPresets } = this.ctx;
                const defaults = state.normalizePrefs({});
                let selected = colorUtil.normalizeHex(state.prefs.cardDoneColor, defaults.cardDoneColor);
                const panel = document.createElement('div');
                panel.className = 'color-panel';
                panel.innerHTML = `<div class="color-preview">已登记卡片预览</div>
                    <div>
                        <div style="font-size:.84rem;font-weight:700;color:#5a6774;margin-bottom:8px">预设颜色</div>
                        <div class="color-presets"></div>
                    </div>
                    <div>
                        <div style="font-size:.84rem;font-weight:700;color:#5a6774;margin-bottom:8px">自定义颜色</div>
                        <div class="color-picker-row">
                            <input type="color" value="${selected}">
                            <span class="color-code">${selected}</span>
                        </div>
                    </div>
                    <div class="color-note">颜色会立即用于已登记学生卡片，并写入本地存储；导出备份时也会一起带上。</div>`;
                const preview = panel.querySelector('.color-preview');
                const presetHost = panel.querySelector('.color-presets');
                const picker = panel.querySelector('input[type="color"]');
                const code = panel.querySelector('.color-code');

                const paintPreview = hex => {
                    const safe = colorUtil.normalizeHex(hex, defaults.cardDoneColor);
                    const start = colorUtil.mix(safe, '#ffffff', 0.08);
                    const end = colorUtil.mix(safe, '#10261a', 0.14);
                    preview.style.background = `linear-gradient(160deg, ${start}, ${end})`;
                    preview.style.boxShadow = `0 10px 24px ${colorUtil.withAlpha(safe, 0.22)}`;
                };
                const syncPresetActive = () => {
                    [...presetHost.children].forEach(btn => btn.classList.toggle('active', btn.dataset.color === selected));
                };
                const applySelection = hex => {
                    selected = colorUtil.normalizeHex(hex, defaults.cardDoneColor);
                    picker.value = selected;
                    code.textContent = selected.toUpperCase();
                    paintPreview(selected);
                    syncPresetActive();
                };

                cardColorPresets.forEach(hex => {
                    const btn = document.createElement('button');
                    btn.type = 'button';
                    btn.className = 'color-preset';
                    btn.dataset.color = hex;
                    btn.style.background = hex;
                    btn.onclick = () => applySelection(hex);
                    presetHost.appendChild(btn);
                });

                picker.addEventListener('input', e => applySelection(e.target.value));
                applySelection(selected);

                const val = await modal.show({
                    title: '卡片颜色',
                    content: panel,
                    btns: [
                        { text: '恢复默认', type: 'btn-c', onClick: () => modal.close(defaults.cardDoneColor) },
                        { text: '取消', type: 'btn-c', val: false },
                        { text: '保存', type: 'btn-p', onClick: () => modal.close(selected) }
                    ]
                });
                if (!val) return;
                state.prefs.cardDoneColor = colorUtil.normalizeHex(val, defaults.cardDoneColor);
                state.savePrefs();
                toast.show('卡片颜色已更新');
            },
            buildAsgLayout(title) {
                const c = document.createElement('div');
                c.className = 'st-layout';
                c.style.cssText = 'display:flex;flex-direction:column;height:100%';
                c.innerHTML = `<div class="st-nav"><h2 class="st-title">${title}</h2><button class="st-close" onclick="Modal.close()">&times;</button></div>
                    <div class="st-scroll-area"></div>`;
                return { root: c, body: c.querySelector('.st-scroll-area') };
            },
            async add() {
                const d = new Date(), m = (d.getMonth() + 1 + '').padStart(2, '0'), dd = (d.getDate() + '').padStart(2, '0');
                const def = `${m}${dd}作业`, alt = `${m}${dd}小测`;
                const c = document.createElement('div');
                c.innerHTML = `<input class="input-ui" value="${def}"><div style="display:flex;gap:8px;margin-top:8px">
                    <button class="btn btn-c" style="padding:4px 10px;font-size:0.85rem" data-v="">清空</button>
                    <button class="btn btn-c" style="padding:4px 10px;font-size:0.85rem" data-v="${alt}">${alt}</button></div>
                    <div style="font-size:12px;color:#6c757d;margin-top:10px">默认科目标签为英语，会自动排除名单中标记了 #非英语 的学生。</div>`;
                const inp = c.firstChild;
                c.onclick = e => { const v = e.target.dataset.v; if (v != null) { inp.value = v; inp.focus(); } };
                const n = await Modal.show({ title: '新建任务', content: c, autoFocusEl: inp, btns: [{ text: '取消', val: false }, { text: '确定', type: 'btn-p', onClick: () => Modal.close(inp.value) }] });
                if (n) State.addAsg(n);
            },
            async del() {
                if (State.data.length <= 1) return Modal.alert('至少保留一个任务');
                if (await Modal.confirm('删除此任务？')) State.removeAsg(State.curId);
            },
            async score(id, name) {
                const asg = State.cur;
                const students = State.roster.filter(stu => State.isStuIncluded(asg, stu));
                let index = students.findIndex(stu => stu.id === id);
                if (index === -1) return;

                const presets = ['0', '100'];
                const { root, body } = this.buildAsgLayout('登记分数');
                const page = document.createElement('div');
                page.className = 'score-layout';
                body.appendChild(page);
                let focusTarget = null;
                let input;
                let heroTitle;
                let heroTask;
                let heroDone;
                let heroScore;
                let heroIndex;
                let doneToggleBtn;
                let copyPrevBtn;
                let prevBtn;
                let nextBtn;

                const saveStudent = (stuId, scoreValue, forceDone = null) => {
                    const current = asg.records[stuId] || {};
                    const normalized = String(scoreValue ?? '').trim();
                    const payload = {
                        score: normalized ? normalized : null,
                        done: forceDone == null ? (normalized ? true : !!current.done) : forceDone
                    };
                    State.updRec(stuId, payload);
                };

                const getCurrentStudent = () => students[index];
                const getCurrentRecord = () => asg.records[getCurrentStudent().id] || {};

                const applyCurrentView = ({ keepFocus = false } = {}) => {
                    const stu = getCurrentStudent();
                    const rec = getCurrentRecord();
                    const done = !!rec.done;

                    heroTitle.textContent = `${stu.id} ${stu.name || name || ''}`;
                    heroTask.textContent = asg.name;
                    heroDone.textContent = done ? '已完成' : '未完成';
                    heroDone.className = `score-chip ${done ? 'done' : 'pending'}`;
                    heroScore.textContent = rec.score != null && rec.score !== '' ? `当前分数 ${rec.score}` : '当前未录入';
                    heroIndex.textContent = `第 ${index + 1} / ${students.length} 位`;

                    input.value = rec.score ?? '';
                    doneToggleBtn.textContent = done ? '已完成' : '标记完成';
                    doneToggleBtn.className = `btn ${done ? 'btn-p' : 'btn-c'}`;

                    copyPrevBtn.disabled = index === 0;
                    prevBtn.disabled = index === 0;
                    nextBtn.disabled = index === students.length - 1;

                    focusTarget = input;
                    if (keepFocus && Modal.isOpen) Modal.scheduleFocus(input);
                };

                const shiftStudent = step => {
                    const nextIndex = index + step;
                    if (nextIndex < 0 || nextIndex >= students.length) return;
                    index = nextIndex;
                    applyCurrentView({ keepFocus: true });
                };

                const build = () => {
                    const hero = document.createElement('section');
                    hero.className = 'score-hero';
                    hero.innerHTML = `<div class="score-hero-main">
                            <div class="score-hero-title"></div>
                            <div class="score-hero-sub">
                                <span class="score-chip"></span>
                                <span class="score-chip"></span>
                                <span class="score-chip"></span>
                            </div>
                        </div>
                        <div class="score-index"></div>`;
                    heroTitle = hero.querySelector('.score-hero-title');
                    [heroTask, heroDone, heroScore] = hero.querySelectorAll('.score-chip');
                    heroIndex = hero.querySelector('.score-index');

                    const edit = document.createElement('section');
                    edit.className = 'score-section';
                    edit.innerHTML = `<div class="score-section-head">
                            <div class="score-inline-actions">
                                <button class="btn btn-c btn-xs" type="button" data-act="minus">-1</button>
                                <button class="btn btn-c btn-xs" type="button" data-act="plus">+1</button>
                            </div>
                        </div>
                        <div class="score-input-row">
                            <input class="input-ui score-input" inputmode="numeric" enterkeyhint="done" placeholder="输入分数">
                            <div class="score-inline-actions">
                                <button class="btn btn-c" type="button" data-act="preset-0">0</button>
                                <button class="btn btn-c" type="button" data-act="preset-100">100</button>
                                <button class="btn btn-c" type="button" data-act="toggle-done">标记完成</button>
                                <button class="btn btn-c" type="button" data-act="clear">清空</button>
                            </div>
                        </div>`;

                    input = edit.querySelector('.score-input');
                    doneToggleBtn = edit.querySelector('[data-act="toggle-done"]');

                    const stepValue = delta => {
                        const currentValue = Number(input.value || getCurrentRecord().score || 0);
                        if (!Number.isFinite(currentValue)) return;
                        input.value = String(currentValue + delta);
                    };
                    edit.querySelector('[data-act="minus"]').onclick = () => stepValue(-1);
                    edit.querySelector('[data-act="plus"]').onclick = () => stepValue(1);
                    doneToggleBtn.onclick = () => {
                        const stu = getCurrentStudent();
                        saveStudent(stu.id, input.value, !getCurrentRecord().done);
                        applyCurrentView({ keepFocus: true });
                    };
                    edit.querySelector('[data-act="clear"]').onclick = () => {
                        const stu = getCurrentStudent();
                        input.value = '';
                        saveStudent(stu.id, '', false);
                        applyCurrentView({ keepFocus: true });
                    };
                    input.addEventListener('keydown', e => {
                        if (e.key === 'ArrowDown' && !e.isComposing) {
                            e.preventDefault();
                            const stu = getCurrentStudent();
                            saveStudent(stu.id, input.value);
                            shiftStudent(1);
                            return;
                        }
                        if (e.key === 'ArrowUp' && !e.isComposing) {
                            e.preventDefault();
                            const stu = getCurrentStudent();
                            saveStudent(stu.id, input.value);
                            shiftStudent(-1);
                            return;
                        }
                        if (e.key === 'Enter' && !e.isComposing) {
                            e.preventDefault();
                            const stu = getCurrentStudent();
                            saveStudent(stu.id, input.value);
                            Modal.close(true);
                        }
                    });

                    presets.forEach(value => {
                        edit.querySelector(`[data-act="preset-${value}"]`).onclick = () => {
                            const stu = getCurrentStudent();
                            input.value = value;
                            saveStudent(stu.id, value);
                            applyCurrentView({ keepFocus: true });
                        };
                    });

                    const actions = document.createElement('section');
                    actions.className = 'score-section';
                    actions.innerHTML = `<div class="score-toolbar">
                            <button class="btn btn-p" type="button" data-act="save">保存并关闭</button>
                            <button class="btn btn-p" type="button" data-act="save-next">保存并下一位</button>
                            <button class="btn btn-c" type="button" data-act="copy-prev">沿用上一位分数</button>
                            <button class="btn btn-c" type="button" data-act="close">完成录入</button>
                        </div>
                        <div class="score-nav">
                            <button class="btn btn-c" type="button" data-act="prev">上一位</button>
                            <button class="btn btn-c" type="button" data-act="next">下一位</button>
                        </div>`;

                    actions.querySelector('[data-act="save"]').onclick = () => {
                        const stu = getCurrentStudent();
                        saveStudent(stu.id, input.value);
                        Modal.close(true);
                    };
                    actions.querySelector('[data-act="save-next"]').onclick = () => {
                        const stu = getCurrentStudent();
                        saveStudent(stu.id, input.value);
                        if (index < students.length - 1) shiftStudent(1);
                        else Modal.close(true);
                    };
                    copyPrevBtn = actions.querySelector('[data-act="copy-prev"]');
                    copyPrevBtn.onclick = () => {
                        if (index === 0) return;
                        const prevStu = students[index - 1];
                        const prevRec = asg.records[prevStu.id] || {};
                        input.value = prevRec.score ?? '';
                        if (Modal.isOpen) Modal.scheduleFocus(input);
                    };
                    actions.querySelector('[data-act="close"]').onclick = () => {
                        const stu = getCurrentStudent();
                        saveStudent(stu.id, input.value);
                        Modal.close(true);
                    };
                    prevBtn = actions.querySelector('[data-act="prev"]');
                    nextBtn = actions.querySelector('[data-act="next"]');
                    prevBtn.onclick = () => {
                        const stu = getCurrentStudent();
                        saveStudent(stu.id, input.value);
                        shiftStudent(-1);
                    };
                    nextBtn.onclick = () => {
                        const stu = getCurrentStudent();
                        saveStudent(stu.id, input.value);
                        shiftStudent(1);
                    };

                    page.replaceChildren(hero, edit, actions);
                };

                build();
                applyCurrentView();
                await Modal.show({ title: '', content: root, type: 'full', autoFocusEl: focusTarget, btns: [] });
            },
            asgManage() {
                const { root, body } = this.buildAsgLayout('作业项目管理');
                const wrap = document.createElement('div');
                wrap.className = 'asg-manage-grid';

                const list = document.createElement('section');
                list.className = 'asg-manage-grid';
                wrap.appendChild(list);

                const bindSubjectPresets = (host, input) => {
                    host.replaceChildren();
                    SUBJECT_PRESETS.forEach(subject => {
                        const btn = document.createElement('button');
                        btn.type = 'button';
                        btn.className = `asg-pill ${input.value.trim() === subject ? 'active' : ''}`;
                        btn.dataset.subject = subject;
                        btn.textContent = subject;
                        btn.onclick = () => {
                            input.value = subject;
                            [...host.children].forEach(el => el.classList.toggle('active', el.dataset.subject === subject));
                        };
                        host.appendChild(btn);
                    });
                };

                const renderRows = () => {
                    const frag = document.createDocumentFragment();
                    State.data.slice().reverse().forEach(asg => {
                        const total = State.getAsgTotalCount(asg);
                        const done = State.getAsgDoneCount(asg);
                        const rate = total ? Math.round(done / total * 100) : 0;
                        const card = document.createElement('article');
                        card.className = `asg-card ${asg.id === State.curId ? 'current' : ''}`;
                        card.dataset.id = String(asg.id);

                        const subject = State.getAsgSubject(asg);
                        card.innerHTML = `<div class="asg-card-head">
                                <div class="asg-card-meta">
                                    <div class="asg-card-title"></div>
                                    <div class="asg-card-sub">
                                        <span class="asg-current-badge"${asg.id === State.curId ? '' : ' hidden'}>当前项目</span>
                                        <span class="asg-subject-badge ${subject === '英语' ? '' : 'non-english'}"></span>
                                        <span>ID ${asg.id}</span>
                                    </div>
                                </div>
                                <div class="asg-card-stats">
                                    <span class="asg-card-rate"></span>
                                    <span>${done}/${total}</span>
                                </div>
                            </div>
                            <div class="asg-card-fields">
                                <div class="asg-field">
                                    <label>项目名称</label>
                                    <input class="input-ui" data-role="name" placeholder="作业项目名称">
                                </div>
                                <div class="asg-field">
                                    <label>科目标签</label>
                                    <input class="input-ui" data-role="subject" placeholder="默认英语">
                                </div>
                            </div>
                            <div class="asg-subject-presets" data-role="presets"></div>
                            <div class="asg-hint">英语标签会自动排除学生名单中标记为 #非英语 的学生。</div>
                            <div class="asg-card-actions">
                                <button class="btn btn-c btn-xs" type="button" data-act="pick">切换</button>
                                <button class="btn btn-p btn-xs" type="button" data-act="save">保存</button>
                                <button class="btn btn-d btn-xs" type="button" data-act="del">删除</button>
                            </div>`;
                        card.querySelector('.asg-card-title').textContent = asg.name;
                        card.querySelector('.asg-subject-badge').textContent = subject;
                        const rateEl = card.querySelector('.asg-card-rate');
                        rateEl.textContent = `${rate}%`;
                        rateEl.style.color = rate < 60 ? 'var(--danger)' : rate > 90 ? 'var(--success)' : '#16212c';
                        const nameInput = card.querySelector('[data-role="name"]');
                        const subjectInput = card.querySelector('[data-role="subject"]');
                        nameInput.value = asg.name;
                        subjectInput.value = subject;
                        bindSubjectPresets(card.querySelector('[data-role="presets"]'), subjectInput);
                        frag.appendChild(card);
                    });
                    list.replaceChildren(frag);
                };

                list.onclick = async e => {
                    const btn = e.target.closest('[data-act]');
                    if (btn) {
                        const card = btn.closest('.asg-card[data-id]');
                        if (!card) return;
                        const id = +card.dataset.id;
                        const act = btn.dataset.act;
                        if (act === 'pick') {
                            State.selectAsg(id);
                            renderRows();
                            return;
                        }
                        if (act === 'save') {
                            const name = card.querySelector('[data-role="name"]').value.trim();
                            const subject = card.querySelector('[data-role="subject"]').value.trim() || '英语';
                            if (!State.updateAsgMeta(id, { name, subject })) {
                                Modal.alert('项目名称不能为空');
                                return;
                            }
                            renderRows();
                            return;
                        }
                        if (act === 'del') {
                            if (State.data.length <= 1) return Modal.alert('至少保留一个任务');
                            if (await Modal.confirm('删除该作业项目？')) {
                                State.removeAsg(id);
                                renderRows();
                            }
                        }
                        return;
                    }
                };

                list.oninput = e => {
                    const subjectInput = e.target.closest('[data-role="subject"]');
                    if (!subjectInput) return;
                    const card = subjectInput.closest('.asg-card');
                    bindSubjectPresets(card.querySelector('[data-role="presets"]'), subjectInput);
                };

                renderRows();
                body.appendChild(wrap);
                Modal.show({ title: '', content: root, type: 'full', btns: [] });
            },
            roster() {
                const parseEntry = line => {
                    const raw = String(line || '').trim();
                    if (!raw) return null;
                    const noEnglish = /\s*#(?:非英语|非英|no-en|noeng|not-en)\s*$/i.test(raw);
                    const clean = raw.replace(/\s*#(?:非英语|非英|no-en|noeng|not-en)\s*$/i, '').trim();
                    const spaceIndex = clean.indexOf(' ');
                    return spaceIndex === -1
                        ? { id: clean, name: '', noEnglish }
                        : { id: clean.slice(0, spaceIndex), name: clean.slice(spaceIndex + 1).trim(), noEnglish };
                };
                const entries = State.list.map(parseEntry).filter(Boolean);

                const c = document.createElement('div');
                c.className = 'st-layout';
                c.style.cssText = 'display:flex;flex-direction:column;height:100%';
                c.innerHTML = `<div class="st-nav"><h2 class="st-title">编辑学生名单</h2><button class="st-close" onclick="Modal.close()">&times;</button></div>
                    <div class="st-scroll-area" style="padding:16px;flex:1">
                        <div class="roster-shell">
                            <div class="roster-hint-card">直接逐行编辑座位号、姓名和排除标记。可一键自动生成座位号，也可按座位号排序。勾选“排除英语”后，该学生会在英语任务中自动跳过。</div>
                            <div class="roster-toolbar">
                                <button class="btn btn-p" type="button" data-act="add">新增一行</button>
                                <button class="btn btn-c" type="button" data-act="autonum">自动生成座位号</button>
                                <button class="btn btn-c" type="button" data-act="sort-seat">按座位号排序</button>
                                <button class="btn btn-c" type="button" data-act="clean">清理空行</button>
                            </div>
                            <div class="roster-summary">
                                <span class="roster-badge" data-role="count"></span>
                                <span class="roster-badge" data-role="excluded"></span>
                            </div>
                            <div class="roster-list" data-role="list"></div>
                        </div>
                    </div>`;

                const listEl = c.querySelector('[data-role="list"]');
                const countEl = c.querySelector('[data-role="count"]');
                const excludedEl = c.querySelector('[data-role="excluded"]');
                const getPadLength = () => Math.max(2, String(Math.max(entries.length, 1)).length);
                const formatSeat = (value, padLength = getPadLength()) => {
                    const text = String(value ?? '').trim();
                    if (!text) return '';
                    return /^\d+$/.test(text) ? text.padStart(padLength, '0') : text;
                };
                const syncSummary = () => {
                    const valid = entries.filter(item => item.id || item.name).length;
                    const excluded = entries.filter(item => item.noEnglish && (item.id || item.name)).length;
                    countEl.textContent = `共 ${valid} 人`;
                    excludedEl.textContent = `排除英语 ${excluded} 人`;
                };
                const renderRows = () => {
                    syncSummary();
                    if (!entries.length) {
                        listEl.innerHTML = '<div class="roster-empty">还没有学生，点击“新增一行”开始编辑。</div>';
                        return;
                    }
                    const frag = document.createDocumentFragment();
                    entries.forEach((entry, index) => {
                        const row = document.createElement('div');
                        row.className = 'roster-row';
                        row.dataset.index = String(index);
                        row.innerHTML = `<input class="input-ui roster-seat" data-role="id" type="text" inputmode="numeric" placeholder="座位号">
                            <input class="input-ui roster-name" data-role="name" type="text" placeholder="姓名">
                            <label class="roster-check"><input data-role="exclude" type="checkbox">排除英语</label>
                            <button class="btn btn-d btn-xs roster-del" type="button" data-act="remove">删除</button>`;
                        row.querySelector('[data-role="id"]').value = entry.id || '';
                        row.querySelector('[data-role="name"]').value = entry.name || '';
                        row.querySelector('[data-role="exclude"]').checked = !!entry.noEnglish;
                        frag.appendChild(row);
                    });
                    listEl.replaceChildren(frag);
                };
                const autoNumber = () => {
                    const padLength = getPadLength();
                    entries.forEach((entry, index) => { entry.id = String(index + 1).padStart(padLength, '0'); });
                    renderRows();
                };
                const sortBySeat = () => {
                    const rank = value => {
                        const text = String(value || '').trim();
                        if (/^\d+$/.test(text)) return [0, Number(text), ''];
                        return [1, Number.MAX_SAFE_INTEGER, text];
                    };
                    entries.sort((a, b) => {
                        const [ta, na, sa] = rank(a.id);
                        const [tb, nb, sb] = rank(b.id);
                        return ta - tb || na - nb || sa.localeCompare(sb, 'zh-CN') || (a.name || '').localeCompare(b.name || '', 'zh-CN');
                    });
                    renderRows();
                };
                const compactEntries = () => {
                    for (let i = entries.length - 1; i >= 0; i--) {
                        if (!entries[i].id && !entries[i].name) entries.splice(i, 1);
                    }
                    renderRows();
                };
                const serializeEntries = () => {
                    const padLength = getPadLength();
                    let nextAuto = 1;
                    const usedIds = new Set(entries.map(item => formatSeat(item.id, padLength)).filter(Boolean));
                    const nextFreeId = () => {
                        while (usedIds.has(String(nextAuto).padStart(padLength, '0'))) nextAuto++;
                        const id = String(nextAuto).padStart(padLength, '0');
                        usedIds.add(id);
                        nextAuto++;
                        return id;
                    };
                    const normalizedEntries = entries
                        .filter(item => String(item.id || '').trim() || String(item.name || '').trim())
                        .map(item => ({
                            id: formatSeat(item.id, padLength) || nextFreeId(),
                            name: String(item.name || '').trim(),
                            noEnglish: !!item.noEnglish
                        }));
                    State.assertUniqueRosterIds(normalizedEntries.map(item => item.id), '保存名单');
                    return normalizedEntries.map(item => `${item.id}${item.name ? ` ${item.name}` : ''}${item.noEnglish ? ' #非英语' : ''}`);
                };

                c.querySelector('.roster-toolbar').onclick = e => {
                    const btn = e.target.closest('[data-act]');
                    if (!btn) return;
                    const act = btn.dataset.act;
                    if (act === 'add') {
                        entries.push({ id: '', name: '', noEnglish: false });
                        renderRows();
                        requestAnimationFrame(() => listEl.querySelector('.roster-row:last-child [data-role="name"]')?.focus());
                        return;
                    }
                    if (act === 'autonum') return autoNumber();
                    if (act === 'sort-seat') return sortBySeat();
                    if (act === 'clean') return compactEntries();
                };
                listEl.oninput = e => {
                    const row = e.target.closest('.roster-row');
                    if (!row) return;
                    const index = Number(row.dataset.index);
                    const entry = entries[index];
                    if (!entry) return;
                    if (e.target.matches('[data-role="id"]')) entry.id = e.target.value.trim();
                    if (e.target.matches('[data-role="name"]')) entry.name = e.target.value.trim();
                    syncSummary();
                };
                listEl.onchange = e => {
                    const row = e.target.closest('.roster-row');
                    if (!row) return;
                    const index = Number(row.dataset.index);
                    const entry = entries[index];
                    if (!entry) return;
                    if (e.target.matches('[data-role="exclude"]')) {
                        entry.noEnglish = e.target.checked;
                        syncSummary();
                    }
                };
                listEl.onclick = e => {
                    const btn = e.target.closest('[data-act="remove"]');
                    if (!btn) return;
                    const row = btn.closest('.roster-row');
                    const index = Number(row?.dataset.index);
                    if (!Number.isInteger(index)) return;
                    entries.splice(index, 1);
                    renderRows();
                };

                renderRows();
                Modal.show({
                    title: '', content: c, type: 'full', btns: [{ text: '取消', val: false }, {
                        text: '保存', type: 'btn-p', onClick: () => {
                            try {
                                State.list = serializeEntries();
                                State.parseRoster();
                                State.save({ dirtyData: false, dirtyList: true, normalizeMode: 'none' });
                                Modal.close();
                            } catch (err) {
                                Modal.alert(err.message || '名单保存失败');
                            }
                        }
                    }]
                });
            },
            stats() {
                const sel = new Set(State.data.map(a => a.id)), c = document.createElement('div');
                c.className = 'st-layout';
                c.innerHTML = `<div class="st-nav"><h2 class="st-title">统计概览</h2><button class="st-close" onclick="Modal.close()">&times;</button></div>
                    <div class="st-scroll-area"><div class="st-summary" id="stSum"></div><div class="st-filters" id="stFil"></div><div class="st-card-table" id="stTab"></div></div>`;

                const ui = { sum: c.querySelector('#stSum'), fil: c.querySelector('#stFil'), tab: c.querySelector('#stTab') };
                const statsState = { chipVersion: -1, rowPool: new Map() };
                ui.fil.onclick = e => { const id = +e.target.dataset.id; if (id) { sel.has(id) ? sel.delete(id) : sel.add(id); upd(); } };

                const summaryCards = {
                    avg: document.createElement('div'),
                    count: document.createElement('div')
                };
                summaryCards.avg.className = 'st-metric';
                summaryCards.count.className = 'st-metric';
                summaryCards.avg.innerHTML = '<div class="st-val"></div><div class="st-label">平均完成率</div>';
                summaryCards.count.innerHTML = '<div class="st-val"></div><div class="st-label">统计任务数</div>';
                ui.sum.replaceChildren(summaryCards.avg, summaryCards.count);
                const avgValEl = summaryCards.avg.querySelector('.st-val');
                const countValEl = summaryCards.count.querySelector('.st-val');

                const syncSummary = (avgRate, taskCount) => {
                    avgValEl.textContent = `${avgRate}%`;
                    countValEl.textContent = String(taskCount);
                };

                const syncChips = () => {
                    if (statsState.chipVersion !== State._asgListVersion) {
                        const chipFrag = document.createDocumentFragment();
                        State.data.slice().reverse().forEach(a => {
                            const chip = document.createElement('div');
                            chip.className = 'st-chip';
                            chip.dataset.id = String(a.id);
                            chip.textContent = a.name;
                            chipFrag.appendChild(chip);
                        });
                        ui.fil.replaceChildren(chipFrag);
                        statsState.chipVersion = State._asgListVersion;
                    }
                    [...ui.fil.children].forEach(chip => {
                        chip.classList.toggle('active', sel.has(+chip.dataset.id));
                    });
                };

                const createStatsRow = () => {
                    const row = document.createElement('div');
                    row.className = 'st-row';

                    const user = document.createElement('div');
                    user.className = 'st-user';
                    const name = document.createElement('span');
                    name.className = 'st-name';
                    const id = document.createElement('span');
                    id.className = 'st-id';
                    user.appendChild(name);
                    user.appendChild(id);

                    const visual = document.createElement('div');
                    visual.className = 'st-visual';
                    const rate = document.createElement('div');
                    rate.className = 'st-rate';

                    row.appendChild(user);
                    row.appendChild(visual);
                    row.appendChild(rate);
                    row._nameEl = name;
                    row._idEl = id;
                    row._visualEl = visual;
                    row._rateEl = rate;
                    return row;
                };

                const syncStatsRow = (row, item) => {
                    row._nameEl.textContent = item.name;
                    row._idEl.textContent = item.id;
                    row._rateEl.textContent = `${item.rate}%`;
                    row._rateEl.style.color = item.rate < 60 ? 'var(--danger)' : item.rate > 90 ? 'var(--success)' : 'inherit';

                    const visual = row._visualEl;
                    while (visual.children.length < item.dones.length) {
                        const dot = document.createElement('div');
                        dot.className = 'st-dot';
                        visual.appendChild(dot);
                    }
                    while (visual.children.length > item.dones.length) {
                        visual.lastElementChild.remove();
                    }
                    item.dones.forEach((done, index) => {
                        visual.children[index].className = `st-dot ${done ? 'done' : ''}`;
                    });
                };

                const upd = () => {
                    const selectedIds = State.data.filter(a => sel.has(a.id)).map(a => a.id);
                    const { tgs, rows, avgRate } = State.getStatsRows(selectedIds);
                    syncSummary(avgRate, tgs.length);
                    syncChips();

                    const tableFrag = document.createDocumentFragment();
                    const head = document.createElement('div');
                    head.className = 'st-row st-head';
                    head.innerHTML = '<div>学生</div><div>提交详情</div><div style="text-align:right">完成率</div>';
                    tableFrag.appendChild(head);
                    rows.forEach(item => {
                        let row = statsState.rowPool.get(item.id);
                        if (!row) {
                            row = createStatsRow();
                            statsState.rowPool.set(item.id, row);
                        }
                        syncStatsRow(row, item);
                        tableFrag.appendChild(row);
                    });
                    ui.tab.replaceChildren(tableFrag);
                };
                upd(); Modal.show({ title: '', content: c, type: 'full', btns: [] });
            },
            exp() {
                const blob = new Blob([JSON.stringify({ list: State.list, data: State.data, prefs: State.normalizePrefs(State.prefs) })], { type: 'application/json' });
                const a = document.createElement('a');
                const url = URL.createObjectURL(blob);
                a.href = url;
                a.download = 'backup.json';
                a.click();
                setTimeout(() => URL.revokeObjectURL(url), 0);
            },
            imp() {
                this.ctx.getFileInput()?.click();
            },
            normalizeImport(raw) {
                if (!raw || typeof raw !== 'object') throw new Error('备份文件结构错误');
                if (!Array.isArray(raw.list) || !Array.isArray(raw.data)) throw new Error('备份缺少 list/data');
                const list = raw.list.map(v => String(v ?? '').trim()).filter(Boolean);
                const parsedList = list.map(line => State.parseRosterLine(line)).filter(item => item.id);
                State.assertUniqueRosterIds(parsedList.map(item => item.id), '导入名单');
                const idSet = new Set();
                const data = raw.data.map((a, idx) => {
                    if (!a || typeof a !== 'object') throw new Error(`第 ${idx + 1} 个作业格式错误`);
                    const id = Number(a.id);
                    const name = String(a.name ?? '').trim();
                    const subject = String(a.subject ?? '').trim() || (/英语/.test(name) ? '英语' : '其他');
                    if (!name) throw new Error(`第 ${idx + 1} 个作业名称为空`);
                    const recObj = a.records && typeof a.records === 'object' ? a.records : {};
                    const records = {};
                    Object.entries(recObj).forEach(([stuId, rec]) => {
                        if (!stuId || !rec || typeof rec !== 'object') return;
                        const item = {};
                        if (rec.done != null) item.done = !!rec.done;
                        if (rec.score != null && rec.score !== '') item.score = rec.score;
                        if (Object.keys(item).length) records[String(stuId)] = item;
                    });
                    return { id, name, subject, records };
                });
                if (!data.length) throw new Error('备份中没有作业数据');
                if (!list.length) throw new Error('备份中没有学生名单');
                const prefs = State.normalizePrefs(raw.prefs);
                return { list, data, prefs };
            },
            handleFile(e) {
                const { state, modal, toast } = this.ctx;
                const f = e.target.files[0]; if (!f) return;
                const r = new FileReader(); r.onload = async ev => {
                    try {
                        const d = Actions.normalizeImport(JSON.parse(ev.target.result));
                        if (await modal.confirm('覆盖现有数据？')) {
                            state.list = d.list;
                            state.data = d.data;
                            state.prefs = d.prefs;
                            state.parseRoster();
                            const repairedIds = state.sanitizeAsgIds();
                            if (repairedIds) toast.show('已自动修复异常任务 ID');
                            if (!state.data.length) state.addAsg('任务 1');
                            state.rebuildAsgIndex();
                            state.curId = state.data[0].id;
                            state.savePrefs();
                            state.save({ immediate: true, dirtyData: true, dirtyList: true, asgListChanged: true });
                            modal.alert('导入成功');
                        }
                    } catch (err) { modal.alert('格式错误: ' + err.message); }
                }; r.readAsText(f); e.target.value = '';
            }
        };

        UI.actions = {
            has: act => typeof Actions[act] === 'function',
            run: act => Actions[act](),
            handleFile: e => Actions.handleFile(e),
            score: (id, name) => Actions.score(id, name)
        };
        Actions.ctx = {
            state: State,
            modal: Modal,
            toast: Toast,
            debug: Debug,
            colorUtil: ColorUtil,
            subjectPresets: SUBJECT_PRESETS,
            cardColorPresets: CARD_COLOR_PRESETS,
            getFileInput: () => $('fileIn')
        };
        Toast.init();
        Modal.init(); State.init();
