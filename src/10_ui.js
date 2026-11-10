/* ==========================================================================
   UI - 부팅/메뉴/도움말/크레딧/일시정지 패널 관리
   ========================================================================== */
const CREDITS_TEXT =
`Music
  "Night Runner" by KLY (CC-BY 3.0, OpenGameArt.org)
  "Race" by Alex_089 (CC-BY 4.0, OpenGameArt.org)
  "Death of Hope" by ColdOneK (CC-BY 4.0, OpenGameArt.org)
SFX
  boost by qubodup (CC-BY 3.0, OpenGameArt.org)
  engine loops by domasx2 (CC0), engine start by looneybits (CC0)
  collision / debris by rubberduck (CC0)
Art
  Kenney "Racing pack" (CC0) - 장애물·코스 오브젝트
  Unlucky Studio "Free Top Down Car Sprites" (CC0) - AI·교통차(상단 뷰)
  FisherG "Parallax City - Night" (CC0) - 파라락 배경
  Alucard "Cars 2D Top Down" (CC-BY 3.0), Carlos Alface "2D Old Cars Pack" (OGA-BY 3.0)
  overcrafted "top down pixel police car" (OGA-BY 3.0)
  fridaruiz "pixel night city" (CC-BY 4.0)
All above collected from OpenGameArt.org (2026-11). 일부는 리사이즈/트리밍 등 개작되어 사용되었습니다.
자체 제작: 2.5D 도로·조명·파티클·HUD 렌더링, 절차적 가로등/빌딩, WebAudio 폴백 사운드,
플레이어 차량 3D 모델과 yaw 스프라이트 48장(Blender 5.2 로 자체 렌더 · 제3자 자산 아님).`;

const UI = {
  el: {},
  init() {
    const ids = ['bootLayer', 'menuLayer', 'helpLayer', 'credLayer', 'pauseLayer',
      'bootBar', 'bootMsg', 'bootAssets', 'credText',
      'btnFree', 'btnCred', 'btnHelp', 'btnRestart', 'btnHelpClose', 'btnMusic',
      'btnCredClose', 'btnResume', 'btnMenu', 'btnCred2'];
    for (const id of ids) this.el[id] = document.getElementById(id);
    this.el.credText.textContent = CREDITS_TEXT;

    const bind = (id, fn) => {
      const b = this.el[id];
      if (b) b.addEventListener('click', (e) => { e.preventDefault(); Sound.unlock(); fn(); b.blur(); });
    };
    bind('btnFree', () => Game.startFree());
    bind('btnCred', () => this.show('credLayer'));
    bind('btnCred2', () => this.show('credLayer'));
    bind('btnCredClose', () => this.show(Game.mode === 'pause' ? 'pauseLayer' : 'menuLayer'));
    bind('btnHelp', () => this.show('helpLayer'));
    bind('btnHelpClose', () => this.show('menuLayer'));
    bind('btnRestart', () => { Game.buildCourse(Date.now() & 0xffffff); Toast.show('코스를 다시 만들었습니다'); });
    bind('btnMusic', () => { const on = Sound.toggleMusic(); Toast.show('음악: ' + (on ? '켬' : '끔')); });
    bind('btnResume', () => Game.resume());
    bind('btnMenu', () => Game.toMenu());
    this.buildColors();

    // 첫 사용자 상호작용에서 사운드 해제
    const unl = () => Sound.unlock();
    window.addEventListener('pointerdown', unl, { once: false });
    window.addEventListener('keydown', unl, { once: false });
    return this;
  },

  hideAll() {
    for (const k in this.el) {
      const e = this.el[k];
      if (e && /Layer$/.test(k)) e.classList.add('hidden');
    }
  },
  show(name) {
    this.hideAll();
    const e = this.el[name];
    if (e) e.classList.remove('hidden');
  },
  none() { this.hideAll(); },

  /* ---- 차량 색 고르기(조작/설정 패널). M4 에서 차고로 옮길 예정. ---- */
  buildColors() {
    const row = document.getElementById('rowColors');
    if (!row) return;
    this.el.rowColors = row;
    row.innerHTML = '';
    for (const p of CONFIG.car.sprites.palettes) {
      const b = document.createElement('button');
      b.dataset.pal = p.id;
      b.addEventListener('click', (e) => {
        e.preventDefault();
        Sound.unlock();
        const q = Game.setCarColor(p.id);
        if (q) {
          this.markColors();
          Toast.show('차량 색: ' + q.name +
            (Sprites.carSpritesReady(q.id) ? '' : ' (스프라이트 없음 → 절차적 차체)'));
        }
        b.blur();
      });
      row.appendChild(b);
    }
    this.markColors();
  },
  markColors() {
    const row = this.el.rowColors;
    if (!row) return;
    const cur = Game.carPalette().id;
    for (const b of row.children) {
      const p = CONFIG.car.sprites.palettes.filter((q) => q.id === b.dataset.pal)[0];
      if (!p) continue;
      const on = p.id === cur;
      b.textContent = (on ? '● ' : '○ ') + p.name;
      b.className = on ? '' : 'alt';
    }
  },

  bootProgress(p, msg) {
    if (this.el.bootBar) this.el.bootBar.style.width = Math.round(p * 100) + '%';
    if (msg && this.el.bootMsg) this.el.bootMsg.textContent = msg;
  },
  bootDone(sm) {
    if (!this.el.bootAssets) return;
    if (sm.total === 0) {
      this.el.bootAssets.textContent = '외부 에셋 사용 안 함 - 모든 그래픽/사운드는 절차적으로 생성됩니다.';
      return;
    }
    const mode = sm.ok === 0 ? 'assets/game 을 찾지 못해 절차적 화면/합성 사운드로 실행합니다.'
      : '실물 에셋 ' + sm.ok + '개 로드 (실패 ' + sm.bad + '개 → 항목별 절차적 폴백)';
    this.el.bootAssets.textContent = mode;
  }
};
