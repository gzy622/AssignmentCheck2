const $ = id => document.getElementById(id);

const LS = {
    get(k, d) {
        const raw = localStorage.getItem(k);
        if (raw == null) {
            Debug.log(`[LS.get] key=${k} not found, using default`, 'info');
            return d;
        }
        try {
            const val = JSON.parse(raw);
            Debug.log(`[LS.get] key=${k} success`, 'info');
            return val;
        } catch (err) {
            Debug.log(`[LS.get] key=${k} error=${err.message}`, 'error');
            return d;
        }
    },
    set(k, v) {
        try {
            const nextRaw = JSON.stringify(v);
            if (localStorage.getItem(k) === nextRaw) return;
            localStorage.setItem(k, nextRaw);
            Debug.log(`[LS.set] key=${k} success`, 'info');
        } catch (err) {
            Debug.log(`[LS.set] key=${k} error=${err.message}`, 'error');
        }
    }
};

const KEYS = { DATA: 'tracker_db', LIST: 'tracker_roster', ANIM: 'tracker_anim', DEBUG: 'tracker_debug', PREFS: 'tracker_prefs', DRAFT: 'tracker_recovery_draft' };
const SUBJECT_PRESETS = ['英语', '语文', '数学', '物理', '化学', '其他'];
const IS_ANDROID_FIREFOX = /Android/i.test(navigator.userAgent) && /Firefox/i.test(navigator.userAgent);
const CARD_COLOR_PRESETS = ['#68c490', '#8ecae6', '#f4a261', '#e9c46a', '#c084fc', '#f28482'];

const ColorUtil = {
    clamp(v, min = 0, max = 255) { return Math.max(min, Math.min(max, Math.round(v))); },
    normalizeHex(input, fallback = '#68c490') {
        const raw = String(input || '').trim();
        const short = /^#?([0-9a-f]{3})$/i.exec(raw);
        if (short) {
            const hex = short[1];
            return `#${hex[0]}${hex[0]}${hex[1]}${hex[1]}${hex[2]}${hex[2]}`.toLowerCase();
        }
        const full = /^#?([0-9a-f]{6})$/i.exec(raw);
        return full ? `#${full[1].toLowerCase()}` : fallback;
    },
    hexToRgb(hex) {
        const safe = this.normalizeHex(hex);
        return {
            r: parseInt(safe.slice(1, 3), 16),
            g: parseInt(safe.slice(3, 5), 16),
            b: parseInt(safe.slice(5, 7), 16)
        };
    },
    rgbToHex({ r, g, b }) {
        return `#${[r, g, b].map(v => this.clamp(v).toString(16).padStart(2, '0')).join('')}`;
    },
    mix(hexA, hexB, ratio) {
        const a = this.hexToRgb(hexA);
        const b = this.hexToRgb(hexB);
        const t = Math.max(0, Math.min(1, Number(ratio) || 0));
        return this.rgbToHex({
            r: a.r + (b.r - a.r) * t,
            g: a.g + (b.g - a.g) * t,
            b: a.b + (b.b - a.b) * t
        });
    },
    withAlpha(hex, alpha) {
        const { r, g, b } = this.hexToRgb(hex);
        return `rgba(${r}, ${g}, ${b}, ${Math.max(0, Math.min(1, Number(alpha) || 0))})`;
    }
};

const Toast = {
    el: null,
    timer: 0,
    init() { this.el = $('toast'); },
    show(msg, ms = 1500) {
        if (!this.el) return;
        Debug.log(`[Toast] show: ${msg}`, 'info');
        this.el.textContent = msg;
        this.el.classList.add('show');
        clearTimeout(this.timer);
        this.timer = setTimeout(() => this.el.classList.remove('show'), ms);
    }
};

