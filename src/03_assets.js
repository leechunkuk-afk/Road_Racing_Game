/* ==========================================================================
   Assets (M0.5) - 외부 에셋 로드 + 항목별 폴백 판정
   실패해도 throw 하지 않는다. 모든 소비자는 Assets.has(id) 로 갈라선다.
   ========================================================================== */
const Assets = {
  items: {}, order: [], done: 0, total: 0, started: false, finished: false,

  init() {
    this.order = CONFIG.assets.enabled ? CONFIG.assets.list.slice() : [];
    this.total = this.order.length;
    for (const a of this.order) this.items[a.id] = { def: a, state: 'wait', obj: null };
  },

  has(id) { const it = this.items[id]; return !!it && it.state === 'ok'; },
  img(id) { const it = this.items[id]; return it && it.state === 'ok' ? it.obj : null; },
  audio(id) { const it = this.items[id]; return it && it.state === 'ok' ? it.obj : null; },

  // assets/game/ 자체가 없는 환경: 전체 폴백
  allMissing() {
    if (!this.finished) return false;
    for (const k in this.items) if (this.items[k].state === 'ok') return false;
    return true;
  },

  summary() {
    let ok = 0, bad = 0, wait = 0;
    for (const k in this.items) {
      const s = this.items[k].state;
      if (s === 'ok') ok++; else if (s === 'fail') bad++; else wait++;
    }
    return { ok, bad, wait, total: this.total };
  },

  load(onProgress, onDone) {
    this.init();
    this.started = true;
    if (!this.total) { this.finished = true; if (onDone) onDone(this.summary()); return; }

    const base = CONFIG.assets.base;
    const settle = () => {
      this.done++;
      if (onProgress) onProgress(this.done, this.total);
      if (this.done >= this.total) {
        this.finished = true;
        if (onDone) onDone(this.summary());
      }
    };

    for (const a of this.order) {
      const it = this.items[a.id];
      const url = base + a.url;
      try {
        if (a.type === 'img') {
          const im = new Image();
          im.onload = () => { it.state = 'ok'; it.obj = im; settle(); };
          im.onerror = () => { it.state = 'fail'; it.obj = null; settle(); };
          im.src = url;
        } else if (a.type === 'audio') {
          const au = new Audio();
          au.preload = 'auto';
          au.loop = !!(a.loop || /^mus_/.test(a.id) || /^eng\d$/.test(a.id));
          au.addEventListener('canplaythrough', () => { it.state = 'ok'; it.obj = au; settle(); }, { once: true });
          au.addEventListener('error', () => { it.state = 'fail'; it.obj = null; settle(); }, { once: true });
          // 일부 브라우저는 loadeddata 먼저 옴 - 둘 다 허용
          au.addEventListener('loadeddata', () => {
            if (it.state === 'wait' && au.readyState >= 2) { it.state = 'ok'; it.obj = au; settle(); }
          }, { once: true });
          au.src = url;
          if (au.readyState >= 3) { it.state = 'ok'; it.obj = au; }
        }
      } catch (e) { it.state = 'fail'; settle(); }
    }

    // 네트워크 정지/무응답 대비 안전장치
    setTimeout(() => {
      if (!this.finished) {
        for (const k in this.items) if (this.items[k].state !== 'ok') { this.items[k].state = 'fail'; }
        this.done = this.total; this.finished = true;
        if (onProgress) onProgress(this.total, this.total);
        if (onDone) onDone(this.summary());
      }
    }, 9000);
  }
};
