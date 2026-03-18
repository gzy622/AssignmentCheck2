        const VERSION = '20260318-1957';
        const State = {
            list: [], roster: [], data: [], curId: null, mode: 'id', scoring: false, animations: true, debug: false,
            prefs: { cardDoneColor: '#68c490' },
            asgMap: new Map(),
            rosterIndexMap: new Map(),
            noEnglishIds: [],
            view: { init() { }, render() { }, renderStudent() { }, renderProgress() { }, isReady() { return false; } },
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
                this.list = LS.get(KEYS.LIST, DEFAULT_ROSTER);
                this.data = LS.get(KEYS.DATA, []).map(a => this.normalizeAsg(a)).filter(Boolean);
                this.animations = LS.get(KEYS.ANIM, true);
                this.debug = !!LS.get(KEYS.DEBUG, false);
                this.prefs = this.normalizePrefs(LS.get(KEYS.PREFS, this.prefs));
                const recovered = this.applyRecoveryDraft();
                try {
                    this.parseRoster();
                    Debug.log('Roster parsed successfully', 'info');
                } catch (err) {
                    Debug.log(`Roster parse error: ${err.message}`, 'error');
                    window.alert(`名单数据异常：${err.message}\n请先修复本地名单后再使用。`);
                    throw err;
                }
                if (!this.data.length) {
                    Debug.log('No data found, adding default assignment', 'info');
                    this.addAsg('任务 1');
                }
                const repairedIds = this.sanitizeAsgIds();
                this._ensureAsgIndex();
                if (repairedIds) Toast.show('已自动修复异常任务 ID');
                this.curId = this.resolveCurId(this.curId);
                this.applyAnim();
                this.applyCardColor();
                window.addEventListener('beforeunload', () => this._flushPersist());
                this.view.init();
                if (recovered) Toast.show('已恢复上次未完成的临时登记数据');
                const verEl = $('menuVersion');
                if (verEl) verEl.textContent = `Version: ${VERSION}`;
            },

            normalizePrefs(raw) {
                const prefs = raw && typeof raw === 'object' ? raw : {};
                return { cardDoneColor: ColorUtil.normalizeHex(prefs.cardDoneColor, '#68c490') };
            },

            _ensureAsgIndex() {
                if (!this.asgMap.size || this.asgMap.size !== this.data.length) {
                    this.asgMap = new Map(this.data.map(a => [a.id, a]));
                }
            },
            rebuildAsgIndex() { this.asgMap = new Map(this.data.map(a => [a.id, a])); },

            resolveCurId(candidate) {
                if (this.asgMap.has(candidate)) return candidate;
                return this.data[this.data.length - 1]?.id ?? null;
            },

            getRecoveryDraft() {
                const draft = LS.get(KEYS.DRAFT, null);
                if (!draft || typeof draft !== 'object' || !Array.isArray(draft.list) || !Array.isArray(draft.data)) return null;
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
                const current = { list: this.list, data: this.data, prefs: this.prefs, curId: this.curId };
                if (JSON.stringify(draft) === JSON.stringify(current)) return false;
                Object.assign(this, { list: draft.list, data: draft.data, prefs: draft.prefs, curId: Number.isFinite(draft.curId) ? draft.curId : this.curId });
                return true;
            },

            saveRecoveryDraft() {
                LS.set(KEYS.DRAFT, { version: 1, updatedAt: Date.now(), list: this.list, data: this.data, prefs: this.normalizePrefs(this.prefs), curId: this.curId });
            },

            sanitizeAsgIds() {
                const used = new Set(), cleaned = [], nextId = Date.now();
                let repaired = false;
                this.data.forEach(item => {
                    const asg = this.normalizeAsg(item);
                    if (!asg || asg._invalidId) { repaired = true; return; }
                    if (used.has(asg.id)) {
                        repaired = true;
                        let nid = nextId; while (used.has(nid)) nid++;
                        asg.id = nid;
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
                const subject = String(asg.subject || '').trim() || (/英语/.test(name) ? '英语' : '其他');
                const id = Number(asg.id);
                const invalidId = !Number.isFinite(id);
                const normalized = { id: invalidId ? null : id, name: name || '未命名任务', subject, records: asg.records && typeof asg.records === 'object' ? asg.records : {} };
                if (invalidId) normalized._invalidId = true;
                return normalized;
            },

            normalizeAsgInPlace(asg) {
                const n = this.normalizeAsg(asg);
                if (!n) return null;
                if (asg && typeof asg === 'object') Object.assign(asg, n);
                return n;
            },

            invalidateDerived() { this._metricsToken++; this._statsCache.clear(); },

            markGridDirty({ full = false, ids = [] } = {}) {
                if (full) { this._gridDirtyFull = true; this._gridDirtyStudentIds.clear(); return; }
                if (this._gridDirtyFull) return;
                ids.forEach(id => { const key = String(id || '').trim(); if (key) this._gridDirtyStudentIds.add(key); });
            },

            consumeGridDirty() {
                const dirty = { full: this._gridDirtyFull, ids: this._gridDirtyFull ? [] : Array.from(this._gridDirtyStudentIds) };
                this._gridDirtyFull = false;
                this._gridDirtyStudentIds.clear();
                return dirty;
            },

            _queuePersist() { clearTimeout(this._persistTimer); this._persistTimer = setTimeout(() => this._flushPersist(), 300); },
            queuePersist() { this._queuePersist(); }, // Maintain API

            _flushPersist() {
                clearTimeout(this._persistTimer);
                this._persistTimer = 0;
                if (this._dirtyData) { LS.set(KEYS.DATA, this.data); this._dirtyData = false; }
                if (this._dirtyList) { LS.set(KEYS.LIST, this.list); this._dirtyList = false; }
            },
            flushPersist() { this._flushPersist(); }, // Maintain API

            parseRosterLine(rawLine) {
                const lineText = String(rawLine ?? '').trim();
                const noEnRegex = /\s*#(?:非英语|非英|no-en|noeng|not-en)\s*$/i;
                const noEnglish = noEnRegex.test(lineText);
                const line = lineText.replace(noEnRegex, '').trim();
                const i = line.indexOf(' ');
                return i === -1 ? { id: line, name: '', noEnglish } : { id: line.slice(0, i), name: line.slice(i + 1), noEnglish };
            },

            getDuplicateIds(ids) {
                const seen = new Set(), dup = new Set();
                ids.forEach(id => { const key = String(id || '').trim(); if (!key) return; if (seen.has(key)) dup.add(key); seen.add(key); });
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
                if (normalizeMode === 'all') { this.sanitizeAsgIds(); this._ensureAsgIndex(); }
                else if (normalizeMode === 'target' && targetAsgId != null) {
                    const asg = this.asgMap.get(targetAsgId) || this.data.find(item => item.id === targetAsgId);
                    if (asg) this.normalizeAsgInPlace(asg);
                } else if (normalizeMode === 'none') { this._ensureAsgIndex(); }

                this.invalidateDerived();
                if (dirtyData) this._dirtyData = true;
                if (dirtyList) this._dirtyList = true;
                if (asgListChanged) {
                    this._asgListVersion++;
                    Debug.log('Assignment list version incremented', 'info');
                }
                if (dirtyData || dirtyList) this.saveRecoveryDraft();
                if (immediate) this._flushPersist(); else this._queuePersist();
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
                const sAnim = $('statusAnim'); if (sAnim) sAnim.textContent = this.animations ? '开' : '关';
                const sDebug = $('statusDebug'); if (sDebug) sDebug.textContent = Debug.enabled ? '开' : '关';
            },

            applyCardColor() {
                const base = ColorUtil.normalizeHex(this.prefs?.cardDoneColor, '#68c490');
                const [s, e, b] = [0.08, 0.14, 0.2].map(r => ColorUtil.mix(base, r === 0.08 ? '#ffffff' : '#10261a', r));
                const d = document.documentElement.style;
                d.setProperty('--done-card-start', s); d.setProperty('--done-card-end', e); d.setProperty('--done-card-border', b);
                d.setProperty('--done-card-shadow', ColorUtil.withAlpha(base, 0.22));
                d.setProperty('--done-card-press-shadow', ColorUtil.withAlpha(base, 0.32));
            },

            applyScoring() {
                const sScore = $('statusScore'); if (sScore) sScore.textContent = this.scoring ? '开' : '关';
                const btnScore = $('btnScore'); if (btnScore) btnScore.classList.toggle('active', !!this.scoring);
            },

            get cur() { return this.asgMap.get(this.curId) || this.data[0]; },

            addAsg(n) {
                Debug.log(`Adding assignment: ${n}`, 'info');
                let id = Date.now();
                while (this.asgMap.has(id)) id++;
                this.data.push(this.normalizeAsg({ id, name: (n || '').trim() || '未命名任务', subject: '英语', records: {} }));
                this._ensureAsgIndex();
                this.curId = id;
                this.markGridDirty({ full: true });
                this.save({ asgListChanged: true, normalizeMode: 'none' });
            },

            selectAsg(id) {
                Debug.log(`Selecting assignment: ${id}`, 'info');
                if (!this.asgMap.has(id)) {
                    Debug.log(`selectAsg failed: ID ${id} not found`, 'warn');
                    return;
                }
                this.curId = id;
                this.markGridDirty({ full: true });
                this.view.render();
            },

            renameAsg(id, name) {
                const asg = this.asgMap.get(id);
                if (!asg || !(name || '').trim()) return false;
                asg.name = name.trim();
                this.save({ asgListChanged: true, normalizeMode: 'target', targetAsgId: id });
                return true;
            },

            updateAsgMeta(id, payload = {}) {
                const asg = this.asgMap.get(id);
                if (!asg) return false;
                const safeName = String(payload.name ?? asg.name).trim();
                const safeSubject = String(payload.subject ?? asg.subject ?? '').trim() || '英语';
                if (!safeName) return false;
                const prevSub = this.getAsgSubject(asg);
                Object.assign(asg, { name: safeName, subject: safeSubject });
                if (id === this.curId && prevSub !== safeSubject) this.markGridDirty({ full: true });
                this.save({ asgListChanged: true, normalizeMode: 'target', targetAsgId: id });
                return true;
            },

            removeAsg(id) {
                Debug.log(`Removing assignment: ${id}`, 'warn');
                if (this.data.length <= 1) return false;
                const idx = this.data.findIndex(a => a.id === id);
                if (idx === -1) {
                    Debug.log(`removeAsg failed: ID ${id} not found`, 'warn');
                    return false;
                }
                this.data.splice(idx, 1);
                if (this.curId === id) this.curId = (this.data[Math.max(0, idx - 1)] || this.data[0]).id;
                this._ensureAsgIndex();
                this.markGridDirty({ full: true });
                this.save({ asgListChanged: true, normalizeMode: 'none' });
                return true;
            },

            getAsgSubject(asg) { return String(asg?.subject || '').trim() || (/英语/.test(asg?.name || '') ? '英语' : '其他'); },
            isEnglishAsg(asg) { return this.getAsgSubject(asg) === '英语'; },
            isStuIncluded(asg, stu) { return !(this.isEnglishAsg(asg) && stu.noEnglish); },

            getAsgMetrics(asg) {
                if (!asg) return { total: 0, done: 0 };
                const cached = this._statsCache.get(asg.id);
                if (cached && cached.token === this._metricsToken) return cached.metrics;
                let total = 0, done = 0;
                for (const stu of this.roster) {
                    if (!this.isStuIncluded(asg, stu)) continue;
                    total++; if (asg.records?.[stu.id]?.done) done++;
                }
                const metrics = { total, done };
                this._statsCache.set(asg.id, { token: this._metricsToken, metrics });
                return metrics;
            },

            getAsgRowSnapshot(asg) {
                if (!asg) return { included: [], done: [] };
                const cacheKey = `rows:${asg.id}`, cached = this._statsCache.get(cacheKey);
                if (cached && cached.token === this._metricsToken) return cached.value;
                const included = new Array(this.roster.length), done = new Array(this.roster.length);
                this.roster.forEach((stu, i) => {
                    const isInc = this.isStuIncluded(asg, stu);
                    included[i] = isInc;
                    done[i] = isInc && !!asg.records?.[stu.id]?.done;
                });
                const value = { included, done };
                this._statsCache.set(cacheKey, { token: this._metricsToken, value });
                return value;
            },

            getAsgTotalCount(asg) { return this.getAsgMetrics(asg).total; },
            getAsgDoneCount(asg) { return this.getAsgMetrics(asg).done; },

            getStatsRows(selectedIds) {
                const keyIds = selectedIds.slice().sort((a, b) => a - b);
                const cacheKey = `${this._metricsToken}|${keyIds.join(',')}`, cached = this._statsCache.get(cacheKey);
                if (cached) return cached;
                const tgs = keyIds.map(id => this.asgMap.get(id)).filter(Boolean);
                const snapshots = tgs.map(asg => this.getAsgRowSnapshot(asg));
                const rows = this.roster.map((s, i) => {
                    let total = 0, doneCount = 0;
                    const dones = snapshots.map(snap => {
                        if (!snap.included[i]) return null;
                        total++; if (snap.done[i]) doneCount++;
                        return snap.done[i];
                    }).filter(v => v !== null);
                    return { ...s, dones, rate: total ? Math.round(doneCount / total * 100) : 0, total, i };
                }).filter(r => r.total > 0).sort((a, b) => b.rate - a.rate || a.i - b.i);
                const result = { tgs, rows, avgRate: rows.length ? Math.round(rows.reduce((sum, row) => sum + row.rate, 0) / rows.length) : 0 };
                this._statsCache.set(cacheKey, result);
                return result;
            },

            formatDebugRecordValue(value, emptyLabel = '空') {
                return value == null || value === '' ? emptyLabel : String(value);
            },

            logRecordChange(asg, id, prevRecord, nextRecord, meta = {}) {
                const prevScore = prevRecord?.score ?? null;
                const nextScore = nextRecord?.score ?? null;
                const prevDone = !!prevRecord?.done;
                const nextDone = !!nextRecord?.done;
                const scoreChanged = prevScore !== nextScore;
                const doneChanged = prevDone !== nextDone;
                if (!scoreChanged && !doneChanged) return;
                const student = this.roster.find(item => item.id === id) || { id, name: meta.studentName || '' };
                const parts = [];
                if (scoreChanged) parts.push(`分数 ${this.formatDebugRecordValue(prevScore)} -> ${this.formatDebugRecordValue(nextScore)}`);
                if (doneChanged) parts.push(`完成 ${prevDone ? '已完成' : '未完成'} -> ${nextDone ? '已完成' : '未完成'}`);
                const action = meta.action ? ` 动作=${meta.action}` : '';
                const source = meta.source ? ` 来源=${meta.source}` : '';
                Debug.log(`[记录变更] 任务=${asg?.name || '未命名任务'} 学生=${student.id} ${student.name || ''}${action}${source} ${parts.join('，')}`.trim(), scoreChanged && doneChanged ? 'warn' : 'info');
            },

            updRec(id, val, meta = {}) {
                const asg = this.cur; if (!asg) return;
                const prevRecord = asg.records[id] ? { ...asg.records[id] } : null;
                const prevDone = !!prevRecord?.done;
                const r = asg.records;
                r[id] = { ...r[id], ...val };
                if (!r[id].done && (r[id].score == null || r[id].score === '')) delete r[id];
                const nextRecord = r[id] ? { ...r[id] } : null;
                this.invalidateDerived();
                this.markGridDirty({ ids: [id] });
                this.saveRecoveryDraft();
                this._queuePersist();
                this.view.renderStudent(id);
                this.logRecordChange(asg, id, prevRecord, nextRecord, meta);
                if (prevDone !== !!asg.records[id]?.done) this.view.renderProgress(this.getAsgDoneCount(asg), this.getAsgTotalCount(asg));
            }
        };

        const UI = {
            isReady: false,
            actions: { has() { return false; }, run() { }, handleFile() { }, score() { } },
            _gridFrozen: false, _taskSelectVersion: -1, _lastRenderAsgId: null, _lastRosterVersion: -1, _lastCardPoolSize: -1, _lastGridMetricsKey: '', _gridPaddingX: 0, _gridPaddingY: 0,
            init() {
                BackHandler.init();
                this.gridEl = $('grid'); this.counterEl = $('counter'); this.progressFillEl = $('progressFill');
                this.asgSelectEl = $('asgSelect'); this.asgSelectEl.onchange = e => State.selectAsg(+e.target.value);
                $('btnView').onclick = e => { document.body.classList.toggle('mode-names', (State.mode = State.mode === 'id' ? 'name' : 'id') === 'name'); e.target.classList.toggle('active', State.mode === 'name'); };
                $('btnScore').onclick = () => this.actions.run('toggleScore');
                $('btnMenu').onclick = e => { e.stopPropagation(); $('menu').classList.toggle('show'); };
                document.onclick = () => $('menu').classList.remove('show');
                $('menu').onclick = e => {
                    const act = e.target.closest('[act]')?.getAttribute('act');
                    if (act && this.actions.has(act)) { $('menu').classList.remove('show'); this.actions.run(act); }
                };
                $('fileIn').onchange = e => this.actions.handleFile(e);
                Debug.init(); this.setupGrid(); this.setupGridSizing(); State.applyScoring(); this.isReady = true; this.render();
            },
            setupGrid() {
                let timer = null, pressCard = null, longPressed = false, moved = false, startPos = { x: 0, y: 0 };
                const cancelTimer = () => { if (timer) clearTimeout(timer); timer = null; };
                const resetState = () => { if (pressCard) pressCard.classList.remove('pressing'); cancelTimer(); pressCard = null; longPressed = false; moved = false; };
                const handle = (card, long) => {
                    if (card.dataset.excluded === '1') return;
                    const { id, name } = card.dataset;
                    if (long || State.scoring) this.actions.score(id, name);
                    else State.updRec(id, { done: !State.cur.records[id]?.done }, { source: 'grid', action: 'toggle-done', studentName: name });
                };
                this.gridEl.onpointerdown = e => {
                    const c = e.target.closest('.student-card'); if (!c) return;
                    pressCard = c; longPressed = false; moved = false; startPos = { x: e.clientX, y: e.clientY };
                    c.classList.add('pressing'); cancelTimer();
                    timer = setTimeout(() => { timer = null; longPressed = true; c.classList.remove('pressing'); handle(c, true); resetState(); }, 500);
                };
                this.gridEl.onpointerup = e => {
                    const c = e.target.closest('.student-card');
                    if (c && pressCard === c && !longPressed && !moved) { c.classList.remove('pressing'); handle(c, false); }
                    resetState();
                };
                this.gridEl.onpointermove = e => {
                    if (!pressCard) return;
                    if (Math.abs(e.clientX - startPos.x) > 10 || Math.abs(e.clientY - startPos.y) > 8) { moved = true; pressCard.classList.remove('pressing'); cancelTimer(); }
                };
                this.gridEl.onpointercancel = this.gridEl.onpointerleave = resetState;
            },
            setupGridSizing() {
                this.refreshGridPadding();
                const refresh = () => { this.refreshGridPadding(); this.scheduleGridLayout(); };
                this._gridResizeObserver = new ResizeObserver(refresh); this._gridResizeObserver.observe(this.gridEl);
                window.addEventListener('resize', refresh, { passive: true });
                if (window.visualViewport) window.visualViewport.addEventListener('resize', refresh, { passive: true });
                this.scheduleGridLayout();
            },
            refreshGridPadding() {
                const s = getComputedStyle(this.gridEl);
                this._gridPaddingX = parseFloat(s.paddingLeft) + parseFloat(s.paddingRight);
                this._gridPaddingY = parseFloat(s.paddingTop) + parseFloat(s.paddingBottom);
            },
            setGridFrozen(f) { this._gridFrozen = !!f; if (!f) this.scheduleGridLayout(); },
            scheduleGridLayout() { if (!this._gridFrozen) { cancelAnimationFrame(this._gridLayoutRaf || 0); this._gridLayoutRaf = requestAnimationFrame(() => this.updateGridMetrics()); } },
            calcGridLayout(count, width, height) {
                const cols = 5, rows = Math.ceil(Math.max(1, count) / cols);
                const baseGap = Math.max(4, Math.min(10, Math.round(Math.min(width, height) / 95)));
                const calc = g => ({ w: (width - g * (cols - 1)) / cols, h: (height - g * (rows - 1)) / rows });
                let g = baseGap, s = calc(g), b = Math.min(s.w, s.h);
                if (b < 24) { g = 2; s = calc(g); b = Math.min(s.w, s.h); }
                b = Math.max(18, b);
                return { cols, rows, gap: g, w: Math.max(18, s.w), h: Math.max(18, s.h), id: Math.max(12, Math.min(44, b * 0.34)), idC: Math.max(9, Math.min(16, b * 0.2)), name: Math.max(9, Math.min(20, b * 0.18)), tag: Math.max(8, Math.min(13, b * 0.12)), pad: Math.max(3, Math.min(8, b * 0.08)), rad: Math.max(8, Math.min(16, b * 0.15)) };
            },
            updateGridMetrics() {
                const grid = this.gridEl, count = State.roster.length, w = grid.clientWidth - this._gridPaddingX, h = grid.clientHeight - this._gridPaddingY;
                if (!w || !h) return;
                const m = this.calcGridLayout(count, w, h);
                const key = `${count}|${m.cols}|${m.rows}|${m.gap}|${m.w.toFixed(2)}|${m.h.toFixed(2)}|${m.id}|${m.name}|${m.tag}|${m.pad}|${m.rad}`;
                if (key === this._lastGridMetricsKey) return;
                this._lastGridMetricsKey = key;
                const d = grid.style;
                d.setProperty('--grid-cols', m.cols); d.setProperty('--grid-rows', m.rows); d.setProperty('--grid-gap', `${m.gap}px`);
                d.setProperty('--cell-w', `${m.w}px`); d.setProperty('--cell-h', `${m.h}px`); d.setProperty('--id-size', `${m.id}px`);
                d.setProperty('--id-corner-size', `${m.idC}px`); d.setProperty('--name-size', `${m.name}px`);
                d.setProperty('--tag-size', `${m.tag}px`); d.setProperty('--card-pad', `${m.pad}px`); d.setProperty('--card-radius', `${m.rad}px`);
            },
            createCard() { const c = document.createElement('button'); c.type = 'button'; c.className = 'student-card'; c.innerHTML = '<span class="card-id"></span><span class="card-name"></span><span class="card-score" hidden></span>'; return c; },
            syncCardPool() {
                const grid = this.gridEl, target = State.roster.length;
                while (grid.children.length < target) grid.appendChild(this.createCard());
                while (grid.children.length > target) grid.lastElementChild.remove();
            },
            renderCard(card, stu, rec, excluded = false) {
                card.dataset.id = stu.id; card.dataset.name = stu.name; card.dataset.excluded = excluded ? '1' : '0';
                const [idEl, nameEl, scoreEl] = card.children;
                if (idEl.textContent !== stu.id) idEl.textContent = stu.id;
                if (nameEl.textContent !== stu.name) nameEl.textContent = stu.name;
                card.classList.toggle('done', !excluded && !!rec.done);
                card.classList.toggle('excluded', excluded);
                if (!excluded && rec.score != null && rec.score !== '') {
                    scoreEl.hidden = false; scoreEl.textContent = String(rec.score);
                } else { scoreEl.hidden = true; scoreEl.textContent = ''; }
            },
            renderStudent(id) {
                const asg = State.cur, index = State.rosterIndexMap.get(id);
                if (!asg || index == null) return;
                this.syncCardPool();
                this.renderCard(this.gridEl.children[index], State.roster[index], asg.records[id] || {}, !State.isStuIncluded(asg, State.roster[index]));
            },
            renderProgress(done, total = State.roster.length) {
                this.counterEl.textContent = `${done}/${total}`;
                this.progressFillEl.style.width = total ? `${(done / total) * 100}%` : '0%';
            },
            ensureTaskOptions() {
                const sel = this.asgSelectEl;
                if (this._taskSelectVersion !== State._asgListVersion) {
                    sel.replaceChildren(...State.data.map(a => { const o = document.createElement('option'); o.value = String(a.id); o.textContent = a.name; return o; }));
                    this._taskSelectVersion = State._asgListVersion;
                }
                if (sel.value != State.curId) sel.value = String(State.curId);
            },
            render() {
                const asg = State.cur; if (!asg) return;
                const currentPoolSize = State.roster.length, dirty = State.consumeGridDirty(), force = dirty.full || this._lastCardPoolSize !== currentPoolSize;
                this.ensureTaskOptions(); this.syncCardPool();
                const cards = this.gridEl.children;
                if (force) {
                    State.roster.forEach((stu, i) => this.renderCard(cards[i], stu, asg.records[stu.id] || {}, !State.isStuIncluded(asg, stu)));
                } else {
                    dirty.ids.forEach(id => {
                        const idx = State.rosterIndexMap.get(id);
                        if (idx != null) this.renderCard(cards[idx], State.roster[idx], asg.records[id] || {}, !State.isStuIncluded(asg, State.roster[idx]));
                    });
                }
                this.renderProgress(State.getAsgDoneCount(asg), State.getAsgTotalCount(asg));
                this._lastCardPoolSize = currentPoolSize; this.scheduleGridLayout();
            }
        };

        State.view = {
            init: () => UI.init(), render: () => UI.render(),
            renderStudent: id => UI.renderStudent(id),
            renderProgress: (done, total) => UI.renderProgress(done, total),
            isReady: () => UI.isReady
        };

        Object.assign(globalThis, { State, UI });
