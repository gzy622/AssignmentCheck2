const $ = id => document.getElementById(id);

const LS = {
    get(k, d) {
        const raw = localStorage.getItem(k);
        if (raw == null) return d;
        try {
            return JSON.parse(raw);
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
    lines: [],
    init() {
        this.el = $('debugPanel');
        this.contentEl = $('debugContent');
        this.enabled = !!LS.get(KEYS.DEBUG, false);
        $('debugClear')?.addEventListener('click', () => this.clear());
        this.apply();

        window.addEventListener('error', e => {
            this.log(`JS Error: ${e.message}`, 'error');
        });
        window.addEventListener('unhandledrejection', e => {
            this.log(`Promise Error: ${e.reason}`, 'error');
        });
    },
    apply() {
        if (!this.el) return;
        this.el.classList.toggle('show', this.enabled);
        const sDebug = $('statusDebug'); if (sDebug) sDebug.textContent = this.enabled ? '开' : '关';
    },
    toggle() {
        this.enabled = !this.enabled;
        LS.set(KEYS.DEBUG, this.enabled);
        if (!this.enabled) this.clear();
        this.apply();
        this.render();
    },
    clear() {
        this.lines = [];
        this.render();
    },
    log(msg, level = 'info') {
        if (!this.enabled || !this.el) return;
        const t = new Date();
        const ts = `${String(t.getMinutes()).padStart(2, '0')}:${String(t.getSeconds()).padStart(2, '0')}.${String(t.getMilliseconds()).padStart(3, '0')}`;
        this.lines.push({ ts, msg, level });
        if (this.lines.length > 50) this.lines.shift();
        this.render();
    },
    render() {
        if (!this.contentEl) return;
        if (!this.enabled) { this.contentEl.innerHTML = ''; return; }
        if (this.lines.length === 0) {
            this.contentEl.innerHTML = '<div style="color:rgba(148,163,184,0.4);text-align:center;margin-top:20px">等待事件...</div>';
            return;
        }

        const frag = document.createDocumentFragment();
        this.lines.forEach(line => {
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
