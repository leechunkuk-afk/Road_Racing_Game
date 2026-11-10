# tools/asset_pipeline — 에셋 수집/가공 파이프라인

OpenGameArt에서 수집한 소재를 `assets/source/`(원본) → `assets/game/`(런타임)으로 정리하는 재실행 가능한 스크립트 모음.
저장소 루트에서 인자 없이 실행하면 기본 경로(`assets/`)로 동작한다.

| 순서 | 스크립트 | 하는 일 | 비고 |
|---|---|---|---|
| 0 | `oga_candidates.json` | 수집 후보 OGA 페이지 40개 URL | 사람이 편집 |
| 1 | `01_harvest_pages.ps1` | 페이지에서 제목/파일 링크/라이선스 추출 | 출력이 `out_harvest.json` |
| 2 | `assets_manifest.json` + `02_download.ps1` | 선정된 36건을 `assets/source/<dir>/`로 다운로드 | 이미 있으면 SKIP |
| 3 | `03_extract.ps1` | zip 해제 + 내용물(크기·해상도) 보고 | |
| 4 | `04_probe.ps1` | 주요 파일 해상도/용량과 도구(ffmpeg 등) 유무 확인 | |
| 5 | `05_organize_game_assets.ps1` | 런타임용 선별 + 리사이즈 → `assets/game/**` | System.Drawing 사용 |
| 6 | `06_credits.ps1` | 페이지의 **Author 필드·라이선스** 정확 재수집 | → `assets/credit_report.json` |
| 7 | `07_music_prep.js` | MP3 프레임 단위 커트, WAV mono/22.05kHz 다운샘플 + 페이드 | Node, 의존성 없음 |
| 8 | `08_scan_docs_text.ps1` | 문서에 일본어 가나·한자 섞임 검사 | 코드 작성 품질 검사용 |

실행 예시
```
powershell -NoProfile -ExecutionPolicy Bypass -File tools\asset_pipeline\06_credits.ps1
node tools\asset_pipeline\07_music_prep.js .
```

주의
- OpenGameArt는 봇 차단(403)이 있어 브라우저·웹페치 경로가 막혀 있다. 이 스크립들은 **로컬 네트워크 + Chrome User-Agent**로 접근한다.
- 저자 정보는 페이지의 `field-name-author-submitter` 블록만 정확하다(첫 `/users/` 링크는 댓글 작성자일 수 있음).
- `ffmpeg`/`magick`이 없는 환경에서도 동작하도록 이미지 처리는 `System.Drawing`, 오디오는 Node 수작업 파서로 구현했다.
- 스크립트 안의 주석·출력은 인코딩 문제로 **ASCII 전용**으로 유지한다.
