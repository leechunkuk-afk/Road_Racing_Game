/* ==========================================================================
   CONFIG · 코스/물리/조명/오디오의 모든 수치 (단일 진실의 원천)
   ========================================================================== */
const SCREEN = { w: 1280, h: 720 };

const CONFIG = {
  version: '0.1.0-m1',

  camera: {
    height: 480,           // 도로면 위 카메라 높이(유닛)
    fovBase: 100,          // 기준 화각(도)
    fovMax: 126,           // 최고속에서 넓어지는 화각(속도감)
    drawDistance: 220,     // 세그먼트 수
    fogDensity: 4.2,       // 원거리 어둠(클수록 짙음)
    playerZOffset: 0,      // 런타임 계산 (cameraDepth * roadHalf)
    bob: 1.0
  },

  road: {
    width: 900,            // 도로 절반 폭(유닛, 100유닛=1m). 전체 폭은 18m
    segLen: 200,
    rumbleLen: 3,          // 세그먼트 3개 = 1 루머블 패턴
    lanes: 3,
    laneMarkerW: 0.02,     // 절반 폭 대비 차선 마커 두께
    railLimit: 1.22,       // 가드레일 내측 한계(playerX 단위 = 절반 폭 배수)
    railHeight: 115        // 가드레일 높이(월드 유닛)
  },

  physics: {
    maxSpeed: 0,           // setup() 에서 segLen/rumbleLen/(1/60) 로 계산
    accel: 0, brake: 0, decel: 0,
    offRoadDecel: 0, offRoadLimit: 0,
    centrifugal: 0.34,     // 커브에서 바깥으로 밀리는 강도
    steerRate: 2.3,        // 초당 조향량(속도 100% 기준)
    gripAsphalt: 1.0,
    kmhFactor: 0.036,      // 유닛/초 -> km/h
    dragShifts: 6
  },

  lighting: {
    ambient: 0.20,         // 가로등 없는 구간 최소 밝기
    lampSpacing: 9,        // 세그먼트 간격
    lampReach: 1500,       // 가로등 빛 도달 거리(유닛)
    lampBoost: 0.62,       // 빛 최대 추가 밝기
    headReach: 2600,       // 헤드램프 도달 거리(유닛)
    headNear: 260,         // 헤드램프가 가장 밝은 근처 거리
    headBoost: 0.90,
    warmTint: 'rgba(255,196,120,0.10)'
  },

  surfaces: {
    asphalt: 1.00, wet: 0.78, gravel: 0.55, dirt: 0.42, ice: 0.32, oil: 0.18, ramp: 0.90
  },

  /* 노면 위험 요소: ko = 화면 표시 이름, grip = CONFIG.surfaces 의 그립 계수 키 */
  hazardInfo: {
    oil:    { ko: '기름 유출', grip: 'oil' },
    ice:    { ko: '빙판', grip: 'ice' },
    gravel: { ko: '비포장', grip: 'gravel' },
    wet:    { ko: '젖은 노면', grip: 'wet' }
  },
  hazard: {
    count: 14,          // 코스당 위험 구간 개수
    minLen: 12, maxLen: 40,
    rampCount: 6,       // 점프대 개수
    rampMinSpeed: 0.28, // 발동 최소 속도(최고속 대비)
    launchBase: 250, launchMore: 340
  },

  /* 장애물 종류별 충돌 계수: dmg = 피해 배율, keep = 충돌 후 속도 유지율, ko = 화면 표시 이름 */
  obstacles: {
    cone:        { dmg: 0.18, keep: 0.74, ko: '콘' },
    barrier:     { dmg: 1.10, keep: 0.30, ko: '배리어' },
    barrel:      { dmg: 0.75, keep: 0.44, ko: '드럼통' },
    tirestack:   { dmg: 0.45, keep: 0.62, ko: '타이어 더미' },
    rock:        { dmg: 1.00, keep: 0.34, ko: '바위' },
    tree:        { dmg: 1.30, keep: 0.26, ko: '나무' },
    streetlight: { dmg: 1.40, keep: 0.24, ko: '가로등' },
    bldg:        { dmg: 1.60, keep: 0.20, ko: '건물' }
  },

  fx: {
    maxParticles: 260,
    speedLines: 90,
    shakeMax: 9,
    bloom: true,
    motionBlur: 0.35
  },

  audio: {
    master: 0.85, music: 0.42, sfx: 0.75, engine: 0.55,
    musicOn: true
  },

  assets: {
    base: 'assets/game/',
    enabled: true,
    // id/type/url: type = img | audio | atlas
    list: [
      { id: 'px_sky',  type: 'img', url: 'bg/px_sky.png' },
      { id: 'px_far',  type: 'img', url: 'bg/px_far.png' },
      { id: 'px_mid',  type: 'img', url: 'bg/px_mid.png' },
      { id: 'px_close',type: 'img', url: 'bg/px_close.png' },
      { id: 'px_cars_far',   type: 'img', url: 'bg/px_cars_far.png' },
      { id: 'px_cars_close', type: 'img', url: 'bg/px_cars_close.png' },
      { id: 'atlas_objects', type: 'img', url: 'atlas/kenney_spritesheet_objects.png' },
      { id: 'atlas_vehicles',type: 'img', url: 'atlas/kenney_spritesheet_vehicles.png' },
      { id: 'eng1', type: 'audio', url: 'sfx/engine_loop_1.wav' },
      { id: 'eng2', type: 'audio', url: 'sfx/engine_loop_2.wav' },
      { id: 'eng3', type: 'audio', url: 'sfx/engine_loop_3.wav' },
      { id: 'eng_start', type: 'audio', url: 'sfx/engine_start.wav' },
      { id: 'crash1', type: 'audio', url: 'sfx/crash_bfh1_hit_02.ogg' },
      { id: 'crash2', type: 'audio', url: 'sfx/crash_bfh1_metal_falling_01.ogg' },
      { id: 'boost_s', type: 'audio', url: 'sfx/boost-start.ogg' },
      { id: 'boost_l', type: 'audio', url: 'sfx/boost-loop.ogg' },
      { id: 'boost_e', type: 'audio', url: 'sfx/boost-end.ogg' },
      { id: 'mus_menu',  type: 'audio', url: 'music/menu_cut.mp3' },
      { id: 'mus_cruise',type: 'audio', url: 'music/night_drive_cut.mp3' },
      { id: 'mus_race',  type: 'audio', url: 'music/race_cut.mp3' }
    ]
  }
};

