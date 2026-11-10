/* ==========================================================================
   Physics - 플레이어 차량 물리(속도/조향/원심력/노면/충돌) + 카메라 상태
   좌표: z = 진행 방향(유닛), playerX = 도로 폭 단위(-1 좌측 끝 ~ 1 우측 끝)
   ========================================================================== */
const Physics = {
  player: null,
  cam: { x: 0, y: 0, z: 0, depth: 0, bob: 0, shake: 0, shakeT: 0, fov: CONFIG.camera.fovBase },
  fx: { particles: [], lines: [], skidmarks: [] },
  stats: null,
  mode: 'free',

  /* 차량 절반폭을 playerX 단위(도로 절반폭의 배수)로 환산. 렌더·충돌·점프 판정이 같은 실측을 쓴다 */
  carHalfX() {
    const c = CONFIG.car;
    return (c.widthM * CONFIG.unitPerMeter) / (2 * CONFIG.road.width) * c.hitGrace;
  },

  setup() {
    const maxSpeed = CONFIG.road.segLen / CONFIG.road.rumbleLen / (1 / 60);
    const p = CONFIG.physics;
    p.maxSpeed = maxSpeed;
    p.accel = maxSpeed / 5.2;
    p.brake = -maxSpeed / 1.6;
    p.decel = -maxSpeed / 6.0;
    p.offRoadDecel = -maxSpeed / 2.2;
    p.offRoadLimit = maxSpeed / 3.2;
    this.stats = this.baseStats();
    this.player = this.newCar();
    this.cam.depth = 1 / Math.tan((CONFIG.camera.fovBase / 2) * Math.PI / 180);
    return this;
  },

  baseStats() {
    return {
      engineLv: 1, tireLv: 1, brakeLv: 1, bodyLv: 1, nitroLv: 1,
      engine: 100, tire: 100, fuel: 100, body: 100,
      tune: { accel: 0, grip: 0, brake: 0 }
    };
  },

  newCar() {
    const s = this.stats;
    return {
      z: 0, speed: 0, x: 0, y: 0, vy: 0, airborne: false,
      steer: 0, yaw: 0, roll: 0, pitch: 0, prevSpeed: 0,
      gear: 1, rpm: 0, throttle: 0, brakeOn: false, hand: false, boost: false, boostT: 0,
      slip: 0, offRoad: false, surface: 'asphalt', grip: 1,
      kmh: 0, travelled: 0, driftTime: 0,
      dmg: { engine: s.engine, tire: s.tire, body: s.body },
      blinker: 0, invuln: 0, started: false, flipped: 0,
      rampCool: 0, wobPhase: Math.random() * 6.28, launchPower: 0
    };
  },

  reset(keepStats) {
    if (!keepStats) this.stats = this.baseStats();
    this.player = this.newCar();
    this.fx.particles = []; this.fx.lines = []; this.fx.skidmarks = [];
    this.cam.shake = 0;
    return this.player;
  },

  /* ------------------------------------------------------------ helpers -- */
  topSpeed() {
    const s = this.stats;
    return CONFIG.physics.maxSpeed * (0.86 + 0.05 * s.engineLv + 0.02 * s.tune.accel);
  },
  powerRatio() {
    const s = this.stats;
    const dmgPenalty = s.engine < 30 ? 0.30 : s.engine < 60 ? 0.12 : 0;
    return 1 + 0.10 * (s.engineLv - 1) + 0.04 * s.tune.accel - dmgPenalty;
  },
  gripNow() {
    const s = this.stats;
    const base = CONFIG.surfaces[this.player.surface] || 1;
    const tire = 1 - (1 - s.tire / 100) * 0.35;
    return utils.clamp(base * (0.9 + 0.04 * s.tireLv + 0.03 * s.tune.grip) * tire, 0.08, 1.6);
  },

  /* 노면 종류 결정: 코스 표면 + 위험 패치(기름/얼음/비포장) + 도로 바깥 */
  updateSurface(seg) {
    const p = this.player;
    let surf = seg.surface || 'asphalt';
    if (seg.hazard && CONFIG.hazardInfo[seg.hazard.type]) surf = seg.hazard.type;
    if (p.offRoad && surf === 'asphalt') surf = 'dirt';
    if (surf === p.surface) return;
    p.surface = surf;
    p.wobPhase = Math.random() * Math.PI * 2;
    const info = CONFIG.hazardInfo[surf];
    if (info) Toast.show(info.ko + ' 구간', 1500);
    else if (surf === 'dirt') Toast.show('비포장 도로 바깥', 1200);
  },

  /* ----------------------------------------------------------- update -- */
  update(dt, inp) {
    const p = this.player, s = this.stats, ph = CONFIG.physics;
    if (!p) return;
    p.prevSpeed = p.speed;

    const seg = Road.findSegment(p.z);
    const seg2 = Road.findSegment(p.z + CONFIG.road.segLen);
    const speedPct = p.speed / this.topSpeed();
    this.updateSurface(seg);
    p.grip = this.gripNow();

    /* 입력 -> 가속/브레이크 */
    p.throttle = inp.up ? 1 : 0;
    p.brakeOn = !!inp.down;
    p.hand = !!inp.hand;
    const wantBoost = !!inp.boost && s.fuel > 1;
    if (wantBoost && !p.boost) { p.boostT = 0; Sound.sfx('boost_s'); }
    p.boost = wantBoost;
    if (p.boost) {
      p.boostT += dt;
      s.fuel = Math.max(0, s.fuel - dt * 3.4);
      if (p.boostT > 0.4 && Math.random() < 0.06) Sound.sfx('boost_l');
    }

    const acc = this.powerRatio();
    const brkGrip = 0.50 + 0.50 * utils.clamp(p.grip, 0, 1);
    if (p.boost) p.speed += ph.accel * acc * 1.55 * dt;
    else if (p.throttle) p.speed += ph.accel * acc * dt;
    else if (p.brakeOn) p.speed += ph.brake * (0.75 + 0.05 * s.brakeLv + 0.02 * s.tune.brake) * brkGrip * dt;
    else p.speed += ph.decel * dt;

    if (p.offRoad) {
      if (p.speed > ph.offRoadLimit) p.speed += ph.offRoadDecel * dt;
      // 비포장/잔도 소음·진동
      this.cam.bob = Math.sin(p.z / 40) * (2 + speedPct * 5);
    } else {
      this.cam.bob = Math.sin(p.z / 900) * (0.5 + speedPct * 1.6);
    }

    /* 조향 */
    const grip = p.grip;
    const steerBase = (inp.left ? -1 : 0) + (inp.right ? 1 : 0);
    const maxSteer = 1;
    const responsive = (p.hand ? 1.45 : 1.0) * (0.55 + 0.45 * Math.min(1, speedPct * 2.2));
    p.steer = utils.clamp(p.steer + steerBase * ph.steerRate * dt * responsive, -maxSteer, maxSteer);
    if (!steerBase) p.steer *= Math.pow(0.02, dt);

    // 조향은 속도가 있을 때만 효율(정지 상태에선 미세)
    const dx = dt * 2 * speedPct * (0.6 + 0.4 * grip);
    p.x += p.steer * dx;

    // 커브 원심력
    p.x -= dt * speedPct * speedPct * seg.curve * ph.centrifugal * (1.25 - grip * 0.35);

    // 미끄러짐(핸드브레이크/저그립) - 드리프트 강도 0..1
    const driftAmt = utils.clamp(
      Math.abs(p.steer) * speedPct * (p.hand ? 1.7 : 1) * (1.4 - grip), 0, 1);
    p.slip = utils.lerp(p.slip, driftAmt, dt * 6);
    p.yaw = utils.lerp(p.yaw, p.steer * (0.16 + driftAmt * 0.5), dt * 6);
    p.roll = utils.lerp(p.roll, -p.steer * (0.03 + driftAmt * 0.07), dt * 5);

    // 저그립 노면(기름/얼음/비포장): steering 을 하지 않아도 차가 밀린다
    if (grip < 0.62 && speedPct > 0.12 && !p.airborne) {
      p.wobPhase += dt * (4.5 + speedPct * 11);
      const wob = (0.62 - grip) * Math.sin(p.wobPhase) * speedPct;
      p.x += wob * dt * 1.9;
      p.yaw = utils.clamp(p.yaw + wob * 0.22, -1, 1);
      p.roll = utils.clamp(p.roll + wob * 0.10, -0.25, 0.25);
      if (grip < 0.35 && Math.random() < 0.25) FX.smoke(p.z + 40, p.x, 1);
    }

    const driftNeed = grip < 0.62 ? 0.20 : 0.35;
    if (driftAmt > driftNeed && speedPct > 0.18 && !p.offRoad) {
      p.driftTime += dt;
      Sound.skid(driftAmt);
      if (Math.random() < 0.6) FX.skid(p.z + 120, p.x, p.steer);
      FX.smoke(p.z + 60, p.x, 1);
    } else {
      Sound.skid(0);
    }

    /* 노면 밖 + 충돌 */
    p.offRoad = Math.abs(p.x) > 1;
    this.collide(dt, seg, speedPct);

    /* 점프대 발사 */
    if (p.rampCool > 0) p.rampCool -= dt;
    if (!p.airborne && p.rampCool <= 0 && seg.ramp && speedPct >= CONFIG.hazard.rampMinSpeed) {
      const half = (PROP_SIZE.ramp[0] / CONFIG.road.width) * 0.5;
      if (utils.overlap(p.x, this.carHalfX(), seg.rampOffset, half, 0.85)) {
        p.airborne = true;
        p.vy = CONFIG.hazard.launchBase + CONFIG.hazard.launchMore * speedPct;
        p.launchPower = speedPct;
        p.rampCool = 1.5;
        p.pitch = -0.14;
        this.cam.shake = Math.max(this.cam.shake, 2.5);
        Sound.sfx('jump');
        // 정점 높이(m): 월드 스케일(100유닛 = 1m) 기준으로 표시
        const apexM = p.vy * p.vy / (2 * CONFIG.physics.gravity * CONFIG.unitPerMeter);
        Toast.show('점프 ' + Math.round(apexM) + 'm', 1200);
      }
    }

    /* 점프(air) */
    if (p.airborne) {
      p.vy -= CONFIG.physics.gravity * dt;
      p.y += p.vy * dt;
      p.pitch = utils.lerp(p.pitch, -0.10, dt * 3);
      if (p.y <= 0) {
        p.y = 0; p.airborne = false;
        const hard = Math.abs(p.vy) / CONFIG.physics.landingHard;
        this.cam.shake = Math.min(CONFIG.fx.shakeMax, 3 + hard * 8);
        p.pitch = 0.06;
        if (hard > 0.5) { this.damageBody(hard * 6, 'landing'); Sound.sfx('crash2'); }
      }
    } else {
      p.pitch = utils.lerp(p.pitch, 0, dt * 4);
    }

    /* 속도 클램프 + 이동 */
    p.speed = utils.clamp(p.speed, 0, this.topSpeed() * (p.boost ? 1.12 : 1));
    p.kmh = p.speed * ph.kmhFactor;
    const dz = p.speed * dt;
    p.z = utils.inc(p.z, dz, Road.trackLength);
    p.travelled += dz;

    /* 기어/rpm(표시+엔진음) */
    const gr = ph.dragShifts;
    const band = 1 / gr;
    const within = (speedPct % band) / band;
    p.gear = Math.min(gr, 1 + Math.floor(speedPct * gr));
    p.rpm = utils.clamp(0.16 + within * 0.84 + (p.throttle ? 0.05 : -0.03), 0.05, 1);
    Sound.engine(p.rpm, p.throttle, p.boost);

    /* 카메라 */
    this.cam.fov = utils.lerp(this.cam.fov, CONFIG.camera.fovBase + (CONFIG.camera.fovMax - CONFIG.camera.fovBase) * speedPct, dt * 3);
    this.cam.depth = 1 / Math.tan((this.cam.fov / 2) * Math.PI / 180);
    this.cam.x = p.x * CONFIG.road.width;
    this.cam.y = CONFIG.camera.height + p.y;
    this.cam.shakeT += dt;
    if (this.cam.shake > 0) this.cam.shake = Math.max(0, this.cam.shake - dt * 14);

    if (p.invuln > 0) p.invuln -= dt;
    s.fuel = Math.max(0, s.fuel - dt * 0.16 - dt * speedPct * 0.22);

    FX.update(dt, p);
    return p;
  },

  /* 실체 충돌: 연속 가드레일 + 개별 물체(solid 스프라이트) */
  collide(dt, seg, speedPct) {
    const p = this.player;
    // 1) 가드레일은 무적 여부와 관계없이 항상 적용(경계를 통과하면 안 됨)
    this.railCollide(dt);
    // 2) 개별 물체 충돌은 최근 충돌 직후 짧은 무적 시간에는 무시
    if (p.invuln > 0) return;
    const near = [Road.findSegment(p.z - CONFIG.road.segLen), seg, Road.findSegment(p.z + CONFIG.road.segLen)];
    for (const sg of near) {
      for (const sp of sg.sprites) {
        if (!sp.solid) continue;
        if (!utils.overlap(p.x, this.carHalfX(), sp.offset, (sp.w / CONFIG.road.width) * 0.5, 0.75)) continue;
        this.crash(sp, speedPct);
        return;
      }
    }
  },

  /* 가드레일 접촉: 감속 + 차체 마모 + 불꽃. 노면 밖으로 밀려나는 것을 막는다 */
  railCollide(dt) {
    const p = this.player, s = this.stats;
    const RAIL = CONFIG.road.railLimit;
    if (Math.abs(p.x) <= RAIL) return;
    p.x = utils.clamp(p.x, -RAIL, RAIL);
    // 스크레이핑: 초당 30% 감속, 차체 초당 2.5 깎임(금방 폐차되지 않도록 완만하게)
    p.speed = Math.max(0, p.speed * (1 - 0.35 * dt));
    this.cam.shake = Math.max(this.cam.shake, 2.2);
    Sound.skid(0.5);
    if (Math.random() < 0.4) FX.sparks(p.x);
    s.body = Math.max(0, s.body - dt * 2.5);
    if (s.body <= 0) Game.wreck();
  },

  crash(sp, speedPct) {
    const p = this.player;
    const info = CONFIG.obstacles[sp.kind] || { dmg: 1, keep: 0.35, ko: '장애물' };
    p.speed *= info.keep;
    p.invuln = 1.0;
    this.cam.shake = CONFIG.fx.shakeMax * utils.clamp(0.45 + speedPct, 0.45, 1);
    this.damageBody((3 + speedPct * 12) * info.dmg, 'impact');
    Sound.sfx(speedPct > 0.5 ? 'crash2' : 'crash1');
    // 쾅 소리 위에 유리/파편 소리를 겹쳐 무게감을 더한다(무거운 물체·고속 충돌일 때만)
    if (speedPct > 0.55) Sound.sfx('crash_glass');
    if (speedPct > 0.7 && (sp.kind === 'barrier' || sp.kind === 'bldg' || sp.kind === 'streetlight')) Sound.sfx('crash_break');
    FX.debris(sp.offset, sp.kind);
    Toast.show('충돌! ' + info.ko);
  },

  damageBody(amount, why) {
    const s = this.stats;
    s.body = Math.max(0, s.body - amount);
    s.tire = Math.max(0, s.tire - amount * 0.18);
    if (why === 'impact') s.engine = Math.max(0, s.engine - amount * 0.22);
    if (s.body <= 0) Game.wreck();
  },

  /* 외부에서 노면 변경(M2 에서 호출) */
  setSurface(seg, type, extra) {
    seg.surface = type;
    seg.hazard = extra || null;
  }
};
