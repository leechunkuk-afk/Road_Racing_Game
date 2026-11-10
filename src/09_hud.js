/* ==========================================================================
   HUD - 같은 캔버스 위에 얹는 계기판/미니맵/상태 표시
   ========================================================================== */
const HUD = {
  fps: 60, fpsAcc: 0, fpsN: 0, fpsShow: 60,
  zoneShown: '', zoneT: 0,

  draw(dt) {
    const g = SCR.ctx, W = SCR.w, H = SCR.h;
    const p = Physics.player, s = Physics.stats;

    this.fpsAcc += dt; this.fpsN++;
    if (this.fpsAcc >= 0.5) { this.fpsShow = Math.round(this.fpsN / this.fpsAcc); this.fpsAcc = 0; this.fpsN = 0; }

    g.save();
    g.setTransform(SCR.dpr, 0, 0, SCR.dpr, 0, 0);

    this.drawTopLeft();
    this.drawGauge(W - 118, H - 96, 78);
    this.drawSurface(W - 118, H - 178);
    this.drawBars(28, H - 118);
    this.drawMiniMap(W - 150, 96);
    this.drawStatus(W / 2, 26);
    this.drawZone(W / 2, H * 0.2);

    g.restore();
  },

  txt(g, s, x, y, size, col, align, glow) {
    g.font = '600 ' + size + 'px "Segoe UI","Malgun Gothic",sans-serif';
    g.textAlign = align || 'left';
    g.textBaseline = 'alphabetic';
    if (glow) { g.shadowColor = glow; g.shadowBlur = 12; }
    g.fillStyle = col;
    g.fillText(s, x, y);
    g.shadowBlur = 0;
  },

  drawTopLeft() {
    const g = SCR.ctx, p = Physics.player;
    const t = utils.fmtTime(Game.clock);
    this.txt(g, t, 26, 40, 24, '#eaf4ff', 'left', 'rgba(49,217,255,.8)');
    this.txt(g, (p.travelled / 1000 * 0.05).toFixed(2) + ' km', 26, 64, 13, '#8fa8c4');
    this.txt(g, (Game.mode === 'free' ? '자유주행' : '레이스') + ' · ' + Road.nearestZoneName(p.z), 26, 84, 13, '#9fd4ff');
    if (Save.data.cam === 'hood') this.txt(g, '1인칭(보닛)', 26, 104, 12, '#ffc46b');
  },

  drawStatus(x, y) {
    const g = SCR.ctx;
    const sm = Assets.summary();
    const label = sm.ok === 0 ? '절차적 모드(에셋 없음)' : '실물 에셋 ' + sm.ok + '/' + sm.total;
    g.globalAlpha = 0.85;
    this.txt(g, 'FPS ' + this.fpsShow + '  ·  ' + label, x, y, 12,
      sm.ok === 0 ? '#ffc46b' : '#8fa8c4', 'center');
    g.globalAlpha = 1;
  },

  /* 계기판: 원형 게이지 + 기어 */
  drawGauge(cx, cy, r) {
    const g = SCR.ctx, p = Physics.player;
    const pct = utils.clamp(p.speed / Physics.topSpeed(), 0, 1);
    const a0 = Math.PI * 0.78, a1 = Math.PI * 2.22;

    g.save();
    g.globalAlpha = 0.92;
    // 받침
    g.lineWidth = 9; g.lineCap = 'round';
    g.strokeStyle = 'rgba(120,190,255,0.14)';
    g.beginPath(); g.arc(cx, cy, r, a0, a1); g.stroke();
    // 게이지
    const grd = g.createLinearGradient(cx - r, cy, cx + r, cy);
    grd.addColorStop(0, '#31d9ff'); grd.addColorStop(0.7, '#ffd166'); grd.addColorStop(1, '#ff2f8e');
    g.strokeStyle = grd; g.lineWidth = 7;
    g.beginPath(); g.arc(cx, cy, r, a0, a0 + (a1 - a0) * pct); g.stroke();
    // 눈금
    g.strokeStyle = 'rgba(200,225,255,0.35)'; g.lineWidth = 1.5;
    for (let i = 0; i <= 10; i++) {
      const a = a0 + (a1 - a0) * (i / 10);
      const s1 = r - 13, s2 = r - (i % 5 === 0 ? 22 : 18);
      g.beginPath();
      g.moveTo(cx + Math.cos(a) * s1, cy + Math.sin(a) * s1);
      g.lineTo(cx + Math.cos(a) * s2, cy + Math.sin(a) * s2);
      g.stroke();
    }
    // 바늘
    const an = a0 + (a1 - a0) * pct;
    g.strokeStyle = '#ff5f7a'; g.lineWidth = 2.5;
    g.beginPath();
    g.moveTo(cx - Math.cos(an) * 12, cy - Math.sin(an) * 12);
    g.lineTo(cx + Math.cos(an) * (r - 16), cy + Math.sin(an) * (r - 16));
    g.stroke();
    // 수치
    this.txt(g, String(Math.round(p.kmh)), cx, cy + 6, 30, '#ffffff', 'center', 'rgba(49,217,255,.9)');
    this.txt(g, 'km/h', cx, cy + 24, 11, '#8fa8c4', 'center');
    this.txt(g, 'D' + p.gear, cx + r - 6, cy - r + 22, 15, p.boost ? '#ff2f8e' : '#9fd4ff', 'center');
    g.restore();
  },

  /* 계기판 위: 현재 노면/그립 상태 (점프 중이면 높이 표시) */
  drawSurface(cx, cy) {
    const g = SCR.ctx, p = Physics.player;
    const SURF = {
      asphalt: ['아스팔트', '#8fa8c4'], wet: ['젖은 노면', '#7fc8ff'],
      gravel: ['비포장', '#e0c18a'], dirt: ['비포장 길바닥', '#e0c18a'],
      ice: ['빙판', '#9fe8ff'], oil: ['기름 유출', '#ff8fae'], ramp: ['점프대', '#ffc46b']
    };
    let label = null, col = '#8fa8c4';
    if (p.airborne) {
      label = '공중 ' + Math.max(0, Math.round(p.y / 50)) + ' m';
      col = '#49d9ff';
    } else if (p.surface !== 'asphalt') {
      const it = SURF[p.surface] || [p.surface, '#ffc46b'];
      label = it[0];
      col = it[1];
    }
    if (!label) return;
    const grip = Math.round(utils.clamp(p.grip, 0, 1.6) * 100 / 1.6);
    g.save();
    g.globalAlpha = 0.9;
    this.txt(g, label, cx, cy, 13, col, 'center');
    // 그립 막대
    const bw = 96;
    g.fillStyle = 'rgba(120,190,255,0.12)';
    g.fillRect(cx - bw / 2, cy + 6, bw, 5);
    g.fillStyle = col;
    g.fillRect(cx - bw / 2, cy + 6, bw * utils.clamp(p.grip, 0, 1), 5);
    g.restore();
  },

  /* 좌측 하단: 4계통 상태 바 (M1: 표시만) */
  drawBars(x, y) {
    const g = SCR.ctx;
    const s = Physics.stats;
    const rows = [
      ['차체', s.body, '#7fe3a0'],
      ['엔진', s.engine, '#7fc8ff'],
      ['타이어', s.tire, '#ffd166'],
      ['연료', s.fuel, '#ff9f6b']
    ];
    g.save();
    g.globalAlpha = 0.9;
    rows.forEach((r, i) => {
      const yy = y + i * 21;
      this.txt(g, r[0], x, yy + 10, 11, '#8fa8c4');
      g.fillStyle = 'rgba(120,190,255,0.12)';
      g.fillRect(x + 42, yy + 3, 128, 8);
      const v = utils.clamp(r[1] / 100, 0, 1);
      g.fillStyle = r[2];
      g.fillRect(x + 42, yy + 3, 128 * v, 8);
      g.strokeStyle = 'rgba(120,190,255,0.22)'; g.lineWidth = 1;
      g.strokeRect(x + 42.5, yy + 3.5, 127, 7);
      if (v < 0.25) this.txt(g, '!', x + 178, yy + 11, 12, '#ff5f7a');
    });
    g.restore();
  },

  /* 우상단: 전방 커브 미니맵(곡률 누적 polyline) */
  drawMiniMap(cx, cy) {
    const g = SCR.ctx;
    const p = Physics.player;
    const look = 90;
    const base = Road.findSegment(p.z);
    const n = Road.segments.length;
    let x = 0, dx = 0, heading = 0;
    const pts = [];
    for (let i = 0; i < look; i++) {
      const seg = Road.segments[(base.index + i) % n];
      heading += seg.curve * 0.02;
      x += Math.sin(heading);
      pts.push({ i: i, x: x, y: -i * 0.9, curve: seg.curve });
    }
    const sc = 1.55;
    g.save();
    g.globalAlpha = 0.85;
    g.strokeStyle = 'rgba(120,190,255,0.18)'; g.lineWidth = 1;
    g.strokeRect(cx - 60, cy - 30, 120, 130);
    g.strokeStyle = 'rgba(180,215,255,0.55)'; g.lineWidth = 3; g.lineCap = 'round';
    g.beginPath();
    for (let i = 0; i < pts.length; i++) {
      const px = cx + pts[i].x * sc * 6, py = cy + 95 + pts[i].y * sc * 6 + 95;
      if (i === 0) g.moveTo(px, py); else g.lineTo(px, py);
    }
    g.stroke();
    // 내 위치
    g.fillStyle = '#ff5f7a';
    g.beginPath(); g.arc(cx + pts[0].x * sc * 6, cy + 95 + 95, 4, 0, Math.PI * 2); g.fill();
    this.txt(g, '전방 코스', cx, cy - 36, 11, '#8fa8c4', 'center');
    g.restore();
  },

  /* 구역 이름 팝업 */
  drawZone(cx, cy) {
    const p = Physics.player;
    const zn = Road.nearestZoneName(p.z);
    if (zn !== this.zoneShown) {
      this.zoneShown = zn; this.zoneT = 2.2;
    }
    if (this.zoneT > 0) {
      this.zoneT -= 1 / 60;
      const a = utils.clamp(this.zoneT / 0.6, 0, 1);
      SCR.ctx.globalAlpha = a;
      this.txt(SCR.ctx, zn, cx, cy, 22, '#cfe6ff', 'center', 'rgba(49,217,255,.7)');
      SCR.ctx.globalAlpha = 1;
    }
  }
};
