const ActionViews = {
    getPresentGridMetrics(count) {
        const total = Math.max(1, Number(count) || 1);
        const viewportWidth = Math.max(window.innerWidth || 0, window.visualViewport?.width || 0, 320);
        const viewportHeight = Math.max(window.innerHeight || 0, window.visualViewport?.height || 0, 320);
        const isPortrait = viewportHeight >= viewportWidth;
        const maxCols = Math.min(total, isPortrait ? 6 : 10);
        let best = { cols: 1, rows: total, score: 0 };

        for (let cols = 1; cols <= maxCols; cols++) {
            const rows = Math.ceil(total / cols);
            const cellWidth = viewportWidth / cols;
            const cellHeight = viewportHeight / rows;
            const shapePenalty = isPortrait ? Math.abs(cellWidth / cellHeight - 0.92) : Math.abs(cellWidth / cellHeight - 1.28);
            const emptyPenalty = (cols * rows - total) * (isPortrait ? 16 : 30);
            const score = Math.min(cellWidth, cellHeight * (isPortrait ? 0.96 : 1.1)) - shapePenalty * 22 - emptyPenalty;
            if (score > best.score) best = { cols, rows, score };
        }

        return { cols: best.cols, rows: best.rows };
    },

    createNav(title, onClose) {
        const nav = document.createElement('div');
        nav.className = 'st-nav';
        nav.innerHTML = `<h2 class="st-title">${title}</h2><button class="st-close" type="button">&times;</button>`;
        nav.querySelector('.st-close').onclick = onClose || (() => Modal.close());
        return nav;
    },
    createShell(title) {
        const root = document.createElement('div');
        root.className = 'st-layout';
        root.style.cssText = 'display:flex;flex-direction:column;flex:1;min-height:0';
        root.appendChild(this.createNav(title));
        const body = document.createElement('div');
        body.className = 'st-scroll-area';
        root.appendChild(body);
        return { root, body };
    },
    createPageLayout(title) { return this.createShell(title); },

    createColorPanel(selected) {
        const panel = document.createElement('div');
        panel.className = 'color-panel';
        panel.innerHTML = `<div class="color-preview">已登记卡片预览</div>
            <div>
                <div style="font-size:.84rem;font-weight:700;color:#5a6774;margin-bottom:8px">预设颜色</div>
                <div class="color-presets"></div>
            </div>
            <div>
                <div style="font-size:.84rem;font-weight:700;color:#5a6774;margin-bottom:8px">自定义颜色</div>
                <div class="color-picker-row"><input type="color" value="${selected}"><span class="color-code">${selected}</span></div>
            </div>
            <div class="color-note">颜色会立即用于已登记学生卡片，并写入本地存储；导出备份时也会一起带上。</div>`;
        return {
            panel,
            preview: panel.querySelector('.color-preview'),
            presetHost: panel.querySelector('.color-presets'),
            picker: panel.querySelector('input[type="color"]'),
            code: panel.querySelector('.color-code')
        };
    },

    createAsgManageShell() {
        const { root, body } = this.createShell('作业项目管理');
        body.innerHTML = `<section class="asg-manage-hero">
            <div class="asg-manage-hero-head">
                <div class="asg-manage-hero-title">新建任务</div>
                <div class="asg-manage-hero-note">在此页完成新增、切换、编辑与删除，统一管理任务。</div>
            </div>
            <div class="asg-manage-form">
                <input class="input-ui" data-role="new-name" placeholder="输入任务名称">
                <button class="btn btn-c" type="button" data-role="new-alt"></button>
                <button class="btn btn-p" type="button" data-role="new-create">创建</button>
            </div>
        </section>`;
        const list = document.createElement('section');
        list.className = 'asg-manage-grid';
        body.appendChild(list);
        return {
            root,
            body,
            list,
            newNameInput: body.querySelector('[data-role="new-name"]'),
            newAltBtn: body.querySelector('[data-role="new-alt"]'),
            newCreateBtn: body.querySelector('[data-role="new-create"]')
        };
    },

    createRosterShell() {
        const { root, body } = this.createShell('编辑学生名单');
        body.style.padding = '16px';
        body.innerHTML = `<div class="roster-shell">
            <div class="roster-hint-card">直接逐行编辑座位号、姓名和排除标记。可一键自动生成座位号，也可按座位号排序。勾选“排除英语”后，该学生会在英语任务中自动跳过。</div>
            <div class="roster-toolbar">
                <button class="btn btn-p" type="button" data-act="add"> 新增一行</button>
                <button class="btn btn-c" type="button" data-act="autonum">自动生成座位号</button>
                <button class="btn btn-c" type="button" data-act="sort-seat">按座位号排序</button>
                <button class="btn btn-c" type="button" data-act="clean">清理空行</button>
            </div>
            <div class="roster-summary"><span class="roster-badge" data-role="count"></span><span class="roster-badge" data-role="excluded"></span></div>
            <div class="roster-list" data-role="list"></div>
        </div>`;
        return {
            root,
            listEl: body.querySelector('[data-role="list"]'),
            countEl: body.querySelector('[data-role="count"]'),
            excludedEl: body.querySelector('[data-role="excluded"]'),
            toolbar: body.querySelector('.roster-toolbar')
        };
    },

    createStatsShell() {
        const { root, body } = this.createShell('统计概览');
        body.innerHTML = `<div class="st-summary" id="stSum"></div><div class="st-filters" id="stFil"></div><div class="st-card-table" id="stTab"></div>`;
        return { root, sum: body.querySelector('#stSum'), fil: body.querySelector('#stFil'), tab: body.querySelector('#stTab') };
    },

    createImportShell() {
        const { root, body } = this.createShell('导入备份');
        body.style.padding = '16px';
        body.innerHTML = `<section class="import-shell">
            <div class="import-note">导入会直接覆盖当前名单、任务与设置。请先确认备份文件来源正确。</div>
            <div class="import-actions">
                <button class="btn btn-c" type="button" data-role="pick">选择备份文件</button>
                <button class="btn btn-p" type="button" data-role="apply" disabled>确认覆盖并导入</button>
            </div>
            <div class="import-file" data-role="file">未选择文件</div>
            <div class="import-status" data-role="status">等待选择备份文件</div>
        </section>`;
        return {
            root,
            pickBtn: body.querySelector('[data-role="pick"]'),
            applyBtn: body.querySelector('[data-role="apply"]'),
            fileEl: body.querySelector('[data-role="file"]'),
            statusEl: body.querySelector('[data-role="status"]')
        };
    },

    createPresentView(title, students, records) {
        const root = document.createElement('div');
        root.className = 'present-mode';
        root.innerHTML = `
            <div class="present-floating-bar">
                <span class="present-title">${title}</span>
                <button class="btn btn-c btn-xs" onclick="Modal.close()">退出展示</button>
            </div>
            <div class="present-grid"></div>
        `;
        const metrics = this.getPresentGridMetrics(students.length);
        root.style.setProperty('--present-cols', metrics.cols);
        root.style.setProperty('--present-rows', metrics.rows);
        const grid = root.querySelector('.present-grid');
        students.forEach(stu => {
            const rec = records[stu.id] || {}, isDone = !!rec.done, score = (rec.score ?? '') !== '' ? rec.score : '';
            const note = rec.note || '';
            const displayValue = score !== '' ? score : note;
            const item = document.createElement('div');
            item.className = `present-item ${isDone ? 'done' : 'pending'}`;
            const valueClass = String(displayValue).length >= 3 ? 'present-value compact' : 'present-value';
            item.innerHTML = `
                <div class="present-stu-info">
                    <span class="present-id">${stu.id}</span>
                    <span class="present-name">${stu.name}</span>
                </div>
                <div class="present-status">
                    ${displayValue !== '' ? `<span class="${valueClass}">${displayValue}</span>` : ''}
                </div>
            `;
            grid.appendChild(item);
        });
        return root;
    }
};

globalThis.ActionViews = ActionViews;
