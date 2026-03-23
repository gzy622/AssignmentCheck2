const $ = id => document.getElementById(id);

const LS = {
    _log(action, key, err) {
        const msg = `[LS.${action}] key=${key}${err ? ` error=${err.message}` : ''}`;
        if (typeof Debug !== 'undefined' && Debug.enabled) Debug.log(msg);
        else if (err || action === 'get') console.warn(msg);
    },
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
            this._log('get', k, err);
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
            this._log('set', k, err);
        }
    }
};

const KEYS = { DATA: 'tracker_db', LIST: 'tracker_roster', ANIM: 'tracker_anim', DEBUG: 'tracker_debug', PREFS: 'tracker_prefs', DRAFT: 'tracker_recovery_draft' };
const SUBJECT_PRESETS = ['英语', '语文', '数学', '物理', '化学', '其他'];
const IS_ANDROID_FIREFOX = /Android/i.test(navigator.userAgent) && /Firefox/i.test(navigator.userAgent);
const CARD_COLOR_PRESETS = ['#68c490', '#8ecae6', '#f4a261', '#e9c46a', '#c084fc', '#f28482'];
const APP_NAME_SLUG = 'assignmentcheck2';
const DEFAULT_ROSTER = [
    '01 蓝慧婷', '02 陈静', '03 李智豪', '04 朱佑豪', '05 张伟芬',
    '06 许俊熠', '07 李凤君', '08 黄文涛', '09 黄泺绮', '10 利子见',
    '11 蔡嘉乐', '12 刘静娴', '13 蓝烽', '14 张思琪', '15 卢佳慧',
    '16 钟佳渝', '17 叶帆', '18 吴梦婷', '19 彭文佳', '20 吴思静',
    '21 刘嘉莹', '22 温秋茹', '23 李乐', '24 温沁钰', '25 林思婷',
    '26 巫依霞', '27 刘雅淇', '28 侯润楹', '29 叶塘美', '30 黄宇凡',
    '31 叶煌', '32 张清雅', '33 杨梓豪', '34 王政铭', '35 陈圆',
    '36 刘斌', '37 丘雅莹', '38 罗燕', '39 何苑琦', '40 赵玉婷',
    '41 曾宝茹', '42 张栩瑜', '43 李孝霖', '44 杨欢', '45 彭嘉红',
    '46 丘瑜诗', '47 李欣', '48 吴嘉钰', '49 刘依婷', '50 曾誉宸'
];

const ColorUtil = {
    clamp(v, min = 0, max = 255) { return Math.max(min, Math.min(max, Math.round(v))); },
    normalizeHex(hex, fallback = '#68c490') {
        return this.rgbToHex(this.hexToRgb(hex, fallback));
    },
    hexToRgb(hex, fallback = '#68c490') {
        const raw = String(hex || '').trim().replace(/^#/, '').toLowerCase();
        let r, g, b;
        if (raw.length === 3) {
            [r, g, b] = [0, 1, 2].map(i => parseInt(raw[i] + raw[i], 16));
        } else if (raw.length === 6) {
            [r, g, b] = [0, 2, 4].map(i => parseInt(raw.slice(i, i + 2), 16));
        } else {
            const fb = this.hexToRgb(fallback, '#68c490');
            return fb;
        }
        return isNaN(r) || isNaN(g) || isNaN(b) ? this.hexToRgb(fallback, '#68c490') : { r, g, b };
    },
    rgbToHex({ r, g, b }) {
        return `#${[r, g, b].map(v => this.clamp(v).toString(16).padStart(2, '0')).join('')}`;
    },
    mix(hexA, hexB, ratio) {
        const a = this.hexToRgb(hexA), b = this.hexToRgb(hexB);
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

const formatBackupFileName = (date = new Date()) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    const hh = String(date.getHours()).padStart(2, '0');
    const mm = String(date.getMinutes()).padStart(2, '0');
    const ss = String(date.getSeconds()).padStart(2, '0');
    return `${APP_NAME_SLUG}_backup_${y}${m}${d}_${hh}${mm}${ss}.json`;
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
        if (!this.enabled || !this.el || !this.contentEl) return;
        const filtered = this.filter === 'all' ? this.lines : this.lines.filter(l => l.level === this.filter);
        if (filtered.length === 0) {
            this.contentEl.innerHTML = '<div style="opacity:0.5;padding:10px;text-align:center">暂无日志</div>';
            return;
        }
        const frag = document.createDocumentFragment();
        filtered.forEach(l => {
            const div = document.createElement('div');
            div.className = `debug-line debug-line-${l.level}`;
            div.innerHTML = `<span class="debug-ts">${l.ts}</span><span class="debug-msg">${l.msg}</span>`;
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
    APP_NAME_SLUG,
    ColorUtil,
    formatBackupFileName,
    Toast,
    Debug
});
