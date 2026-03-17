const ActionViews = {
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
        root.style.cssText = 'display:flex;flex-direction:column;height:100%';
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
        const list = document.createElement('section');
        list.className = 'asg-manage-grid';
        body.appendChild(list);
        return { root, body, list };
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
        const grid = root.querySelector('.present-grid');
        students.forEach(stu => {
            const rec = records[stu.id] || {}, isDone = !!rec.done, score = (rec.score ?? '') !== '' ? rec.score : '';
            const item = document.createElement('div');
            item.className = `present-item ${isDone ? 'done' : 'pending'}`;
            item.innerHTML = `
                <div class="present-stu-info">
                    <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${stu.name}</span>
                    <span class="present-id">${stu.id}</span>
                </div>
                <div class="present-status">
                    <span class="present-badge ${isDone ? 'done' : 'pending'}">${isDone ? 'OK' : '..'}</span>
                    ${score !== '' ? `<span class="present-score">${score}</span>` : ''}
                </div>
            `;
            grid.appendChild(item);
        });
        return root;
    }
};

globalThis.ActionViews = ActionViews;
