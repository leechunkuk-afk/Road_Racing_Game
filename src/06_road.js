/* ==========================================================================
   Road - 세그먼트 기반 코스 정의(커브/언듈레이션/가로등/소품/구역)
   세그먼트 = segLen 길이의 도로 조각. 커브는 curve 값의 누적(OutRun 방식).
   ========================================================================== */
const Road = {
  segments: [],
  trackLength: 0,
  seed: 0,
  zones: [],          // 구역(디스트릭트) 정보: {from,to,theme,name}
  lampList: [],       // {segIndex, side, z} - 조명 계산용 인덱스

  /* --------------------------------------------------------- 기본 추가 -- */
  addSegment(curve, y) {
    const n = this.segments.length;
    const light = Math.floor(n / CONFIG.road.rumbleLen) % 2 === 0;
    this.segments.push({
      index: n,
      p1: { world: { x: 0, y: this.lastY(), z: n * CONFIG.road.segLen }, camera: {}, screen: {} },
      p2: { world: { x: 0, y: y, z: (n + 1) * CONFIG.road.segLen }, camera: {}, screen: {} },
      curve: curve,
      sprites: [],
      cars: [],
      surface: 'asphalt',
      hazard: null,
      light: light,
      color: light ? 'light' : 'dark',
      lit: 1, fog: 0
    });
  },
  lastY() {
    const s = this.segments.length - 1;
    return s < 0 ? 0 : this.segments[s].p2.world.y;
  },

  addRoad(enter, hold, leave, curve, y) {
    const total = enter + hold + leave;
    const startY = this.lastY();
    const endY = startY + (y || 0) * CONFIG.road.segLen;
    const n = 0;
    for (let i = 0; i < enter; i++)
      this.addSegment(utils.easeIn(0, curve, i / enter), utils.easeInOut(startY, endY, i / total));
    for (let i = 0; i < hold; i++)
      this.addSegment(curve, utils.easeInOut(startY, endY, (enter + i) / total));
    for (let i = 0; i < leave; i++)
      this.addSegment(utils.easeInOut(curve, 0, i / leave), utils.easeInOut(startY, endY, (enter + hold + i) / total));
  },

  addStraight(num) { this.addRoad(num || ROAD.LEN.MEDIUM, num || ROAD.LEN.MEDIUM, num || ROAD.LEN.MEDIUM, 0, 0); },
  addCurve(num, curve, height) {
    this.addRoad(num || ROAD.LEN.MEDIUM, num || ROAD.LEN.MEDIUM, num || ROAD.LEN.MEDIUM,
      curve || ROAD.CURVE.MEDIUM, height || ROAD.HILL.NONE);
  },
  addHill(num, height) {
    this.addRoad(num || ROAD.LEN.MEDIUM, num || ROAD.LEN.MEDIUM, num || ROAD.LEN.MEDIUM, 0, height || ROAD.HILL.MEDIUM);
  },
  addLowRollingHills(num, height) {
    const n = num || ROAD.LEN.SHORT, h = height === undefined ? ROAD.HILL.LOW : height;
    this.addRoad(n, n, n, 0, h / 2);
    this.addRoad(n, n, n, 0, -h);
    this.addRoad(n, n, n, ROAD.CURVE.EASY, h);
    this.addRoad(n, n, n, 0, 0);
    this.addRoad(n, n, n, -ROAD.CURVE.EASY, h / 2);
    this.addRoad(n, n, n, 0, 0);
  },
  addSCurves() {
    this.addRoad(ROAD.LEN.MEDIUM, ROAD.LEN.MEDIUM, ROAD.LEN.MEDIUM, -ROAD.CURVE.EASY, ROAD.HILL.NONE);
    this.addRoad(ROAD.LEN.MEDIUM, ROAD.LEN.MEDIUM, ROAD.LEN.MEDIUM, ROAD.CURVE.MEDIUM, ROAD.HILL.MEDIUM);
    this.addRoad(ROAD.LEN.MEDIUM, ROAD.LEN.MEDIUM, ROAD.LEN.MEDIUM, ROAD.CURVE.EASY, -ROAD.HILL.LOW);
    this.addRoad(ROAD.LEN.MEDIUM, ROAD.LEN.MEDIUM, ROAD.LEN.MEDIUM, -ROAD.CURVE.EASY, ROAD.HILL.MEDIUM);
    this.addRoad(ROAD.LEN.MEDIUM, ROAD.LEN.MEDIUM, ROAD.LEN.MEDIUM, -ROAD.CURVE.MEDIUM, -ROAD.HILL.MEDIUM);
  },
  addBumps() {
    const seq = [5, -2, -5, 8, 5, -7, 5, -2];
    for (const v of seq) this.addRoad(10, 10, 10, 0, v);
  },
  addDownhillToEnd(num) {
    const n = num || 200;
    this.addRoad(n, n, n, -ROAD.CURVE.EASY, -this.lastY() / CONFIG.road.segLen);
  },

  /* ------------------------------------------------------------- 생성 -- */
  clear() { this.segments = []; this.zones = []; this.lampList = []; },

  resetSprites() {
    for (const s of this.segments) { s.sprites = []; }
    this.lampList = [];
  },

  build(seed) {
    this.seed = seed >>> 0;
    const rnd = utils.mulberry32(this.seed);
    this.clear();

    // 도시 순환 코스: 직선-커브-언듈레이션- 헤어핀Mix 를 섞어 반복
    this.addStraight(ROAD.LEN.SHORT);
    this.addLowRollingHills();
    this.addSCurves();
    this.addCurve(ROAD.LEN.MEDIUM, ROAD.CURVE.MEDIUM, ROAD.HILL.LOW);
    this.addStraight(70);
    this.addBumps();
    this.addLowRollingHills();
    this.addCurve(ROAD.LEN.LONG, ROAD.CURVE.MEDIUM, ROAD.HILL.MEDIUM);
    this.addSCurves();
    this.addHill(ROAD.LEN.MEDIUM, ROAD.HILL.HIGH);
    this.addStraight(ROAD.LEN.LONG);
    this.addSCurves();
    this.addCurve(ROAD.LEN.MEDIUM, -ROAD.CURVE.MEDIUM, -ROAD.HILL.LOW);
    this.addBumps();
    this.addCurve(ROAD.LEN.LONG, -ROAD.CURVE.MEDIUM, ROAD.HILL.MEDIUM);
    this.addStraight(ROAD.LEN.MEDIUM);
    this.addSCurves();
    this.addDownhillToEnd(120);

    this.trackLength = this.segments.length * CONFIG.road.segLen;
    this.makeZones(rnd);
    this.decorate(rnd);
    this.placeHazards(rnd);
    return this;
  },

  makeZones(rnd) {
    const themes = ['downtown', 'industrial', 'riverside', 'old_town', 'suburb'];
    const names = {
      downtown: '다운타운', industrial: '공업지대', riverside: '강변도로',
      old_town: '구시가', suburb: '외곽'
    };
    let at = 0;
    while (at < this.segments.length) {
      const len = 260 + Math.floor(rnd() * 320);
      const theme = themes[Math.floor(rnd() * themes.length)];
      this.zones.push({ from: at, to: Math.min(this.segments.length, at + len), theme: theme, name: names[theme] });
      at += len;
    }
  },
  zoneOf(i) {
    for (const z of this.zones) if (i >= z.from && i < z.to) return z;
    return this.zones[this.zones.length - 1];
  },

  /* 소품 배치: 가로등은 좌우 교대로 일정 간격, 그 밖에 구역별 장식품
     offset 단위는 '도로 절반 폭' 배수(1.0 = 노면 가장자리) */
  decorate(rnd) {
    this.resetSprites();
    const spacing = CONFIG.lighting.lampSpacing;
    const RW = CONFIG.road.width;
    const RAIL = CONFIG.road.railLimit;   // 가드레일 내측 한계
    const IN = RAIL - 0.04;               // 가드레일 안쪽 어깨(장애물 배치 가능 영역)

    const push = (seg, kind, offset, w, h, seed, solid) => {
      const s = seg.sprites;
      s.push({
        kind: kind, offset: offset, w: w, h: h, seed: seed | 0,
        solid: !!solid, hitW: w / RW
      });
    };

    for (const z of this.zones) {
      const th = z.theme;
      const lampGap = th === 'suburb' ? spacing * 2 : (th === 'downtown' ? Math.max(4, spacing - 3) : spacing);
      const bldgDeep = th === 'downtown' ? 3 : th === 'industrial' ? 2 : th === 'old_town' ? 2 : 1;
      const bldgScale = th === 'downtown' ? 1.45 : th === 'suburb' ? 0.62 : 1.0;
      const bldgChance = th === 'industrial' ? 0.55 : 0.85;

      for (let i = z.from; i < z.to; i++) {
        const seg = this.segments[i];
        const side = (Math.floor(i / lampGap) % 2) ? 1 : -1;
        const safeStart = i < 45;   // 스타트 라인 근처에는 장애물을 두지 않는다

        // 가로등: 가드레일 바깥(도달할 수 없지만 충돌 판정은 유지)
        if (i % lampGap === 0) {
          const off = side * (RAIL + (th === 'downtown' ? 0.20 : 0.34));
          push(seg, 'streetlight', off, PROP_SIZE.streetlight[0], PROP_SIZE.streetlight[1], i * 7 + (side > 0 ? 1 : 2), true);
          this.lampList.push({ i: i, side: side, z: i * CONFIG.road.segLen, off: off });
        }

        // 건물 블록: 가드레일 바깥쪽에만 배치(주행과 무관한 배경)
        if (i % 6 === 0 && rnd() < bldgChance) {
          let edge = RAIL + 0.55;
          for (let d = 0; d < bldgDeep; d++) {
            const bs = 1 - d * 0.14;
            const w = PROP_SIZE.bldg[0] * bldgScale * bs * (0.8 + rnd() * 0.7);
            const h = PROP_SIZE.bldg[1] * bldgScale * bs * (0.5 + rnd() * 0.95);
            const half = (w / 2) / RW;
            const off = side * (edge + half + rnd() * 0.3);
            push(seg, d === 0 ? 'bldg' : 'bldg_far', off, w, h, i * 31 + d * 17, d === 0);
            edge = off + half * side * 0.2;
          }
        }

        // 구역별 소품(가드레일 안쪽 어깨 = 실제로 부딪힐 수 있는 장애물)
        if (th === 'riverside' && i % 9 === 0 && rnd() < 0.7) {
          push(seg, 'tree', -side * (RAIL + 0.10 + rnd() * 0.06), PROP_SIZE.tree[0], PROP_SIZE.tree[1], i, true);
        }
        if (th === 'suburb' && !safeStart && i % 11 === 0 && rnd() < 0.55) {
          push(seg, 'tree', side * (IN + 0.02 + rnd() * 0.06), PROP_SIZE.tree[0], PROP_SIZE.tree[1], i, true);
        }
        if (th === 'industrial' && !safeStart && i % 17 === 0 && rnd() < 0.6) {
          const k = rnd() < 0.5 ? 'barrel' : 'rock';
          push(seg, k, side * (IN - 0.06 + rnd() * 0.10), PROP_SIZE[k][0], PROP_SIZE[k][1], i, true);
        }
        // 커브 구간 안전물(아웃코스에 몰림)
        if (!safeStart && Math.abs(seg.curve) > 3 && i % 5 === 0) {
          const os = -Math.sign(seg.curve) * (IN - 0.10 + rnd() * 0.08);
          push(seg, 'barrel', os, PROP_SIZE.barrel[0], PROP_SIZE.barrel[1], i, true);
        }
        // 교통 정체/공사 구간 흉내: 콘 + 배리어 + 타이어 더미(도로 위)
        if (!safeStart && i % 47 === 13) {
          push(seg, 'cone', side * (rnd() * 0.7), PROP_SIZE.cone[0], PROP_SIZE.cone[1], i, true);
        }
        if (!safeStart && i % 89 === 31) {
          push(seg, 'barrier', side * (0.15 + rnd() * 0.35), PROP_SIZE.barrier[0], PROP_SIZE.barrier[1], i, true);
          push(seg, 'cone', -side * 0.55, PROP_SIZE.cone[0], PROP_SIZE.cone[1], i + 3, true);
        }
        if (th !== 'suburb' && !safeStart && i % 61 === 44) {
          push(seg, 'tirestack', -side * (IN - 0.05), PROP_SIZE.tirestack[0], PROP_SIZE.tirestack[1], i, true);
        }
      }
    }
    return this;
  },

  /* 위험 노면(기름/얼음/비포장/젖은 노면)과 점프대를 코스에 배정한다.
     hazard 는 물리 그립에, ramp 는 발사(airborne)에 연결된다. */
  placeHazards(rnd) {
    const H = CONFIG.hazard;
    const total = this.segments.length;
    const starts = [];
    const themePick = {
      downtown: ['wet', 'oil', 'wet', 'gravel'],
      industrial: ['oil', 'oil', 'gravel', 'wet'],
      riverside: ['wet', 'ice', 'gravel', 'ice'],
      old_town: ['gravel', 'cobble', 'oil'],
      suburb: ['gravel', 'gravel', 'ice', 'wet']
    };

    /* 유형별 최소 개수를 채운 주머니를 만들어 섞는다.
       테마 풀에서만 뽑으면 특정 위험 유형이 코스에 한 개도 없는 일이 생긴다(실측: oil 0개). */
    const bag = [];
    for (const t in H.quota) for (let i = 0; i < H.quota[t]; i++) bag.push(t);
    while (bag.length < H.count) bag.push('wet');   // 여유분은 가장 순한 젖은 노면
    for (let i = bag.length - 1; i > 0; i--) {
      const j = Math.floor(rnd() * (i + 1));
      const tmp = bag[i]; bag[i] = bag[j]; bag[j] = tmp;
    }

    let guard = 0;
    while (starts.length < H.count && guard++ < H.count * 12) {
      const at = 70 + Math.floor(rnd() * (total - 140));
      let ok = true;
      for (const s of starts) if (Math.abs(s - at) < 70) { ok = false; break; }
      if (!ok) continue;
      starts.push(at);

      const theme = this.zoneOf(at).theme;
      const pool = themePick[theme] || ['wet'];
      // 남은 개수가 적은 유형부터 테마에 맞게 꺼낸다(테마와 무관한 유형은 어쩔 수 없이 그대로)
      let idx = -1, fewest = Infinity;
      for (let k = 0; k < bag.length; k++) {
        const t = bag[k] === 'cobble' ? 'gravel' : bag[k];
        if (pool.indexOf(t) < 0) continue;
        let left = 0;
        for (const x of bag) if ((x === 'cobble' ? 'gravel' : x) === t) left++;
        if (left < fewest) { fewest = left; idx = k; }
      }
      let type = idx >= 0 ? bag.splice(idx, 1)[0] : bag.pop();
      if (type === 'cobble') type = 'gravel';
      const len = H.minLen + Math.floor(rnd() * (H.maxLen - H.minLen));
      const sideBias = rnd() < 0.45 ? (rnd() < 0.5 ? -1 : 1) : 0;   // 0 = 전체 차선

      for (let i = at; i < Math.min(total, at + len); i++) {
        const seg = this.segments[i];
        seg.patch = { type: type, partial: sideBias !== 0, side: sideBias };
        if (type === 'oil' || type === 'ice') { seg.hazard = { type: type }; seg.surface = type; }
        else seg.surface = type;
      }
      // 진입 경고: 콘 + 노면 화살표로 위험 구간 앞을 표시
      for (let k = 6; k >= 2; k -= 2) {
        const i = at - k;
        if (i < 1) continue;
        const seg = this.segments[i];
        const os = (sideBias ? sideBias * 0.62 : 0.86);
        seg.sprites.push({
          kind: 'cone', offset: os, w: PROP_SIZE.cone[0], h: PROP_SIZE.cone[1],
          seed: i, solid: true, hitW: PROP_SIZE.cone[0] / CONFIG.road.width
        });
      }
    }

    // 점프대: 가능한 직선 구간에만 배치
    let ramps = 0, at2 = 120;
    while (ramps < H.rampCount && at2 < total - 60) {
      at2 += 120 + Math.floor(rnd() * 180);
      const i = at2;
      if (i >= total - 20) break;
      const seg = this.segments[i];
      if (Math.abs(seg.curve) > 1.2 || seg.patch) continue;
      if (this.segments[i - 1].ramp || seg.hazard) continue;
      seg.ramp = true;
      seg.rampOffset = (rnd() - 0.5) * 0.7;
      seg.sprites.push({
        kind: 'ramp', offset: seg.rampOffset, w: PROP_SIZE.ramp[0], h: PROP_SIZE.ramp[1],
        seed: i, solid: false, hitW: PROP_SIZE.ramp[0] / CONFIG.road.width
      });
      // 좌우 안내 콘
      for (const s of [-1, 1]) {
        for (let k = 3; k >= 1; k--) {
          const j = i - k * 2;
          if (j < 1) continue;
          this.segments[j].sprites.push({
            kind: 'cone', offset: s * (0.86 + k * 0.02), w: PROP_SIZE.cone[0], h: PROP_SIZE.cone[1],
            seed: j + s, solid: true, hitW: PROP_SIZE.cone[0] / CONFIG.road.width
          });
        }
      }
      ramps++;
    }
    this.rampCount = ramps;
    return this;
  },

  /* ----------------------------------------------------------- 조회 -- */
  findSegment(z) {
    const n = this.segments.length;
    let i = Math.floor(z / CONFIG.road.segLen) % n;
    if (i < 0) i += n;
    return this.segments[i];
  },

  /* 구간 조명 강도: 가로등 위치 기준으로 0..1 (M1: 단순 거리 감쇠) */
  lampLight(z) {
    const reach = CONFIG.lighting.lampReach;
    let best = 0;
    const n = this.lampList.length;
    if (!n) return 0;
    // z 근처만: lampList 는 정렬돼 있으므로 이진 탐색
    let lo = 0, hi = n - 1;
    while (lo < hi) { const mid = (lo + hi) >> 1; if (this.lampList[mid].z < z) lo = mid + 1; else hi = mid; }
    for (let k = Math.max(0, lo - 6); k < Math.min(n, lo + 6); k++) {
      const d = Math.abs(this.lampList[k].z - z);
      const f = 1 - utils.clamp(d / reach, 0, 1);
      if (f > best) best = f;
    }
    return best;
  },

  nearestZoneName(z) {
    const s = this.findSegment(z);
    const zone = this.zoneOf(s.index);
    return zone ? zone.name : '';
  }
};
