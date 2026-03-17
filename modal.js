const Modal = {
    el: $('modal'),
    card: $('modal').querySelector('.modal-card'),
    title: $('modal').querySelector('.modal-title'),
    body: $('modal').querySelector('.modal-body'),
    footer: $('modal').querySelector('.modal-footer'),
    closeBtn: $('modal').querySelector('.modal-close'),
    header: $('modal').querySelector('.modal-header'),
    isOpen: false,
    isClosing: false,
    isFull: false,
    resolve: null,
    _scrollY: 0,
    _layoutRaf: 0,
    _viewportHandler: null,
    _focusHandler: null,
    _focusTimer: 0,
    _pointerGuardTimer: 0,
    _stableFocusMode: false,
    _lastLayout: null,

    init() {
        this.closeBtn.onclick = () => {
            Debug.log('点击关闭按钮');
            this.close(false);
        };
        document.addEventListener('keydown', (e) => {
            if (e.key !== 'Escape') return;
            if (this.isOpen) this.close(false);
            else BackHandler.closeOverlayLikeEsc();
        });
    },

    lockBody() {
        this._scrollY = window.scrollY || 0;
        document.body.style.setProperty('--locked-body-height', `${window.innerHeight}px`);
        document.body.classList.add('modal-open');
        document.body.style.top = `-${this._scrollY}px`;
    },

    unlockBody() {
        document.body.classList.remove('modal-open');
        document.body.style.top = '';
        document.body.style.removeProperty('--locked-body-height');
        window.scrollTo(0, this._scrollY || 0);
    },

    releaseActiveInput() {
        const active = document.activeElement;
        if (!active || active === document.body) return;
        if (active.matches?.('input, textarea, select, [contenteditable="true"]')) active.blur();
    },

    shouldUseStableFocusMode(el) {
        if (!IS_ANDROID_FIREFOX || !el) return false;
        return el.matches?.('input, textarea, [contenteditable="true"]');
    },

    shouldFreezeViewportOffsets() {
        return this._stableFocusMode;
    },

    scheduleFocus(el) {
        clearTimeout(this._focusTimer);
        this._focusTimer = 0;
        if (!el) return;
        const delay = this.shouldUseStableFocusMode(el) ? 180 : 60;
        this._focusTimer = setTimeout(() => {
            this._focusTimer = 0;
            if (!this.isOpen) return;
            el.focus({ preventScroll: true });
        }, delay);
    },

    clearFocusTimer() {
        clearTimeout(this._focusTimer);
        this._focusTimer = 0;
    },

    armPointerGuard(ms = 320) {
        clearTimeout(this._pointerGuardTimer);
        this._pointerGuardTimer = 0;
        this.el.style.pointerEvents = 'none';
        this._pointerGuardTimer = setTimeout(() => {
            this._pointerGuardTimer = 0;
            if (!this.isOpen || this.isClosing) return;
            this.el.style.pointerEvents = '';
        }, ms);
    },

    clearPointerGuard() {
        clearTimeout(this._pointerGuardTimer);
        this._pointerGuardTimer = 0;
        this.el.style.pointerEvents = '';
    },

    buildPagePanel(title, content, btns = []) {
        const panel = document.createElement('div');
        panel.className = 'st-layout';
        panel.style.cssText = 'display:flex;flex-direction:column;height:100%';

        const nav = document.createElement('div');
        nav.className = 'st-nav';
        const titleEl = document.createElement('h2');
        titleEl.className = 'st-title';
        titleEl.textContent = title || '';
        const closeBtn = document.createElement('button');
        closeBtn.className = 'st-close';
        closeBtn.type = 'button';
        closeBtn.innerHTML = '&times;';
        closeBtn.onclick = () => this.close(false);
        nav.appendChild(titleEl);
        nav.appendChild(closeBtn);

        const scroll = document.createElement('div');
        scroll.className = 'st-scroll-area';

        const section = document.createElement('section');
        section.className = 'modal-page-section';
        if (typeof content === 'string') {
            const text = document.createElement('div');
            text.className = 'modal-page-text';
            text.textContent = content;
            section.appendChild(text);
        } else {
            section.appendChild(content);
        }

        if (btns.length) {
            const actions = document.createElement('div');
            actions.className = 'modal-page-actions';
            btns.forEach(b => {
                const btn = document.createElement('button');
                btn.className = `btn ${b.type || 'btn-c'}`;
                btn.type = 'button';
                btn.textContent = b.text;
                btn.onclick = () => { if (b.onClick) b.onClick(); else this.close(b.val); };
                actions.appendChild(btn);
            });
            section.appendChild(actions);
        }

        scroll.appendChild(section);
        panel.appendChild(nav);
        panel.appendChild(scroll);
        return panel;
    },

    bindViewport() {
        this.unbindViewport();
        this._viewportHandler = () => this.scheduleLayout();
        this._focusHandler = () => {
            if (this.shouldFreezeViewportOffsets()) return;
            this.scheduleLayout();
        };
        window.addEventListener('resize', this._viewportHandler, { passive: true });
        if (window.visualViewport) {
            window.visualViewport.addEventListener('resize', this._viewportHandler, { passive: true });
        }
        if (!this.shouldFreezeViewportOffsets()) {
            document.addEventListener('focusin', this._focusHandler);
        }
    },

    unbindViewport() {
        if (this._viewportHandler) {
            window.removeEventListener('resize', this._viewportHandler);
            if (window.visualViewport) {
                window.visualViewport.removeEventListener('resize', this._viewportHandler);
            }
            this._viewportHandler = null;
        }
        if (this._focusHandler) {
            document.removeEventListener('focusin', this._focusHandler);
            this._focusHandler = null;
        }
        cancelAnimationFrame(this._layoutRaf || 0);
        this._layoutRaf = 0;
        this.clearFocusTimer();
    },

    scheduleLayout() {
        if (!this.isOpen) return;
        cancelAnimationFrame(this._layoutRaf || 0);
        this._layoutRaf = requestAnimationFrame(() => this.updateLayout());
    },

    updateLayout() {
        if (!this.isOpen) return;
        const vv = window.visualViewport;
        const vpH = Math.round(vv ? vv.height : window.innerHeight);
        let topGap;
        let bottomGap;

        if (this.shouldFreezeViewportOffsets()) {
            topGap = this.isFull ? 0 : 12;
            bottomGap = this.isFull ? 0 : 12;
        } else {
            const vpTop = Math.round(vv ? vv.offsetTop : 0);
            const keyboardInset = Math.max(0, Math.round(window.innerHeight - (vv ? vv.height + vv.offsetTop : window.innerHeight)));
            topGap = this.isFull ? vpTop : Math.max(10, vpTop + 12);
            bottomGap = this.isFull ? keyboardInset : Math.max(10, keyboardInset + 12);
        }

        const nextLayout = { vpH, topGap, bottomGap };
        const prev = this._lastLayout;
        if (prev && prev.vpH === vpH && prev.topGap === topGap && prev.bottomGap === bottomGap) return;
        this._lastLayout = nextLayout;
        this.el.style.setProperty('--modal-vh', `${vpH}px`);
        this.el.style.setProperty('--modal-top-gap', `${topGap}px`);
        this.el.style.setProperty('--modal-bottom-gap', `${bottomGap}px`);
    },

    show({ title, content, type = 'normal', btns = [], autoFocusEl = null }) {
        if (this.isOpen) this.forceClose(false);
        UI.setGridFrozen(true);
        this.releaseActiveInput();
        const usePageLayout = type !== 'full';
        this.title.textContent = title || '';
        this.body.innerHTML = '';
        if (!usePageLayout) {
            if (typeof content === 'string') this.body.innerHTML = content;
            else this.body.appendChild(content);
        } else {
            this.body.appendChild(this.buildPagePanel(title, content, btns));
        }

        this.el.className = '';
        this.isFull = true;
        this._stableFocusMode = this.shouldUseStableFocusMode(autoFocusEl);
        this.el.classList.add('full');
        if (this._stableFocusMode) this.el.classList.add('focus-stable');
        this.header.style.display = 'none';

        this.footer.innerHTML = '';
        this.footer.style.display = !usePageLayout && btns.length ? 'flex' : 'none';

        if (!usePageLayout) {
            btns.forEach(b => {
                const btn = document.createElement('button');
                btn.className = `btn ${b.type || 'btn-c'}`;
                btn.textContent = b.text;
                btn.onclick = () => { if (b.onClick) b.onClick(); else this.close(b.val); };
                this.footer.appendChild(btn);
            });
        }

        this.isOpen = true;
        Debug.log(`Modal.show open type=${type} stable=${this._stableFocusMode ? 1 : 0}`);
        this.isClosing = false;
        this._lastLayout = null;
        this.el.classList.add('is-open');
        this.armPointerGuard();
        this.lockBody();
        this.bindViewport();
        this.scheduleLayout();
        this.scheduleFocus(autoFocusEl);
        return new Promise(r => this.resolve = r);
    },

    close(val) {
        if (!this.isOpen || this.isClosing) return;
        Debug.log(`Modal.close val=${val}`);
        this.isClosing = true;
        this.el.classList.add('is-closing');
        this.el.classList.remove('is-open');

        const cleanup = () => {
            this.el.classList.remove('is-closing');
            this.el.classList.remove('full', 'focus-stable');
            this.isOpen = false;
            this.isClosing = false;
            this.isFull = false;
            this._stableFocusMode = false;
            this._lastLayout = null;
            this.clearPointerGuard();
            this.unbindViewport();
            this.unlockBody();
            UI.setGridFrozen(false);
            this.el.style.removeProperty('--modal-vh');
            this.el.style.removeProperty('--modal-top-gap');
            this.el.style.removeProperty('--modal-bottom-gap');
            const resolver = this.resolve;
            this.resolve = null;
            if (resolver) resolver(val);
        };

        if (!State.animations) return cleanup();
        setTimeout(cleanup, 220);
    },

    forceClose(val = false) {
        if (!this.isOpen) return;
        Debug.log(`Modal.forceClose val=${val}`);
        this.el.classList.remove('is-open', 'is-closing', 'full', 'focus-stable');
        this.isOpen = false;
        this.isClosing = false;
        this.isFull = false;
        this._stableFocusMode = false;
        this._lastLayout = null;
        this.clearPointerGuard();
        this.unbindViewport();
        this.unlockBody();
        UI.setGridFrozen(false);
        this.el.style.removeProperty('--modal-vh');
        this.el.style.removeProperty('--modal-top-gap');
        this.el.style.removeProperty('--modal-bottom-gap');
        const resolver = this.resolve;
        this.resolve = null;
        if (resolver) resolver(val);
    },

    alert(msg) { return this.show({ title: '提示', content: msg, btns: [{ text: '确定', type: 'btn-p', val: true }] }); },
    confirm(msg) { return this.show({ title: '确认', content: msg, btns: [{ text: '取消', type: 'btn-c', val: false }, { text: '确定', type: 'btn-p', val: true }] }); },
    prompt(title, val = '', type = 'text') {
        const input = document.createElement('input');
        input.className = 'input-ui';
        input.value = val;
        if (type === 'number') { input.type = 'number'; input.inputMode = 'numeric'; }
        input.enterKeyHint = 'done';
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.isComposing) {
                e.preventDefault();
                this.close(input.value);
            }
        });
        return this.show({
            title, content: input, autoFocusEl: input,
            btns: [
                { text: '取消', type: 'btn-c', val: false },
                { text: '确定', type: 'btn-p', onClick: () => this.close(input.value) }
            ]
        });
    }
};

globalThis.Modal = Modal;