/* Kenney Racing Pack(objects) 시트 좌표 - assets/game/atlas/kenney_spritesheet_objects.xml
   파일 fetch 없이 쓰기 위해 상수로 하드카피 (file:// 대응) */
const SPRITES_KENNEY_OBJECTS = {
  sheet: 'atlas_objects', pw: 1024, ph: 1024,
  frames: {
    cone_straight:[800,645,45,44], cone_down:[795,947,46,44],
    barrier_red:[450,406,210,62], barrier_red_race:[450,278,210,62],
    barrier_white:[450,214,210,62], barrier_white_race:[450,342,210,62],
    barrel_red:[737,934,56,56], barrel_red_down:[728,645,70,48],
    barrel_blue:[762,368,56,56], barrel_blue_down:[666,139,70,48],
    tires_red:[762,194,56,56], tires_white:[762,310,56,56],
    rock1:[646,934,89,72], rock2:[666,69,73,68], rock3:[666,0,87,67],
    oil:[617,600,109,95],
    tree_small:[516,738,141,141], tree_large:[450,0,214,212],
    light_white:[662,214,98,235], light_yellow:[659,697,98,235],
    lights:[450,672,160,64],
    skidmark_long_1:[759,695,60,192], skidmark_long_2:[755,0,60,192],
    arrow_white:[450,571,165,99], arrow_yellow:[450,470,165,99],
    tribune_empty:[0,517,448,223], tribune_full:[0,292,448,223]
  }
};

/* Kenney Racing Pack(vehicles) - 탑뷰. 미니맵/아이콘용 */
const SPRITES_KENNEY_VEHICLES = {
  sheet: 'atlas_vehicles', pw: 1024, ph: 512,
  frames: {
    car_black_1:[0,0,71,131], car_black_3:[290,133,70,131],
    car_blue_1:[0,251,71,131]
  }
};

/* 코스 제작 상수 */
const ROAD = {
  LEN:   { NONE: 0, SHORT: 25, MEDIUM: 50, LONG: 100 },
  CURVE: { NONE: 0, EASY: 2, MEDIUM: 4, HARD: 6 },
  HILL:  { NONE: 0, LOW: 20, MEDIUM: 40, HIGH: 60 }
};

/* 소품 종류별 실제 크기(월드 유닛: [폭, 높이], 도로 절반폭 900 기준) */
const PROP_SIZE = {
  streetlight: [150,  950],
  tree:        [420,  540],
  bldg:        [1500, 2600],
  bldg_far:    [2100, 3900],
  cone:        [70,   85],
  barrier:     [430,  120],
  barrel:      [115,  130],
  tirestack:   [140,  150],
  rock:        [220,  180],
  lamphead:    [110,  110],
  ramp:        [760,  210]
};

/* 야간 도로 색 팔레트 ( 밝기 단계별 캐시는 09_render 에서 만든다 ) */
const PALETTE = {
  roadLight:  '#1c2129',
  roadDark:   '#171b22',
  rumbleLight:'#8e2c3a',
  rumbleDark: '#c9d3df',
  lane:       '#c8d6e5',
  grassLight: '#0b1018',
  grassDark:  '#0a0e15',
  shoulder:   '#232a35',
  fog:        '#05070d',
  skyTop:     '#060a14',
  skyMid:     '#0d1526',
  horizon:    '#17233a'
};
