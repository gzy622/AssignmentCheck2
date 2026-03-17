        const Actions = {
            ctx: {
                state: null,
                modal: null,
                toast: null,
                debug: null,
                views: null,
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
                const { state, modal, toast, views, colorUtil, cardColorPresets } = this.ctx;
                const defaults = state.normalizePrefs({});
                let selected = colorUtil.normalizeHex(state.prefs.cardDoneColor, defaults.cardDoneColor);
                const { panel, preview, presetHost, picker, code } = views.createColorPanel(selected);

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
                return this.ctx.views.createPageLayout(title);
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
                            Modal.close(true);
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
                const { root, list } = this.ctx.views.createAsgManageShell();
                const asgState = {
                    pool: new Map(),
                    mountedIds: new Set()
                };

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

                const createAsgCard = () => {
                    const card = document.createElement('article');
                    card.className = 'asg-card';
                    card.innerHTML = `<div class="asg-card-head">
                            <div class="asg-card-meta">
                                <div class="asg-card-title"></div>
                                <div class="asg-card-sub">
                                    <span class="asg-current-badge" hidden>当前项目</span>
                                    <span class="asg-subject-badge"></span>
                                    <span data-role="idLabel"></span>
                                </div>
                            </div>
                            <div class="asg-card-stats">
                                <span class="asg-card-rate"></span>
                                <span data-role="progress"></span>
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
                    card._titleEl = card.querySelector('.asg-card-title');
                    card._currentBadgeEl = card.querySelector('.asg-current-badge');
                    card._subjectBadgeEl = card.querySelector('.asg-subject-badge');
                    card._idLabelEl = card.querySelector('[data-role="idLabel"]');
                    card._rateEl = card.querySelector('.asg-card-rate');
                    card._progressEl = card.querySelector('[data-role="progress"]');
                    card._nameInput = card.querySelector('[data-role="name"]');
                    card._subjectInput = card.querySelector('[data-role="subject"]');
                    card._presetsEl = card.querySelector('[data-role="presets"]');
                    return card;
                };

                const syncAsgCard = (card, asg) => {
                    const total = State.getAsgTotalCount(asg);
                    const done = State.getAsgDoneCount(asg);
                    const rate = total ? Math.round(done / total * 100) : 0;
                    const subject = State.getAsgSubject(asg);
                    const isCurrent = asg.id === State.curId;
                    card.dataset.id = String(asg.id);
                    card.classList.toggle('current', isCurrent);
                    card._titleEl.textContent = asg.name;
                    card._currentBadgeEl.hidden = !isCurrent;
                    card._subjectBadgeEl.textContent = subject;
                    card._subjectBadgeEl.classList.toggle('non-english', subject !== '英语');
                    card._idLabelEl.textContent = `ID ${asg.id}`;
                    card._rateEl.textContent = `${rate}%`;
                    card._rateEl.style.color = rate < 60 ? 'var(--danger)' : rate > 90 ? 'var(--success)' : '#16212c';
                    card._progressEl.textContent = `${done}/${total}`;
                    if (card._nameInput.value !== asg.name) card._nameInput.value = asg.name;
                    if (card._subjectInput.value !== subject) card._subjectInput.value = subject;
                    bindSubjectPresets(card._presetsEl, card._subjectInput);
                };

                const renderRows = () => {
                    const nextMounted = new Set();
                    State.data.slice().reverse().forEach(asg => {
                        let card = asgState.pool.get(asg.id);
                        if (!card) {
                            card = createAsgCard();
                            asgState.pool.set(asg.id, card);
                        }
                        syncAsgCard(card, asg);
                        list.appendChild(card);
                        nextMounted.add(asg.id);
                    });
                    asgState.mountedIds.forEach(id => {
                        if (nextMounted.has(id)) return;
                        asgState.pool.get(id)?.remove();
                    });
                    asgState.mountedIds = nextMounted;
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
                let nextRowId = 1;
                const entries = State.list.map(parseEntry).filter(Boolean).map(entry => ({ ...entry, _rowId: nextRowId++ }));

                const { root, listEl, countEl, excludedEl, toolbar } = this.ctx.views.createRosterShell();
                const rosterState = {
                    pool: new Map(),
                    mountedIds: new Set(),
                    emptyEl: document.createElement('div')
                };
                rosterState.emptyEl.className = 'roster-empty';
                rosterState.emptyEl.textContent = '还没有学生，点击“新增一行”开始编辑。';
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
                const createRosterRow = () => {
                   const row = document.createElement('div');
                   row.className = 'roster-row';
                   row.innerHTML = `<input class="input-ui roster-seat" data-role="id" type="text" inputmode="numeric" placeholder="座号">
                       <input class="input-ui roster-name" data-role="name" type="text" placeholder="姓名">
                       <label class="roster-check"><input data-role="exclude" type="checkbox">排除英语</label>
                       <button class="btn btn-d roster-del" type="button" data-act="remove" title="删除条目">&times;</button>`;
                   row._idInput = row.querySelector('[data-role="id"]');
                   row._nameInput = row.querySelector('[data-role="name"]');
                   row._excludeInput = row.querySelector('[data-role="exclude"]');
                   return row;
                };                const syncRosterRow = (row, entry, index) => {
                    row.dataset.index = String(index);
                    row.dataset.rowId = String(entry._rowId);
                    if (row._idInput.value !== (entry.id || '')) row._idInput.value = entry.id || '';
                    if (row._nameInput.value !== (entry.name || '')) row._nameInput.value = entry.name || '';
                    if (row._excludeInput.checked !== !!entry.noEnglish) row._excludeInput.checked = !!entry.noEnglish;
                };
                const renderRows = () => {
                    syncSummary();
                    if (!entries.length) {
                        listEl.replaceChildren(rosterState.emptyEl);
                        rosterState.mountedIds.forEach(id => rosterState.pool.get(id)?.remove());
                        rosterState.mountedIds = new Set();
                        return;
                    }
                    const nextMounted = new Set();
                    entries.forEach((entry, index) => {
                        let row = rosterState.pool.get(entry._rowId);
                        if (!row) {
                            row = createRosterRow();
                            rosterState.pool.set(entry._rowId, row);
                        }
                        syncRosterRow(row, entry, index);
                        listEl.appendChild(row);
                        nextMounted.add(entry._rowId);
                    });
                    rosterState.mountedIds.forEach(id => {
                        if (nextMounted.has(id)) return;
                        rosterState.pool.get(id)?.remove();
                    });
                    rosterState.mountedIds = nextMounted;
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

                toolbar.onclick = e => {
                    const btn = e.target.closest('[data-act]');
                    if (!btn) return;
                    const act = btn.dataset.act;
                    if (act === 'add') {
                        entries.push({ id: '', name: '', noEnglish: false, _rowId: nextRowId++ });
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
                    title: '', content: root, type: 'full', btns: [{ text: '取消', val: false }, {
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
                const sel = new Set(State.data.map(a => a.id));
                const ui = this.ctx.views.createStatsShell();
                const statsState = {
                    chipVersion: -1,
                    chipPool: new Map(),
                    rowPool: new Map(),
                    mountedRowIds: new Set()
                };
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
                        const chipNodes = [];
                        State.data.slice().reverse().forEach(a => {
                            let chip = statsState.chipPool.get(a.id);
                            if (!chip) {
                                chip = document.createElement('div');
                                chip.className = 'st-chip';
                                chip.dataset.id = String(a.id);
                                statsState.chipPool.set(a.id, chip);
                            }
                            chip.textContent = a.name;
                            chipNodes.push(chip);
                        });
                        ui.fil.replaceChildren(...chipNodes);
                        statsState.chipVersion = State._asgListVersion;
                    }
                    [...ui.fil.children].forEach(chip => {
                        chip.classList.toggle('active', sel.has(+chip.dataset.id));
                    });
                };

                const head = document.createElement('div');
                head.className = 'st-row st-head';
                head.innerHTML = '<div>学生</div><div>提交详情</div><div style="text-align:right">完成率</div>';
                ui.tab.appendChild(head);

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

                    const nextMounted = new Set();
                    rows.forEach(item => {
                        let row = statsState.rowPool.get(item.id);
                        if (!row) {
                            row = createStatsRow();
                            statsState.rowPool.set(item.id, row);
                        }
                        syncStatsRow(row, item);
                        ui.tab.appendChild(row);
                        nextMounted.add(item.id);
                    });
                    statsState.mountedRowIds.forEach(id => {
                        if (nextMounted.has(id)) return;
                        statsState.rowPool.get(id)?.remove();
                    });
                    statsState.mountedRowIds = nextMounted;
                };
                upd(); Modal.show({ title: '', content: ui.root, type: 'full', btns: [] });
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
            },
            present() {
                const asg = State.cur;
                const students = State.roster;
                const view = ActionViews.createPresentView(asg.name, students, asg.records);
                Modal.show({ title: '', content: view, type: 'full', btns: [] });
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
            views: ActionViews,
            colorUtil: ColorUtil,
            subjectPresets: SUBJECT_PRESETS,
            cardColorPresets: CARD_COLOR_PRESETS,
            getFileInput: () => $('fileIn')
        };

        globalThis.Actions = Actions;
