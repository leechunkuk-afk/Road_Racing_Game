/* ==========================================================================
   Sprites - 소품/차량 드로잉. 실물 스프라이트가 있으면 그것을, 없으면 절차적.
   소비자는 항상 같은 인터페이스를 쓴다:  Sprites.prop(ctx, kind, cx, baseY, w, h)
   ========================================================================== */
const Sprites = {
  bldg: [], lightGlow: null, _built: false,

  build() {
    if (this._built) return;
    this._built = true;
    const rnd = utils.mulberry32(20261110);
    // 빌딩 실루엣 변형 8종(윈도우 켜짐 패턴) - 한 번만 렌더하고 재사용
    for (let v = 0; v < 8; v++) {
      const cw = 96, chh = 192;
      const c = document.createElement('canvas'); c.width = cw; c.height = chh;
      const g = c.getContext('2d');
      const grd = g.createLinearGradient(0, 0, 0, chh);
      grd.addColorStop(0, '#101725'); grd.addColorStop(1, '#070b13');
      g.fillStyle = grd; g.fillRect(0, 0, cw, chh);
      g.strokeStyle = 'rgba(120,180,255,0.10)'; g.strokeRect(0.5, 0.5, cw - 1, chh - 1);
      const cols = 5, rows = 11;
      for (let r = 0; r < rows; r++) {
        for (let cix = 0; cix < cols; cix++) {
          if (rnd() > 0.42) continue;
          const warm = rnd();
          g.fillStyle = warm > 0.72 ? 'rgba(255,196,120,0.85)'
                      : warm > 0.42 ? 'rgba(150,215,255,0.75)'
                                    : 'rgba(255,140,190,0.65)';
          const px = 6 + cix * ((cw - 12) / cols), py = 8 + r * ((chh - 16) / rows);
          g.fillRect(px, py, (cw - 12) / cols - 4, (chh - 16) / rows - 6);
        }
      }
      // 네온 사인 띠
      if (v % 3 === 0) {
        g.fillStyle = v % 2 ? 'rgba(255,47,142,0.75)' : 'rgba(49,217,255,0.75)';
        g.fillRect(4, chh * 0.18 + (v * 7) % 40, cw - 8, 3);
      }
      this.bldg.push(c);
    }
    // 가로등 머리 글로우
    const gc = document.createElement('canvas'); gc.width = gc.height = 128;
    const gg = gc.getContext('2d');
    const rg = gg.createRadialGradient(64, 64, 4, 64, 64, 62);
    rg.addColorStop(0, 'rgba(255,225,170,0.95)');
    rg.addColorStop(0.35, 'rgba(255,190,110,0.42)');
    rg.addColorStop(1, 'rgba(255,170,80,0)');
    gg.fillStyle = rg; gg.fillRect(0, 0, 128, 128);
    this.lightGlow = gc;
  },

  frame(id) {
    const f = SPRITES_KENNEY_OBJECTS.frames[id];
    if (!f) return null;
    const sheet = Assets.img(SPRITES_KENNEY_OBJECTS.sheet);
    return sheet ? { img: sheet, x: f[0], y: f[1], w: f[2], h: f[3] } : null;
  },

  atlasDraw(ctx, fr, cx, baseY, w, h) {
    ctx.drawImage(fr.img, fr.x, fr.y, fr.w, fr.h, Math.round(cx - w / 2), Math.round(baseY - h), Math.round(w), Math.round(h));
  },

  /* kind: streetlight|tree|bldg|bldg_far|cone|barrier|barrel|tirestack|rock */
  prop(ctx, kind, cx, baseY, w, h, seed) {
    const s = seed || 0;
    switch (kind) {
      case 'streetlight': return this.streetlight(ctx, cx, baseY, w, h, s);
      case 'bldg':
      case 'bldg_far': {
        const v = this.bldg.length ? this.bldg[(s >>> 3) % this.bldg.length] : null;
        if (v) { ctx.drawImage(v, Math.round(cx - w / 2), Math.round(baseY - h), Math.round(w), Math.round(h)); }
        else {
          ctx.fillStyle = kind === 'bldg' ? '#0d1421' : '#0a0f18';
          ctx.fillRect(Math.round(cx - w / 2), Math.round(baseY - h), Math.round(w), Math.round(h));
        }
        return;
      }
      case 'tree': {
        const fr = this.frame(s % 2 ? 'tree_small' : 'tree_large');
        if (fr) return this.atlasDraw(ctx, fr, cx, baseY, w, h);
        ctx.fillStyle = '#12331f'; ctx.beginPath();
        ctx.moveTo(cx, baseY - h); ctx.lineTo(cx + w / 2, baseY); ctx.lineTo(cx - w / 2, baseY);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = '#1a1208'; ctx.fillRect(cx - w * 0.05, baseY - h * 0.18, w * 0.1, h * 0.18);
        return;
      }
      case 'cone': {
        const fr = this.frame('cone_straight');
        if (fr) return this.atlasDraw(ctx, fr, cx, baseY, w, h);
        ctx.fillStyle = '#ff7a2f'; ctx.beginPath();
        ctx.moveTo(cx, baseY - h); ctx.lineTo(cx + w * 0.42, baseY); ctx.lineTo(cx - w * 0.42, baseY);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.85)'; ctx.fillRect(cx - w * 0.3, baseY - h * 0.55, w * 0.6, h * 0.14);
        return;
      }
      case 'barrier': {
        const fr = this.frame('barrier_red_race');
        if (fr) return this.atlasDraw(ctx, fr, cx, baseY, w, h);
        ctx.fillStyle = '#d9414f'; ctx.fillRect(cx - w / 2, baseY - h, w, h);
        ctx.fillStyle = '#e9eef5';
        for (let i = 0; i < 4; i++) ctx.fillRect(cx - w / 2 + i * (w / 4) + w * 0.02, baseY - h, w * 0.2, h);
        return;
      }
      case 'barrel': {
        const fr = this.frame('barrel_red');
        if (fr) return this.atlasDraw(ctx, fr, cx, baseY, w, h);
        ctx.fillStyle = '#c8394a'; ctx.beginPath();
        ctx.ellipse(cx, baseY - h / 2, w / 2, h / 2, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.75)'; ctx.fillRect(cx - w / 2, baseY - h * 0.62, w, h * 0.16);
        return;
      }
      case 'tirestack': {
        const fr = this.frame('tires_red');
        if (fr) return this.atlasDraw(ctx, fr, cx, baseY, w, h);
        ctx.fillStyle = '#16181c'; ctx.beginPath();
        ctx.ellipse(cx, baseY - h / 2, w / 2, h / 2, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#e7edf3'; ctx.beginPath();
        ctx.ellipse(cx, baseY - h / 2, w * 0.22, h * 0.22, 0, 0, Math.PI * 2); ctx.fill();
        return;
      }
      case 'ramp': {
        // 점프대: 노란/검정 사선 + 진행 방향 화살표
        ctx.fillStyle = 'rgba(8,10,14,0.55)';
        ctx.beginPath();
        ctx.moveTo(cx - w * 0.52, baseY); ctx.lineTo(cx - w * 0.38, baseY - h * 0.86);
        ctx.lineTo(cx + w * 0.38, baseY - h * 0.86); ctx.lineTo(cx + w * 0.52, baseY);
        ctx.closePath(); ctx.fill();
        const wg = ctx.createLinearGradient(0, baseY - h, 0, baseY);
        wg.addColorStop(0, '#f2c33c');
        wg.addColorStop(0.55, '#c99423');
        wg.addColorStop(1, '#6d4f14');
        ctx.fillStyle = wg;
        ctx.beginPath();
        ctx.moveTo(cx - w * 0.46, baseY - h * 0.05); ctx.lineTo(cx - w * 0.33, baseY - h * 0.80);
        ctx.lineTo(cx + w * 0.33, baseY - h * 0.80); ctx.lineTo(cx + w * 0.46, baseY - h * 0.05);
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(12,14,18,0.85)';
        for (let k = 0; k < 4; k++) {
          const yy = baseY - h * (0.12 + k * 0.19);
          ctx.fillRect(cx - w * 0.42, yy, w * 0.84, h * 0.075);
        }
        ctx.fillStyle = 'rgba(255,246,214,0.30)';
        ctx.fillRect(cx - w * 0.33, baseY - h * 0.84, w * 0.66, h * 0.05);
        if (w > 26) {
          ctx.fillStyle = 'rgba(18,20,26,0.75)';
          for (let k = 0; k < 2; k++) {
            const ay = baseY - h * (0.30 + k * 0.26);
            ctx.beginPath();
            ctx.moveTo(cx, ay - h * 0.14); ctx.lineTo(cx + w * 0.16, ay);
            ctx.lineTo(cx + w * 0.06, ay); ctx.lineTo(cx, ay - h * 0.06);
            ctx.lineTo(cx - w * 0.06, ay); ctx.lineTo(cx - w * 0.16, ay);
            ctx.closePath(); ctx.fill();
          }
        }
        return;
      }
      case 'rock': {
        const fr = this.frame('rock' + (1 + (s % 3)));
        if (fr) return this.atlasDraw(ctx, fr, cx, baseY, w, h);
        ctx.fillStyle = '#3a3f47'; ctx.beginPath();
        ctx.moveTo(cx - w / 2, baseY); ctx.lineTo(cx - w * 0.2, baseY - h);
        ctx.lineTo(cx + w * 0.35, baseY - h * 0.8); ctx.lineTo(cx + w / 2, baseY);
        ctx.closePath(); ctx.fill();
        return;
      }
    }
  },

  streetlight(ctx, cx, baseY, w, h, s) {
    const side = (s % 2) ? 1 : -1;          // 도로 바깥으로 팔이 꺾임
    const poleW = Math.max(1.2, w * 0.055);
    ctx.strokeStyle = '#2b3441';
    ctx.lineWidth = poleW;
    ctx.beginPath();
    ctx.moveTo(cx, baseY);
    ctx.lineTo(cx, baseY - h * 0.86);
    const armX = cx + side * w * 0.42;
    ctx.quadraticCurveTo(cx + side * w * 0.05, baseY - h * 0.99, armX, baseY - h * 0.95);
    ctx.stroke();
    // 램프 머리 + 글로우
    const hw = Math.max(2, w * 0.20), hh = Math.max(1.5, h * 0.035);
    ctx.fillStyle = '#f3e3c0';
    ctx.fillRect(armX - hw / 2, baseY - h * 0.95, hw, hh);
    if (CONFIG.fx.bloom && this.lightGlow && hw > 1.5) {
      const g = Math.max(hw * 4.2, hh * 10);
      ctx.globalAlpha = 0.55;
      ctx.drawImage(this.lightGlow, armX - g / 2, baseY - h * 0.95 - g * 0.28, g, g);
      ctx.globalAlpha = 1;
    }
  },

  /* player/AI 차량 (후방 3/4 뷰).
     opt: {color, steer, yaw, drift, brake, boost, dmg, air, light, wing} */
  carRear(ctx, cx, baseY, w, h, opt) {
    const o = opt || {};
    const steer = utils.clamp(o.steer || 0, -1, 1);
    const drift = utils.clamp(o.drift || 0, 0, 1);
    const yaw = utils.clamp((o.yaw !== undefined ? o.yaw : steer * 0.15) * 3.4, -1, 1);
    const col = o.color || '#c81f3a';
    const dmg = utils.clamp(o.dmg || 0, 0, 1);
    const air = utils.clamp(o.air || 0, 0, 1);
    const lit = utils.clamp(o.light === undefined ? 0.9 : o.light, 0.25, 1.3);
    const brake = !!o.brake;

    const W = w * 0.88;             // 리어 범퍼 기준 폭
    const BW = W * 0.50;            // 반폭
    const SH = h * 0.56;            // 페렌더 윗선(숄더) 높이
    const GT = h * 0.80;            // 유리 위쪽 높이
    const yv = yaw * W * 0.040;     // 요각에 따른 수평 이동
    ctx.save();
    ctx.translate(cx, baseY - air * h * 0.05);
    ctx.rotate(steer * 0.040 + drift * steer * 0.020);

    /* 접지 그림자(부드러운 타원) */
    const sw = W * (0.58 + air * 0.06), shh = h * (0.070 - air * 0.025);
    let g = ctx.createRadialGradient(yv * 0.5, -shh * 0.25, 1, yv * 0.5, -shh * 0.25, sw);
    g.addColorStop(0, 'rgba(0,0,0,0.58)');
    g.addColorStop(0.55, 'rgba(0,0,0,0.26)');
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.ellipse(yv * 0.5, -shh * 0.25, sw, shh * 2.3, 0, 0, Math.PI * 2); ctx.fill();

    /* 휠/타이어(차체 뒤에 숨도록 먼저) */
    const ww = w * 0.125, wh = h * (0.30 - air * 0.05);
    for (const s of [-1, 1]) {
      const x = s * (BW * 0.92 + yv * 0.3) - (s < 0 ? ww : 0);
      const y = -wh - air * h * 0.04;
      const wg = ctx.createLinearGradient(x, y, x + ww, 0);
      wg.addColorStop(0, '#05070a'); wg.addColorStop(0.45, '#1b2028'); wg.addColorStop(1, '#080a0e');
      ctx.fillStyle = wg;
      this.roundPath(ctx, x, y, ww, wh, ww * 0.24); ctx.fill();
      ctx.fillStyle = 'rgba(190,210,240,' + (0.05 + lit * 0.05).toFixed(3) + ')';
      ctx.fillRect(x + ww * 0.14, y + wh * 0.14, ww * 0.72, wh * 0.09);
    }

    /* 차체 실루엣 - 페렌더가 불룩 나오는 곡선 */
    const bodyPath = () => {
      ctx.beginPath();
      ctx.moveTo(-BW + yv, -h * 0.040);
      ctx.bezierCurveTo(-BW - W * 0.014, -SH * 0.52, -BW - W * 0.010, -SH * 0.86, -BW * 0.84, -SH * 0.99);
      ctx.bezierCurveTo(-BW * 0.46, -SH * 1.07, BW * 0.46, -SH * 1.07, BW * 0.84, -SH * 0.99);
      ctx.bezierCurveTo(BW + W * 0.010, -SH * 0.86, BW + W * 0.014, -SH * 0.52, BW + yv, -h * 0.040);
      ctx.bezierCurveTo(BW * 0.55, -h * 0.010, -BW * 0.55, -h * 0.010, -BW + yv, -h * 0.040);
      ctx.closePath();
    };
    const pg = ctx.createLinearGradient(0, -SH * 1.10, 0, 0);
    pg.addColorStop(0, this.shade(col, 1.30 * lit));
    pg.addColorStop(0.34, this.shade(col, 1.02));
    pg.addColorStop(0.66, this.shade(col, 0.74));
    pg.addColorStop(1, this.shade(col, 0.40));
    ctx.fillStyle = pg;
    bodyPath(); ctx.fill();

    /* 차체 안쪽만 잘라 둥글게 표현 */
    ctx.save();
    bodyPath(); ctx.clip();
    const hg = ctx.createLinearGradient(-BW, 0, BW, 0);
    hg.addColorStop(0, 'rgba(0,0,0,0.60)');
    hg.addColorStop(0.14, 'rgba(0,0,0,0.02)');
    hg.addColorStop(0.50, 'rgba(255,255,255,0.06)');
    hg.addColorStop(0.86, 'rgba(0,0,0,0.02)');
    hg.addColorStop(1, 'rgba(0,0,0,0.60)');
    ctx.fillStyle = hg; ctx.fillRect(-W, -h * 1.2, W * 2, h * 1.4);
    // 캐릭터 라인(가로 반사 띠)
    const cl = ctx.createLinearGradient(0, -SH * 0.80, 0, -SH * 0.50);
    cl.addColorStop(0, 'rgba(255,255,255,0)');
    cl.addColorStop(0.45, 'rgba(255,246,232,' + (0.09 + lit * 0.10).toFixed(3) + ')');
    cl.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = cl; ctx.fillRect(-BW, -SH * 0.80, BW * 2, SH * 0.30);
    // 루프/숄더 가장자리 림라이트
    ctx.strokeStyle = 'rgba(215,235,255,' + (0.10 + lit * 0.16).toFixed(3) + ')';
    ctx.lineWidth = Math.max(1, w * 0.006);
    ctx.beginPath();
    ctx.moveTo(-BW * 0.86, -SH * 0.98);
    ctx.bezierCurveTo(-BW * 0.46, -SH * 1.06, BW * 0.46, -SH * 1.06, BW * 0.86, -SH * 0.98);
    ctx.stroke();
    // 페렌더 그늘(휠 아치)
    for (const s of [-1, 1]) {
      const ag = ctx.createRadialGradient(s * BW * 0.86, -SH * 0.30, 1, s * BW * 0.86, -SH * 0.30, W * 0.20);
      ag.addColorStop(0, 'rgba(0,0,0,0.45)'); ag.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.fillStyle = ag;
      ctx.fillRect(s * BW * 0.86 - W * 0.2, -SH * 0.30 - W * 0.2, W * 0.4, W * 0.4);
    }
    ctx.restore();

    /* 리어 글래스 + 루프 */
    const gwb = BW * 0.70, gwt = BW * 0.52;
    const yb = -SH * 1.01, yt = -GT;
    const glass = () => {
      ctx.beginPath();
      ctx.moveTo(-gwb + yv * 1.5, yb);
      ctx.lineTo(-gwt + yv * 1.9, yt + h * 0.015);
      ctx.quadraticCurveTo(0, yt - h * 0.010, gwt + yv * 1.9, yt + h * 0.015);
      ctx.lineTo(gwb + yv * 1.5, yb);
      ctx.closePath();
    };
    ctx.fillStyle = this.shade(col, 0.66);
    ctx.beginPath();
    ctx.moveTo(-gwb - W * 0.035 + yv * 1.4, yb + h * 0.012);
    ctx.lineTo(-gwt - W * 0.022 + yv * 1.8, yt - h * 0.012);
    ctx.quadraticCurveTo(0, yt - h * 0.036, gwt + W * 0.022 + yv * 1.8, yt - h * 0.012);
    ctx.lineTo(gwb + W * 0.035 + yv * 1.4, yb + h * 0.012);
    ctx.closePath(); ctx.fill();
    const gg = ctx.createLinearGradient(0, yt, 0, yb);
    gg.addColorStop(0, 'rgba(38,52,72,0.95)');
    gg.addColorStop(0.45, 'rgba(15,21,31,0.96)');
    gg.addColorStop(1, 'rgba(9,12,18,0.98)');
    ctx.fillStyle = gg; glass(); ctx.fill();
    ctx.save(); glass(); ctx.clip();
    const rf = ctx.createLinearGradient(-gwb, yt, gwb * 0.4, yb);
    rf.addColorStop(0, 'rgba(150,200,255,0.00)');
    rf.addColorStop(0.42, 'rgba(160,210,255,' + (0.10 + lit * 0.10).toFixed(3) + ')');
    rf.addColorStop(0.60, 'rgba(120,170,230,0.03)');
    rf.addColorStop(1, 'rgba(255,190,120,0.06)');
    ctx.fillStyle = rf; ctx.fillRect(-gwb, yt - h * 0.05, gwb * 2, (yb - yt) + h * 0.05);
    ctx.strokeStyle = 'rgba(200,220,245,0.10)'; ctx.lineWidth = Math.max(1, w * 0.004);
    ctx.beginPath(); ctx.moveTo(-gwb * 0.86, yb - (yb - yt) * 0.30);
    ctx.lineTo(gwb * 0.90, yb - (yb - yt) * 0.44); ctx.stroke();
    ctx.restore();

    /* 리어램프: 모서리를 감싸는 형태 + LED 슬랫 + 블룸 */
    const ly0 = -SH * 0.64, lh = SH * 0.22;
    for (const s of [-1, 1]) {
      const x1 = s * BW * 0.28 + yv, x2 = s * BW * 0.99 + yv;
      ctx.beginPath();
      ctx.moveTo(x1, ly0);
      ctx.lineTo(x2 - s * W * 0.02, ly0 - lh * 0.20);
      ctx.quadraticCurveTo(x2 + s * W * 0.014, ly0 + lh * 0.32, x2 - s * W * 0.012, ly0 + lh);
      ctx.lineTo(x1, ly0 + lh * 0.90);
      ctx.closePath();
      const lg = ctx.createLinearGradient(0, ly0, 0, ly0 + lh);
      lg.addColorStop(0, brake ? '#ff8078' : '#7d1a26');
      lg.addColorStop(0.5, brake ? '#ff2f3f' : '#a5202e');
      lg.addColorStop(1, brake ? '#c01324' : '#59101a');
      ctx.fillStyle = lg; ctx.fill();
      const span = Math.abs(x2 - x1);
      ctx.fillStyle = 'rgba(255,238,238,' + (brake ? 0.52 : 0.20).toFixed(3) + ')';
      for (let k = 0; k < 3; k++) {
        ctx.fillRect(Math.min(x1, x2) + span * (0.16 + k * 0.24), ly0 + lh * 0.26, span * 0.10, lh * 0.44);
      }
      if (CONFIG.fx.bloom) {
        ctx.globalAlpha = brake ? 0.50 : 0.20;
        const bx = (x1 + x2) / 2;
        const bl = ctx.createRadialGradient(bx, ly0 + lh * 0.5, 1, bx, ly0 + lh * 0.5, lh * 3.2);
        bl.addColorStop(0, 'rgba(255,62,84,0.92)');
        bl.addColorStop(1, 'rgba(255,40,70,0)');
        ctx.fillStyle = bl;
        ctx.beginPath(); ctx.ellipse(bx, ly0 + lh * 0.5, lh * 3.0, lh * 2.1, 0, 0, Math.PI * 2); ctx.fill();
        ctx.globalAlpha = 1;
      }
    }

    /* 데크 립 + 번호판 */
    ctx.fillStyle = 'rgba(0,0,0,0.26)';
    ctx.fillRect(-BW * 0.34 + yv, -SH * 0.70, BW * 0.68, Math.max(1, h * 0.005));
    const plw = BW * 0.32, plh = SH * 0.17, ply = -SH * 0.34;
    ctx.fillStyle = 'rgba(226,234,246,0.82)';
    this.roundPath(ctx, -plw / 2 + yv, ply, plw, plh, Math.max(1, w * 0.006)); ctx.fill();
    if (plw > 26) {
      ctx.fillStyle = 'rgba(26,36,54,0.60)';
      ctx.font = Math.round(plh * 0.60) + 'px "Malgun Gothic",sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(o.plate || 'ND-01', yv, ply + plh * 0.56);
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
    }

    /* 하부 범퍼/디퓨저 + 머플러 팁 */
    const vy = -h * 0.042;
    ctx.fillStyle = 'rgba(11,14,19,0.94)';
    ctx.beginPath();
    ctx.moveTo(-BW * 0.94 + yv, vy); ctx.lineTo(BW * 0.94 + yv, vy);
    ctx.lineTo(BW * 0.80 + yv, vy - h * 0.078); ctx.lineTo(-BW * 0.80 + yv, vy - h * 0.078);
    ctx.closePath(); ctx.fill();
    ctx.fillStyle = 'rgba(150,162,178,0.13)';
    for (let k = -2; k <= 2; k++) {
      ctx.fillRect(k * BW * 0.15 - Math.max(0.7, w * 0.004), vy - h * 0.072, Math.max(1.4, w * 0.008), h * 0.064);
    }
    for (const s of [-1, 1]) {
      ctx.fillStyle = '#262b33';
      ctx.beginPath();
      ctx.ellipse(s * BW * 0.58 + yv, vy - h * 0.030, Math.max(1.6, w * 0.017), Math.max(1.2, h * 0.021), 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = 'rgba(215,228,245,0.20)';
      ctx.beginPath();
      ctx.ellipse(s * BW * 0.58 + yv, vy - h * 0.038, Math.max(1, w * 0.012), Math.max(0.7, h * 0.010), 0, 0, Math.PI * 2);
      ctx.fill();
    }

    /* 리어 스포일러 */
    if (o.wing !== false) {
      const wy = -SH * 1.12, span2 = BW * 1.04, th2 = Math.max(1.6, h * 0.028);
      ctx.fillStyle = 'rgba(14,17,22,0.95)';
      for (const s of [-1, 1]) {
        ctx.fillRect(s * BW * 0.64 + yv - Math.max(1, w * 0.008), wy, Math.max(2, w * 0.016), SH * 0.17);
      }
      const wg2 = ctx.createLinearGradient(0, wy - th2, 0, wy + th2);
      wg2.addColorStop(0, 'rgba(126,140,160,0.92)');
      wg2.addColorStop(0.45, 'rgba(26,30,38,0.98)');
      wg2.addColorStop(1, 'rgba(9,11,15,0.98)');
      ctx.fillStyle = wg2;
      this.roundPath(ctx, -span2 + yv * 1.6, wy - th2, span2 * 2, th2 * 2, th2 * 0.6); ctx.fill();
    }

    /* 손상: 찌그러짐 + 스크래치 + 램프 파손 */
    if (dmg > 0.05) {
      const rnd = utils.mulberry32(777);
      ctx.save(); bodyPath(); ctx.clip();
      for (let i = 0; i < Math.floor(1 + dmg * 7); i++) {
        const x0 = (rnd() - 0.5) * BW * 1.7, y0 = -SH * (0.12 + rnd() * 0.86);
        const rr = W * (0.035 + rnd() * 0.06) * (0.6 + dmg);
        const dg = ctx.createRadialGradient(x0, y0, 1, x0, y0, rr);
        dg.addColorStop(0, 'rgba(9,11,15,' + (0.28 + dmg * 0.32).toFixed(3) + ')');
        dg.addColorStop(0.55, 'rgba(22,26,32,0.16)');
        dg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = dg;
        ctx.beginPath(); ctx.ellipse(x0, y0, rr, rr * 0.62, rnd() * 3, 0, Math.PI * 2); ctx.fill();
      }
      ctx.strokeStyle = 'rgba(16,18,23,' + (0.22 + dmg * 0.40).toFixed(3) + ')';
      ctx.lineWidth = Math.max(1, w * 0.009);
      for (let i = 0; i < Math.floor(dmg * 10); i++) {
        const x0 = (rnd() - 0.5) * BW * 1.8, y0 = -SH * (0.10 + rnd() * 0.88);
        ctx.beginPath(); ctx.moveTo(x0, y0);
        ctx.lineTo(x0 + (rnd() - 0.5) * BW * 0.7, y0 + (rnd() - 0.5) * SH * 0.34);
        ctx.stroke();
      }
      ctx.restore();
      if (dmg > 0.55) {
        ctx.fillStyle = 'rgba(7,9,13,0.72)';
        ctx.fillRect(-BW * 0.99 + yv, ly0 - lh * 0.2, BW * 0.34, lh * 1.2);
      }
    }

    /* 니트로 불꽃(머플러 팁에서) */
    if (o.boost) {
      const fl = h * (0.13 + Math.random() * 0.13);
      for (const s of [-1, 1]) {
        const fx = s * BW * 0.58 + yv;
        const fg = ctx.createLinearGradient(fx, -h * 0.05, fx, -h * 0.05 + fl);
        fg.addColorStop(0, 'rgba(255,246,212,0.95)');
        fg.addColorStop(0.35, 'rgba(255,150,60,0.70)');
        fg.addColorStop(1, 'rgba(120,60,255,0)');
        ctx.fillStyle = fg;
        ctx.beginPath();
        ctx.moveTo(fx - w * 0.034, -h * 0.048);
        ctx.lineTo(fx + w * 0.034, -h * 0.048);
        ctx.lineTo(fx, -h * 0.048 + fl);
        ctx.closePath(); ctx.fill();
      }
    }
    ctx.restore();
  },

  /* 보닛(1인칭) 뷰: 화면 아래에 걸리는 후드 + 미러 + 와이퍼 */
  carHood(ctx, cx, baseY, w, h, opt) {
    const o = opt || {};
    const steer = utils.clamp(o.steer || 0, -1, 1);
    const drift = utils.clamp(o.drift || 0, 0, 1);
    const col = o.color || '#c81f3a';
    const dmg = utils.clamp(o.dmg || 0, 0, 1);
    const lit = utils.clamp(o.light === undefined ? 0.9 : o.light, 0.3, 1.3);
    const hw = w * 0.66, hh = h;
    ctx.save();
    ctx.translate(cx, baseY);
    ctx.rotate(steer * (0.014 + drift * 0.010));

    /* 후드 실루엣 - 어깨가 불룩한 곡선 사다리꼴 */
    const hood = () => {
      ctx.beginPath();
      ctx.moveTo(-hw * 0.60, -hh * 0.34);
      ctx.bezierCurveTo(-hw * 0.80, -hh * 0.20, -hw * 0.95, -hh * 0.08, -hw, 0);
      ctx.lineTo(hw, 0);
      ctx.bezierCurveTo(hw * 0.95, -hh * 0.08, hw * 0.80, -hh * 0.20, hw * 0.60, -hh * 0.34);
      ctx.bezierCurveTo(hw * 0.24, -hh * 0.42, -hw * 0.24, -hh * 0.42, -hw * 0.60, -hh * 0.34);
      ctx.closePath();
    };
    const gr = ctx.createLinearGradient(-hw, 0, hw, 0);
    gr.addColorStop(0, this.shade(col, 0.34 * lit));
    gr.addColorStop(0.16, this.shade(col, 0.86));
    gr.addColorStop(0.50, this.shade(col, 1.16 * lit));
    gr.addColorStop(0.84, this.shade(col, 0.86));
    gr.addColorStop(1, this.shade(col, 0.34 * lit));
    ctx.fillStyle = gr;
    hood(); ctx.fill();

    /* 후드 안쪽 디테일(클립으로 가장자리 유지) */
    ctx.save();
    hood(); ctx.clip();
    const dome = ctx.createLinearGradient(-hw * 0.30, -hh * 0.42, hw * 0.30, -hh * 0.02);
    dome.addColorStop(0, 'rgba(255,255,255,' + (0.05 + lit * 0.07).toFixed(3) + ')');
    dome.addColorStop(0.5, 'rgba(255,255,255,0.02)');
    dome.addColorStop(1, 'rgba(0,0,0,0.22)');
    ctx.fillStyle = dome;
    ctx.beginPath();
    ctx.moveTo(-hw * 0.26, -hh * 0.36);
    ctx.bezierCurveTo(-hw * 0.30, -hh * 0.20, -hw * 0.28, -hh * 0.06, -hw * 0.22, 0);
    ctx.lineTo(hw * 0.22, 0);
    ctx.bezierCurveTo(hw * 0.28, -hh * 0.06, hw * 0.30, -hh * 0.20, hw * 0.26, -hh * 0.36);
    ctx.bezierCurveTo(hw * 0.10, -hh * 0.40, -hw * 0.10, -hh * 0.40, -hw * 0.26, -hh * 0.36);
    ctx.closePath(); ctx.fill();
    const rg = ctx.createLinearGradient(-hw, -hh * 0.40, hw, -hh * 0.02);
    rg.addColorStop(0, 'rgba(255,255,255,0)');
    rg.addColorStop(0.34, 'rgba(150,200,255,' + (0.07 + lit * 0.10).toFixed(3) + ')');
    rg.addColorStop(0.58, 'rgba(255,255,255,0.02)');
    rg.addColorStop(0.80, 'rgba(255,190,130,0.06)');
    rg.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = rg;
    ctx.fillRect(-hw, -hh * 0.40, hw * 2, hh * 0.26);
    ctx.strokeStyle = 'rgba(220,236,255,' + (0.10 + lit * 0.14).toFixed(3) + ')';
    ctx.lineWidth = Math.max(1, w * 0.005);
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(s * hw * 0.62, -hh * 0.335);
      ctx.bezierCurveTo(s * hw * 0.86, -hh * 0.19, s * hw * 0.96, -hh * 0.07, s * hw, -hh * 0.005);
      ctx.stroke();
    }
    const vw = hw * 0.11, vh = hh * 0.030;
    for (const s of [-1, 1]) {
      for (let k = 0; k < 3; k++) {
        const vx = s * hw * 0.47 - (s < 0 ? vw : 0);
        const vy = -hh * (0.250 - k * 0.052);
        const vg = ctx.createLinearGradient(0, vy, 0, vy + vh);
        vg.addColorStop(0, 'rgba(6,8,12,0.80)');
        vg.addColorStop(1, 'rgba(120,140,165,0.16)');
        ctx.fillStyle = vg;
        ctx.fillRect(vx, vy, vw, vh);
      }
    }
    ctx.restore();

    /* 패널 이음선 + 앞모서리 그늘 */
    ctx.strokeStyle = 'rgba(8,10,14,0.55)';
    ctx.lineWidth = Math.max(1, w * 0.0035);
    ctx.beginPath();
    ctx.moveTo(-hw * 0.62, -hh * 0.345);
    ctx.bezierCurveTo(-hw * 0.30, -hh * 0.415, hw * 0.30, -hh * 0.415, hw * 0.62, -hh * 0.345);
    ctx.stroke();
    ctx.fillStyle = 'rgba(0,0,0,0.30)';
    ctx.beginPath();
    ctx.moveTo(-hw, 0); ctx.lineTo(hw, 0);
    ctx.lineTo(hw * 0.94, -hh * 0.055); ctx.lineTo(-hw * 0.94, -hh * 0.055);
    ctx.closePath(); ctx.fill();

    /* 와이퍼 */
    ctx.strokeStyle = 'rgba(10,13,18,0.75)';
    ctx.lineWidth = Math.max(1.2, w * 0.006);
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(s * hw * 0.30, -hh * 0.335);
      ctx.lineTo(s * hw * 0.13, -hh * 0.470);
      ctx.stroke();
    }

    /* 사이드 미러(날렵한 케이스 + 거울면 반사) */
    for (const s of [-1, 1]) {
      const mx = s * hw * 0.92, my = -hh * 0.40;
      const mw = hw * 0.15, mh = hh * 0.075;
      ctx.fillStyle = 'rgba(10,13,19,0.92)';
      ctx.beginPath();
      ctx.moveTo(mx - s * mw * 0.10, my + mh * 0.10);
      ctx.lineTo(mx + s * mw * 0.92, my - mh * 0.20);
      ctx.lineTo(mx + s * mw * 1.00, my + mh * 0.55);
      ctx.lineTo(mx - s * mw * 0.20, my + mh * 0.95);
      ctx.closePath(); ctx.fill();
      const mg = ctx.createLinearGradient(mx, my - mh * 0.2, mx, my + mh);
      mg.addColorStop(0, 'rgba(120,170,225,' + (0.30 + lit * 0.22).toFixed(3) + ')');
      mg.addColorStop(0.60, 'rgba(30,44,64,0.70)');
      mg.addColorStop(1, 'rgba(12,16,22,0.80)');
      ctx.fillStyle = mg;
      ctx.beginPath();
      ctx.moveTo(mx + s * mw * 0.08, my + mh * 0.16);
      ctx.lineTo(mx + s * mw * 0.86, my - mh * 0.06);
      ctx.lineTo(mx + s * mw * 0.92, my + mh * 0.46);
      ctx.lineTo(mx + s * mw * 0.02, my + mh * 0.74);
      ctx.closePath(); ctx.fill();
    }

    /* 손상(후드 찌그러짐/기스) */
    if (dmg > 0.05) {
      const rnd = utils.mulberry32(4242);
      ctx.save(); hood(); ctx.clip();
      for (let i = 0; i < Math.floor(1 + dmg * 6); i++) {
        const x0 = (rnd() - 0.5) * hw * 1.7, y0 = -hh * (0.04 + rnd() * 0.30);
        const rr = hw * (0.05 + rnd() * 0.07) * (0.6 + dmg);
        const dg = ctx.createRadialGradient(x0, y0, 1, x0, y0, rr);
        dg.addColorStop(0, 'rgba(8,10,14,' + (0.30 + dmg * 0.30).toFixed(3) + ')');
        dg.addColorStop(0.55, 'rgba(20,24,30,0.14)');
        dg.addColorStop(1, 'rgba(0,0,0,0)');
        ctx.fillStyle = dg;
        ctx.beginPath(); ctx.ellipse(x0, y0, rr, rr * 0.55, rnd() * 3, 0, Math.PI * 2); ctx.fill();
      }
      ctx.strokeStyle = 'rgba(14,16,21,' + (0.20 + dmg * 0.35).toFixed(3) + ')';
      ctx.lineWidth = Math.max(1, w * 0.008);
      for (let i = 0; i < Math.floor(dmg * 9); i++) {
        const x0 = (rnd() - 0.5) * hw * 1.8, y0 = -hh * (0.03 + rnd() * 0.32);
        ctx.beginPath(); ctx.moveTo(x0, y0);
        ctx.lineTo(x0 + (rnd() - 0.5) * hw * 0.5, y0 + (rnd() - 0.5) * hh * 0.12);
        ctx.stroke();
      }
      ctx.restore();
    }
    ctx.restore();
  },

  roundPath(ctx, x, y, w, h, r) {
    r = Math.min(r, w / 2, h / 2);
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  },

  shade(hex, k) {
    const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    if (!m) return hex;
    const f = (v) => utils.clamp(Math.round(v * k), 0, 255);
    return 'rgb(' + f(parseInt(m[1], 16)) + ',' + f(parseInt(m[2], 16)) + ',' + f(parseInt(m[3], 16)) + ')';
  },

  glowSprite(ctx, cx, cy, size, alpha) {
    if (!this.lightGlow) return;
    ctx.globalAlpha = alpha;
    ctx.drawImage(this.lightGlow, cx - size / 2, cy - size / 2, size, size);
    ctx.globalAlpha = 1;
  }
};
