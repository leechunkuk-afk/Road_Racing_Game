/* ==========================================================================
   Render - 2.5D 유사 3D 렌더러 (OutRun/GTA1 계열 세그먼트 프로젝션)
   FX 는 동일한 파일에 둔다(파티클/스키드마크/디브리).
   ========================================================================== */
const FX = {
  parts: [], skids: [],
  smoke(z, x, n) {
    if (Physics.fx.particles.length > CONFIG.fx.maxParticles) return;
    for (let i = 0; i < (n || 1); i++) {
      Physics.fx.particles.push({
        x: x + (Math.random() - 0.5) * 0.22, z: z + Math.random() * 60,
        vx: (Math.random() - 0.5) * 0.25, vz: 60 + Math.random() * 120, vy: 40 + Math.random() * 70,
        y: 4, life: 0.55 + Math.random() * 0.5, t: 0, kind: 'smoke', size: 90 + Math.random() * 90
      });
    }
  },
  debris(offset, kind) {
    for (let i = 0; i < 14; i++) {
      Physics.fx.particles.push({
        x: offset + (Math.random() - 0.5) * 0.3, z: Physics.player.z + Math.random() * 100,
        vx: (Math.random() - 0.5) * 1.6, vz: -200 + Math.random() * 400, vy: 120 + Math.random() * 260,
        y: 20 + Math.random() * 40, life: 0.7 + Math.random() * 0.7, t: 0, kind: 'debris',
        size: 14 + Math.random() * 22, col: kind === 'barrel' ? '#c8394a' : '#8d97a5'
      });
    }
  },
  sparks(x) {
    for (let i = 0; i < 6; i++) {
      Physics.fx.particles.push({
        x: x, z: Physics.player.z + 40, vx: (Math.random() - 0.5) * 2, vz: -100 - Math.random() * 200,
        vy: 60 + Math.random() * 120, y: 10, life: 0.3, t: 0, kind: 'spark', size: 8
      });
    }
  },
  skid(z, x, steer) {
    if (Physics.fx.skidmarks.length > 400) Physics.fx.skidmarks.shift();
    Physics.fx.skidmarks.push({ z: z, x: x, w: 0.16, a: utils.clamp(Math.abs(steer), 0.2, 1) });
  },
  update(dt, p) {
    const ps = Physics.fx.particles;
    for (let i = ps.length - 1; i >= 0; i--) {
      const q = ps[i];
      q.t += dt;
      if (q.t >= q.life) { ps.splice(i, 1); continue; }
      q.z += q.vz * dt; q.x += q.vx * dt * 0.15;
      if (q.kind !== 'smoke') {
        q.vy -= 700 * dt; q.y += q.vy * dt;
        if (q.y < 0) { q.y = 0; q.vy *= -0.35; q.vx *= 0.6; q.vz *= 0.6; }
      } else {
        q.y += q.vy * dt; q.vy *= 0.92; q.size += 90 * dt;
      }
    }
    // 스키드마크는 뒤로 밀리면 제거
    const sk = Physics.fx.skidmarks;
    while (sk.length && Math.abs(utils.lapDiff(sk[0].z, p.z, Road.trackLength)) > 2600) sk.shift();
  }
};
utils.lapDiff = function (a, b, total) {
  let d = a - b;
  while (d > total / 2) d -= total;
  while (d < -total / 2) d += total;
  return d;
};

