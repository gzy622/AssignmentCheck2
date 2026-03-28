const Modal = {
    el: $('modal'),
    card: $('modal').querySelector('.modal-card'),
    title: $('modal').querySelector('.modal-title'),
    body: $('modal').querySelector('.modal-body'),
    footer: $('modal').querySelector('.modal-footer'),
    closeBtn: $('modal').querySelector('.modal-close'),
    header: $('modal').querySelector('.modal-header'),
    isOpen: false, isClosing: false, isFull: false, resolve: null,
    FULL_EXIT_MS: 260,
    PAGE_EXIT_MS: 220,
    _scrollY: 0, _layoutRaf: 0, _enterRafA: 0, _enterRafB: 0, _viewportHandler: null, _focusHandler: null, _focusTimer: 0, _pointerGuardTimer: 0, _stableFocusMode: false, _lastLayout: null,

    init() {
        this.closeBtn.onclick = () => { if (Debug.enabled) Debug.log('点击关闭按钮'); this.close(false); };
        document.addEventListener('keydown', e => { if (e.key === 'Escape') this.isOpen ? this.close(false) : BackHandler.closeOverlayLikeEsc(); });
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
        const a = document.activeElement;
        if (a && a !== document.body && a.matches?.('input, textarea, select, [contenteditable="true"]')) a.blur();
    },

    scheduleFocus(el) {
        clearTimeout(this._focusTimer);
        if (!el) return;
        this._focusTimer = setTimeout(() => {
            this._focusTimer = 0;
            if (this.isOpen) el.focus({ preventScroll: true });
        }, IS_ANDROID_FIREFOX && el.matches?.('input, textarea, [contenteditable="true"]') ? 180 : 60);
    },

    armPointerGuard(ms = 320) {
        clearTimeout(this._pointerGuardTimer);
        this.el.style.pointerEvents = 'none';
        this._pointerGuardTimer = setTimeout(() => {
            this._pointerGuardTimer = 0;
            if (this.isOpen && !this.isClosing) this.el.style.pointerEvents = '';
        }, ms);
    },

    buildPagePanel(title, content, btns = []) {
        const root = document.createElement('div');
        root.className = 'st-layout';
        root.style.cssText = 'display:flex;flex-direction:column;flex:1;min-height:0';
        root.appendChild(ActionViews.createNav(title, () => this.close(false)));

        const scroll = document.createElement('div');
        scroll.className = 'st-scroll-area';
        const section = document.createElement('section');
        section.className = 'modal-page-section';
        if (typeof content === 'string') {
            const t = document.createElement('div'); t.className = 'modal-page-text'; t.textContent = content; section.appendChild(t);
        } else section.appendChild(content);

        if (btns.length) {
            const actions = document.createElement('div');
            actions.className = 'modal-page-actions';
            btns.forEach(b => {
                const btn = document.createElement('button');
                btn.className = `btn ${b.type || 'btn-c'}`;
                btn.textContent = b.text;
                btn.onclick = () => b.onClick ? b.onClick() : this.close(b.val);
                actions.appendChild(btn);
            });
            section.appendChild(actions);
        }
        scroll.appendChild(section);
        root.appendChild(scroll);
        return root;
    },

    bindViewport() {
        this.unbindViewport();
        this._viewportHandler = () => this.scheduleLayout();
        this._focusHandler = () => { if (!this._stableFocusMode) this.scheduleLayout(); };
        window.addEventListener('resize', this._viewportHandler, { passive: true });
        if (window.visualViewport) window.visualViewport.addEventListener('resize', this._viewportHandler, { passive: true });
        if (!this._stableFocusMode) document.addEventListener('focusin', this._focusHandler);
    },

    unbindViewport() {
        if (this._viewportHandler) {
            window.removeEventListener('resize', this._viewportHandler);
            if (window.visualViewport) window.visualViewport.removeEventListener('resize', this._viewportHandler);
            this._viewportHandler = null;
        }
        if (this._focusHandler) { document.removeEventListener('focusin', this._focusHandler); this._focusHandler = null; }
        cancelAnimationFrame(this._layoutRaf || 0); this._layoutRaf = 0;
        clearTimeout(this._focusTimer); this._focusTimer = 0;
    },

    cancelEnterTransition() {
        cancelAnimationFrame(this._enterRafA || 0);
        cancelAnimationFrame(this._enterRafB || 0);
        this._enterRafA = 0;
        this._enterRafB = 0;
    },

    stageOpenTransition() {
        this.cancelEnterTransition();
        this.el.classList.add('is-preopen');
        this._enterRafA = requestAnimationFrame(() => {
            this._enterRafA = 0;
            this._enterRafB = requestAnimationFrame(() => {
                this._enterRafB = 0;
                if (!this.isOpen || this.isClosing) return;
                this.el.classList.remove('is-preopen');
                this.el.classList.add('is-open');
            });
        });
    },

    scheduleLayout() { if (this.isOpen) { cancelAnimationFrame(this._layoutRaf || 0); this._layoutRaf = requestAnimationFrame(() => this.updateLayout()); } },

    updateLayout() {
        if (!this.isOpen) return;
        const vv = window.visualViewport, vpH = Math.round(vv ? vv.height : window.innerHeight);
        let top, bot;
        if (this._stableFocusMode) {
            top = bot = 0;
        } else {
            const vpT = Math.round(vv ? vv.offsetTop : 0);
            const kbd = Math.max(0, Math.round(window.innerHeight - (vv ? vv.height + vv.offsetTop : window.innerHeight)));
            top = vpT; bot = kbd;
        }
        if (this._lastLayout && this._lastLayout.vpH === vpH && this._lastLayout.top === top && this._lastLayout.bot === bot) return;
        this._lastLayout = { vpH, top, bot };
        const s = this.el.style;
        s.setProperty('--modal-vh', `${vpH}px`);
        s.setProperty('--modal-top-gap', `${top}px`);
        s.setProperty('--modal-bottom-gap', `${bot}px`);
    },

    show({ title, content, type = 'normal', btns = [], autoFocusEl = null }) {
        if (this.isOpen) this.forceClose(false);
        UI.setGridFrozen(true);
        this.releaseActiveInput();
        const usePage = type !== 'full';
        const isFullScreen = !usePage;
        this.title.textContent = title || '';
        this.body.innerHTML = '';
        this.body.appendChild(usePage ? this.buildPagePanel(title, content, btns) : (typeof content === 'string' ? (this.body.innerHTML = content, this.body.firstChild) : content));

        this.isFull = isFullScreen;
        this.el.className = `${isFullScreen ? 'full' : 'page'}`;
        this._stableFocusMode = IS_ANDROID_FIREFOX && autoFocusEl?.matches?.('input, textarea, [contenteditable="true"]');
        if (this._stableFocusMode) this.el.classList.add('focus-stable');

        // Apply lite transitions for Android devices to improve animation performance
        if (isFullScreen && Device.useLiteFullscreenTransitions()) {
            document.body.classList.add('lite-transitions');
        }
        this.header.style.display = 'none';
        this.footer.innerHTML = '';
        this.footer.style.display = !usePage && btns.length ? 'flex' : 'none';

        if (!usePage) {
            btns.forEach(b => {
                const btn = document.createElement('button');
                btn.className = `btn ${b.type || 'btn-c'}`;
                btn.textContent = b.text;
                btn.onclick = () => b.onClick ? b.onClick() : this.close(b.val);
                this.footer.appendChild(btn);
            });
        }

        if (Debug.enabled) Debug.log(`Modal.show type=${type} stable=${this._stableFocusMode ? 1 : 0}`);
        this.isClosing = false; this.isOpen = true; this._lastLayout = null;
        this.stageOpenTransition();
        // Use shorter pointer guard for lite transitions on Android
        const pointerGuardMs = (this.isFull && Device.useLiteFullscreenTransitions()) ? 240 : (this.isFull ? 360 : 280);
        this.armPointerGuard(pointerGuardMs); this.lockBody(); this.bindViewport(); this.scheduleLayout(); this.scheduleFocus(autoFocusEl);
        return new Promise(r => this.resolve = r);
    },

    _cleanup(val) {
        this.cancelEnterTransition();
        this.el.classList.remove('is-preopen', 'is-open', 'is-closing', 'full', 'page', 'focus-stable');
        this.isOpen = this.isClosing = this.isFull = this._stableFocusMode = false;
        this._lastLayout = null;
        clearTimeout(this._pointerGuardTimer); this.el.style.pointerEvents = '';
        document.body.classList.remove('lite-transitions');
        this.unbindViewport(); this.unlockBody(); UI.setGridFrozen(false);
        const r = this.resolve; this.resolve = null; if (r) r(val);
    },

    close(val) {
        if (!this.isOpen || this.isClosing) return;
        this.cancelEnterTransition();
        if (this.el.classList.contains('is-preopen') && !this.el.classList.contains('is-open')) return this._cleanup(val);
        this.isClosing = true;
        this.el.classList.remove('is-preopen');
        this.el.classList.add('is-closing');
        this.el.classList.remove('is-open');
        if (!State.animations) return this._cleanup(val);
        // Use shorter exit duration for lite transitions on Android
        const exitMs = (this.isFull && Device.useLiteFullscreenTransitions()) ? 180 : (this.isFull ? this.FULL_EXIT_MS : this.PAGE_EXIT_MS);
        setTimeout(() => this._cleanup(val), exitMs);
    },

    forceClose(val = false) { if (this.isOpen) this._cleanup(val); },

    alert(msg) { return this.show({ title: '提示', content: msg, btns: [{ text: '确定', type: 'btn-p', val: true }] }); },
    confirm(msg) { return this.show({ title: '确认', content: msg, btns: [{ text: '取消', type: 'btn-c', val: false }, { text: '确定', type: 'btn-p', val: true }] }); },
    prompt(title, val = '', type = 'text') {
        const input = document.createElement('input');
        input.className = 'input-ui'; input.value = val;
        if (type === 'number') { input.type = 'number'; input.inputMode = 'numeric'; }
        input.enterKeyHint = 'done';
        input.addEventListener('keydown', e => { if (e.key === 'Enter' && !e.isComposing) { e.preventDefault(); this.close(input.value); } });
        return this.show({ title, content: input, autoFocusEl: input, btns: [{ text: '取消', type: 'btn-c', val: false }, { text: '确定', type: 'btn-p', onClick: () => this.close(input.value) }] });
    }
};

globalThis.Modal = Modal;
