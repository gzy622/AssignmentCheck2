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

    createColorShell(selected) {
        const { root, body } = this.createShell('卡片颜色');
        body.style.padding = '16px';
        const color = this.createColorPanel(selected);
        body.appendChild(color.panel);
        return { root, body, ...color };
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
        body.style.padding = '12px';
        body.innerHTML = `<div class="roster-shell">
            <div class="roster-topbar">
                <div class="roster-actions" data-role="actions">
                    <button class="btn btn-p" type="button" data-act="add">新增</button>
                    <button class="btn btn-c" type="button" data-act="autonum">编座号</button>
                    <button class="btn btn-c" type="button" data-act="sort-seat">排序</button>
                    <button class="btn btn-c" type="button" data-act="clean">清空行</button>
                </div>
                <div class="roster-actions roster-actions-end" data-role="submit">
                    <button class="btn btn-c" type="button" data-act="cancel">取消</button>
                    <button class="btn btn-p" type="button" data-act="save">保存</button>
                </div>
            </div>
            <div class="roster-content">
                <div class="roster-summary"><span class="roster-badge" data-role="count"></span><span class="roster-badge" data-role="excluded"></span></div>
                <div class="roster-list" data-role="list"></div>
            </div>
        </div>`;
        return {
            root,
            listEl: body.querySelector('[data-role="list"]'),
            countEl: body.querySelector('[data-role="count"]'),
            excludedEl: body.querySelector('[data-role="excluded"]'),
            toolbar: body.querySelector('[data-role="actions"]'),
            submitBar: body.querySelector('[data-role="submit"]')
        };
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

    createQuizTrendShell() {
        const { root, body } = this.createShell('小测趋势');
        body.style.padding = '16px';
        body.innerHTML = `<section class="trend-shell">
            <div class="trend-hero">
                <div>
                    <div class="trend-hero-title">按区间查看全班小测成绩</div>
                    <div class="trend-hero-note">选择起止任务后，按学生展示均分、最新分、区间变化与得分轨迹。</div>
                </div>
                <div class="trend-hero-summary" data-role="summary"></div>
            </div>
            <div class="trend-toolbar">
                <label class="trend-field">
                    <span>开始</span>
                    <select class="input-ui" data-role="start"></select>
                </label>
                <label class="trend-field">
                    <span>结束</span>
                    <select class="input-ui" data-role="end"></select>
                </label>
                <label class="trend-field trend-search">
                    <span>筛选</span>
                    <input class="input-ui" data-role="search" placeholder="输入学号或姓名">
                </label>
                <div class="trend-quick" data-role="quick">
                    <button class="btn btn-c" type="button" data-range="recent">最近5次</button>
                    <button class="btn btn-c" type="button" data-range="all">全部</button>
                </div>
            </div>
            <div class="trend-assignment-strip" data-role="assignments"></div>
            <div class="trend-board" data-role="board">
                <div class="trend-list" data-role="list"></div>
            </div>
        </section>`;
        return {
            root,
            summaryEl: body.querySelector('[data-role="summary"]'),
            startEl: body.querySelector('[data-role="start"]'),
            endEl: body.querySelector('[data-role="end"]'),
            searchEl: body.querySelector('[data-role="search"]'),
            quickEl: body.querySelector('[data-role="quick"]'),
            assignmentEl: body.querySelector('[data-role="assignments"]'),
            boardEl: body.querySelector('[data-role="board"]'),
            listEl: body.querySelector('[data-role="list"]')
        };
    },

    createTrendSparkline(entries) {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('viewBox', '0 0 180 52');
        svg.setAttribute('class', 'trend-sparkline');
        if (!entries.length) {
            svg.innerHTML = '<text x="90" y="30" text-anchor="middle" class="trend-empty-text">暂无分数</text>';
            return svg;
        }
        if (entries.length === 1) {
            const score = entries[0].score;
            const y = 44 - Math.max(0, Math.min(40, score / 2.5));
            svg.innerHTML = `<line x1="16" y1="${y}" x2="164" y2="${y}" class="trend-line trend-line-single"></line><circle cx="90" cy="${y}" r="5" class="trend-dot"></circle>`;
            return svg;
        }
        const scores = entries.map(item => item.score);
        const min = Math.min(...scores);
        const max = Math.max(...scores);
        const span = Math.max(1, max - min);
        const points = entries.map((item, index) => {
            const x = 16 + (148 * index / (entries.length - 1));
            const y = 44 - ((item.score - min) / span) * 32;
            return { x, y, score: item.score };
        });
        svg.innerHTML = `<polyline points="${points.map(point => `${point.x},${point.y}`).join(' ')}" class="trend-line"></polyline>${points.map(point => `<circle cx="${point.x}" cy="${point.y}" r="4" class="trend-dot"><title>${point.score}</title></circle>`).join('')}`;
        return svg;
    }
};

globalThis.ActionViews = ActionViews;
