        const Actions = {
            ctx: { state: null, modal: null, toast: null, debug: null, views: null, colorUtil: null, subjectPresets: [], cardColorPresets: [], getFileInput: () => null },
            _importCtx: null,
            toggleScore() { const { state } = this.ctx; state.scoring = !state.scoring; state.applyScoring(); },
            toggleAnim() { const { state } = this.ctx; state.animations = !state.animations; state.saveAnim(); },
            toggleDebug() { const { debug, toast } = this.ctx; debug.toggle(); toast.show(`调试面板已${debug.enabled ? '开启' : '关闭'}`); },
            async cardColor() {
                const { state, modal, toast, views, colorUtil, cardColorPresets } = this.ctx, defaults = state.normalizePrefs({});
                let selected = colorUtil.normalizeHex(state.prefs.cardDoneColor, defaults.cardDoneColor);
                const { panel, preview, presetHost, picker, code } = views.createColorPanel(selected);
                const apply = hex => {
                    selected = colorUtil.normalizeHex(hex, defaults.cardDoneColor); picker.value = selected; code.textContent = selected.toUpperCase();
                    const s = colorUtil.mix(selected, '#ffffff', 0.08), e = colorUtil.mix(selected, '#10261a', 0.14);
                    preview.style.background = `linear-gradient(160deg, ${s}, ${e})`;
                    preview.style.boxShadow = `0 10px 24px ${colorUtil.withAlpha(selected, 0.22)}`;
                    [...presetHost.children].forEach(btn => btn.classList.toggle('active', btn.dataset.color === selected));
                };
                cardColorPresets.forEach(hex => {
                    const btn = document.createElement('button'); btn.className = 'color-preset'; btn.dataset.color = hex; btn.style.background = hex;
                    btn.onclick = () => apply(hex); presetHost.appendChild(btn);
                });
                picker.oninput = e => apply(e.target.value); apply(selected);
                const val = await modal.show({ title: '卡片颜色', content: panel, btns: [{ text: '恢复默认', val: defaults.cardDoneColor }, { text: '取消', val: false }, { text: '保存', type: 'btn-p', onClick: () => modal.close(selected) }] });
                if (val) { state.prefs.cardDoneColor = colorUtil.normalizeHex(val, defaults.cardDoneColor); state.savePrefs(); toast.show('卡片颜色已更新'); }
            },
            async add() {
                this.asgManage();
            },
            async del() { this.asgManage(); },
            score(id, name) {
                const card = document.querySelector(`.student-card[data-id="${id}"]`);
                if (card) {
                    const rect = card.getBoundingClientRect();
                    ScorePad.show(id, name, rect);
                } else {
                    const allCards = document.querySelectorAll('.student-card');
                    for (const c of allCards) {
                        if (c.dataset.id === id) {
                            const rect = c.getBoundingClientRect();
                            ScorePad.show(id, name, rect);
                            break;
                        }
                    }
                }
            },
            asgManage() {
                const { root, list, newNameInput, newAltBtn, newCreateBtn } = this.ctx.views.createAsgManageShell(), pool = new Map();
                const { modal, toast, subjectPresets } = this.ctx;
                let mounted = new Set();
                const draftTimers = new Map();
                const now = new Date();
                const mm = `${now.getMonth() + 1}`.padStart(2, '0');
                const dd = `${now.getDate()}`.padStart(2, '0');
                const defaultName = `${mm}${dd}作业`;
                const altName = `${mm}${dd}小测`;
                const createAsg = () => {
                    const name = (newNameInput.value || '').trim() || (newNameInput.placeholder || '').trim();
                    if (!name) return toast.show('任务名称不能为空');
                    State.addAsg(name);
                    newNameInput.value = '';
                    newNameInput.placeholder = defaultName;
                    upd();
                };
                const clearDraftTimer = id => {
                    if (!draftTimers.has(id)) return;
                    clearTimeout(draftTimers.get(id));
                    draftTimers.delete(id);
                };
                const renderCardMeta = (card, asg) => {
                    if (!card || !asg) return;
                    const t = State.getAsgTotalCount(asg), d = State.getAsgDoneCount(asg), r = t ? Math.round(d / t * 100) : 0, sub = State.getAsgSubject(asg), cur = asg.id === State.curId;
                    card.dataset.id = asg.id;
                    card.classList.toggle('current', cur);
                    card.querySelector('.asg-t').textContent = asg.name;
                    card.querySelector('.asg-cur').hidden = !cur;
                    const subBadge = card.querySelector('.asg-sub');
                    subBadge.textContent = sub;
                    subBadge.classList.toggle('non-english', sub !== '英语');
                    const rateEl = card.querySelector('.asg-rate');
                    rateEl.textContent = `${r}%`;
                    rateEl.style.color = r < 60 ? 'var(--danger)' : r > 90 ? 'var(--success)' : 'inherit';
                    card.querySelector('.asg-prog').textContent = `${d}/${t}`;
                    card.querySelector('[data-r="name"]').value = asg.name;
                    card.querySelector('[data-r="sub"]').value = sub;
                };
                const saveCardMeta = (card, { strict = false } = {}) => {
                    const id = +card?.dataset.id;
                    if (!id) return false;
                    clearDraftTimer(id);
                    const nameInput = card.querySelector('[data-r="name"]');
                    const nextName = String(nameInput?.value || '').trim();
                    const nextSubject = card.querySelector('[data-r="sub"]')?.value;
                    const asg = State.asgMap.get(id) || State.data.find(item => item.id === id);
                    if (!asg) return false;
                    if (!nextName) {
                        if (!strict) return false;
                        nameInput.value = asg.name;
                        renderCardMeta(card, asg);
                        toast.show('任务名称不能为空');
                        return false;
                    }
                    if (!State.updateAsgMeta(id, { name: nextName, subject: nextSubject })) return false;
                    renderCardMeta(card, State.asgMap.get(id) || asg);
                    return true;
                };
                const queueCardMetaSave = card => {
                    const id = +card?.dataset.id;
                    if (!id) return;
                    clearDraftTimer(id);
                    draftTimers.set(id, setTimeout(() => {
                        draftTimers.delete(id);
                        saveCardMeta(card);
                    }, 250));
                };
                const requestDelete = async id => {
                    clearDraftTimer(id);
                    if (State.data.length <= 1) return toast.show('至少保留一个任务');
                    const asg = State.asgMap.get(id) || State.data.find(item => item.id === id);
                    const total = asg ? State.getAsgTotalCount(asg) : 0;
                    const done = asg ? State.getAsgDoneCount(asg) : 0;
                    const info = document.createElement('div');
                    info.className = 'modal-page-text';
                    info.innerHTML = `<div style="font-size:1rem;font-weight:700;color:#1f2937;margin-bottom:8px">确认删除该作业项目</div>
                        <div style="color:#4b5563;line-height:1.6">名称：${asg?.name || '未命名任务'}</div>
                        <div style="color:#4b5563;line-height:1.6">科目：${State.getAsgSubject(asg)}</div>
                        <div style="color:#4b5563;line-height:1.6">进度：${done}/${total}</div>
                        <div style="color:#4b5563;line-height:1.6">ID：${id}</div>`;
                    const ok = await modal.show({
                        title: '删除作业项目',
                        content: info,
                        btns: [
                            { text: '取消', type: 'btn-c', val: false },
                            { text: '确认删除', type: 'btn-d', val: true }
                        ]
                    });
                    if (!ok) return;
                    if (State.data.length <= 1) return toast.show('至少保留一个任务');
                    State.removeAsg(id);
                    upd();
                };
                newNameInput.placeholder = defaultName;
                newAltBtn.textContent = altName;
                newAltBtn.onclick = () => { newNameInput.value = altName; newNameInput.focus(); };
                newCreateBtn.onclick = createAsg;
                newNameInput.addEventListener('keydown', e => {
                    if (e.key !== 'Enter') return;
                    e.preventDefault();
                    createAsg();
                });
                const upd = () => {
                    const next = new Set();
                    State.data.slice().reverse().forEach(asg => {
                        let c = pool.get(asg.id); if (!c) {
                            c = document.createElement('article'); c.className = 'asg-card';
                            c.innerHTML = `<button class="asg-card-delete" type="button" data-act="del" aria-label="删除任务" title="删除任务">
                                    <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                                        <path d="M3 6h18"></path>
                                        <path d="M8 6V4h8v2"></path>
                                        <path d="M19 6l-1 14H6L5 6"></path>
                                        <path d="M10 11v6"></path>
                                        <path d="M14 11v6"></path>
                                    </svg>
                                </button>
                                <div class="asg-card-head"><div class="asg-card-meta"><div class="asg-t"></div><div class="asg-card-sub"><span class="asg-cur" hidden>当前</span><span class="asg-sub"></span><span>ID ${asg.id}</span></div></div><div class="asg-card-stats"><span class="asg-rate"></span><span class="asg-prog"></span></div></div>
                                <div class="asg-card-fields"><div class="asg-f"><label>名称</label><input class="input-ui" data-r="name"></div><div class="asg-f"><label>科目</label><select class="input-ui" data-r="sub"></select></div></div>`;
                            const subSelect = c.querySelector('[data-r="sub"]');
                            subjectPresets.forEach(subject => {
                                const option = document.createElement('option');
                                option.value = subject;
                                option.textContent = subject;
                                subSelect.appendChild(option);
                            });
                            pool.set(asg.id, c);
                        }
                        renderCardMeta(c, asg);
                        list.appendChild(c); next.add(asg.id);
                    });
                    mounted.forEach(id => { if (!next.has(id)) pool.get(id)?.remove(); }); mounted = next;
                };
                list.onclick = async e => {
                    const c = e.target.closest('.asg-card'), id = +c?.dataset.id;
                    if (!id) return;
                    const act = e.target.closest('[data-act]')?.dataset.act;
                    if (act === 'del') {
                        await requestDelete(id);
                        return;
                    }
                    if (!e.target.closest('button, input, select, textarea, label')) {
                        State.selectAsg(id);
                        upd();
                    }
                };
                list.oninput = e => {
                    if (e.target.dataset.r !== 'name') return;
                    const c = e.target.closest('.asg-card');
                    if (!c) return;
                    c.querySelector('.asg-t').textContent = e.target.value.trim() || '未命名任务';
                    queueCardMetaSave(c);
                };
                list.onchange = e => {
                    const c = e.target.closest('.asg-card');
                    if (!c) return;
                    if (e.target.dataset.r === 'sub') saveCardMeta(c, { strict: true });
                };
                list.addEventListener('focusout', e => {
                    const role = e.target.dataset.r;
                    if (role !== 'name' && role !== 'sub') return;
                    const c = e.target.closest('.asg-card');
                    if (!c) return;
                    saveCardMeta(c, { strict: role === 'name' });
                });
                upd(); Modal.show({ title: '', content: root, type: 'full' });
            },
            roster() {
                let nextId = 1; const entries = State.list.map(l => ({ ...State.parseRosterLine(l), _rowId: nextId++ }));
                const { root, listEl, countEl, excludedEl, toolbar } = this.ctx.views.createRosterShell(), pool = new Map();
                const { bottomSheet } = this.ctx;
                let mounted = new Set();
                const renderSummary = () => {
                    let validCount = 0, excludedCount = 0;
                    entries.forEach(e => {
                        if (!e.id && !e.name) return;
                        validCount++;
                        if (e.noEnglish) excludedCount++;
                    });
                    countEl.textContent = `共 ${validCount} 人`;
                    excludedEl.textContent = `排除英语 ${excludedCount} 人`;
                };
                const renderAllRows = () => {
                    const next = new Set();
                    entries.forEach((e, i) => {
                        let r = pool.get(e._rowId);
                        if (!r) {
                            r = document.createElement('div');
                            r.className = 'roster-row';
                            r.innerHTML = `<input class="input-ui roster-seat" data-r="id" placeholder="座号"><input class="input-ui roster-name" data-r="name" placeholder="姓名"><label class="roster-check"><input type="checkbox" data-r="ex">排除</label><button class="btn btn-d roster-del" data-act="del">&times;</button>`;
                            pool.set(e._rowId, r);
                        }
                        r.dataset.idx = i;
                        r.querySelector('[data-r="id"]').value = e.id;
                        r.querySelector('[data-r="name"]').value = e.name;
                        r.querySelector('[data-r="ex"]').checked = !!e.noEnglish;
                        listEl.appendChild(r);
                        next.add(e._rowId);
                    });
                    mounted.forEach(id => { if (!next.has(id)) pool.get(id)?.remove(); });
                    mounted = next;
                    renderSummary();
                };
                toolbar.onclick = e => {
                    const act = e.target.closest('[data-act]')?.dataset.act;
                    if (act === 'add') {
                        entries.push({ id: '', name: '', noEnglish: false, _rowId: nextId++ });
                        renderAllRows();
                        listEl.lastElementChild.querySelector('[data-r="name"]').focus();
                    }
                    else if (act === 'autonum') {
                        entries.forEach((e, i) => e.id = String(i + 1).padStart(2, '0'));
                        renderAllRows();
                    }
                    else if (act === 'sort-seat') {
                        entries.sort((a, b) => a.id.localeCompare(b.id, undefined, { numeric: true }));
                        renderAllRows();
                    }
                    else if (act === 'clean') {
                        for (let i = entries.length - 1; i >= 0; i--) if (!entries[i].id && !entries[i].name) entries.splice(i, 1);
                        renderAllRows();
                    }
                };
                listEl.oninput = e => {
                    const r = e.target.closest('.roster-row');
                    if (!r) return;
                    const i = Number(r.dataset.idx);
                    if (!Number.isFinite(i)) return;
                    if (e.target.dataset.r === 'id') entries[i].id = e.target.value;
                    else if (e.target.dataset.r === 'name') entries[i].name = e.target.value;
                    renderSummary();
                };
                listEl.onchange = e => {
                    if (e.target.dataset.r !== 'ex') return;
                    const r = e.target.closest('.roster-row');
                    if (!r) return;
                    const i = Number(r.dataset.idx);
                    if (!Number.isFinite(i)) return;
                    entries[i].noEnglish = e.target.checked;
                    renderSummary();
                };
                listEl.onclick = e => {
                    const del = e.target.closest('[data-act="del"]');
                    if (!del) return;
                    const row = del.closest('.roster-row');
                    if (!row) return;
                    const i = Number(row.dataset.idx);
                    if (!Number.isFinite(i)) return;
                    entries.splice(i, 1);
                    renderAllRows();
                };
                renderAllRows();
                Modal.show({ title: '', content: root, type: 'full', btns: [{ text: '取消', val: false }, { text: '保存', type: 'btn-p', onClick: () => {
                    try { State.list = entries.filter(e => e.id || e.name).map(e => `${e.id}${e.name ? ` ${e.name}` : ''}${e.noEnglish ? ' #非英语' : ''}`); State.parseRoster(); State.save({ dirtyData: false, dirtyList: true, invalidateDerived: false }); Modal.close(true); }
                    catch (err) { bottomSheet.alert(err.message); }
                }}]});
            },
            stats() {
                const sel = new Set(State.data.map(a => a.id)), ui = this.ctx.views.createStatsShell(), pool = new Map();
                let mounted = new Set();
                const upd = () => {
                    const { tgs, rows, avgRate } = State.getStatsRows(Array.from(sel));
                    ui.sum.innerHTML = `<div class="st-metric"><div class="st-val">${avgRate}%</div><div class="st-label">平均完成率</div></div><div class="st-metric"><div class="st-val">${tgs.length}</div><div class="st-label">统计任务数</div></div>`;
                    ui.fil.innerHTML = ''; State.data.slice().reverse().forEach(a => { const c = document.createElement('button'); c.type = 'button'; c.className = `st-chip ${sel.has(a.id) ? 'active' : ''}`; c.textContent = a.name; c.onclick = () => { sel.has(a.id) ? sel.delete(a.id) : sel.add(a.id); upd(); }; ui.fil.appendChild(c); });
                    if (!ui.tab.firstChild) ui.tab.innerHTML = '<div class="st-row st-head"><div>学生</div><div>提交详情</div><div style="text-align:right">完成率</div></div>';
                    const next = new Set();
                    rows.forEach(item => {
                        let r = pool.get(item.id); if (!r) {
                            r = document.createElement('div'); r.className = 'st-row';
                            r.innerHTML = `<div class="st-user"><span class="st-name"></span><span class="st-id"></span></div><div class="st-visual"></div><div class="st-rate"></div>`;
                            pool.set(item.id, r);
                        }
                        r.querySelector('.st-name').textContent = item.name; r.querySelector('.st-id').textContent = item.id;
                        const v = r.querySelector('.st-visual'); v.innerHTML = ''; item.dones.forEach(d => { const dot = document.createElement('div'); dot.className = `st-dot ${d ? 'done' : ''}`; v.appendChild(dot); });
                        const rE = r.querySelector('.st-rate'); rE.textContent = `${item.rate}%`; rE.style.color = item.rate < 60 ? 'var(--danger)' : item.rate > 90 ? 'var(--success)' : 'inherit';
                        ui.tab.appendChild(r); next.add(item.id);
                    });
                    mounted.forEach(id => { if (!next.has(id)) pool.get(id)?.remove(); }); mounted = next;
                };
                upd(); Modal.show({ title: '', content: ui.root, type: 'full' });
            },
            exp() {
                const b = new Blob([JSON.stringify({ list: State.list, data: State.data, prefs: State.normalizePrefs(State.prefs) })], { type: 'application/json' }), a = document.createElement('a');
                a.href = URL.createObjectURL(b); a.download = formatBackupFileName(new Date()); a.click();
            },
            imp() {
                const ui = this.ctx.views.createImportShell();
                const setStatus = (text, type = '') => {
                    ui.statusEl.textContent = text;
                    ui.statusEl.className = `import-status${type ? ` ${type}` : ''}`;
                };
                this._importCtx = {
                    payload: null,
                    onFileParsed: ({ fileName, payload }) => {
                        ui.fileEl.textContent = fileName;
                        ui.applyBtn.disabled = !payload;
                        this._importCtx.payload = payload || null;
                        if (!payload) return setStatus('文件无效，请选择包含 list 与 data 的备份文件。', 'err');
                        setStatus(`已载入文件，待导入：名单 ${payload.list.length} 条，任务 ${payload.data.length} 条。`);
                    },
                    onFileError: msg => {
                        ui.fileEl.textContent = '未选择文件';
                        ui.applyBtn.disabled = true;
                        this._importCtx.payload = null;
                        setStatus(msg, 'err');
                    }
                };
                ui.pickBtn.onclick = () => this.ctx.getFileInput()?.click();
                ui.applyBtn.onclick = () => {
                    const payload = this._importCtx?.payload;
                    if (!payload) return setStatus('请先选择有效备份文件。', 'err');
                    try {
                        this.applyImportData(payload);
                        setStatus('导入完成，当前数据已覆盖并保存。', 'ok');
                    } catch (err) {
                        setStatus(`导入失败：${err.message}`, 'err');
                    }
                };
                Modal.show({ title: '', content: ui.root, type: 'full' });
            },
            parseImportData(raw) {
                if (!raw || typeof raw !== 'object' || !Array.isArray(raw.list) || !Array.isArray(raw.data)) return null;
                return { list: raw.list, data: raw.data, prefs: State.normalizePrefs(raw.prefs) };
            },
            applyImportData(payload) {
                Object.assign(State, { list: payload.list, data: payload.data, prefs: payload.prefs });
                State.parseRoster();
                State.sanitizeAsgIds();
                if (!State.data.length) throw new Error('备份中不包含任务数据');
                State.rebuildAsgIndex();
                State.curId = State.resolveCurId(State.data[0].id);
                State.save({ immediate: true, asgListChanged: true, invalidateDerived: false });
            },
            handleFile(e) {
                const ctx = this._importCtx;
                const f = e.target.files[0];
                if (!ctx || !f) return;
                const r = new FileReader();
                r.onload = ev => {
                    try {
                        const parsed = this.parseImportData(JSON.parse(ev.target.result));
                        if (!parsed) throw new Error('文件格式不符合备份规范');
                        ctx.onFileParsed({ fileName: f.name, payload: parsed });
                    } catch (err) {
                        ctx.onFileError(`解析失败：${err.message}`);
                    }
                };
                r.readAsText(f);
                e.target.value = '';
            },
            present() { Modal.show({ title: '', content: ActionViews.createPresentView(State.cur.name, State.roster, State.cur.records), type: 'full' }); }
        };

        UI.actions = { has: a => typeof Actions[a] === 'function', run: a => Actions[a](), handleFile: e => Actions.handleFile(e), score: (id, name) => Actions.score(id, name) };
        Actions.ctx = { state: State, modal: Modal, bottomSheet: BottomSheet, toast: Toast, debug: Debug, views: ActionViews, colorUtil: ColorUtil, subjectPresets: SUBJECT_PRESETS, cardColorPresets: CARD_COLOR_PRESETS, getFileInput: () => $('fileIn') };
        globalThis.Actions = Actions;
