        const Actions = {
            ctx: { state: null, modal: null, toast: null, debug: null, views: null, colorUtil: null, subjectPresets: [], cardColorPresets: [], getFileInput: () => null },
            _importCtx: null,
            deferFullscreenWork(root, task, delay = 140) {
                const controller = Modal.getProgressiveController(root);
                if (typeof task === 'function') {
                    if (controller) {
                        controller.schedule(() => task(controller), { phase: 'heavy', delay });
                        return controller;
                    }
                    if (delay > 0) {
                        setTimeout(() => requestAnimationFrame(task), delay);
                    } else {
                        requestAnimationFrame(task);
                    }
                    return null;
                }
                const plan = task && typeof task === 'object' ? task : {};
                if (controller) {
                    if (typeof plan.shell === 'function') controller.schedule(() => plan.shell(controller), { phase: 'shell', delay: plan.shellDelay ?? 0 });
                    if (typeof plan.aboveFold === 'function') controller.schedule(() => plan.aboveFold(controller), { phase: 'aboveFold', delay: plan.aboveFoldDelay ?? 0 });
                    if (typeof plan.heavy === 'function') controller.schedule(() => plan.heavy(controller), { phase: 'heavy', delay: plan.heavyDelay ?? 0 });
                    return controller;
                }
                plan.shell?.(null);
                plan.aboveFold?.(null);
                plan.heavy?.(null);
                return null;
            },
            toggleView() { const { state } = this.ctx; state.toggleViewMode(); },
            toggleScore() { const { state } = this.ctx; state.scoring = !state.scoring; state.applyScoring(); },
            toggleAnim() { const { state } = this.ctx; state.animations = !state.animations; state.saveAnim(); },

            async cardColor() {
                const { state, modal, toast, views, colorUtil, cardColorPresets } = this.ctx, defaults = state.normalizePrefs({});
                let selected = colorUtil.normalizeHex(state.prefs.cardDoneColor, defaults.cardDoneColor);
                const { root, preview, presetHost, picker, code } = views.createColorShell(selected);
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
                const val = await modal.show({ title: '', content: root, type: 'full', loadingMask: false, btns: [{ text: '恢复默认', val: defaults.cardDoneColor }, { text: '取消', val: false }, { text: '保存', type: 'btn-p', onClick: () => modal.close(selected) }] });
                if (val) { state.prefs.cardDoneColor = colorUtil.normalizeHex(val, defaults.cardDoneColor); state.savePrefs(); toast.show('卡片颜色已更新'); }
            },
            async add() {
                this.asgManage();
            },
            async del() { this.asgManage(); },
            score(id, name) {
                const card = UI.getStudentCard(id);
                if (!card) return;
                ScorePad.show(id, name, card.getBoundingClientRect());
            },
            asgManage() {
                const { root, list, introHost } = this.ctx.views.createAsgManageShell(), pool = new Map();
                const { modal, toast, subjectPresets, views } = this.ctx;
                let mounted = new Set();
                let hero = null;
                let work = null;
                let listRenderToken = 0;
                let upd = () => {};
                const draftTimers = new Map();
                const now = new Date();
                const mm = `${now.getMonth() + 1}`.padStart(2, '0');
                const dd = `${now.getDate()}`.padStart(2, '0');
                const defaultName = `${mm}${dd}作业`;
                const altName = `${mm}${dd}小测`;
                const isViewActive = () => modal.isOpen && modal.body.contains(root);
                const mountHero = () => {
                    if (hero) return hero;
                    hero = views.createAsgManageHero();
                    introHost.replaceChildren(hero.section);
                    hero.newNameInput.placeholder = defaultName;
                    hero.newAltBtn.textContent = altName;
                    hero.newAltBtn.onclick = () => { hero.newNameInput.value = altName; hero.newNameInput.focus(); };
                    hero.newCreateBtn.onclick = createAsg;
                    hero.newNameInput.addEventListener('keydown', e => {
                        if (e.key !== 'Enter') return;
                        e.preventDefault();
                        createAsg();
                    });
                    return hero;
                };
                const createAsg = () => {
                    const refs = mountHero();
                    const name = (refs.newNameInput.value || '').trim() || (refs.newNameInput.placeholder || '').trim();
                    if (!name) return toast.show('任务名称不能为空');
                    State.addAsg(name);
                    refs.newNameInput.value = '';
                    refs.newNameInput.placeholder = defaultName;
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

                const renderList = ({ chunked = !!work?.animated } = {}) => {
                    const token = ++listRenderToken;
                    const asgs = State.data.slice().reverse();
                    const next = new Set();
                    const useChunked = !!(chunked && work?.animated);
                    list.replaceChildren();
                    if (!asgs.length) {
                        mounted.forEach(id => pool.get(id)?.remove());
                        mounted = next;
                        return;
                    }
                    let index = 0;
                    const batchSize = useChunked ? 4 : asgs.length;
                    const paintBatch = () => {
                        if (token !== listRenderToken || !isViewActive()) return;
                        const frag = document.createDocumentFragment();
                        const end = Math.min(index + batchSize, asgs.length);
                        for (; index < end; index++) {
                            const asg = asgs[index];
                            let c = pool.get(asg.id);
                            if (!c) {
                                c = document.createElement('article');
                                c.className = 'asg-card';
                                c.innerHTML = `<button class="asg-card-delete" type="button" data-act="del" aria-label="删除任务" title="删除任务">
                                        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">
                                            <path d="M3 6h18"></path>
                                            <path d="M8 6V4h8v2"></path>
                                            <path d="M19 6l-1 14H6L5 6"></path>
                                            <path d="M10 11v6"></path>
                                            <path d="M14 11v6"></path>
                                        </svg>
                                    </button>
                                    <div class="asg-card-head"><div class="asg-card-meta"><div class="asg-t"></div><div class="asg-card-sub"><span class="asg-cur" hidden>当前</span><span class="asg-sub"></span><span>ID ${asg.id}</span></div></div><div class="asg-card-stats"><span class="asg-rate"></span><span class="asg-prog"></span></div></div>
                                    <div class="asg-card-fields"><div class="asg-f"><input class="input-ui" data-r="name" placeholder="名称"></div><div class="asg-f"><select class="input-ui" data-r="sub"></select></div></div>`;
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
                            frag.appendChild(c);
                            next.add(asg.id);
                        }
                        if (!frag.childNodes.length) return;
                        list.appendChild(frag);
                        if (index < asgs.length && useChunked) {
                            work.frame(paintBatch);
                            return;
                        }
                        mounted.forEach(id => { if (!next.has(id)) pool.get(id)?.remove(); });
                        mounted = next;
                    };
                    paintBatch();
                };

                upd = () => {
                    mountHero();
                    renderList({ chunked: !!work?.animated && State.data.length > 6 });
                };

                Modal.show({ title: '', content: root, type: 'full', loadingMask: false });
                work = this.deferFullscreenWork(root, {
                    aboveFold: () => { mountHero(); },
                    heavy: () => renderList({ chunked: true })
                });
            },
            roster() {
                let nextId = 1; const entries = State.list.map(l => ({ ...State.parseRosterLine(l), _rowId: nextId++ }));
                const { root, listEl, topHost, summaryHost } = this.ctx.views.createRosterShell(), pool = new Map();
                const { bottomSheet, views } = this.ctx;
                let mounted = new Set();
                let chrome = null;
                let work = null;
                let renderToken = 0;
                const empty = document.createElement('div');
                empty.className = 'roster-empty';
                empty.textContent = '暂无学生，请点击上方新增。';
                const isViewActive = () => Modal.isOpen && Modal.body.contains(root);
                const mountChrome = () => {
                    if (chrome) return chrome;
                    chrome = views.createRosterChrome();
                    topHost.replaceChildren(chrome.topbar);
                    summaryHost.replaceChildren(chrome.summary);
                    chrome.toolbar.onclick = e => {
                        const act = e.target.closest('[data-act]')?.dataset.act;
                        if (act === 'add') {
                            entries.push({ id: '', name: '', noEnglish: false, _rowId: nextId++ });
                            renderAllRows({ focusLast: true });
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
                    chrome.submitBar.onclick = e => {
                        const act = e.target.closest('[data-act]')?.dataset.act;
                        if (act === 'cancel') Modal.close(false);
                        else if (act === 'save') saveRoster();
                    };
                    return chrome;
                };
                const saveRoster = () => {
                    try {
                        State.list = entries.filter(e => e.id || e.name).map(e => `${e.id}${e.name ? ` ${e.name}` : ''}${e.noEnglish ? ' #非英语' : ''}`);
                        State.parseRoster();
                        State.save({ dirtyData: false, dirtyList: true, invalidateDerived: false });
                        Modal.close(true);
                    }
                    catch (err) { bottomSheet.alert(err.message); }
                };
                const renderSummary = () => {
                    const refs = mountChrome();
                    let validCount = 0, excludedCount = 0;
                    entries.forEach(e => {
                        if (!e.id && !e.name) return;
                        validCount++;
                        if (e.noEnglish) excludedCount++;
                    });
                    refs.countEl.textContent = `共 ${validCount} 人`;
                    refs.excludedEl.textContent = `排除英语 ${excludedCount} 人`;
                };
                const renderAllRows = ({ focusLast = false, chunked = !!work?.animated && entries.length > 18 } = {}) => {
                    const token = ++renderToken;
                    const next = new Set();
                    const useChunked = !!(chunked && work?.animated);
                    listEl.replaceChildren();
                    if (!entries.length) {
                        listEl.replaceChildren(empty);
                        mounted.forEach(id => pool.get(id)?.remove());
                        mounted = next;
                        renderSummary();
                        return;
                    }
                    let index = 0;
                    const batchSize = useChunked ? 12 : entries.length;
                    const finishRender = () => {
                        mounted.forEach(id => { if (!next.has(id)) pool.get(id)?.remove(); });
                        mounted = next;
                        renderSummary();
                        if (focusLast) listEl.lastElementChild?.querySelector('[data-r="name"]')?.focus();
                    };
                    const paintBatch = () => {
                        if (token !== renderToken || !isViewActive()) return;
                        const frag = document.createDocumentFragment();
                        const end = Math.min(index + batchSize, entries.length);
                        for (; index < end; index++) {
                            const e = entries[index];
                            let r = pool.get(e._rowId);
                            if (!r) {
                                r = document.createElement('div');
                                r.className = 'roster-row';
                                r.innerHTML = `<input class="input-ui roster-seat" data-r="id" placeholder="座号"><input class="input-ui roster-name" data-r="name" placeholder="姓名"><label class="roster-check"><input type="checkbox" data-r="ex">排除</label><button class="btn btn-d roster-del" data-act="del">&times;</button>`;
                                pool.set(e._rowId, r);
                            }
                            r.dataset.idx = index;
                            r.querySelector('[data-r="id"]').value = e.id;
                            r.querySelector('[data-r="name"]').value = e.name;
                            r.querySelector('[data-r="ex"]').checked = !!e.noEnglish;
                            frag.appendChild(r);
                            next.add(e._rowId);
                        }
                        listEl.appendChild(frag);
                        if (index < entries.length && useChunked) {
                            work.frame(paintBatch);
                            return;
                        }
                        finishRender();
                    };
                    paintBatch();
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
                Modal.show({ title: '', content: root, type: 'full', loadingMask: false });
                work = this.deferFullscreenWork(root, {
                    aboveFold: () => { mountChrome(); renderSummary(); },
                    heavy: () => renderAllRows({ chunked: true })
                });
            },
            exp() {
                const b = new Blob([JSON.stringify({ list: State.list, data: State.data, prefs: State.normalizePrefs(State.prefs) })], { type: 'application/json' }), a = document.createElement('a');
                a.href = URL.createObjectURL(b); a.download = formatBackupFileName(new Date()); a.click();
            },
            async expExcel() {
                const { modal, toast } = this.ctx;
                
                if (!State.data.length) {
                    toast.show('暂无作业数据');
                    return;
                }

                const assignments = State.data;
                
                const root = document.createElement('div');
                root.innerHTML = `<section class="export-excel-shell">
                    <div class="export-excel-note">选择要导出的作业项目，选择后将生成Excel表格。</div>
                    <div class="export-excel-options">
                        <label class="export-excel-option">
                            <input type="radio" name="exportRange" value="current" checked>
                            <span>当前作业（${State.cur?.name || '未选择'}）</span>
                        </label>
                        <label class="export-excel-option">
                            <input type="radio" name="exportRange" value="all">
                            <span>全部作业（${assignments.length}个）</span>
                        </label>
                        <label class="export-excel-option">
                            <input type="radio" name="exportRange" value="custom">
                            <span>自定义选择</span>
                        </label>
                    </div>
                    <div class="export-excel-checklist" hidden></div>
                </section>`;

                const checklistEl = root.querySelector('.export-excel-checklist');
                const radioEls = root.querySelectorAll('input[name="exportRange"]');
                
                const updateChecklist = () => {
                    const selected = root.querySelector('input[name="exportRange"]:checked').value;
                    if (selected === 'custom') {
                        checklistEl.hidden = false;
                        checklistEl.innerHTML = '<div style="font-size:.84rem;font-weight:700;color:#5a6774;margin-bottom:8px">选择作业</div>';
                        assignments.forEach(asg => {
                            const label = document.createElement('label');
                            label.className = 'export-excel-checkitem';
                            label.innerHTML = `<input type="checkbox" value="${asg.id}" checked><span>${asg.name}</span>`;
                            checklistEl.appendChild(label);
                        });
                    } else {
                        checklistEl.hidden = true;
                    }
                };

                radioEls.forEach(el => el.addEventListener('change', updateChecklist));
                updateChecklist();

                const result = await modal.show({
                    title: '导出Excel',
                    content: root,
                    btns: [
                        { text: '取消', type: 'btn-c', val: false },
                        { text: '导出', type: 'btn-p', val: true }
                    ]
                });

                if (!result) return;

                let targetAssignments = [];
                const rangeType = root.querySelector('input[name="exportRange"]:checked').value;
                
                if (rangeType === 'current') {
                    const cur = State.cur;
                    if (cur) targetAssignments = [cur];
                } else if (rangeType === 'all') {
                    targetAssignments = assignments;
                } else {
                    const checked = checklistEl.querySelectorAll('input[type="checkbox"]:checked');
                    const checkedIds = Array.from(checked).map(c => +c.value);
                    targetAssignments = assignments.filter(a => checkedIds.includes(a.id));
                }

                if (!targetAssignments.length) {
                    toast.show('请至少选择一个作业');
                    return;
                }

                const headers = ['学号', '姓名', ...targetAssignments.map(a => a.name)];
                const rows = State.roster.map(stu => {
                    const row = [stu.id, stu.name];
                    targetAssignments.forEach(asg => {
                        const isEnglish = State.isEnglishAsg(asg);
                        const isExcluded = isEnglish && stu.noEnglish;
                        if (isExcluded) {
                            row.push('非英语生');
                            return;
                        }
                        const rec = asg.records?.[stu.id];
                        if (rec?.done && (rec?.score == null || rec?.score === '')) {
                            row.push('✓');
                        } else if (rec?.score != null && rec?.score !== '') {
                            row.push(rec.score);
                        } else {
                            row.push('');
                        }
                    });
                    return row;
                });

                const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, '成绩表');

                const date = new Date();
                const y = date.getFullYear();
                const m = String(date.getMonth() + 1).padStart(2, '0');
                const d = String(date.getDate()).padStart(2, '0');
                const fileName = `成绩导出_${y}${m}${d}.xlsx`;

                XLSX.writeFile(wb, fileName);
                toast.show(`已导出 ${targetAssignments.length} 个作业的成绩`);
            },
            async expText() {
                const { modal, toast } = this.ctx;
                
                if (!State.data.length) {
                    toast.show('暂无作业数据');
                    return;
                }

                const assignments = State.data;
                
                const root = document.createElement('div');
                root.innerHTML = `<section class="export-excel-shell">
                    <div class="export-excel-note">选择要导出的作业项目，选择后将生成纯文本，可以直接粘贴到微信等聊天软件中。</div>
                    <div class="export-excel-options">
                        <label class="export-excel-option">
                            <input type="radio" name="exportRange" value="current" checked>
                            <span>当前作业（${State.cur?.name || '未选择'}）</span>
                        </label>
                        <label class="export-excel-option">
                            <input type="radio" name="exportRange" value="all">
                            <span>全部作业（${assignments.length}个）</span>
                        </label>
                        <label class="export-excel-option">
                            <input type="radio" name="exportRange" value="custom">
                            <span>自定义选择</span>
                        </label>
                    </div>
                    <div class="export-excel-checklist" hidden></div>
                </section>`;

                const checklistEl = root.querySelector('.export-excel-checklist');
                const radioEls = root.querySelectorAll('input[name="exportRange"]');
                
                const updateChecklist = () => {
                    const selected = root.querySelector('input[name="exportRange"]:checked').value;
                    if (selected === 'custom') {
                        checklistEl.hidden = false;
                        checklistEl.innerHTML = '<div style="font-size:.84rem;font-weight:700;color:#5a6774;margin-bottom:8px">选择作业</div>';
                        assignments.forEach(asg => {
                            const label = document.createElement('label');
                            label.className = 'export-excel-checkitem';
                            label.innerHTML = `<input type="checkbox" value="${asg.id}" checked><span>${asg.name}</span>`;
                            checklistEl.appendChild(label);
                        });
                    } else {
                        checklistEl.hidden = true;
                    }
                };

                radioEls.forEach(el => el.addEventListener('change', updateChecklist));
                updateChecklist();

                const result = await modal.show({
                    title: '导出文本',
                    content: root,
                    btns: [
                        { text: '取消', type: 'btn-c', val: false },
                        { text: '导出', type: 'btn-p', val: true }
                    ]
                });

                if (!result) return;

                let targetAssignments = [];
                const rangeType = root.querySelector('input[name="exportRange"]:checked').value;
                
                if (rangeType === 'current') {
                    const cur = State.cur;
                    if (cur) targetAssignments = [cur];
                } else if (rangeType === 'all') {
                    targetAssignments = assignments;
                } else {
                    const checked = checklistEl.querySelectorAll('input[type="checkbox"]:checked');
                    const checkedIds = Array.from(checked).map(c => +c.value);
                    targetAssignments = assignments.filter(a => checkedIds.includes(a.id));
                }

                if (!targetAssignments.length) {
                    toast.show('请至少选择一个作业');
                    return;
                }

                const lines = [];
                targetAssignments.forEach(asg => {
                    const isEnglish = State.isEnglishAsg(asg);
                    lines.push(`【${asg.name}】`);
                    
                    let doneCount = 0;
                    let scoredCount = 0;
                    const studentLines = [];

                    State.roster.forEach(stu => {
                        if (isEnglish && stu.noEnglish) {
                            studentLines.push(`${stu.id} ${stu.name} 非英语生`);
                            return;
                        }
                        const rec = asg.records?.[stu.id];
                        if (rec?.done) {
                            doneCount++;
                            if (rec?.score != null && rec?.score !== '') {
                                scoredCount++;
                                studentLines.push(`${stu.id} ${stu.name} ${rec.score}`);
                            } else {
                                studentLines.push(`${stu.id} ${stu.name} ✓`);
                            }
                        } else {
                            studentLines.push(`${stu.id} ${stu.name} 未交`);
                        }
                    });

                    lines.push(`已交${doneCount}/${State.roster.length} 已打分${scoredCount}/${doneCount}`);
                    lines.push(...studentLines);
                    lines.push('');
                });

                const text = lines.join('\n');
                
                navigator.clipboard.writeText(text).then(() => {
                    toast.show(`已复制 ${targetAssignments.length} 个作业到剪贴板`);
                }).catch(() => {
                    const textarea = document.createElement('textarea');
                    textarea.value = text;
                    textarea.style.position = 'fixed';
                    textarea.style.opacity = '0';
                    document.body.appendChild(textarea);
                    textarea.select();
                    document.execCommand('copy');
                    document.body.removeChild(textarea);
                    toast.show(`已复制 ${targetAssignments.length} 个作业到剪贴板`);
                });
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
                if (!Validator.isValidImportData(raw)) return null;
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
            quizTrend() {
                const ui = this.ctx.views.createQuizTrendShell();
                const assignments = State.getQuizTrendAssignments();
                const TREND_DEFER_WORK_THRESHOLD = 120;
                const TREND_CHUNK_SIZE_FIRST = 8;
                const TREND_CHUNK_SIZE_NEXT = 12;
                let activeAssignmentIds = new Set();
                let lastRangeAssignmentIds = new Set();
                const chipPool = new Map();
                const cardPool = new Map();
                const empty = document.createElement('div');
                empty.className = 'trend-empty';
                let currentReport = null;
                let chrome = null;
                let work = null;
                let renderTask = 0;
                let listTask = 0;
                let renderToken = 0;
                if (!assignments.length) {
                    this.ctx.toast.show('暂无任务数据');
                    return;
                }
                const mountChrome = () => {
                    if (chrome) return chrome;
                    chrome = this.ctx.views.createQuizTrendChrome();
                    ui.heroHost.replaceChildren(chrome.hero);
                    ui.toolbarHost.replaceChildren(chrome.toolbar);
                    Object.assign(ui, chrome);
                    return chrome;
                };
                const formatStat = value => value == null ? '--' : `${value}`;
                const formatDelta = value => value == null ? '待观察' : `${value > 0 ? '+' : ''}${value}`;
                const getTrendTone = trend => trend === '上升' ? 'up' : trend === '下降' ? 'down' : trend === '稳定' ? 'steady' : 'mix';
                const getRangeAssignments = () => State.getAsgRange(+ui.startEl.value, +ui.endEl.value, assignments);
                const scheduleTask = (task, delay = 0) => work ? work.after(task, delay) : setTimeout(task, delay);
                const cancelPendingRender = () => {
                    renderToken++;
                    clearTimeout(renderTask);
                    clearTimeout(listTask);
                    renderTask = 0;
                    listTask = 0;
                };
                const isTrendViewActive = () => Modal.isOpen && Modal.body.contains(ui.root);
                const shouldDeferTrendRender = rangeAssignments => (work?.animated ?? State.animations !== false) && State.roster.length * Math.max(1, rangeAssignments.length) >= TREND_DEFER_WORK_THRESHOLD;
                const showTrendMessage = message => {
                    empty.textContent = message;
                    ui.listEl.replaceChildren(empty);
                };
                const createTrendMetric = label => {
                    const metric = document.createElement('span');
                    metric.className = 'trend-metric';
                    metric.append(document.createTextNode(`${label} `));
                    const valueEl = document.createElement('strong');
                    metric.appendChild(valueEl);
                    return { metric, valueEl };
                };
                const createTrendCard = () => {
                    const card = document.createElement('article');
                    card.className = 'trend-card';

                    const head = document.createElement('div');
                    head.className = 'trend-card-head';
                    const meta = document.createElement('div');
                    const nameEl = document.createElement('div');
                    nameEl.className = 'trend-student-name';
                    const subEl = document.createElement('div');
                    subEl.className = 'trend-student-sub';
                    meta.append(nameEl, subEl);

                    const badgeEl = document.createElement('span');
                    badgeEl.className = 'trend-badge';
                    head.append(meta, badgeEl);

                    const metrics = document.createElement('div');
                    metrics.className = 'trend-metrics';
                    const avg = createTrendMetric('均分');
                    const latest = createTrendMetric('最新');
                    const delta = createTrendMetric('变化');
                    const best = createTrendMetric('最佳');
                    metrics.append(avg.metric, latest.metric, delta.metric, best.metric);

                    const chartEl = document.createElement('div');
                    chartEl.className = 'trend-chart';
                    const scoreRowEl = document.createElement('div');
                    scoreRowEl.className = 'trend-score-row';

                    card.append(head, metrics, chartEl, scoreRowEl);
                    card._trendRefs = {
                        nameEl,
                        subEl,
                        badgeEl,
                        avgEl: avg.valueEl,
                        latestEl: latest.valueEl,
                        deltaEl: delta.valueEl,
                        bestEl: best.valueEl,
                        chartEl,
                        scoreRowEl
                    };
                    return card;
                };
                const createTrendScorePill = item => {
                    const pill = document.createElement('span');
                    pill.className = `trend-score-pill ${item.score != null ? 'has-score' : item.included ? '' : 'excluded'}`.trim();
                    const labelEl = document.createElement('b');
                    labelEl.textContent = item.label;
                    const scoreEl = document.createElement('strong');
                    scoreEl.textContent = item.score != null ? String(item.score) : item.included ? '--' : '免记';
                    pill.append(labelEl, scoreEl);
                    return pill;
                };
                const syncActiveAssignments = rangeAssignments => {
                    const rangeIds = new Set(rangeAssignments.map(asg => asg.id));
                    if (!lastRangeAssignmentIds.size && !activeAssignmentIds.size) {
                        activeAssignmentIds = new Set(rangeAssignments.map(asg => asg.id));
                    } else {
                        activeAssignmentIds = new Set([...activeAssignmentIds].filter(id => rangeIds.has(id)));
                        rangeAssignments.forEach(asg => {
                            if (!lastRangeAssignmentIds.has(asg.id)) activeAssignmentIds.add(asg.id);
                        });
                    }
                    lastRangeAssignmentIds = rangeIds;
                };
                const fillOptions = () => {
                    mountChrome();
                    const options = assignments.map(asg => `<option value="${asg.id}">${asg.name}</option>`).join('');
                    ui.startEl.innerHTML = options;
                    ui.endEl.innerHTML = options;
                    ui.startEl.value = String(assignments[Math.max(0, assignments.length - 5)]?.id ?? assignments[0].id);
                    ui.endEl.value = String(assignments[assignments.length - 1].id);
                };
                const renderAssignments = rangeAssignments => {
                    ui.assignmentEl.replaceChildren(...rangeAssignments.map((asg, index) => {
                        let chip = chipPool.get(asg.id);
                        if (!chip) {
                            chip = document.createElement('button');
                            chip.type = 'button';
                            chip.dataset.asgId = String(asg.id);
                            chipPool.set(asg.id, chip);
                        }
                        const active = activeAssignmentIds.has(asg.id);
                        chip.className = `trend-assignment-chip${active ? ' active' : ''}`;
                        chip.setAttribute('aria-pressed', String(active));
                        chip.textContent = `${index + 1}. ${asg.name}`;
                        return chip;
                    }));
                };
                const renderStudentCard = student => {
                    let card = cardPool.get(student.id);
                    if (!card) {
                        card = createTrendCard();
                        cardPool.set(student.id, card);
                    }
                    if (card._trendRenderKey === student.renderKey) return card;
                    const refs = card._trendRefs;
                    const trendTone = getTrendTone(student.stats.trend);
                    refs.nameEl.textContent = student.searchText;
                    refs.subEl.textContent = `记录 ${student.stats.coverage}`;
                    refs.badgeEl.className = `trend-badge ${trendTone}`;
                    refs.badgeEl.textContent = student.stats.trend;
                    refs.avgEl.textContent = formatStat(student.stats.avg);
                    refs.latestEl.textContent = formatStat(student.stats.latest);
                    refs.deltaEl.textContent = formatDelta(student.stats.delta);
                    refs.bestEl.textContent = formatStat(student.stats.best);
                    if (card._trendTimelineKey !== student.timelineKey) {
                        refs.chartEl.replaceChildren(this.ctx.views.createTrendSparkline(student.entries));
                        refs.scoreRowEl.replaceChildren(...student.timeline.map(createTrendScorePill));
                        card._trendTimelineKey = student.timelineKey;
                    }
                    card._trendRenderKey = student.renderKey;
                    return card;
                };
                const renderVisibleStudents = token => {
                    if (token !== renderToken || !isTrendViewActive()) return;
                    if (!currentReport) return;
                    if (!currentReport.assignments.length) {
                        showTrendMessage('当前没有选中要显示的小测项目');
                        return;
                    }
                    const keyword = String(ui.searchEl?.value || '').trim();
                    const visibleStudents = currentReport.students.filter(student => !keyword || student.searchText.includes(keyword));
                    if (!visibleStudents.length) {
                        showTrendMessage('当前筛选下没有匹配学生');
                        return;
                    }
                    clearTimeout(listTask);
                    listTask = 0;
                    if (!shouldDeferTrendRender(currentReport.assignments)) {
                        ui.listEl.replaceChildren(...visibleStudents.map(student => renderStudentCard(student)));
                        return;
                    }
                    showTrendMessage(`正在加载 ${visibleStudents.length} 名学生的趋势...`);
                    let index = 0;
                    const paintBatch = () => {
                        if (token !== renderToken || !isTrendViewActive()) return;
                        const batchSize = index === 0 ? TREND_CHUNK_SIZE_FIRST : TREND_CHUNK_SIZE_NEXT;
                        const frag = document.createDocumentFragment();
                        const end = Math.min(index + batchSize, visibleStudents.length);
                        for (; index < end; index++) frag.appendChild(renderStudentCard(visibleStudents[index]));
                        if (ui.listEl.firstElementChild === empty) ui.listEl.replaceChildren(frag);
                        else ui.listEl.appendChild(frag);
                        if (index < visibleStudents.length) listTask = scheduleTask(paintBatch, 0);
                    };
                    listTask = scheduleTask(paintBatch, 0);
                };
                const applyStudentFilter = () => {
                    renderVisibleStudents(renderToken);
                };
                const render = ({ defer = false } = {}) => {
                    cancelPendingRender();
                    const token = renderToken;
                    const run = () => {
                        if (token !== renderToken || !isTrendViewActive()) return;
                        renderTask = 0;
                        const rangeAssignments = getRangeAssignments();
                        syncActiveAssignments(rangeAssignments);
                        const visibleAssignments = rangeAssignments.filter(asg => activeAssignmentIds.has(asg.id));
                        currentReport = State.getScoreRangeReport(null, null, visibleAssignments);
                        const report = currentReport;
                        if (token !== renderToken || !isTrendViewActive()) return;
                        ui.summaryEl.textContent = `区间内 ${rangeAssignments.length} 次任务，当前显示 ${report.assignments.length} 次，${report.scoredStudentCount} 人有成绩记录`;
                        renderAssignments(rangeAssignments);
                        renderVisibleStudents(token);
                    };
                    if (defer) {
                        ui.summaryEl.textContent = '正在整理小测趋势...';
                        showTrendMessage('正在整理成绩数据...');
                        renderTask = scheduleTask(run, 0);
                        return;
                    }
                    run();
                };
                const renderForCurrentRange = () => {
                    const rangeAssignments = getRangeAssignments();
                    const defer = shouldDeferTrendRender(rangeAssignments);
                    render({ defer });
                };
                const bindHandlers = () => {
                    ui.startEl.onchange = renderForCurrentRange;
                    ui.endEl.onchange = renderForCurrentRange;
                    ui.searchEl.oninput = applyStudentFilter;
                    ui.assignmentEl.onclick = e => {
                        const chip = e.target.closest('[data-asg-id]');
                        if (!chip) return;
                        const asgId = Number(chip.dataset.asgId);
                        if (!Number.isFinite(asgId)) return;
                        if (activeAssignmentIds.has(asgId)) activeAssignmentIds.delete(asgId);
                        else activeAssignmentIds.add(asgId);
                        renderForCurrentRange();
                    };
                    ui.quickEl.onclick = e => {
                        const act = e.target.closest('[data-range]')?.dataset.range;
                        if (!act) return;
                        if (act === 'all') {
                            ui.startEl.value = String(assignments[0].id);
                        } else {
                            ui.startEl.value = String(assignments[Math.max(0, assignments.length - 5)].id);
                        }
                        ui.endEl.value = String(assignments[assignments.length - 1].id);
                        renderForCurrentRange();
                    };
                };
                Modal.show({ title: '', content: ui.root, type: 'full', loadingMask: false });
                work = this.deferFullscreenWork(ui.root, {
                    aboveFold: controller => {
                        mountChrome();
                        fillOptions();
                        bindHandlers();
                        controller?.registerCleanup(cancelPendingRender);
                    },
                    heavy: () => renderForCurrentRange()
                });
            }
        };

        UI.actions = { has: a => typeof Actions[a] === 'function', run: a => Actions[a](), handleFile: e => Actions.handleFile(e), score: (id, name) => Actions.score(id, name) };
        Actions.ctx = { state: State, modal: Modal, bottomSheet: BottomSheet, toast: Toast, views: ActionViews, colorUtil: ColorUtil, subjectPresets: SUBJECT_PRESETS, cardColorPresets: CARD_COLOR_PRESETS, getFileInput: () => $('fileIn') };
        globalThis.Actions = Actions;