/* =========================================================== renderer === */
const Render = {
  W: 0, H: 0, ctx: null,
  skyCache: null, vigCache: null, lampSprite: null,
  camY: 0, camZ: 0, camX: 0, camDepth: 0,
  segColors: {}, _fogTint: null,

  init() {
    this.ctx = SCR.ctx; this.W = SCR.w; this.H = SCR.h;
    this.buildSky();
    this.buildVignette();
    return this;
  },

  /* ---------------------------------------------- 배경(하늘/스카이라인) -- */
  buildSky() {
    const c = document.createElement('canvas');
    c.width = this.W; c.height = this.H;
    const g = c.getContext('2d');
    const gr = g.createLinearGradient(0, 0, 0, this.H);
    gr.addColorStop(0, PALETTE.skyTop);
    gr.addColorStop(0.42, PALETTE.skyMid);
    gr.addColorStop(0.58, PALETTE.horizon);
    gr.addColorStop(1, '#0a0f1a');
    g.fillStyle = gr; g.fillRect(0, 0, this.W, this.H);
    // 별
    const rnd = utils.mulberry32(4242);
    for (let i = 0; i < 190; i++) {
      const x = rnd() * this.W, y = rnd() * this.H * 0.42;
      const a = 0.15 + rnd() * 0.55;
      g.fillStyle = 'rgba(200,225,255,' + a.toFixed(2) + ')';
      g.fillRect(x, y, 1.2, 1.2);
    }
    // 달
    const mg = g.createRadialGradient(this.W * 0.78, this.H * 0.16, 4, this.W * 0.78, this.H * 0.16, 90);
    mg.addColorStop(0, 'rgba(255,245,220,0.95)');
    mg.addColorStop(0.22, 'rgba(255,238,205,0.55)');
    mg.addColorStop(1, 'rgba(255,230,190,0)');
    g.fillStyle = mg; g.beginPath(); g.arc(this.W * 0.78, this.H * 0.16, 90, 0, Math.PI * 2); g.fill();
    // 도시 글로우(지평선)
    const hg = g.createLinearGradient(0, this.H * 0.40, 0, this.H * 0.60);
    hg.addColorStop(0, 'rgba(255,120,90,0.05)');
    hg.addColorStop(0.6, 'rgba(120,90,200,0.10)');
    hg.addColorStop(1, 'rgba(20,30,50,0)');
    g.fillStyle = hg; g.fillRect(0, this.H * 0.40, this.W, this.H * 0.22);
    this.skyCache = c;
  },

  buildVignette() {
    const c = document.createElement('canvas');
    c.width = this.W; c.height = this.H;
    const g = c.getContext('2d');
    const rg = g.createRadialGradient(this.W / 2, this.H * 0.52, this.H * 0.28, this.W / 2, this.H * 0.52, this.H * 0.95);
    rg.addColorStop(0, 'rgba(0,0,0,0)');
    rg.addColorStop(1, 'rgba(0,0,0,0.62)');
    g.fillStyle = rg; g.fillRect(0, 0, this.W, this.H);
    this.vigCache = c;
  },

  /* --------------------------------------------------------- 프레임 -- */
  frame() {
    const g = this.ctx, W = this.W, H = this.H;
    const p = Physics.player, cam = Physics.cam;
    this.camDepth = cam.depth;

    g.setTransform(SCR.dpr, 0, 0, SCR.dpr, 0, 0);
    g.clearRect(0, 0, W, H);

    // 카메라 흔들림
    const sh = cam.shake;
    const sx = sh ? (Math.random() - 0.5) * sh : 0;
    const sy = sh ? (Math.random() - 0.5) * sh : 0;
    g.save();
    g.translate(sx, sy);

    const base = Road.findSegment(p.z);
    const basePct = utils.percentRemaining(p.z, CONFIG.road.segLen);
    const playerSeg = Road.findSegment(p.z + this.playerZ());
    const playerY = utils.interpolate(playerSeg.p1.world.y, playerSeg.p2.world.y, basePct);

    // Jake Gordon 식: 카메라는 플레이어 z 에 두고, 카메라 높이가 시선을 만든다.
    this.camX = p.x * CONFIG.road.width;
    this.camY = CONFIG.camera.height + playerY + (cam.bob || 0);
    this.camZ = p.z;

    /* 배경 */
    this.drawBackground(base, playerSeg);

    /* 도로 + 소품 */
    this.drawRoad(base, basePct);

    /* 플레이어 */
    this.drawPlayer();

    g.restore();

    /* 오버레이 */
    if (this.vigCache) { g.drawImage(this.vigCache, 0, 0); }
    this.drawSpeedLines();
    if (p.boost) this.drawBoostWarp();
  },

  playerZ() { return this.camDepth * CONFIG.road.width; },
  camOffsetX(base, pct) {
    // 커브 안에서 카메라가 도로 중심으로 살짝 당겨지도록(시야 자연스러움)
    return utils.interpolate(base.p1.world.x, base.p2.world.x, pct) + this.camX * 0;
  },

  drawBackground(base, playerSeg) {
    const g = this.ctx, W = this.W, H = this.H;
    if (this.skyCache) g.drawImage(this.skyCache, 0, 0);
    else { g.fillStyle = PALETTE.skyTop; g.fillRect(0, 0, W, H); }

    // 외부 px_* 레이어가 있으면 distant skyline 으로 사용(원본은 160x144 픽셀아트)
    const far = Assets.img('px_far'), mid = Assets.img('px_mid'), close = Assets.img('px_close');
    const curveShift = -(playerSeg.curve || 0) * 260 + (Physics.player.x * -60);
    const horizon = H * 0.52;
    const usePx = far && mid && close;
    if (usePx) {
      g.imageSmoothingEnabled = false;
      const layers = [
        { im: far, y: horizon - 118, h: 120, par: 0.10, a: 0.55 },
        { im: mid, y: horizon - 96, h: 100, par: 0.22, a: 0.7 },
        { im: close, y: horizon - 70, h: 78, par: 0.42, a: 0.85 }
      ];
      for (const L of layers) {
        const w = Math.round(L.im.width * (L.h / L.im.height));
        let off = (curveShift * L.par) % w; if (off > 0) off -= w;
        g.globalAlpha = L.a;
        for (let x = off; x < W; x += w) g.drawImage(L.im, Math.round(x), Math.round(L.y), w, L.h);
        g.globalAlpha = 1;
      }
      g.imageSmoothingEnabled = true;
    } else {
      // 절차적 스카이라인(빌딩 실루엣 2줄)
      this.drawProcSkyline(horizon - 132, 132, 0.18, '#0a1220', 46);
      this.drawProcSkyline(horizon - 96, 96, 0.34, '#0c1524', 30);
    }
  },

  drawProcSkyline(y, h, par, col, n) {
    const g = this.ctx, W = this.W;
    const shift = (-(Physics.player.x * 90 * par) - (Road.findSegment(Physics.player.z).curve * 400 * par)) % W;
    const rnd = utils.mulberry32(1123);
    g.fillStyle = col;
    let x = shift - W;
    while (x < W * 2) {
      const bw = 24 + rnd() * 60, bh = h * (0.35 + rnd() * 0.65);
      g.fillRect(Math.round(x), Math.round(y + h - bh), Math.round(bw), Math.round(bh));
      x += bw + 4 + rnd() * 12;
    }
    // 창문 점
    g.fillStyle = 'rgba(255,200,130,0.16)';
    const r2 = utils.mulberry32(99);
    x = shift - W;
    while (x < W * 2) {
      const bw = 24 + r2() * 60, bh = h * (0.35 + r2() * 0.65);
      for (let k = 0; k < 4; k++) {
        if (r2() > 0.5) continue;
        g.fillRect(Math.round(x + r2() * bw), Math.round(y + h - bh + r2() * bh), 2, 2);
      }
      x += bw + 4 + r2() * 12;
    }
  },

  drawRoad(base, basePct) {
    const g = this.ctx, W = this.W, H = this.H;
    const RW = CONFIG.road.width;
    const N = CONFIG.camera.drawDistance;
    const lanes = CONFIG.road.lanes;
    const p = Physics.player;

    let maxy = H;
    let x = 0, dx = -(base.curve * basePct);

    const n = Road.segments.length;
    for (let k = 0; k < N; k++) {
      const idx = (base.index + k) % n;
      const seg = Road.segments[idx];
      seg.looped = idx < base.index;
      seg.fog = utils.exponentialFog(k / N, CONFIG.camera.fogDensity);

      const cz = this.camZ + (seg.looped ? Road.trackLength : 0);
      utils.project(seg.p1, this.camX - x, this.camY, cz, this.camDepth, W, H, RW);
      utils.project(seg.p2, this.camX - x - dx, this.camY, cz, this.camDepth, W, H, RW);
      x += dx; dx += seg.curve;
      seg.clipMax = maxy;

      if (seg.p1.camera.z <= this.camDepth || seg.p2.screen.y >= seg.p1.screen.y || seg.p2.screen.y >= maxy) continue;

      this.drawSegment(seg);
      maxy = seg.p2.screen.y;
    }

    // 소품/파티클은 원거리 -> 근거리 순
    for (let k = N - 1; k > 0; k--) {
      const idx = (base.index + k) % n;
      const seg = Road.segments[idx];
      if (!seg.p1.screen.scale || seg.p1.camera.z <= this.camDepth) continue;
      const clip = seg.clipMax === undefined ? H : seg.clipMax;
      for (const sp of seg.sprites) this.drawSprite(seg, sp, clip);
      for (const q of Physics.fx.particles) {
        const d = utils.lapDiff(q.z, seg.p1.world.z, Road.trackLength);
        if (Math.abs(d) > CONFIG.road.segLen * 0.6) continue;
        this.drawParticle(seg, q);
      }
    }
  },

  drawSegment(seg) {
    const g = this.ctx, W = this.W;
    const s1 = seg.p1.screen, s2 = seg.p2.screen;
    const maxy = seg.clipMax;

    // 조명 계수: 헤드램프 + 가로등 + 환경광
    const dist = seg.p1.camera.z;
    const L = CONFIG.lighting;
    const hl = L.headBoost * utils.clamp(1 - Math.pow(utils.clamp((dist - L.headNear) / L.headReach, 0, 1), 1.5));
    const lamp = L.lampBoost * Road.lampLight(seg.p1.world.z);
    const lit = utils.clamp(L.ambient + hl + lamp, 0, 1.35);
    seg.lit = lit;

    const light = seg.light;
    let roadC = light ? PALETTE.roadLight : PALETTE.roadDark;
    let rumC = light ? PALETTE.rumbleLight : PALETTE.rumbleDark;
    let grsC = light ? PALETTE.grassLight : PALETTE.grassDark;
    if (seg.surface === 'gravel') { roadC = light ? '#2a2620' : '#242019'; grsC = light ? '#171410' : '#12100c'; }
    else if (seg.surface === 'wet') roadC = light ? '#1a222c' : '#151c25';
    else if (seg.surface === 'ice') roadC = light ? '#28323d' : '#212a34';
    else if (seg.surface === 'oil') roadC = light ? '#131820' : '#0f141b';

    const W1 = s1.w, W2 = s2.w;
    const x1 = s1.x, y1 = s1.y, x2 = s2.x, y2 = s2.y;

    // 가장자리(비포장/잔도)
    g.fillStyle = this.shadeTo(grsC, lit);
    g.fillRect(0, y2, W, Math.max(0, Math.min(maxy, y1) - y2 + 1));

    // 어깨/루머블
    const r1 = W1 * 0.045, r2 = W2 * 0.045;
    const l1 = W1 * CONFIG.road.laneMarkerW, l2 = W2 * CONFIG.road.laneMarkerW;
    this.poly(x1 - W1 - r1, y1, x1 - W1, y1, x2 - W2, y2, x2 - W2 - r2, y2, this.shadeTo(rumC, lit));
    this.poly(x1 + W1 + r1, y1, x1 + W1, y1, x2 + W2, y2, x2 + W2 + r2, y2, this.shadeTo(rumC, lit));
    // 노면
    this.poly(x1 - W1, y1, x1 + W1, y1, x2 + W2, y2, x2 - W2, y2, this.shadeTo(roadC, lit));

    // 위험 노면 패치(기름/얼음/비포장/젖은 구간) + 점프대 데칼
    this.drawPatch(seg, lit);

    // 가드레일(연속 벽) - 물리 경계 railLimit 와 같은 위치
    this.drawRails(seg, lit);

    // 차선 마커(light/dark 패턴으로 리듬)
    if (light) {
      const lanes = CONFIG.road.lanes;
      const laneW1 = (W1 * 2) / lanes, laneW2 = (W2 * 2) / lanes;
      for (let i = 1; i < lanes; i++) {
        const lx1 = x1 - W1 + laneW1 * i, lx2 = x2 - W2 + laneW2 * i;
        this.poly(lx1 - l1, y1, lx1 + l1, y1, lx2 + l2, y2, lx2 - l2, y2, this.shadeTo(PALETTE.lane, lit));
      }
    }
    // 중앙선 강조(도심 1차선 유도)
    // 헤드램프 빔 오버레이(근접 구간만)
    if (lit > L.ambient + 0.05 && dist < L.headReach * 1.1) {
      const a = utils.clamp((lit - L.ambient) * 0.30, 0, 0.28);
      this.poly(x1 - W1, y1, x1 + W1, y1, x2 + W2, y2, x2 - W2, y2, 'rgba(255,205,140,' + a.toFixed(3) + ')');
    }
    // 안개(어둠)
    if (seg.fog < 1) {
      this.poly(x1 - W1 - r1, y1, x1 + W1 + r1, y1, x2 + W2 + r2, y2, x2 - W2 - r2, y2,
        'rgba(5,7,13,' + (1 - seg.fog).toFixed(3) + ')');
    }
  },

  /* 연속 가드레일: 물리 경계(railLimit) 위치에 Perspective 된 벽으로 그린다 */
  drawRails(seg, lit) {
    const g = this.ctx, W = this.W;
    const s1 = seg.p1.screen, s2 = seg.p2.screen;
    if (!s1.w || !s2.w) return;
    const RAIL = CONFIG.road.railLimit;
    const k1 = s1.w / CONFIG.road.width, k2 = s2.w / CONFIG.road.width;
    const h1 = CONFIG.road.railHeight * k1, h2 = CONFIG.road.railHeight * k2;
    if (h1 < 0.6 && h2 < 0.6) return;
    const fade = utils.clamp(seg.fog, 0, 1);
    const shade = lit * (0.30 + 0.70 * fade);
    const bodyC = this.shadeTo('#2a323c', Math.min(shade, 0.85));
    const topC = this.shadeTo('#5d6a78', Math.min(shade, 0.8));

    for (const sgn of [-1, 1]) {
      const ax1 = s1.x + s1.w * RAIL, ax2 = s2.x + s2.w * RAIL;
      // 안쪽 면
      this.poly(ax1, s1.y, ax1, s1.y - h1, ax2, s2.y - h2, ax2, s2.y, bodyC);
      // 상단 레일(두께)
      const t1 = Math.max(1, h1 * 0.16), t2 = Math.max(0.6, h2 * 0.16);
      this.poly(ax1, s1.y - h1, ax1, s1.y - h1 - t1, ax2, s2.y - h2 - t2, ax2, s2.y - h2, topC);
      // 반사판(가로등 빛 받는 지점만 밝게) - 2 세그먼트마다 점
      if (seg.index % 2 === 0 && h1 > 2) {
        g.fillStyle = this.shadeTo('#e4ecf5', Math.min(lit * fade, 0.72));
        g.fillRect(ax1 - sgn * Math.max(0.5, k1 * 12), s1.y - h1 * 0.62, Math.max(1, k1 * 26), Math.max(1, h1 * 0.16));
      }
    }
  },

  /* 노면 패치(위험 구간) + 점프대 데칼: perspective 사각형으로 그린다 */
  drawPatch(seg, lit) {
    const g = this.ctx;
    const s1 = seg.p1.screen, s2 = seg.p2.screen;
    if (!s1.w || !s2.w) return;
    const fade = utils.clamp(seg.fog, 0, 1);
    const k1 = s1.w / CONFIG.road.width;

    if (seg.patch) {
      const t = seg.patch.type;
      let col = null, al = 0;
      if (t === 'oil') { col = [8, 11, 16]; al = 0.66; }
      else if (t === 'ice') { col = [150, 208, 232]; al = 0.16; }
      else if (t === 'gravel') { col = [58, 49, 38]; al = 0.55; }
      else if (t === 'wet') { col = [96, 134, 176]; al = 0.11; }
      if (col) {
        let lo = -1, hi = 1;
        if (seg.patch.partial) {
          const j = 0.06 + utils.hash01(seg.index * 7 + 3) * 0.22;
          if (seg.patch.side > 0) lo = j; else hi = -j;
        }
        const a = (al * (0.42 + 0.58 * lit) * fade).toFixed(3);
        this.poly(s1.x + s1.w * lo, s1.y, s1.x + s1.w * hi, s1.y,
          s2.x + s2.w * hi, s2.y, s2.x + s2.w * lo, s2.y,
          'rgba(' + col[0] + ',' + col[1] + ',' + col[2] + ',' + a + ')');
        // 기름/얼음은 반사 광택, 비포장은 자갈 점
        if ((t === 'oil' || t === 'ice') && lit > 0.25) {
          const sa = ((t === 'ice' ? 0.20 : 0.13) * lit * fade).toFixed(3);
          const cx1 = s1.x + s1.w * (lo + hi) * 0.5, cx2 = s2.x + s2.w * (lo + hi) * 0.5;
          const qw = (hi - lo) * 0.34;
          this.poly(cx1 - s1.w * qw, s1.y, cx1 + s1.w * qw, s1.y,
            cx2 + s2.w * qw, s2.y, cx2 - s2.w * qw, s2.y, 'rgba(190,225,255,' + sa + ')');
        }
        if (t === 'gravel' && k1 > 0.05 && seg.index % 2 === 0) {
          g.fillStyle = 'rgba(120,110,92,' + (0.20 * lit * fade).toFixed(3) + ')';
          for (let i = 0; i < 4; i++) {
            const hx = (utils.hash01(seg.index * 13 + i) - 0.5) * 1.8;
            if (seg.patch.partial && (seg.patch.side > 0 ? hx < 0.1 : hx > -0.1)) continue;
            const sz = Math.max(1, k1 * 26);
            g.fillRect(s1.x + s1.w * hx, s1.y - sz, sz, Math.max(1, sz * 0.6));
          }
        }
      }
    }

    // 점프대 진입 화살표(노면 셰브론)
    if (seg.ramp) {
      const a = (0.42 * fade * (0.4 + 0.6 * lit)).toFixed(3);
      const off = seg.rampOffset || 0;
      const cx1 = s1.x + s1.w * off;
      const ww = s1.w * 0.30, ah = Math.max(1.2, k1 * 90);
      g.fillStyle = 'rgba(242,196,60,' + a + ')';
      for (let n = 0; n < 2; n++) {
        const yy = s1.y - ah * n * 0.9;
        g.beginPath();
        g.moveTo(cx1, yy - ah * 0.75);
        g.lineTo(cx1 + ww, yy);
        g.lineTo(cx1 + ww * 0.62, yy);
        g.lineTo(cx1, yy - ah * 0.34);
        g.lineTo(cx1 - ww * 0.62, yy);
        g.lineTo(cx1 - ww, yy);
        g.closePath(); g.fill();
      }
    }
  },

  poly(x1, y1, x2, y2, x3, y3, x4, y4, col) {
    const g = this.ctx;
    g.fillStyle = col;
    g.beginPath();
    g.moveTo(x1, y1); g.lineTo(x2, y2); g.lineTo(x3, y3); g.lineTo(x4, y4);
    g.closePath(); g.fill();
  },

  shadeTo(hex, k) {
    if (hex[0] !== '#') return hex;
    if (k >= 1) return hex;
    const m = /^#([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!m) return hex;
    const f = (v) => utils.clamp(Math.round(v * k), 0, 255);
    const key = hex + '|' + Math.round(k * 40);
    let c = this.segColors[key];
    if (!c) {
      c = 'rgb(' + f(parseInt(m[1], 16)) + ',' + f(parseInt(m[2], 16)) + ',' + f(parseInt(m[3], 16)) + ')';
      this.segColors[key] = c;
    }
    return c;
  },

  drawSprite(seg, sp, clipY) {
    const g = this.ctx;
    const scale = seg.p1.screen.scale;
    if (!scale || scale <= 0) return;
    const k = scale * SCR.w / 2;               // 월드 1유닛 -> 픽셀(가로/세로 동일 배율)
    const destX = seg.p1.screen.x + sp.offset * CONFIG.road.width * k;
    const destY = seg.p1.screen.y;
    const w = sp.w * k, h = sp.h * k;
    if (w < 1 || h < 1) return;
    if (destY - h > clipY) return;
    const lit = utils.clamp(seg.lit, 0.12, 1.25);
    g.save();
    if (lit < 1) g.globalAlpha = utils.clamp(lit + 0.25, 0.25, 1);
    Sprites.prop(g, sp.kind, destX, destY, w, h, sp.seed);
    g.restore();
  },

  drawParticle(seg, q) {
    const g = this.ctx;
    const scale = seg.p1.screen.scale;
    if (!scale) return;
    const k = scale * SCR.w / 2;
    const x = seg.p1.screen.x + q.x * CONFIG.road.width * k;
    const yBase = seg.p1.screen.y;
    const y = yBase - q.y * k;
    const s = Math.max(1, q.size * k);
    const af = 1 - q.t / q.life;
    if (q.kind === 'smoke') {
      g.globalAlpha = 0.20 * af;
      g.fillStyle = '#8c9bad';
      g.beginPath(); g.arc(x, y, s, 0, Math.PI * 2); g.fill();
      g.globalAlpha = 1;
    } else if (q.kind === 'debris') {
      g.globalAlpha = Math.min(1, af * 1.6);
      g.fillStyle = q.col;
      g.fillRect(x - s / 2, y - s / 2, s, s);
      g.globalAlpha = 1;
    } else {
      g.globalAlpha = af;
      g.fillStyle = '#ffd27a';
      g.fillRect(x, y, Math.max(1, s * 0.6), Math.max(1, s * 0.6));
      g.globalAlpha = 1;
    }
  },

  /* --------------------------------------------------- 플레이어 차량 -- */
  drawPlayer() {
    const g = this.ctx, W = this.W, H = this.H;
    const p = Physics.player;
    const chase = Save.data.cam !== 'hood';
    const cx = W / 2 + p.yaw * 90 + (p.slip * p.steer * 40);
    const cy = H * (chase ? 0.80 : 0.86);
    const w = W * (chase ? 0.30 : 0.34), h = H * (chase ? 0.30 : 0.34);
    const air = p.y > 0 ? utils.clamp(p.y / 900, 0, 1) : 0;
    const lampLit = utils.clamp(0.55 + CONFIG.lighting.lampBoost * Road.lampLight(p.z), 0.3, 1.3);
    const dmg = 1 - Physics.stats.body / 100;
    if (!chase) {
      // 보닛 뷰: 도로 + 글로시 후드 일부
      g.save();
      g.globalAlpha = 0.94;
      Sprites.carHood(g, cx, H + h * 0.16, w * 2.4, h * 1.35, {
        steer: p.steer, drift: p.slip, color: Game.carColor,
        dmg: dmg, light: lampLit
      });
      g.restore();
      return;
    }
    g.save();
    g.translate(0, -air * 60);
    Sprites.carRear(g, cx, cy + (Physics.cam.bob || 0) * 0.6, w, h, {
      color: Game.carColor,
      steer: p.steer, yaw: p.yaw + p.slip * p.steer * 0.6, brake: p.brakeOn || p.speed < p.prevSpeed,
      boost: p.boost, dmg: dmg, drift: p.slip, air: air,
      light: lampLit, wing: Save.data.wing !== false, plate: Save.data.plate || 'ND-01'
    });
    g.restore();
  },

  drawSpeedLines() {
    const g = this.ctx, W = this.W, H = this.H;
    const sp = Physics.player.speed / Physics.topSpeed();
    if (sp < 0.55) return;
    const a = utils.clamp((sp - 0.55) / 0.45, 0, 1);
    const n = Math.floor(CONFIG.fx.speedLines * a);
    g.save();
    g.strokeStyle = 'rgba(200,225,255,' + (0.05 + a * 0.16).toFixed(3) + ')';
    g.lineWidth = 1;
    const rnd = utils.mulberry32(Math.floor(Physics.player.z / 40));
    for (let i = 0; i < n; i++) {
      const ang = rnd() * Math.PI * 2;
      const r0 = H * (0.32 + rnd() * 0.5);
      const len = H * (0.04 + a * 0.16) * (0.4 + rnd());
      const cx = W / 2, cy = H * 0.52;
      g.beginPath();
      g.moveTo(cx + Math.cos(ang) * r0, cy + Math.sin(ang) * r0 * 0.7);
      g.lineTo(cx + Math.cos(ang) * (r0 + len), cy + Math.sin(ang) * (r0 + len) * 0.7);
      g.stroke();
    }
    g.restore();
  },

  drawBoostWarp() {
    const g = this.ctx, W = this.W, H = this.H;
    const rg = g.createRadialGradient(W / 2, H * 0.52, H * 0.18, W / 2, H * 0.52, H * 0.9);
    rg.addColorStop(0, 'rgba(120,190,255,0)');
    rg.addColorStop(1, 'rgba(90,150,255,0.16)');
    g.fillStyle = rg; g.fillRect(0, 0, W, H);
  }
};
