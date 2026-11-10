/* ==========================================================================
   utils / Screen / Input / Save
   ========================================================================== */
const utils = {
  clamp: (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v),
  lerp: (a, b, t) => a + (b - a) * t,
  /* 시드 하나에서 0..1 결정론적 값(패치/무늬 모양을 코스 전체에서 고정하기 위해) */
  hash01: (i) => { const x = Math.sin(i * 127.1 + 11.7) * 43758.5453; return x - Math.floor(x); },
  interpolate: (a, b, t) => utils.lerp(a, b, t),
  easeIn: (a, b, p) => a + (b - a) * Math.pow(p, 2),
  easeOut: (a, b, p) => a + (b - a) * (1 - Math.pow(1 - p, 2)),
  easeInOut: (a, b, p) => a + (b - a) * (-Math.cos(p * Math.PI) / 2 + 0.5),
  exponentialFog: (d, density) => 1 / Math.pow(Math.E, (d * d * density)),
  inc: (start, inc, max) => { let r = start + inc; if (r > max) r -= max; if (r < 0) r += max; return r; },
  percentRemaining: (n, total) => (n % total) / total,

  // 결정적 난수 (코스 생성 재현 가능)
  mulberry32: function (seed) {
    let a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) >>> 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  },

  overlap(x1, w1, x2, w2, pct) {
    const half = pct === undefined ? 0.5 : pct;
    const min1 = x1 - w1 * half, max1 = x1 + w1 * half;
    const min2 = x2 - w2 * half, max2 = x2 + w2 * half;
    return !((max1 < min2) || (min1 > max2));
  },

  fmtTime(ms) {
    if (!isFinite(ms) || ms <= 0) return '--:--.--';
    const m = Math.floor(ms / 60000), s = Math.floor((ms % 60000) / 1000), c = Math.floor((ms % 1000) / 10);
    return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0') + '.' + String(c).padStart(2, '0');
  },

  project(p, camX, camY, camZ, camDepth, width, height, roadWidth) {
    p.camera.x = (p.world.x || 0) - camX;
    p.camera.y = (p.world.y || 0) - camY;
    p.camera.z = (p.world.z || 0) - camZ;
    p.screen.scale = camDepth / p.camera.z;
    p.screen.x = Math.round((width / 2) + (p.screen.scale * p.camera.x * width / 2));
    p.screen.y = Math.round((height / 2) - (p.screen.scale * p.camera.y * height / 2));
    p.screen.w = Math.round(p.screen.scale * roadWidth * width / 2);
  }
};

/* ---------------------------------------------------------------- canvas -- */
const SCR = {
  canvas: null, ctx: null, w: SCREEN.w, h: SCREEN.h, dpr: 1, scale: 1,
  init() {
    this.canvas = document.getElementById('game');
    this.ctx = this.canvas.getContext('2d');
    this.fit();
    window.addEventListener('resize', () => this.fit());
  },
  fit() {
    const wrap = document.getElementById('wrap');
    const aw = wrap.clientWidth, ah = wrap.clientHeight;
    const s = Math.min(aw / this.w, ah / this.h);
    this.dpr = Math.min(2, window.devicePixelRatio || 1);
    this.canvas.width = Math.round(this.w * this.dpr);
    this.canvas.height = Math.round(this.h * this.dpr);
    this.canvas.style.width = Math.round(this.w * s) + 'px';
    this.canvas.style.height = Math.round(this.h * s) + 'px';
    this.scale = s;
    this.ctx.setTransform(this.dpr, 0, 0, this.dpr, 0, 0);
    this.ctx.imageSmoothingEnabled = true;
    const st = document.getElementById('stage');
    st.style.width = this.canvas.style.width;
    st.style.height = this.canvas.style.height;
  }
};

/* ---------------------------------------------------------------- input -- */
const Input = {
  keys: {}, pressed: {}, pad: null, padPrev: {},
  MAP: {
    ArrowUp: 'up', KeyW: 'up', ArrowDown: 'down', KeyS: 'down',
    ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right',
    Space: 'hand', ShiftLeft: 'boost', ShiftRight: 'boost',
    KeyC: 'cam', KeyR: 'reset', KeyM: 'music', Escape: 'esc', Enter: 'enter',
    Digit1: 'k1', Digit2: 'k2', Digit3: 'k3', Digit4: 'k4', F1: 'k1', F2: 'k2'
  },
  init() {
    window.addEventListener('keydown', (e) => this.onKey(e, true));
    window.addEventListener('keyup', (e) => this.onKey(e, false));
    window.addEventListener('blur', () => { this.keys = {}; });
  },
  onKey(e, down) {
    const name = this.MAP[e.code];
    if (!name) return;
    if (['ArrowUp','ArrowDown','ArrowLeft','ArrowRight','Space'].indexOf(e.code) >= 0) e.preventDefault();
    if (down && !this.keys[name]) this.pressed[name] = true;
    this.keys[name] = down;
  },
  down(n) { return !!this.keys[n]; },
  hit(n) { if (this.pressed[n]) { this.pressed[n] = false; return true; } return false; },
  endFrame() { this.pressed = {}; },

  pollPad() {
    if (!navigator.getGamepads) return;
    const pads = navigator.getGamepads();
    for (let i = 0; i < pads.length; i++) {
      const p = pads[i]; if (!p) continue;
      this.pad = p;
      const ax = p.axes[0] || 0, up = p.buttons[15] && p.buttons[15].pressed, dn = p.buttons[14] && p.buttons[14].pressed;
      const lf = p.buttons[12] && p.buttons[12].pressed, rt = p.buttons[13] && p.buttons[13].pressed;
      const gas = p.buttons[0] && p.buttons[0].pressed, brk = p.buttons[1] && p.buttons[1].pressed;
      const hand = p.buttons[2] && p.buttons[2].pressed, bst = p.buttons[7] && p.buttons[7].pressed;
      if (up || gas) this.keys.up = true;
      if (dn || brk) this.keys.down = true;
      if (lf || ax < -0.35) this.keys.left = true;
      if (rt || ax > 0.35) this.keys.right = true;
      if (hand) this.keys.hand = true;
      if (bst) this.keys.boost = true;
      if (p.buttons[3] && p.buttons[3].pressed && !this.padPrev.start) this.pressed.esc = true;
      this.padPrev.start = p.buttons[3] && p.buttons[3].pressed;
      break;
    }
  }
};

/* ------------------------------------------------------------ save(설정) -- */
const Save = {
  KEY: 'nightdrive.settings.v1',
  data: { musicOn: true, cam: 'chase', quality: 'high', volume: 0.85, seen: {},
          carColor: CONFIG.car.sprites.paletteDefault },
  load() {
    try {
      const raw = localStorage.getItem(this.KEY);
      if (raw) Object.assign(this.data, JSON.parse(raw));
    } catch (e) { /* file:// 등에서 실패해도 기본값으로 진행 */ }
    CONFIG.audio.musicOn = this.data.musicOn;
    return this.data;
  },
  put() {
    try {
      this.data.musicOn = CONFIG.audio.musicOn;
      localStorage.setItem(this.KEY, JSON.stringify(this.data));
    } catch (e) {}
  }
};

/* --------------------------------------------------------------- toast -- */
const Toast = {
  el: null, t: 0,
  show(msg, ms) {
    if (!this.el) this.el = document.getElementById('toast');
    if (!this.el) return;
    this.el.textContent = msg;
    this.el.style.opacity = '1';
    clearTimeout(this.t);
    this.t = setTimeout(() => { this.el.style.opacity = '0'; }, ms || 1600);
  }
};