const Debug = {
    el: null,
    contentEl: null,
    enabled: false,
    interactive: false,
    filter: 'all',
    lines: [],
    _drag: { active: false, x: 0, y: 0, lastX: 0, lastY: 0 },
    init() {
        this.el = $('debugPanel');
        this.contentEl = $('debugContent');
        this.enabled = !!LS.get(KEYS.DEBUG, false);
        
        const bind = (id, fn) => {
            const btn = $(id);
            if (!btn) return;
            btn.onpointerdown = e => e.stopPropagation();
            btn.onclick = fn;
        };
        bind('debugClear', () => this.clear());
        bind('debugLock', () => this.toggleInteractive());
        bind('debugFilter', () => this.toggleFilter());
        bind('debugClose', () => this.toggle());
        
        this.apply();

        if (this.el) {
            this.el.onpointerdown = e => {
                if (!this.interactive || e.target.closest('.debug-actions')) return;
                this._drag.active = true;
                this._drag.x = e.clientX;
                this._drag.y = e.clientY;
                this._drag.lastX = this.el.offsetLeft;
                this._drag.lastY = this.el.offsetTop;
                this.el.setPointerCapture(e.pointerId);
            };
            this.el.onpointermove = e => {
                if (!this._drag.active) return;
                const dx = e.clientX - this._drag.x;
                const dy = e.clientY - this._drag.y;
                this.el.style.left = `${this._drag.lastX + dx}px`;
                this.el.style.top = `${this._drag.lastY + dy}px`;
                this.el.style.right = 'auto';
                this.el.style.bottom = 'auto';
            };
            this.el.onpointerup = e => {
                this._drag.active = false;
                this.el.releasePointerCapture(e.pointerId);
            };
        }

        window.addEventListener('error', e => {
            this.log(`[JS Error] ${e.message} at ${e.filename}:${e.lineno}`, 'error');
        });
        window.addEventListener('unhandledrejection', e => {
            this.log(`[Promise Error] ${e.reason}`, 'error');
        });
        Debug.log('Debug system initialized', 'info');
    },
    apply() {
        if (!this.el) return;
        this.el.classList.toggle('show', this.enabled);
        if (!this.enabled) {
            this.el.style.left = '';
            this.el.style.top = '';
            this.el.style.right = '';
            this.el.style.bottom = '';
        }
        const sDebug = $('statusDebug'); if (sDebug) sDebug.textContent = this.enabled ? '开' : '关';
        if (this.el) {
            this.el.classList.toggle('interactive', this.interactive);
            $('debugLock').textContent = this.interactive ? '🔓' : '🔒';
            this.updateFilterUI();
        }
    },
    toggle() {
        this.enabled = !this.enabled;
        LS.set(KEYS.DEBUG, this.enabled);
        if (!this.enabled) {
            this.clear();
            this.interactive = false;
        }
        this.apply();
        this.render();
    },
    toggleInteractive() {
        this.interactive = !this.interactive;
        this.el?.classList.toggle('interactive', this.interactive);
        $('debugLock').textContent = this.interactive ? '🔓' : '🔒';
        Debug.log(`Debug interactive=${this.interactive}`, 'info');
    },
    toggleFilter() {
        const levels = ['all', 'info', 'warn', 'error'];
        const idx = levels.indexOf(this.filter);
        this.filter = levels[(idx + 1) % levels.length];
        this.updateFilterUI();
        this.render();
        Debug.log(`Filter changed to: ${this.filter}`, 'info');
    },
    updateFilterUI() {
        const btn = $('debugFilter');
        if (!btn) return;
        const icons = { all: '🏷️', info: 'ℹ️', warn: '⚠️', error: '❌' };
        btn.textContent = icons[this.filter] || '🏷️';
        btn.title = `筛选: ${this.filter}`;
    },
    clear() {
        this.lines = [];
        this.render();
        Debug.log('Logs cleared', 'info');
    },
    log(msg, level = 'info') {
        if (!this.enabled || !this.el) return;
        const t = new Date();
        const ts = `${String(t.getMinutes()).padStart(2, '0')}:${String(t.getSeconds()).padStart(2, '0')}.${String(t.getMilliseconds()).padStart(3, '0')}`;
        this.lines.push({ ts, msg, level });
        if (this.lines.length > 200) this.lines.shift();
        this.render();
    },
    render() {
        if (!this.contentEl) return;
        if (!this.enabled) { this.contentEl.innerHTML = ''; return; }
        
        const filtered = this.filter === 'all' 
            ? this.lines 
            : this.lines.filter(l => l.level === this.filter);

        if (filtered.length === 0) {
            this.contentEl.innerHTML = `<div style="color:rgba(148,163,184,0.4);text-align:center;margin-top:20px">${this.filter === 'all' ? '等待事件...' : '无匹配日志'}</div>`;
            return;
        }

        const frag = document.createDocumentFragment();
        filtered.forEach(line => {
            const div = document.createElement('div');
            div.className = 'debug-line';
            div.innerHTML = `<span class="debug-ts">${line.ts}</span><span class="debug-lvl-${line.level}">${line.msg}</span>`;
            frag.appendChild(div);
        });
        this.contentEl.innerHTML = '';
        this.contentEl.appendChild(frag);
        this.contentEl.scrollTop = this.contentEl.scrollHeight;
    }
};

Object.assign(globalThis, {
    $,
    LS,
    KEYS,
    SUBJECT_PRESETS,
    IS_ANDROID_FIREFOX,
    CARD_COLOR_PRESETS,
    ColorUtil,
    Toast,
    Debug
});
