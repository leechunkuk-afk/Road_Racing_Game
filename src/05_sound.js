/* ==========================================================================
   Sound - 외부 사운드(assets/game/sfx,music) 재생 + WebAudio 합성 폴백
   정책: 외부 에셋이 로드됐으면 그것을 쓰고, 없으면 같은 이름의 합성 소리를 낸다.
   file:// 제약 때문에 HTMLAudioElement 를 WebAudio 그래프에 연결하지 않는다.
   ========================================================================== */
const Sound = {
  ctx: null, master: null, sfxGain: null, ready: false, unlocked: false,
  eng: null,            // 엔진 신디사이즈 노드 묶음
  engExt: null,         // 외부 엔진 루프 요소 상태
  skid: null,           // 타이어 스키드 루프
  musicCur: null, musicId: '',
  noiseBuf: null,

  init() {
    this.ext = { eng1: Assets.audio('eng1'), eng2: Assets.audio('eng2'), eng3: Assets.audio('eng3') };
    this.sfxExt = {
      crash1: Assets.audio('crash1'), crash2: Assets.audio('crash2'),
      boost_s: Assets.audio('boost_s'), boost_l: Assets.audio('boost_l'), boost_e: Assets.audio('boost_e')
    };
  },

  // 사용자 제스처 이후에 AudioContext 를 만든다(자동재생 정책)
  ensure() {
    if (this.ready) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    try {
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = CONFIG.audio.master;
      this.master.connect(this.ctx.destination);
      this.sfxGain = this.ctx.createGain();
      this.sfxGain.gain.value = CONFIG.audio.sfx;
      this.sfxGain.connect(this.master);

      const len = Math.floor(this.ctx.sampleRate * 1.2);
      this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
      const d = this.noiseBuf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

      this.ready = true;
      return true;
    } catch (e) { this.ready = false; return false; }
  },

  unlock() {
    this.unlocked = true;
    if (this.ensure() && this.ctx.state === 'suspended') this.ctx.resume();
    if (CONFIG.audio.musicOn) this.music.play();
  },

  setMaster(v) { CONFIG.audio.master = v; if (this.master) this.master.gain.value = v; },

  /* ------------------------------------------------------------- engine -- */
  startEngine() {
    if (!this.ensure()) return;
    this.stopEngine();
    // 외부 루프(eng1/2/3)가 있으면 요소만 시동(볼륨/피치로 rpm 표현)
    this.engExt = null;
    const a = this.ext.eng2 || this.ext.eng1 || this.ext.eng3;
    if (a) {
      try {
        a.loop = true; a.volume = 0; a.currentTime = 0;
        const pr = a.play();
        if (pr && pr.catch) pr.catch(() => {});
        this.engExt = { el: a, which: a === this.ext.eng2 ? 2 : (a === this.ext.eng1 ? 1 : 3), cur: 0 };
      } catch (e) { this.engExt = null; }
    }
    if (!this.engExt) this.buildEngineSynth();
  },

  buildEngineSynth() {
    const c = this.ctx;
    const g = c.createGain(); g.gain.value = 0;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900; lp.Q.value = 6;
    const o1 = c.createOscillator(); o1.type = 'sawtooth';
    const o2 = c.createOscillator(); o2.type = 'square'; o2.frequency.value = 0;
    const g2 = c.createGain(); g2.gain.value = 0.45;
    const sub = c.createOscillator(); sub.type = 'triangle';
    const gs = c.createGain(); gs.gain.value = 0.35;
    o1.connect(lp); o2.connect(g2); g2.connect(lp); sub.connect(gs); gs.connect(lp);
    lp.connect(g); g.connect(this.sfxGain);
    const t = c.currentTime;
    o1.start(t); o2.start(t); sub.start(t);
    // 흡기 소음
    const n = c.createBufferSource(); n.buffer = this.noiseBuf; n.loop = true;
    const nf = c.createBiquadFilter(); nf.type = 'bandpass'; nf.frequency.value = 1400; nf.Q.value = 0.8;
    const ng = c.createGain(); ng.gain.value = 0;
    n.connect(nf); nf.connect(ng); ng.connect(this.sfxGain); n.start(t);
    this.eng = { o1, o2, sub, g, lp, n, ng };
  },

  stopEngine() {
    if (this.eng) {
      try { this.eng.o1.stop(); this.eng.o2.stop(); this.eng.sub.stop(); this.eng.n.stop(); } catch (e) {}
      try { this.eng.g.disconnect(); } catch (e) {}
      this.eng = null;
    }
    if (this.engExt) { try { this.engExt.el.pause(); } catch (e) {} this.engExt = null; }
  },

  /* rpm: 0..1(클러치/기어 반영값), load: 0..1 가속 pedal, on: 시동 여부 */
  engine(rpm, load, boost) {
    if (!this.eng) return;
    const target = CONFIG.audio.engine * (0.30 + 0.70 * rpm) * (boost ? 1.25 : 1);
    if (this.engExt) {
      const e = this.engExt;
      // rpm 구간별로 다른 외부 루프로 갈아타기(단순 페이드)
      const want = rpm < 0.34 ? (this.ext.eng1 || this.ext.eng2 || this.ext.eng3)
                 : rpm < 0.72 ? (this.ext.eng2 || this.ext.eng1 || this.ext.eng3)
                              : (this.ext.eng3 || this.ext.eng2 || this.ext.eng1);
      if (want && want !== e.el) {
        try { want.loop = true; want.currentTime = 0; want.volume = 0; const pr = want.play(); if (pr && pr.catch) pr.catch(() => {}); } catch (err) {}
        try { e.el.volume = 0; e.el.pause(); } catch (err) {}
        e.el = want;
      }
      e.cur = utils.lerp(e.cur, utils.clamp(target, 0, 1), 0.15);
      try { e.el.volume = e.cur * 0.9; e.el.playbackRate = utils.clamp(0.75 + rpm * 0.9, 0.6, 1.9); } catch (err) {}
      return;
    }
    const g = this.eng.g, o1 = this.eng.o1, o2 = this.eng.o2, sub = this.eng.sub;
    const f = 46 + rpm * 190;
    if (this.ctx) {
      const t = this.ctx.currentTime;
      g.gain.setTargetAtTime(target, t, 0.05);
      o1.frequency.setTargetAtTime(f, t, 0.04);
      o2.frequency.setTargetAtTime(f * 1.005, t, 0.04);
      sub.frequency.setTargetAtTime(f * 0.5, t, 0.05);
      this.eng.lp.frequency.setTargetAtTime(500 + rpm * 2600 + load * 900, t, 0.06);
      this.eng.ng.gain.setTargetAtTime(0.012 + rpm * 0.05, t, 0.1);
    }
  },

  /* --------------------------------------------------------- tire skid -- */
  skidNode: null,
  skid(level) {
    if (!this.ensure()) return;
    if (!this.skidNode) {
      const c = this.ctx;
      const n = c.createBufferSource(); n.buffer = this.noiseBuf; n.loop = true;
      const bp = c.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 2100; bp.Q.value = 3.2;
      const g = c.createGain(); g.gain.value = 0;
      n.connect(bp); bp.connect(g); g.connect(this.sfxGain); n.start();
      this.skidNode = { n: n, g: g, bp: bp };
    }
    const v = utils.clamp(level, 0, 1) * 0.16;
    if (this.ctx) this.skidNode.g.gain.setTargetAtTime(v, this.ctx.currentTime, 0.05);
  },

  /* --------------------------------------------------------------- sfx -- */
  sfx(name) {
    const el = this.sfxExt && this.sfxExt[name];
    if (el) { try { el.currentTime = 0; el.volume = CONFIG.audio.sfx; const p = el.play(); if (p && p.catch) p.catch(() => {}); } catch (e) {} return; }
    if (!this.ensure()) return;
    const c = this.ctx, t = c.currentTime;
    if (name === 'crash1' || name === 'crash2') {
      const n = c.createBufferSource(); n.buffer = this.noiseBuf;
      const bp = c.createBiquadFilter(); bp.type = 'bandpass';
      bp.frequency.value = name === 'crash1' ? 850 : 260; bp.Q.value = 0.9;
      const g = c.createGain();
      g.gain.setValueAtTime(0.9, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
      n.connect(bp); bp.connect(g); g.connect(this.sfxGain); n.start(t); n.stop(t + 0.5);
      const o = c.createOscillator(); o.type = 'triangle';
      o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(48, t + 0.3);
      const og = c.createGain(); og.gain.setValueAtTime(0.5, t); og.gain.exponentialRampToValueAtTime(0.001, t + 0.32);
      o.connect(og); og.connect(this.sfxGain); o.start(t); o.stop(t + 0.35);
    } else if (name === 'boost_s') {
      const o = c.createOscillator(); o.type = 'sawtooth';
      o.frequency.setValueAtTime(180, t); o.frequency.exponentialRampToValueAtTime(1500, t + 0.35);
      const g = c.createGain(); g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.35, t + 0.08); g.gain.exponentialRampToValueAtTime(0.001, t + 0.5);
      const hp = c.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 220;
      o.connect(hp); hp.connect(g); g.connect(this.sfxGain); o.start(t); o.stop(t + 0.55);
    } else if (name === 'jump') {
      // 점프: 올라가는 휘파람 + 짧은 둔탁한 소리
      const o = c.createOscillator(); o.type = 'sine';
      o.frequency.setValueAtTime(220, t); o.frequency.exponentialRampToValueAtTime(760, t + 0.28);
      const og = c.createGain(); og.gain.setValueAtTime(0.0001, t);
      og.gain.exponentialRampToValueAtTime(0.28, t + 0.05); og.gain.exponentialRampToValueAtTime(0.001, t + 0.34);
      o.connect(og); og.connect(this.sfxGain); o.start(t); o.stop(t + 0.36);
      const n = c.createBufferSource(); n.buffer = this.noiseBuf;
      const bp = c.createBiquadFilter(); bp.type = 'bandpass';
      bp.frequency.setValueAtTime(400, t); bp.frequency.exponentialRampToValueAtTime(1800, t + 0.25);
      bp.Q.value = 1.4;
      const ng = c.createGain(); ng.gain.setValueAtTime(0.35, t); ng.gain.exponentialRampToValueAtTime(0.001, t + 0.3);
      n.connect(bp); bp.connect(ng); ng.connect(this.sfxGain); n.start(t); n.stop(t + 0.32);
    }
  },

  /* -------------------------------------------------------------- music -- */
  music: {
    play(id) {
      const S = Sound;
      if (!S.ensure()) return;
      const want = id || (Sound.scene === 'race' ? 'mus_race' : 'mus_cruise');
      if (S.musicId === want && S.musicCur) return;
      const el = Assets.audio(want) || Assets.audio('mus_cruise') || Assets.audio('mus_menu');
      if (S.musicCur) { try { S.musicCur.pause(); } catch (e) {} }
      if (el) {
        try {
          el.loop = true; el.currentTime = 0; el.volume = CONFIG.audio.music;
          const p = el.play(); if (p && p.catch) p.catch(() => {});
          S.musicCur = el; S.musicId = want; S.jamStop(); return;
        } catch (e) {}
      }
      S.jamStart();
    },
    stop() {
      const S = Sound;
      if (S.musicCur) { try { S.musicCur.pause(); } catch (e) {} S.musicCur = null; }
      S.jamStop(); S.musicId = '';
    },
    setVol(v) {
      CONFIG.audio.music = v;
      if (Sound.musicCur) { try { Sound.musicCur.volume = v; } catch (e) {} }
      if (Sound.jam && Sound.jam.gain) Sound.jam.gain.gain.value = v * 0.5;
    }
  },

  /* 외부 음악이 없을 때 쓰는 간단한 절차적 루프(베이스+아르페지오) */
  jam: null,
  jamStart() {
    if (!this.ready || this.jam) return;
    const c = this.ctx;
    const g = c.createGain(); g.gain.value = CONFIG.audio.music * 0.5;
    const lp = c.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 2200;
    g.connect(lp); lp.connect(this.master);
    const scale = [55, 65.4, 73.4, 87.3, 98, 110, 130.8, 146.8];
    const st = c.currentTime + 0.1;
    const notes = [];
    for (let b = 0; b < 32; b++) {
      const t = st + b * 0.25;
      const bass = scale[[0, 0, 3, 2][b % 4]];
      const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = bass;
      const og = c.createGain();
      og.gain.setValueAtTime(0.0001, t); og.gain.exponentialRampToValueAtTime(0.5, t + 0.02);
      og.gain.exponentialRampToValueAtTime(0.001, t + 0.23);
      o.connect(og); og.connect(g); o.start(t); o.stop(t + 0.26); notes.push(o);
      if (b % 2 === 0) {
        const a = c.createOscillator(); a.type = 'triangle';
        a.frequency.value = bass * 4 * (1 + (b % 8) / 12);
        const ag = c.createGain();
        ag.gain.setValueAtTime(0.0001, t); ag.gain.exponentialRampToValueAtTime(0.22, t + 0.015);
        ag.gain.exponentialRampToValueAtTime(0.001, t + 0.2);
        a.connect(ag); ag.connect(g); a.start(t); a.stop(t + 0.22); notes.push(a);
      }
    }
    this.jam = { g, notes, next: st + 8 };
    this.jamTimer = setInterval(() => {
      if (!this.jam || !this.ready) return;
      if (this.ctx && this.jam.next < this.ctx.currentTime + 4) this.jamStart0(this.jam.next);
    }, 1000);
  },
  jamStart0(at) {
    const j = this.jam; if (!j) return;
    const c = this.ctx, scale = [55, 65.4, 73.4, 87.3, 98, 110, 130.8, 146.8];
    for (let b = 0; b < 32; b++) {
      const t = at + b * 0.25;
      const bass = scale[[0, 0, 3, 2][b % 4]];
      const o = c.createOscillator(); o.type = 'sawtooth'; o.frequency.value = bass;
      const og = c.createGain();
      og.gain.setValueAtTime(0.0001, t); og.gain.exponentialRampToValueAtTime(0.5, t + 0.02);
      og.gain.exponentialRampToValueAtTime(0.001, t + 0.23);
      o.connect(og); og.connect(j.g); o.start(t); o.stop(t + 0.26); j.notes.push(o);
    }
    j.next = at + 8;
  },
  jamStop() {
    if (this.jamTimer) { clearInterval(this.jamTimer); this.jamTimer = null; }
    if (this.jam) {
      for (const o of this.jam.notes) { try { o.stop(); } catch (e) {} }
      try { this.jam.g.disconnect(); } catch (e) {}
      this.jam = null;
    }
  },

  toggleMusic() {
    CONFIG.audio.musicOn = !CONFIG.audio.musicOn;
    if (CONFIG.audio.musicOn) this.music.play(); else this.music.stop();
    Save.put();
    return CONFIG.audio.musicOn;
  }
};
