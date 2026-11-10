/* ==========================================================================
   Game - 상태 관리 + 고정 타임스텝 루프
   ========================================================================== */
const Game = {
  mode: 'boot',
  clock: 0,
  carColor: '#31466d',      // 보닛 뷰/절차적 폴백용 차체색(차고에서 고른 색과 맞춘다)
  step: 1 / 60,
  acc: 0,
  last: 0,
  frameCount: 0,
  running: false,
  seed: 20261110,

  /* ---- 차량 색(Blender 스프라이트 3종). M4 차고에서 쓰는 API 이다. ---- */
  carPalette() {
    const S = CONFIG.car.sprites;
    let p = null;
    for (const q of S.palettes) if (q.id === Save.data.carColor) p = q;
    return p || S.palettes[0];
  },
  setCarColor(id) {
    let p = null;
    for (const q of CONFIG.car.sprites.palettes) if (q.id === id) p = q;
    if (!p) return null;
    Save.data.carColor = p.id;
    Save.put();
    this.carColor = p.hex;
    return p;
  },

  boot() {
    SCR.init();
    Input.init();
    Save.load();
    this.carColor = this.carPalette().hex;
    Assets.init();

    UI.init();
    UI.bootProgress(0.05, '도로 생성 중…');

    // 코스는 에셋과 병렬로 먼저 만들어 둔다(폴백 상태에서도 즉시 달릴 수 있게)
    Road.build(this.seed);
    Physics.setup();
    Sprites.build();
    Render.init();
    Sound.init();

    UI.bootProgress(0.2, '에셋 로드 중…');
    Assets.load(
      (done, total) => UI.bootProgress(0.2 + 0.8 * (done / Math.max(1, total)), '에셋 로드 중… ' + done + '/' + total),
      (sm) => {
        UI.bootProgress(1, '준비 완료');
        UI.bootDone(sm);
        Sound.rescan();          // 사운드 참조는 에셋 로드 이후에 확정한다
        this.toMenu();
        if (sm.ok === 0) Toast.show('실물 에셋 없음: 절차적 그래픽/합성 사운드로 실행합니다', 3200);
      }
    );

    this.running = true;
    this.last = performance.now();
    requestAnimationFrame((t) => this.loop(t));
    return this;
  },

  /* ---------------------------------------------------------- 상태 -- */
  toMenu() {
    this.mode = 'menu';
    this.clock = 0;
    UI.show('menuLayer');
    Sound.stopEngine();          // 주행 중 메뉴로 오면 엔진 루프를 세운다
    Sound.skid(0);
    Sound.music.play('mus_menu');
  },
  startFree() {
    this.mode = 'play';
    this.clock = 0;
    // 자유주행 시작 시에는 차량을 정비한 상태로 시작한다(M4 상점 시스템에서 유지/정비로 대체 예정)
    Physics.reset(false);
    UI.none();
    Sound.unlock();
    Sound.startEngine();
    Sound.music.play('mus_cruise');
    Toast.show('출발!  Esc = 일시정지 · C = 시점 전환', 2400);
  },
  pause() {
    if (this.mode !== 'play') return;
    this.mode = 'pause';
    UI.show('pauseLayer');
    Sound.engine(0.12, 0, false);
    Sound.skid(0);
  },
  resume() {
    if (this.mode !== 'pause') return;
    this.mode = 'play';
    UI.none();
    this.last = performance.now();
    this.acc = 0;
  },
  wreck() {
    this.mode = 'wreck';
    Physics.player.speed = 0;
    Sound.stopEngine();
    Sound.skid(0);
    Toast.show('차량이 폐차되었습니다 - 메뉴로 돌아갑니다', 2600);
    setTimeout(() => this.toMenu(), 1800);
  },
  buildCourse(seed) {
    this.seed = seed >>> 0;
    Road.build(this.seed);
    Physics.reset(true);
  },

  /* ------------------------------------------------------------ 루프 -- */
  errCount: 0,
  loop(ts) {
    if (!this.running) return;
    requestAnimationFrame((t) => this.loop(t));
    try {
      this.step_frame(ts);
    } catch (e) {
      this.onError(e);
    }
  },

  onError(e) {
    this.errCount++;
    if (this.errCount === 1) {
      console.error(e);
      Toast.show('오류가 발생했습니다: ' + (e && e.message ? e.message : e), 3200);
    }
    if (this.errCount > 40) {
      this.running = false;
      Toast.show('계속 실행이 어려워 잠시 멈춥니다. 새로고침 후 다시 시도해 주세요.', 5000);
    }
  },

  step_frame(ts) {
    const dt = Math.min(0.1, (ts - this.last) / 1000);
    this.last = ts;

    this.handleKeys();

    if (this.mode === 'play' || this.mode === 'wreck') {
      this.acc += dt;
      let guard = 0;
      while (this.acc >= this.step && guard < 6) {
        if (this.mode === 'play') {
          const inp = {
            up: Input.down('up'), down: Input.down('down'),
            left: Input.down('left'), right: Input.down('right'),
            hand: Input.down('hand'), boost: Input.down('boost')
          };
          Physics.update(this.step, inp);
          this.clock += this.step * 1000;
        }
        this.acc -= this.step;
        guard++;
      }
      if (guard >= 6) this.acc = 0;
      Render.frame();
      HUD.draw(dt);
    } else {
      // 메뉴/일시정지 배경: 조용히 도로를 보여준다(자동 카메라 드리프트)
      this.menuScene(dt);
    }

    Input.pollPad();
    Input.endFrame();
    this.frameCount++;
  },

  handleKeys() {
    if (Input.hit('esc')) {
      Sound.unlock();
      if (this.mode === 'play') this.pause();
      else if (this.mode === 'pause') this.resume();
      else if (this.mode === 'menu') { /* 메뉴에서는 무시 */ }
      else UI.none();
    }
    if (Input.hit('enter') && this.mode === 'menu') { Sound.unlock(); this.startFree(); }
    if (Input.hit('cam')) {
      Save.data.cam = Save.data.cam === 'hood' ? 'chase' : 'hood';
      Save.put();
      Toast.show('시점: ' + (Save.data.cam === 'hood' ? '보닛(1인칭)' : '후방 3/4'));
    }
    if (Input.hit('music')) { const on = Sound.toggleMusic(); Toast.show('음악: ' + (on ? '켬' : '끔')); }
    if (Input.hit('reset')) {
      if (this.mode === 'play') { Physics.reset(true); Toast.show('위치 리셋 (코스는 유지)'); }
      else { this.buildCourse(Date.now() & 0xffffff); Toast.show('코스 재생성'); }
    }
  },

  /* 메뉴 뒤 배경: 천천히 움직이는 도시 시야 */
  menuT: 0,
  menuScene(dt) {
    this.menuT += dt;
    const p = Physics.player;
    p.speed = utils.lerp(p.speed, 1100, dt * 0.6);
    p.z = utils.inc(p.z, p.speed * dt, Road.trackLength);
    p.kmh = p.speed * CONFIG.physics.kmhFactor;
    p.x = utils.lerp(p.x, -0.25 + Math.sin(this.menuT * 0.35) * 0.35, dt * 0.8);
    p.steer = 0; p.prevSpeed = p.speed;
    p.gear = Math.min(6, 1 + Math.floor((p.speed / Physics.topSpeed()) * 6));
    p.rpm = 0.35 + 0.2 * Math.sin(this.menuT);
    Sound.engine(p.rpm, 0.4, false);
    Render.frame();
  }
};

/* 기동 */
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => Game.boot());
} else {
  Game.boot();
}
