# 크레딧 (CREDITS) — NIGHT DRIVE: Neon City Racer

게임에 사용된 제3자 저작물 목록입니다. **화려한 그래픽·사운드의 상당수는 아래 작가님의 작품**이며,
라이선스상 표기가 필수인 항목(CC-BY / OGA-BY)이 있으므로 이 파일과 게임 내 크레딧 화면에서 출처를 표기합니다.
아래 자료 일부는 게임 용도에 맞게 **리사이즈·업스케일·트리밍(커트) 등 개작**되어 사용되었습니다.

- 수집 출처: [OpenGameArt.org](https://opengameart.org/) (2026-11-10 수집)
- 상세 근거(파일별 매핑·용량·파이프라인): [`docs/02_소재_컬렉션_라이선스.md`](docs/02_소재_컬렉션_라이선스.md)
- 원본 데이터: [`assets/credit_report.json`](assets/credit_report.json), [`assets/source_manifest.json`](assets/source_manifest.json)

---

## 1. 표기 필수 (CC-BY 3.0 / CC-BY 4.0 / OGA-BY 3.0)

### 음악 · 사운드
| 저작물 | 저작자 | 라이선스 | 출처 |
|---|---|---|---|
| Night Runner (게임명: *Night Drive*) | **KLY** (Kim Lightyear) | CC-BY 3.0 | https://opengameart.org/content/night-runner |
| Race | **Alex_089** | CC-BY 4.0 | https://opengameart.org/content/race-0 |
| Death of Hope ( menu ) | **ColdOneK** | CC-BY 4.0 | https://opengameart.org/content/death-of-hope-chiptuneelectronic |
| Racing Speed Boost Sound (부스터음) | **qubodup** | CC-BY 3.0 | https://opengameart.org/content/racing-speed-boost-sound |

### 이미지
| 저작물 | 저작자 | 라이선스 | 출처 | 사용처 |
|---|---|---|---|---|
| Cars 2D Top Down (spritesheet) | **Alucard** | CC-BY 3.0 | https://opengameart.org/content/cars-2d-top-down | 경쟁차 도색 변형 |
| 2D Old Cars Pack | **Carlos Alface** | OGA-BY 3.0 | https://opengameart.org/content/2d-old-cars-pack | 교통차 5종 |
| top down pixel police car | **overcrafted** | OGA-BY 3.0 | https://opengameart.org/content/top-down-pixel-police-car | 순찰차 |
| Track Tiles / Race Track Tiles | **TRBRY** | CC-BY 3.0 / OGA-BY 3.0 | https://opengameart.org/content/track-tiles | 노면·커브 텍스처 참고 |
| 2D Top Down Highway Background | **Alucard** | CC-BY 3.0 | https://opengameart.org/content/2d-top-down-highway-background | 도로 질감 참고 |
| Simple Seamless City Pixel Art Background | **CraftPix.net** | OGA-BY 3.0 | https://opengameart.org/content/simple-seamless-city-pixel-art-background | 빌딩 타일(보류) |
| Race Track Tile Set | **CraftPix.net** | OGA-BY 3.0 | https://opengameart.org/content/race-track-tile-set | 코스 오브젝트(보류) |
| pixel night city | **fridaruiz** | CC-BY 4.0 (다중) | https://opengameart.org/content/pixel-night-city | 메뉴/파라락 배경 |

> 다중 라이선스 항목은 **가장 느슨한 조건(CC0 선택 가능)** 으로 사용할 수 있으나,
> 원작자 표시는 예의로 그대로 유지합니다.

---

## 2. 표기 의무 없음 (CC0 / 퍼블릭 도메인) — 사용하지만 감사의 표시를 남김

| 저작물 | 저작자 | 라이선스 | 사용처 |
|---|---|---|---|
| Racing pack (Kenney) | **Kenney** | CC0 | 장애물·코스 오브젝트(콘·배리어·배럴·타이어 stack·oil·가로등), 비포장/모래 노면 |
| Free Top Down Car Sprites | **Unlucky Studio** (제출: sujit1717) | CC0 | 플레이어/AI 차량 스프라이트 8종 |
| 2D Race Cars | **looneybits** | CC0 | 레이싱카 대용 |
| Car (Pixelart) | **Satik64** | CC0 | 소형 차량 |
| Parallax City — Night (4 Colors) | **FisherG** | CC0 | 도시 파라락 배경 6레이어 |
| City Night — Background / Night background | **andersen** / **Game2rise** | CC0 | 메뉴 배경 |
| Basic Art — Racing | **Firefly in the Dusk** | CC0 | 코스 기믹 참고 |
| Streetlight (애니 GIF) | **Frenchyboy** | CC0 | 가로등 점멸 연출 |
| racing car engine sound loops | **domasx2** | CC0 | 엔진 루프 3종 |
| Car engine start 01 | **looneybits** | CC0 | 시동음 |
| 75 CC0 breaking/falling/hit sfx · 100 CC0 SFX | **rubberduck** | CC0 | 충돌·파쇄·유리음 |
| 5 Chiptunes (Action) | **SubspaceAudio** (Juhani Junkala) | CC0 | 레이스 BGM(칩튠 2트랙) |

---

## 3. 자체 제작 / 절차적 생성
- 2.5D 도로·조명·파티클·HUD 렌더링: 본 프로젝트 Canvas 절차적 드로잉
- 속도감 연출(속도선, 셰이크, bloom), UI 텍스트/폰트: 시스템 폰트
- 사운드 폴백: WebAudio 실시간 합성(에셋 미로드 환경에서 자동 사용)

---

## 4. 게임 내 크레딧 표기 (M5에 반영)
설정 → **크레딧** 화면에서 위 "표기 필수" 항목을 아래 형식으로 나열한다.

```
Music: "Night Runner" by KLY (CC-BY 3.0, OpenGameArt.org)
       "Race" by Alex_089 (CC-BY 4.0, OpenGameArt.org)
       "Death of Hope" by ColdOneK (CC-BY 4.0, OpenGameArt.org)
SFX:   boost by qubodup (CC-BY 3.0), engine by domasx2 (CC0), collision by rubberduck (CC0)
Art:   Kenney Racing Pack (CC0), Unlucky Studio (CC0), FisherG (CC0),
       cars by Alucard (CC-BY 3.0), Carlos Alface (OGA-BY 3.0), police by overcrafted (OGA-BY 3.0)
```
