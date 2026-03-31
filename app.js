        const State = {
            list: [], roster: [], data: [], curId: null, mode: 'name', scoring: false, animations: true, debug: false,
            prefs: { cardDoneColor: '#68c490' },
            asgMap: new Map(),
            rosterIndexMap: new Map(),
            noEnglishIds: [],
            view: { init() { }, render() { }, renderStudent() { }, renderProgress() { }, isReady() { return false; } },
            _persistTimer: 0,
            _draftTimer: 0,
            _draftDirty: false,
            _draftPersistMs: 1200,
            _lastDraftSnapshot: null,
            _metricsToken: 0,
            _metricsCache: new Map(),
            _scoreRangeCache: new Map(),
            _dirtyData: false,
            _dirtyList: false,
            _asgListVersion: 0,
            _rosterVersion: 0,
            _gridDirtyFull: true,
            _gridDirtyStudentIds: new Set(),

            init() {
                // 异步初始化，避免启动时卡顿
                const initAsync = async () => {
                    // 先加载基本数据
                    this.list = LS.get(KEYS.LIST, DEFAULT_ROSTER);
                    this.animations = LS.get(KEYS.ANIM, true);
                    this.prefs = this.normalizePrefs(LS.get(KEYS.PREFS, this.prefs));
                    
                    // 延迟加载和处理数据，让页面先渲染
                    setTimeout(() => {
                        try {
                            this.data = LS.get(KEYS.DATA, []).map(a => this.normalizeAsg(a)).filter(Boolean);
                            const recovered = this.applyRecoveryDraft();
                            
                            try {
                                this.parseRoster();
                            } catch (err) {
                                window.alert(`名单数据异常：${err.message}\n请先修复本地名单后再使用。`);
                                throw err;
                            }
                            
                            if (!this.data.length) {
                                this.addAsg('任务 1');
                            }
                            
                            const repairedIds = this.sanitizeAsgIds();
                            this._ensureAsgIndex();
                            if (repairedIds) Toast.show('已自动修复异常任务 ID');
                            
                            this.curId = this.resolveCurId(this.curId);
                            this.applyAnim();
                            this.applyCardColor();
                            window.addEventListener('beforeunload', () => this._flushPersist({ includeDraft: true }));
                            this.view.init();
                            this._lastDraftSnapshot = this.getRecoverySnapshot();
                            if (recovered) Toast.show('已恢复上次未完成的临时登记数据');
                        } catch (err) {
                        }
                    }, 100);
                };
                
                initAsync();
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
                return this.cloneRecoveryState({
                    list: draft.list.map(v => String(v ?? '').trim()).filter(Boolean),
                    data: draft.data.map(a => this.normalizeAsg(a)).filter(Boolean),
                    prefs: this.normalizePrefs(draft.prefs),
                    curId: Number(draft.curId)
                });
            },

            cloneRecoveryRecords(records) {
                const source = records && typeof records === 'object' ? records : {};
                return Object.fromEntries(
                    Object.entries(source).map(([id, entry]) => [id, entry && typeof entry === 'object' ? { ...entry } : entry])
                );
            },

            cloneRecoveryData(data) {
                return (Array.isArray(data) ? data : [])
                    .map(item => this.normalizeAsg(item))
                    .filter(Boolean)
                    .map(asg => ({ id: asg.id, name: asg.name, subject: asg.subject, records: this.cloneRecoveryRecords(asg.records) }));
            },

            cloneRecoveryState(state) {
                const source = state && typeof state === 'object' ? state : {};
                const curId = source.curId == null || source.curId === '' ? null : Number(source.curId);
                return {
                    list: Array.isArray(source.list) ? source.list.map(v => String(v ?? '').trim()).filter(Boolean) : [],
                    data: this.cloneRecoveryData(source.data),
                    prefs: this.normalizePrefs(source.prefs),
                    curId: Number.isFinite(curId) ? curId : null
                };
            },

            getRecoverySnapshot() {
                return this.cloneRecoveryState({
                    list: this.list,
                    data: this.data,
                    prefs: this.prefs,
                    curId: this.curId
                });
            },

            isSameRecoveryValue(a, b) {
                return a === b || (a == null && b == null);
            },

            isSameRecoveryEntry(a, b) {
                if (a === b) return true;
                const objA = a && typeof a === 'object' ? a : null;
                const objB = b && typeof b === 'object' ? b : null;
                if (!objA || !objB) return objA === objB;
                const keysA = Object.keys(objA);
                const keysB = Object.keys(objB);
                if (keysA.length !== keysB.length) return false;
                return keysA.every(key => this.isSameRecoveryValue(objA[key], objB[key]));
            },

            isSameRecoveryRecords(a, b) {
                const recA = a && typeof a === 'object' ? a : {};
                const recB = b && typeof b === 'object' ? b : {};
                const idsA = Object.keys(recA);
                const idsB = Object.keys(recB);
                if (idsA.length !== idsB.length) return false;
                return idsA.every(id => this.isSameRecoveryEntry(recA[id], recB[id]));
            },

            isSameRecoveryData(a, b) {
                if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length) return false;
                for (let i = 0; i < a.length; i++) {
                    const left = a[i];
                    const right = b[i];
                    if (!left || !right) return false;
                    if (left.id !== right.id || left.name !== right.name || left.subject !== right.subject) return false;
                    if (!this.isSameRecoveryRecords(left.records, right.records)) return false;
                }
                return true;
            },

            isSameRecoveryState(a, b) {
                if (!a || !b) return false;
                if (!Array.isArray(a.list) || !Array.isArray(b.list) || a.list.length !== b.list.length) return false;
                if (a.list.some((item, index) => item !== b.list[index])) return false;
                if (!this.isSameRecoveryData(a.data, b.data)) return false;
                const curA = Number.isFinite(a.curId) ? a.curId : null;
                const curB = Number.isFinite(b.curId) ? b.curId : null;
                return curA === curB && this.normalizePrefs(a.prefs).cardDoneColor === this.normalizePrefs(b.prefs).cardDoneColor;
            },

            applyRecoveryDraft() {
                const draft = this.getRecoveryDraft();
                if (!draft) return false;
                const current = { list: this.list, data: this.data, prefs: this.prefs, curId: this.curId };
                if (this.isSameRecoveryState(draft, current)) return false;
                Object.assign(this, { list: draft.list, data: draft.data, prefs: draft.prefs, curId: Number.isFinite(draft.curId) ? draft.curId : this.curId });
                return true;
            },

            queueRecoveryDraft() {
                clearTimeout(this._draftTimer);
                this._draftDirty = true;
                this._draftTimer = setTimeout(() => this.flushRecoveryDraft(), this._draftPersistMs);
            },

            flushRecoveryDraft() {
                clearTimeout(this._draftTimer);
                this._draftTimer = 0;
                if (!this._draftDirty) return;
                this._draftDirty = false;
                this.saveRecoveryDraft();
            },

            saveRecoveryDraft() {
                clearTimeout(this._draftTimer);
                this._draftTimer = 0;
                this._draftDirty = false;
                const snapshot = this.getRecoverySnapshot();
                if (this._lastDraftSnapshot && this.isSameRecoveryState(snapshot, this._lastDraftSnapshot)) return false;
                this._lastDraftSnapshot = this.cloneRecoveryState(snapshot);
                LS.set(KEYS.DRAFT, { version: 1, updatedAt: Date.now(), ...snapshot });
                return true;
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

            invalidateDerived() {
                this._metricsToken++;
                this._metricsCache.clear();
                this._scoreRangeCache.clear();
            },

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

            _flushPersist({ includeDraft = false } = {}) {
                clearTimeout(this._persistTimer);
                this._persistTimer = 0;
                if (this._dirtyData) { LS.set(KEYS.DATA, this.data); this._dirtyData = false; }
                if (this._dirtyList) { LS.set(KEYS.LIST, this.list); this._dirtyList = false; }
                if (includeDraft) this.flushRecoveryDraft();
            },
            flushPersist(options) { this._flushPersist(options); }, // Maintain API

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

            save({ render = true, immediate = false, dirtyData = true, dirtyList = false, asgListChanged = false, normalizeMode = 'all', targetAsgId = null, invalidateDerived = true } = {}) {
                if (normalizeMode === 'all') { this.sanitizeAsgIds(); this._ensureAsgIndex(); }
                else if (normalizeMode === 'target' && targetAsgId != null) {
                    const asg = this.asgMap.get(targetAsgId) || this.data.find(item => item.id === targetAsgId);
                    if (asg) this.normalizeAsgInPlace(asg);
                } else if (normalizeMode === 'none') { this._ensureAsgIndex(); }

                if (invalidateDerived) this.invalidateDerived();
                if (dirtyData) this._dirtyData = true;
                if (dirtyList) this._dirtyList = true;
                if (asgListChanged) {
                    this._asgListVersion++;
                    this._scoreRangeCache.clear();
                }
                if (dirtyData || dirtyList) this.queueRecoveryDraft();
                if (immediate) this._flushPersist({ includeDraft: true }); else this._queuePersist();
                if (render && this.view.isReady()) this.view.render();
            },

            saveAnim() { LS.set(KEYS.ANIM, this.animations); this.applyAnim(); },
            savePrefs() {
                this.prefs = this.normalizePrefs(this.prefs);
                this.queueRecoveryDraft();
                LS.set(KEYS.PREFS, this.prefs);
                this.applyCardColor();
            },

            applyAnim() {
                document.body.classList.toggle('no-animations', !this.animations);
                const sAnim = $('statusAnim'); if (sAnim) sAnim.textContent = this.animations ? '开' : '关';
            },

            applyCardColor() {
                const base = ColorUtil.normalizeHex(this.prefs?.cardDoneColor, '#68c490');
                const [s, e, b] = [0.08, 0.14, 0.2].map(r => ColorUtil.mix(base, r === 0.08 ? '#ffffff' : '#10261a', r));
                const lum = ColorUtil.luminance(base);
                const badgeBg = lum > 0.35 ? ColorUtil.mix('#111111', '#ffffff', 0.12) : ColorUtil.mix('#ffffff', '#111111', 0.08);
                const badgeText = lum > 0.35 ? 'rgba(255,255,255,0.95)' : 'rgba(17,17,17,0.92)';
                const d = document.documentElement.style;
                d.setProperty('--done-card-start', s); d.setProperty('--done-card-end', e); d.setProperty('--done-card-border', b);
                d.setProperty('--done-card-shadow', ColorUtil.withAlpha(base, 0.22));
                d.setProperty('--done-card-press-shadow', ColorUtil.withAlpha(base, 0.32));
                d.setProperty('--done-card-badge', badgeBg);
                d.setProperty('--done-card-badge-text', badgeText);
            },

            applyScoring() {
                const sScore = $('statusScore'); if (sScore) sScore.textContent = this.scoring ? '开' : '关';
                const btnScore = $('btnScore'); if (btnScore) btnScore.classList.toggle('active', !!this.scoring);
            },

            applyViewMode() {
                const showNames = this.mode === 'name';
                document.body.classList.toggle('mode-names', showNames);
                const sView = $('statusView'); if (sView) sView.textContent = showNames ? '开' : '关';
                const btnView = $('btnView'); if (btnView) btnView.classList.toggle('active', showNames);
            },

            toggleViewMode() {
                this.mode = this.mode === 'id' ? 'name' : 'id';
                this.applyViewMode();
            },

            get cur() { return this.asgMap.get(this.curId) || this.data[0]; },

            addAsg(n) {
                let id = Date.now();
                while (this.asgMap.has(id)) id++;
                this.data.push(this.normalizeAsg({ id, name: (n || '').trim() || '未命名任务', subject: '英语', records: {} }));
                this._ensureAsgIndex();
                this.curId = id;
                this.markGridDirty({ full: true });
                this.save({ asgListChanged: true, normalizeMode: 'none', invalidateDerived: false });
            },

            selectAsg(id) {
                if (!this.asgMap.has(id)) {
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
                this.save({ asgListChanged: true, normalizeMode: 'target', targetAsgId: id, invalidateDerived: false });
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
                this.save({ asgListChanged: true, normalizeMode: 'target', targetAsgId: id, invalidateDerived: prevSub !== safeSubject });
                return true;
            },

            removeAsg(id) {
                if (this.data.length <= 1) return false;
                const idx = this.data.findIndex(a => a.id === id);
                if (idx === -1) {
                    return false;
                }
                this.data.splice(idx, 1);
                if (this.curId === id) this.curId = (this.data[Math.max(0, idx - 1)] || this.data[0]).id;
                this._ensureAsgIndex();
                this.markGridDirty({ full: true });
                this.save({ asgListChanged: true, normalizeMode: 'none', invalidateDerived: false });
                return true;
            },

            getAsgSubject(asg) { return String(asg?.subject || '').trim() || (/英语/.test(asg?.name || '') ? '英语' : '其他'); },
            isEnglishAsg(asg) { return this.getAsgSubject(asg) === '英语'; },
            isStuIncluded(asg, stu) { return !(this.isEnglishAsg(asg) && stu.noEnglish); },

            getAsgMetrics(asg) {
                if (!asg) return { total: 0, done: 0 };
                const cached = this._metricsCache.get(asg.id);
                if (cached && cached.token === this._metricsToken) return cached.metrics;
                let total = 0, done = 0;
                for (const stu of this.roster) {
                    if (!this.isStuIncluded(asg, stu)) continue;
                    total++; if (asg.records?.[stu.id]?.done) done++;
                }
                const metrics = { total, done };
                this._metricsCache.set(asg.id, { token: this._metricsToken, metrics });
                return metrics;
            },

            getAsgTotalCount(asg) { return this.getAsgMetrics(asg).total; },
            getAsgDoneCount(asg) { return this.getAsgMetrics(asg).done; },

            parseNumericScore(value) {
                if (typeof value === 'number') return Number.isFinite(value) ? value : null;
                const text = String(value ?? '').trim();
                if (!text) return null;
                return /^-?\d+(?:\.\d+)?$/.test(text) ? Number(text) : null;
            },

            buildTrendTimelineKey(timeline) {
                return timeline.map(item => `${item.asgId}:${item.label}:${item.score ?? ''}:${item.included ? 1 : 0}`).join(';');
            },

            getQuizTrendAssignments() {
                const quizzes = this.data.filter(asg => /小测/.test(String(asg?.name || '')));
                return quizzes.length ? quizzes : this.data.slice();
            },

            getAsgRange(startId, endId, source = this.data) {
                if (!source.length) return [];
                const startIndex = source.findIndex(asg => asg.id === startId);
                const endIndex = source.findIndex(asg => asg.id === endId);
                if (startIndex === -1 && endIndex === -1) return source.slice();
                const safeStart = startIndex === -1 ? 0 : startIndex;
                const safeEnd = endIndex === -1 ? source.length - 1 : endIndex;
                const [from, to] = safeStart <= safeEnd ? [safeStart, safeEnd] : [safeEnd, safeStart];
                return source.slice(from, to + 1);
            },

            classifyScoreTrend(entries) {
                if (!entries.length) return '暂无成绩';
                if (entries.length === 1) return '单次记录';
                const first = entries[0].score;
                const latest = entries[entries.length - 1].score;
                let min = first;
                let max = first;
                for (let i = 1; i < entries.length; i++) {
                    const score = entries[i].score;
                    if (score < min) min = score;
                    if (score > max) max = score;
                }
                const delta = latest - first;
                const span = max - min;
                if (Math.abs(delta) <= 2 && span <= 4) return '稳定';
                if (delta >= 5) return '上升';
                if (delta <= -5) return '下降';
                return '波动';
            },

            getScoreRangeReport(startId, endId, source = this.data) {
                const assignments = this.getAsgRange(startId, endId, source);
                const cacheKey = `${this._metricsToken}|${this._rosterVersion}|${this._asgListVersion}|${assignments.map(asg => asg.id).join(',')}`;
                const cached = this._scoreRangeCache.get(cacheKey);
                if (cached) return cached;

                let scoredStudentCount = 0;
                const students = this.roster.map(stu => {
                    const timeline = [];
                    const entries = [];
                    let includedCount = 0;
                    let totalScore = 0;
                    let first = null;
                    let latest = null;
                    let best = null;
                    let worst = null;

                    assignments.forEach(asg => {
                        if (!this.isStuIncluded(asg, stu)) {
                            timeline.push({ asgId: asg.id, label: asg.name, score: null, rawScore: '', included: false });
                            return;
                        }
                        includedCount++;
                        const rawScore = asg.records?.[stu.id]?.score ?? '';
                        const score = this.parseNumericScore(rawScore);
                        const item = { asgId: asg.id, label: asg.name, score, rawScore, included: true };
                        timeline.push(item);
                        if (score == null) return;
                        entries.push(item);
                        totalScore += score;
                        if (first == null) first = score;
                        latest = score;
                        best = best == null ? score : Math.max(best, score);
                        worst = worst == null ? score : Math.min(worst, score);
                    });

                    const stats = {
                        avg: entries.length ? Number((totalScore / entries.length).toFixed(1)) : null,
                        latest,
                        best,
                        worst,
                        delta: entries.length >= 2 ? Number((latest - first).toFixed(1)) : null,
                        coverage: `${entries.length}/${includedCount}`,
                        trend: this.classifyScoreTrend(entries)
                    };
                    const timelineKey = this.buildTrendTimelineKey(timeline);
                    if (entries.length) scoredStudentCount++;
                    return {
                        id: stu.id,
                        name: stu.name,
                        entries,
                        timeline,
                        stats,
                        searchText: `${stu.id} ${stu.name}`,
                        timelineKey,
                        renderKey: `${stu.id}|${stu.name}|${stats.coverage}|${stats.avg ?? ''}|${stats.latest ?? ''}|${stats.best ?? ''}|${stats.delta ?? ''}|${stats.trend}|${timelineKey}`
                    };
                });
                const report = {
                    assignments: assignments.map(asg => ({ id: asg.id, name: asg.name, subject: this.getAsgSubject(asg) })),
                    students,
                    scoredStudentCount
                };
                if (this._scoreRangeCache.size >= 12) this._scoreRangeCache.clear();
                this._scoreRangeCache.set(cacheKey, report);
                return report;
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
                this.queueRecoveryDraft();
                this._queuePersist();
                this.view.renderStudent(id);
                if (prevDone !== !!asg.records[id]?.done) this.view.renderProgress(this.getAsgDoneCount(asg), this.getAsgTotalCount(asg));
            }
        };

        const UI = {
            isReady: false,
            actions: { has() { return false; }, run() { }, handleFile() { }, score() { } },
            MENU_CLOSE_MS: 160,
            _gridFrozen: false, _taskSelectVersion: -1, _lastRenderAsgId: null, _lastRosterVersion: -1, _lastCardPoolSize: -1, _lastGridMetricsKey: '', _gridPaddingX: 0, _gridPaddingY: 0, _menuTimer: 0,
            init() {
                BackHandler.init();
                this.gridEl = $('grid'); this.counterEl = $('counter'); this.progressFillEl = $('progressFill');
                this.asgSelectEl = $('asgSelect'); this.asgSelectEl.onchange = e => State.selectAsg(+e.target.value);
                this.menuEl = $('menu');
                $('btnScore').onclick = () => this.actions.run('toggleScore');
                $('btnMenu').onclick = e => { e.stopPropagation(); this.toggleMenu(); };
                document.onclick = e => {
                    if (e.target.closest('#btnMenu, #menu')) return;
                    this.closeMenu();
                };
                this.menuEl.onclick = e => {
                    e.stopPropagation();
                    const act = e.target.closest('[act]')?.getAttribute('act');
                    if (act && this.actions.has(act)) { this.closeMenu(); this.actions.run(act); }
                };
                $('fileIn').onchange = e => this.actions.handleFile(e);
                this.setupGrid(); this.setupGridSizing(); State.applyViewMode(); State.applyScoring(); 
                
                // 延迟标记UI为就绪状态，确保State数据已加载
                setTimeout(() => {
                    this.isReady = true;
                    this.render();
                }, 200);
            },
            animationsEnabled() {
                return State.animations !== false;
            },
            ensureMenuEl() {
                if (!this.menuEl || !this.menuEl.isConnected) this.menuEl = $('menu');
                return this.menuEl;
            },
            openMenu() {
                clearTimeout(this._menuTimer);
                this._menuTimer = 0;
                if (!this.ensureMenuEl()) return;
                this.menuEl.classList.remove('closing');
                this.menuEl.classList.add('show');
            },
            closeMenu({ immediate = !this.animationsEnabled() } = {}) {
                clearTimeout(this._menuTimer);
                this._menuTimer = 0;
                if (!this.ensureMenuEl()) return;
                if (immediate) {
                    this.menuEl.classList.remove('show', 'closing');
                    return;
                }
                if (!this.menuEl.classList.contains('show')) {
                    this.menuEl.classList.remove('closing');
                    return;
                }
                this.menuEl.classList.remove('show');
                this.menuEl.classList.add('closing');
                this._menuTimer = setTimeout(() => {
                    this._menuTimer = 0;
                    this.menuEl?.classList.remove('closing');
                }, this.MENU_CLOSE_MS);
            },
            toggleMenu() {
                if (!this.ensureMenuEl()) return;
                if (this.menuEl.classList.contains('show')) {
                    this.closeMenu();
                    return;
                }
                this.openMenu();
            },
            setupGrid() {
                let timer = null, pressCard = null, longPressed = false, moved = false, suppressClickUntil = 0, startPos = { x: 0, y: 0 };
                const cancelTimer = () => { if (timer) clearTimeout(timer); timer = null; };
                const resetState = () => { if (pressCard) pressCard.classList.remove('pressing'); cancelTimer(); pressCard = null; longPressed = false; moved = false; };
                const shouldSuppressClick = () => {
                    if (Date.now() < suppressClickUntil) return true;
                    suppressClickUntil = 0;
                    return false;
                };
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
                    timer = setTimeout(() => {
                        timer = null;
                        longPressed = true;
                        suppressClickUntil = Date.now() + 80;
                        c.classList.remove('pressing');
                        handle(c, true);
                        resetState();
                    }, 500);
                };
                this.gridEl.onpointerup = e => {
                    const c = e.target.closest('.student-card');
                    if (c && pressCard === c) c.classList.remove('pressing');
                    resetState();
                };
                this.gridEl.onpointermove = e => {
                    if (!pressCard) return;
                    if (Math.abs(e.clientX - startPos.x) > 10 || Math.abs(e.clientY - startPos.y) > 8) { moved = true; pressCard.classList.remove('pressing'); cancelTimer(); }
                };
                this.gridEl.onpointercancel = this.gridEl.onpointerleave = resetState;
                this.gridEl.onclick = e => {
                    const c = e.target.closest('.student-card');
                    if (!c || shouldSuppressClick()) return;
                    handle(c, false);
                };
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
            scheduleGridLayout() {
                if (this._gridFrozen || !this.gridEl) return;
                cancelAnimationFrame(this._gridLayoutRaf || 0);
                this._gridLayoutRaf = requestAnimationFrame(() => this.updateGridMetrics());
            },
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
                const grid = this.gridEl;
                if (!grid || !grid.isConnected) return;
                const count = State.roster.length;
                const w = grid.clientWidth - this._gridPaddingX;
                const h = grid.clientHeight - this._gridPaddingY;
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
            getStudentCard(id) {
                const index = State.rosterIndexMap.get(String(id));
                if (index == null || !this.gridEl) return null;
                this.syncCardPool();
                return this.gridEl.children[index] || null;
            },
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
                if (!globalThis.Modal || !Modal.isAnimating) {
                    card.classList.toggle('done', !excluded && !!rec.done);
                }
                card.classList.toggle('excluded', excluded);
                if (!excluded && rec.score != null && rec.score !== '') {
                    scoreEl.hidden = false; scoreEl.textContent = String(rec.score);
                } else { scoreEl.hidden = true; scoreEl.textContent = ''; }
            },
            renderStudent(id) {
                const asg = State.cur, index = State.rosterIndexMap.get(id);
                if (!asg || index == null) return;
                const card = this.getStudentCard(id);
                if (!card) return;
                this.renderCard(card, State.roster[index], asg.records[id] || {}, !State.isStuIncluded(asg, State.roster[index]));
            },
            renderProgress(done, total = State.roster.length) {
                if (!this.counterEl || !this.counterEl.isConnected) this.counterEl = $('counter');
                if (!this.progressFillEl || !this.progressFillEl.isConnected) this.progressFillEl = $('progressFill');
                if (!this.counterEl || !this.progressFillEl) return;
                this.counterEl.textContent = `${done}/${total}`;
                this.progressFillEl.style.width = total ? `${(done / total) * 100}%` : '0%';
            },
            ensureTaskOptions() {
                if (!this.asgSelectEl || !this.asgSelectEl.isConnected) this.asgSelectEl = $('asgSelect');
                const sel = this.asgSelectEl;
                if (!sel) return;
                if (this._taskSelectVersion !== State._asgListVersion) {
                    sel.replaceChildren(...State.data.map(a => { const o = document.createElement('option'); o.value = String(a.id); o.textContent = a.name; return o; }));
                    this._taskSelectVersion = State._asgListVersion;
                }
                if (sel.value != State.curId) sel.value = String(State.curId);
            },
            render() {
                // 确保State数据已加载
                if (!State.data.length || !State.roster.length) return;
                
                const asg = State.cur; if (!asg) return;
                const currentPoolSize = State.roster.length, dirty = State.consumeGridDirty(), force = dirty.full || this._lastCardPoolSize !== currentPoolSize;
                this.ensureTaskOptions(); this.syncCardPool();
                const cards = this.gridEl.children;
                if (force) {
                    // 使用requestAnimationFrame优化渲染性能
                    requestAnimationFrame(() => {
                        State.roster.forEach((stu, i) => this.renderCard(cards[i], stu, asg.records[stu.id] || {}, !State.isStuIncluded(asg, stu)));
                    });
                } else {
                    // 对单个卡片的更新也使用requestAnimationFrame
                    requestAnimationFrame(() => {
                        dirty.ids.forEach(id => {
                            const idx = State.rosterIndexMap.get(id);
                            if (idx != null) this.renderCard(cards[idx], State.roster[idx], asg.records[id] || {}, !State.isStuIncluded(asg, State.roster[idx]));
                        });
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
