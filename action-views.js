const ActionViews = {
    createPageLayout(title) {
        const root = document.createElement('div');
        root.className = 'st-layout';
        root.style.cssText = 'display:flex;flex-direction:column;height:100%';
        root.innerHTML = `<div class="st-nav"><h2 class="st-title">${title}</h2><button class="st-close" onclick="Modal.close()">&times;</button></div>
            <div class="st-scroll-area"></div>`;
        return { root, body: root.querySelector('.st-scroll-area') };
    },
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
                <div class="color-picker-row">
                    <input type="color" value="${selected}">
                    <span class="color-code">${selected}</span>
                </div>
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
        const { root, body } = this.createPageLayout('作业项目管理');
        const list = document.createElement('section');
        list.className = 'asg-manage-grid';
        body.appendChild(list);
        return { root, body, list };
    },
    createRosterShell() {
        const root = document.createElement('div');
        root.className = 'st-layout';
        root.style.cssText = 'display:flex;flex-direction:column;height:100%';
        root.innerHTML = `<div class="st-nav"><h2 class="st-title">编辑学生名单</h2><button class="st-close" onclick="Modal.close()">&times;</button></div>
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
        return {
            root,
            listEl: root.querySelector('[data-role="list"]'),
            countEl: root.querySelector('[data-role="count"]'),
            excludedEl: root.querySelector('[data-role="excluded"]'),
            toolbar: root.querySelector('.roster-toolbar')
        };
    },
    createStatsShell() {
        const root = document.createElement('div');
        root.className = 'st-layout';
        root.innerHTML = `<div class="st-nav"><h2 class="st-title">统计概览</h2><button class="st-close" onclick="Modal.close()">&times;</button></div>
            <div class="st-scroll-area"><div class="st-summary" id="stSum"></div><div class="st-filters" id="stFil"></div><div class="st-card-table" id="stTab"></div></div>`;
        return {
            root,
            sum: root.querySelector('#stSum'),
            fil: root.querySelector('#stFil'),
            tab: root.querySelector('#stTab')
        };
    },
    createPresentView(title, students, records) {
        const root = document.createElement('div');
        root.className = 'present-mode';
        root.innerHTML = `
            <div class="present-header">
                <h2 class="present-title">${title}</h2>
                <button class="btn btn-c btn-xs" onclick="Modal.close()">退出</button>
            </div>
            <div class="present-grid"></div>
        `;
        const grid = root.querySelector('.present-grid');
        students.forEach(stu => {
            const rec = records[stu.id] || {};
            const isDone = !!rec.done;
            const score = (rec.score !== undefined && rec.score !== null && rec.score !== '') ? rec.score : '';
            
            const item = document.createElement('div');
            item.className = `present-item ${isDone ? 'done' : 'pending'}`;
            item.innerHTML = `
                <div class="present-stu-info">
                    <span style="flex-shrink:0;margin-right:4px">${stu.id}</span>
                    <span style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${stu.name}</span>
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
