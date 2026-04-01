const BackHandler = {
    EXIT_WINDOW_MS: 1500,
    _sentinelHash: '#__tracker_back_guard__',
    _lastBackAt: 0,
    _lastSignalAt: 0,
    _suppressOnce: false,
    _guardReady: false,
    _enabled: location.protocol !== 'file:',
    init() {
        if (!this._enabled) return;
        this.armGuards();
        window.addEventListener('popstate', () => this.onBackSignal());
        window.addEventListener('hashchange', () => this.onHashChange());
    },
    armGuards() {
        if (location.hash !== this._sentinelHash) location.hash = this._sentinelHash;
        if (this._guardReady) return;
        history.pushState({ __trackerGuard__: true, t: Date.now() }, '');
        this._guardReady = true;
    },
    onHashChange() {
        if (this._suppressOnce) {
            this._suppressOnce = false;
            return;
        }
        if (location.hash === this._sentinelHash) return;
        this.onBackSignal();
    },
    closeOverlayLikeEsc() {
        if (Modal.isOpen) {
            Modal.close(false);
            return true;
        }
        const menu = $('menu');
        if (menu.classList.contains('show')) {
            menu.classList.remove('show');
            return true;
        }
        return false;
    },
    onBackSignal() {
        const now = Date.now();
        if (now - this._lastSignalAt < 80) return;
        this._lastSignalAt = now;
        if (this._suppressOnce) {
            this._suppressOnce = false;
            return;
        }
        if (this.closeOverlayLikeEsc()) {
            this.rearm();
            return;
        }
        if (now - this._lastBackAt <= this.EXIT_WINDOW_MS) {
            this.exitPage();
            return;
        }
        this._lastBackAt = now;
        Toast.show('再按一次返回退出');
        this.rearm();
    },
    rearm() {
        if (!this._enabled) return;
        setTimeout(() => {
            if (location.hash !== this._sentinelHash) location.hash = this._sentinelHash;
            history.pushState({ __trackerGuard__: true, t: Date.now() }, '');
            this._guardReady = true;
        }, 0);
    },
    exitPage() {
        if (!this._enabled) return;
        this._suppressOnce = true;
        history.back();
        setTimeout(() => {
            if (!document.hidden) window.close();
        }, 120);
    }
};

globalThis.BackHandler = BackHandler;
