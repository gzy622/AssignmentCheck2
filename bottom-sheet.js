/**
 * 底部滑出面板框架 (Bottom Sheet)
 * 复用 ScorePad 的样式与动画模式
 */
const BottomSheet = {
    activeSheet: null,

    /**
     * 创建底部面板
     * @param {Object} options - 配置选项
     * @param {string} options.title - 面板标题
     * @param {HTMLElement} options.content - 内容元素
     * @param {Array} options.buttons - 底部按钮配置 [{ text, type, onClick, primary }]
     * @param {Function} options.onClose - 关闭回调
     * @param {boolean} options.enableDrag - 是否启用拖拽关闭（默认 true）
     * @param {boolean} options.enableBackdrop - 是否启用点击遮罩关闭（默认 true）
     * @returns {Object} 面板实例
     */
    create(options = {}) {
        const {
            title = '',
            content = null,
            buttons = [],
            onClose = null,
            enableDrag = true,
            enableBackdrop = true
        } = options;

        const instance = {
            backdrop: null,
            panel: null,
            isOpen: false,
            _pointerStartY: 0,
            _pointerCurrentY: 0,
            _isDragging: false,
            _resolve: null,
            _keyHandler: null,

            _createElements() {
                // 创建遮罩层
                this.backdrop = document.createElement('div');
                this.backdrop.className = 'bottom-sheet-backdrop';
                if (enableBackdrop) {
                    this.backdrop.onclick = () => this.hide();
                }

                // 创建面板
                this.panel = document.createElement('div');
                this.panel.className = 'bottom-sheet';

                // 构建面板内容
                let html = '';

                // 手柄（如果启用拖拽）
                if (enableDrag) {
                    html += '<div class="bottom-sheet-handle"></div>';
                }

                // 标题
                if (title) {
                    html += `<div class="bottom-sheet-header"><h3 class="bottom-sheet-title">${title}</h3></div>`;
                }

                // 内容区域
                html += '<div class="bottom-sheet-body"></div>';

                // 按钮区域
                if (buttons.length > 0) {
                    html += '<div class="bottom-sheet-footer">';
                    buttons.forEach((btn, idx) => {
                        const btnClass = btn.primary ? 'btn btn-p' : (btn.type || 'btn btn-c');
                        html += `<button class="${btnClass}" data-btn-idx="${idx}">${btn.text}</button>`;
                    });
                    html += '</div>';
                }

                this.panel.innerHTML = html;

                // 插入内容
                if (content) {
                    const bodyEl = this.panel.querySelector('.bottom-sheet-body');
                    if (bodyEl) {
                        bodyEl.appendChild(content);
                    }
                }

                // 绑定按钮事件
                const footer = this.panel.querySelector('.bottom-sheet-footer');
                if (footer) {
                    footer.onclick = (e) => {
                        const btn = e.target.closest('button[data-btn-idx]');
                        if (btn) {
                            const idx = parseInt(btn.dataset.btnIdx, 10);
                            const btnConfig = buttons[idx];
                            if (btnConfig && btnConfig.onClick) {
                                btnConfig.onClick();
                            } else {
                                this.hide();
                            }
                        }
                    };
                }

                // 绑定拖拽事件
                if (enableDrag) {
                    const handle = this.panel.querySelector('.bottom-sheet-handle');
                    if (handle) {
                        handle.addEventListener('pointerdown', (e) => this._onPointerDown(e));
                    }
                    this.panel.addEventListener('pointermove', (e) => this._onPointerMove(e));
                    this.panel.addEventListener('pointerup', (e) => this._onPointerUp(e));
                    this.panel.addEventListener('pointercancel', (e) => this._onPointerUp(e));
                }
            },

            _onPointerDown(e) {
                const handle = this.panel.querySelector('.bottom-sheet-handle');
                if (e.target === handle || handle?.contains(e.target)) {
                    this._isDragging = true;
                    this._pointerStartY = e.clientY;
                    this._pointerCurrentY = e.clientY;
                    this.panel.classList.add('dragging');
                    e.preventDefault();
                }
            },

            _onPointerMove(e) {
                if (!this._isDragging) return;
                this._pointerCurrentY = e.clientY;
                const delta = this._pointerCurrentY - this._pointerStartY;
                if (delta > 0) {
                    const offset = Math.min(delta, 200);
                    this.panel.style.setProperty('--slide-offset', `${offset}px`);
                }
                e.preventDefault();
            },

            _onPointerUp(e) {
                if (!this._isDragging) return;
                this._isDragging = false;
                this.panel.classList.remove('dragging');
                const delta = this._pointerCurrentY - this._pointerStartY;
                if (delta > 80) {
                    this.hide();
                } else {
                    this.panel.style.setProperty('--slide-offset', '0px');
                }
            },

            _bindKeyboard() {
                this._keyHandler = (e) => {
                    if (!this.isOpen) return;
                    if (e.key === 'Escape') {
                        e.preventDefault();
                        this.hide();
                    } else if (e.key === 'Enter' && buttons.some(b => b.primary)) {
                        // 如果有主按钮，Enter 触发主按钮
                        const primaryBtn = buttons.find(b => b.primary);
                        if (primaryBtn && document.activeElement?.tagName !== 'TEXTAREA') {
                            e.preventDefault();
                            if (primaryBtn.onClick) {
                                primaryBtn.onClick();
                            }
                        }
                    }
                };
                document.addEventListener('keydown', this._keyHandler);
            },

            _unbindKeyboard() {
                if (this._keyHandler) {
                    document.removeEventListener('keydown', this._keyHandler);
                    this._keyHandler = null;
                }
            },

            show() {
                if (this.isOpen) return;

                // 关闭其他面板
                if (BottomSheet.activeSheet && BottomSheet.activeSheet !== this) {
                    BottomSheet.activeSheet.hide();
                }
                BottomSheet.activeSheet = this;

                this.isOpen = true;
                this.panel.style.setProperty('--slide-offset', '0px');

                // 强制重绘以确保动画触发
                this.panel.offsetHeight;

                this.panel.classList.add('is-open');
                this.backdrop.classList.add('is-open');

                this._bindKeyboard();

                // 锁定 body 滚动
                document.body.style.overflow = 'hidden';

                return new Promise(r => this._resolve = r);
            },

            hide(result = null) {
                if (!this.isOpen) return;
                this.isOpen = false;
                this.panel.classList.remove('is-open');
                this.backdrop.classList.remove('is-open');

                this._unbindKeyboard();

                // 恢复 body 滚动
                document.body.style.overflow = '';

                if (BottomSheet.activeSheet === this) {
                    BottomSheet.activeSheet = null;
                }

                if (onClose) onClose(result);
                if (this._resolve) {
                    this._resolve(result);
                    this._resolve = null;
                }
            }
        };

        instance._createElements();
        document.body.appendChild(instance.backdrop);
        document.body.appendChild(instance.panel);

        return instance;
    },

    /**
     * 快速显示一个底部面板
     * @param {Object} options - 配置选项
     * @returns {Promise} 关闭时 resolve
     */
    async show(options = {}) {
        const sheet = this.create(options);
        return sheet.show();
    },

    /**
     * 显示确认对话框
     * @param {string} message - 确认消息
     * @returns {Promise<boolean>} 用户选择结果
     */
    async confirm(message) {
        const content = document.createElement('div');
        content.className = 'bottom-sheet-confirm-text';
        content.textContent = message;

        return new Promise(resolve => {
            const sheet = this.create({
                content,
                buttons: [
                    { text: '取消', type: 'btn btn-c', onClick: () => { sheet.hide(); resolve(false); } },
                    { text: '确定', type: 'btn btn-p', primary: true, onClick: () => { sheet.hide(); resolve(true); } }
                ],
                onClose: () => resolve(false)
            });
            sheet.show();
        });
    },

    /**
     * 显示提示对话框
     * @param {string} message - 提示消息
     * @returns {Promise<void>}
     */
    async alert(message) {
        const content = document.createElement('div');
        content.className = 'bottom-sheet-alert-text';
        content.textContent = message;

        return new Promise(resolve => {
            const sheet = this.create({
                content,
                buttons: [
                    { text: '确定', type: 'btn btn-p', primary: true, onClick: () => { sheet.hide(); resolve(); } }
                ],
                onClose: () => resolve()
            });
            sheet.show();
        });
    },

    /**
     * 显示输入对话框
     * @param {string} title - 标题
     * @param {string} defaultValue - 默认值
     * @param {string} inputType - 输入类型
     * @returns {Promise<string|false>} 输入值或 false（取消）
     */
    async prompt(title, defaultValue = '', inputType = 'text') {
        const wrapper = document.createElement('div');
        wrapper.className = 'bottom-sheet-prompt-wrapper';

        const input = document.createElement('input');
        input.className = 'input-ui bottom-sheet-prompt-input';
        input.type = inputType === 'number' ? 'text' : inputType;
        input.inputMode = inputType === 'number' ? 'numeric' : 'text';
        input.value = defaultValue;
        input.enterKeyHint = 'done';

        wrapper.appendChild(input);

        return new Promise(resolve => {
            const sheet = this.create({
                title,
                content: wrapper,
                buttons: [
                    { text: '取消', type: 'btn btn-c', onClick: () => { sheet.hide(); resolve(false); } },
                    { text: '确定', type: 'btn btn-p', primary: true, onClick: () => { sheet.hide(); resolve(input.value); } }
                ],
                onClose: () => resolve(false)
            });
            sheet.show();

            // 自动聚焦
            setTimeout(() => {
                input.focus();
                input.select();
            }, 100);

            // Enter 键提交
            input.addEventListener('keydown', e => {
                if (e.key === 'Enter' && !e.isComposing) {
                    e.preventDefault();
                    sheet.hide();
                    resolve(input.value);
                }
            });
        });
    }
};

globalThis.BottomSheet = BottomSheet;
