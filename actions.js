        const Actions = {
            ctx: { state: null, modal: null, toast: null, debug: null, views: null, colorUtil: null, subjectPresets: [], cardColorPresets: [], getFileInput: () => null },
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
                const d = new Date(), m = (d.getMonth() + 1 + '').padStart(2, '0'), dd = (d.getDate() + '').padStart(2, '0'), def = `${m}${dd}作业`, alt = `${m}${dd}小测`;
                const c = document.createElement('div');
                c.innerHTML = `<input class="input-ui" value="${def}"><div style="display:flex;gap:8px;margin-top:8px"><button class="btn btn-c btn-xs" data-v="">清空</button><button class="btn btn-c btn-xs" data-v="${alt}">${alt}</button></div>`;
                const inp = c.firstChild; c.onclick = e => { const v = e.target.dataset.v; if (v != null) { inp.value = v; inp.focus(); } };
                const n = await Modal.show({ title: '新建任务', content: c, autoFocusEl: inp, btns: [{ text: '取消', val: false }, { text: '确定', type: 'btn-p', onClick: () => Modal.close(inp.value) }] });
                if (n) State.addAsg(n);
            },
            async del() { if (State.data.length > 1 && await Modal.confirm('删除此任务？')) State.removeAsg(State.curId); else if (State.data.length <= 1) Modal.alert('至少保留一个任务'); },
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
                const { root, list } = this.ctx.views.createAsgManageShell(), pool = new Map();
                let mounted = new Set();
                const upd = () => {
                    const next = new Set();
                    State.data.slice().reverse().forEach(asg => {
                        let c = pool.get(asg.id); if (!c) {
                            c = document.createElement('article'); c.className = 'asg-card';
                            c.innerHTML = `<div class="asg-card-head"><div class="asg-card-meta"><div class="asg-t"></div><div class="asg-card-sub"><span class="asg-cur" hidden>当前</span><span class="asg-sub"></span><span>ID ${asg.id}</span></div></div><div class="asg-card-stats"><span class="asg-rate"></span><span class="asg-prog"></span></div></div>
                                <div class="asg-card-fields"><div class="asg-f"><label>名称</label><input class="input-ui" data-r="name"></div><div class="asg-f"><label>科目</label><input class="input-ui" data-r="sub"></div></div><div class="asg-presets"></div>
                                <div class="asg-card-actions"><button class="btn btn-c btn-xs" data-act="pick">切换</button><button class="btn btn-p btn-xs" data-act="save">保存</button><button class="btn btn-d btn-xs" data-act="del">删除</button></div>`;
                            pool.set(asg.id, c);
                        }
                        const t = State.getAsgTotalCount(asg), d = State.getAsgDoneCount(asg), r = t ? Math.round(d / t * 100) : 0, sub = State.getAsgSubject(asg), cur = asg.id === State.curId;
                        c.dataset.id = asg.id; c.classList.toggle('current', cur); c.querySelector('.asg-t').textContent = asg.name; c.querySelector('.asg-cur').hidden = !cur;
                        const sB = c.querySelector('.asg-sub'); sB.textContent = sub; sB.classList.toggle('non-english', sub !== '英语');
                        const rE = c.querySelector('.asg-rate'); rE.textContent = `${r}%`; rE.style.color = r < 60 ? 'var(--danger)' : r > 90 ? 'var(--success)' : 'inherit';
                        c.querySelector('.asg-prog').textContent = `${d}/${t}`; c.querySelector('[data-r="name"]').value = asg.name; c.querySelector('[data-r="sub"]').value = sub;
                        const p = c.querySelector('.asg-presets'); p.innerHTML = ''; SUBJECT_PRESETS.forEach(s => { const b = document.createElement('button'); b.className = `asg-pill ${sub === s ? 'active' : ''}`; b.textContent = s; b.onclick = () => { c.querySelector('[data-r="sub"]').value = s; upd(); }; p.appendChild(b); });
                        list.appendChild(c); next.add(asg.id);
                    });
                    mounted.forEach(id => { if (!next.has(id)) pool.get(id)?.remove(); }); mounted = next;
                };
                list.onclick = async e => {
                    const b = e.target.closest('[data-act]'), c = b?.closest('.asg-card'), id = +c?.dataset.id; if (!id) return;
                    if (b.dataset.act === 'pick') { State.selectAsg(id); upd(); }
                    else if (b.dataset.act === 'save') { if (State.updateAsgMeta(id, { name: c.querySelector('[data-r="name"]').value, subject: c.querySelector('[data-r="sub"]').value })) upd(); else Modal.alert('名称不能为空'); }
                    else if (b.dataset.act === 'del') { if (State.data.length > 1 && await Modal.confirm('删除此任务？')) { State.removeAsg(id); upd(); } else if (State.data.length <= 1) Modal.alert('至少保留一个任务'); }
                };
                upd(); Modal.show({ title: '', content: root, type: 'full' });
            },
            roster() {
                let nextId = 1; const entries = State.list.map(l => ({ ...State.parseRosterLine(l), _rowId: nextId++ }));
                const { root, listEl, countEl, excludedEl, toolbar } = this.ctx.views.createRosterShell(), pool = new Map();
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
                    catch (err) { Modal.alert(err.message); }
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
                const b = new Blob([JSON.stringify({ list: State.list, data: State.data, prefs: State.normalizePrefs(State.prefs) })], { type: 'application/json' }), a = document.createElement('a'), d = new Date();
                a.href = URL.createObjectURL(b); a.download = `backup_${d.getFullYear()}${(d.getMonth()+1+'').padStart(2,'0')}${(d.getDate()+'').padStart(2,'0')}.json`; a.click();
            },
            imp() { this.ctx.getFileInput()?.click(); },
            handleFile(e) {
                const f = e.target.files[0]; if (!f) return;
                const r = new FileReader(); r.onload = async ev => {
                    try {
                        const d = JSON.parse(ev.target.result); if (!d.list || !d.data || !await Modal.confirm('覆盖现有数据？')) return;
                        Object.assign(State, { list: d.list, data: d.data, prefs: State.normalizePrefs(d.prefs) });
                        State.parseRoster(); State.sanitizeAsgIds(); State.rebuildAsgIndex(); State.curId = State.data[0].id; State.save({ immediate: true, asgListChanged: true, invalidateDerived: false }); Modal.alert('导入成功');
                    } catch (err) { Modal.alert('错误: ' + err.message); }
                }; r.readAsText(f); e.target.value = '';
            },
            present() { Modal.show({ title: '', content: ActionViews.createPresentView(State.cur.name, State.roster, State.cur.records), type: 'full' }); }
        };

        UI.actions = { has: a => typeof Actions[a] === 'function', run: a => Actions[a](), handleFile: e => Actions.handleFile(e), score: (id, name) => Actions.score(id, name) };
        Actions.ctx = { state: State, modal: Modal, toast: Toast, debug: Debug, views: ActionViews, colorUtil: ColorUtil, subjectPresets: SUBJECT_PRESETS, cardColorPresets: CARD_COLOR_PRESETS, getFileInput: () => $('fileIn') };
        globalThis.Actions = Actions;
