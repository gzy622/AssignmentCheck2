const ScorePad = {
    el: null,
    backdrop: null,
    isOpen: false,
    currentId: null,
    currentName: null,
    value: '',
    submitAction: 'confirm',
    originalGridTransform: null,
    _pointerStartY: 0,
    _pointerCurrentY: 0,
    _activePointerId: null,
    _isPointerPrimed: false,
    _isDragging: false,
    highlightCloneEl: null,

    init() {
        this.createEl();
        document.body.appendChild(this.backdrop);
        document.body.appendChild(this.el);
    },

    createEl() {
        this.backdrop = document.createElement('div');
        this.backdrop.className = 'scorepad-backdrop';
        this.backdrop.onclick = () => this.hide();

        this.el = document.createElement('div');
        this.el.className = 'scorepad';
        this.el.innerHTML = `
            <div class="scorepad-handle"></div>
            <div class="scorepad-display-row">
                <input type="text" class="scorepad-display input-ui" placeholder="点击此处手动输入" readonly>
            </div>
            <div class="scorepad-keypad">
                <div class="scorepad-row">
                    <button class="scorepad-key" data-val="1">1</button>
                    <button class="scorepad-key" data-val="2">2</button>
                    <button class="scorepad-key" data-val="3">3</button>
                </div>
                <div class="scorepad-row">
                    <button class="scorepad-key" data-val="4">4</button>
                    <button class="scorepad-key" data-val="5">5</button>
                    <button class="scorepad-key" data-val="6">6</button>
                </div>
                <div class="scorepad-row">
                    <button class="scorepad-key" data-val="7">7</button>
                    <button class="scorepad-key" data-val="8">8</button>
                    <button class="scorepad-key" data-val="9">9</button>
                </div>
                <div class="scorepad-row">
                    <button class="scorepad-key action" data-val="clear">C</button>
                    <button class="scorepad-key" data-val="0">0</button>
                    <button class="scorepad-key action" data-val="backspace">⌫</button>
                </div>
            </div>
            <div class="scorepad-toolbar">
                <button class="btn btn-c" data-action="cancel">取消</button>
                <button class="btn btn-p" data-action="confirm">确认</button>
            </div>
        `;

        const display = this.el.querySelector('.scorepad-display');
        display.onclick = (e) => {
            e.target.readOnly = false;
            e.target.focus({ preventScroll: true });
            e.target.select();
        };
        display.onblur = () => {
            display.readOnly = true;
        };
        display.oninput = (e) => {
            this.value = e.target.value;
        };
        display.onkeydown = (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this._saveAndClose();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                this.hide();
            }
        };

        this.el.addEventListener('pointerdown', this._onPointerDown.bind(this));
        this.el.addEventListener('pointermove', this._onPointerMove.bind(this));
        this.el.addEventListener('pointerup', this._onPointerUp.bind(this));
        this.el.addEventListener('pointercancel', this._onPointerUp.bind(this));

        this.el.addEventListener('click', (e) => {
            const key = e.target.closest('.scorepad-key');
            if (key) {
                const val = key.dataset.val;
                if (val === 'clear') {
                    this.value = '';
                } else if (val === 'backspace') {
                    this.value = this.value.slice(0, -1);
                } else {
                    this.value += val;
                }
                this._updateDisplay();
            }

            const btn = e.target.closest('[data-action]');
            if (btn) {
                const action = btn.dataset.action;
                if (action === 'confirm') {
                    this._saveAndClose();
                } else if (action === 'cancel') {
                    this.hide();
                }
            }
        });

        // 全局键盘事件监听（回车确认、ESC退出）
        this._handleKeyDown = (e) => {
            if (!this.isOpen) return;
            if (e.key === 'Enter') {
                e.preventDefault();
                this._saveAndClose();
            } else if (e.key === 'Escape') {
                e.preventDefault();
                this.hide();
            }
        };
        document.addEventListener('keydown', this._handleKeyDown);
    },

    _onPointerDown(e) {
        if (!e.isPrimary || this._activePointerId != null) return;
        this._activePointerId = e.pointerId;
        this._pointerStartY = e.clientY;
        this._pointerCurrentY = e.clientY;
        this._isPointerPrimed = true;
    },

    _onPointerMove(e) {
        if (e.pointerId !== this._activePointerId || !this._isPointerPrimed) return;
        this._pointerCurrentY = e.clientY;
        const delta = this._pointerCurrentY - this._pointerStartY;
        if (!this._isDragging) {
            if (delta < 8) return;
            this._isDragging = true;
            this.el.classList.add('dragging');
            if (this.el.setPointerCapture) this.el.setPointerCapture(e.pointerId);
        }
        if (delta > 0) {
            const offset = Math.min(delta, 200);
            this.el.style.setProperty('--slide-offset', `${offset}px`);
        } else {
            this.el.style.setProperty('--slide-offset', '0px');
        }
        e.preventDefault();
    },

    _onPointerUp(e) {
        if (e.pointerId !== this._activePointerId) return;
        const dragged = this._isDragging;
        this._isDragging = false;
        this._isPointerPrimed = false;
        this._activePointerId = null;
        if (this.el.hasPointerCapture?.(e.pointerId)) this.el.releasePointerCapture(e.pointerId);
        if (dragged) {
            this.el.classList.remove('dragging');
            const delta = this._pointerCurrentY - this._pointerStartY;
            if (delta > 80) {
                this.hide();
                return;
            }
            this.el.style.setProperty('--slide-offset', '0px');
        }
    },

    _getCardById(id) {
        const cards = document.querySelectorAll('.student-card');
        for (const c of cards) {
            if (c.dataset.id === String(id)) return c;
        }
        return null;
    },

    _formatStudentLabel(id, name) {
        const sid = String(id ?? '').trim();
        const sname = String(name ?? '').trim();
        return [sid, sname].filter(Boolean).join(' ');
    },

    show(id, name, rect) {
        if (this.isOpen) return;
        this.isOpen = true;
        UI.setGridFrozen(true);
        this.currentId = id;
        this.currentName = name;

        const asg = State.cur;
        const rec = asg?.records[id] || {};
        this.value = rec.score != null ? String(rec.score) : '';
        this.submitAction = 'confirm';
        const display = this.el.querySelector('.scorepad-display');
        if (display) {
            display.placeholder = this._formatStudentLabel(id, name) || '点击此处手动输入';
        }
        this._updateDisplay();

        const card = this._getCardById(id);
        if (card) {
            card.classList.add('scoring');
            this._createHighlightClone(card);
        }

        // 预设面板高度 CSS 变量（根据内容计算，避免动画时序问题）
        const estimatedHeight = this._estimatePanelHeight();
        document.documentElement.style.setProperty('--scorepad-height', `${estimatedHeight}px`);

        this.el.style.setProperty('--slide-offset', '0px');
        this.el.classList.add('is-open');
        this.backdrop.classList.add('is-open');

        this._adjustGridForPanel(rect);
    },

    _estimatePanelHeight() {
        // 预估面板高度：手柄(25) + 输入框(70) + 键盘(4行*56) + 工具栏(60) + 底部安全区(20) + 间距(20)
        const handleHeight = 25;
        const displayHeight = 70;
        const keypadRows = 4;
        const rowHeight = 56;
        const toolbarHeight = 60;
        const safeArea = 20;
        const padding = 20;
        // 注意：移除了 presets 后，面板高度减小。presets 原本占据了约 42px + 12px margin
        return handleHeight + displayHeight + (keypadRows * rowHeight) + toolbarHeight + safeArea + padding;
    },

    hide() {
        if (!this.isOpen) return;
        this.isOpen = false;
        this.el.classList.remove('is-open');
        this.backdrop.classList.remove('is-open');

        const card = this._getCardById(this.currentId);
        if (card) card.classList.remove('scoring');
        this._clearHighlightClone();

        this._restoreGrid();
        UI.setGridFrozen(false);
        this._isDragging = false;
        this._isPointerPrimed = false;
        this._activePointerId = null;
        this.currentId = null;
        this.currentName = null;
        this.value = '';
        this.submitAction = 'confirm';
    },

    _updateDisplay() {
        const display = this.el.querySelector('.scorepad-display');
        display.value = this.value;
        if (!this.currentId) return;
        display.placeholder = this._formatStudentLabel(this.currentId, this.currentName) || '点击此处手动输入';
    },

    _saveAndClose() {
        // 先关闭输入法（让输入框失去焦点）
        const display = this.el.querySelector('.scorepad-display');
        if (display) {
            display.readOnly = true;
            display.blur();
        }
        if (this.currentId) {
            State.updRec(this.currentId, {
                score: this.value || null,
                done: this.value ? true : !!State.cur.records[this.currentId]?.done
            }, {
                source: 'scorepad',
                action: this.submitAction || 'confirm',
                studentName: this.currentName
            });
        }
        this.hide();
    },

    _adjustGridForPanel(rect) {
        const grid = document.getElementById('grid');
        if (!grid || !rect) return;

        const viewportHeight = window.innerHeight;
        // 使用 CSS 变量预设的高度，避免动画时序问题
        const panelHeight = parseInt(getComputedStyle(document.documentElement)
            .getPropertyValue('--scorepad-height')) || 389;
        const panelTop = viewportHeight - panelHeight;
        
        const targetCardTop = panelTop - rect.height - 20;
        const shift = rect.top - targetCardTop;
        
        if (shift > 0) {
            grid.style.transform = `translateY(-${shift}px)`;
            grid.style.transition = 'transform 0.25s ease';
            this.originalGridTransform = grid.style.transform;
        }
        this._syncHighlightClone();
    },

    _restoreGrid() {
        const grid = document.getElementById('grid');
        if (grid) {
            grid.style.transform = '';
            grid.style.transition = 'transform 0.25s ease';
            this.originalGridTransform = null;
        }
    },

    _createHighlightClone(card) {
        this._clearHighlightClone();
        const clone = card.cloneNode(true);
        clone.classList.add('score-highlight-clone');
        clone.classList.remove('pressing');
        clone.removeAttribute('id');
        document.body.appendChild(clone);
        this.highlightCloneEl = clone;
        this._syncHighlightClone();
    },

    _syncHighlightClone() {
        if (!this.highlightCloneEl || !this.currentId) return;
        const card = this._getCardById(this.currentId);
        if (!card) return;
        const rect = card.getBoundingClientRect();
        const style = this.highlightCloneEl.style;
        style.left = `${rect.left}px`;
        style.top = `${rect.top}px`;
        style.width = `${rect.width}px`;
        style.height = `${rect.height}px`;
    },

    _clearHighlightClone() {
        if (!this.highlightCloneEl) return;
        this.highlightCloneEl.remove();
        this.highlightCloneEl = null;
    }
};

globalThis.ScorePad = ScorePad;
