# CLAUDE.md

크롬 내장 번역기의 DOM 변화를 감지해 번역문 아래에 원문을 회색으로 덧붙이는 **Manifest V3 크롬 확장**. 외부 번역 API를 호출하지 않으며, 사용자 데이터를 외부로 전송하지 않는다.

## 빠른 명령어

```bash
npm run build         # webpack production → dist/
npm run watch         # 개발용 watch
npm run format        # prettier 일괄 적용
npm run format:check  # 포맷 검증
```

확장 로드: `chrome://extensions` → 개발자 모드 → "압축 해제된 확장 프로그램 로드" → [dist/](dist/) 선택.

## 아키텍처

```
[manifest.json] ──► content_scripts: dist/content.js (<all_urls>, all_frames, document_end)
       │
       └── action.popup: dist/popup.html → dist/popup.js

webpack: src/content.js, src/popup.js → dist/[name].js
popup ⇄ content 동기화는 chrome.storage.local.isEnabled 하나만 사용
```

## 핵심 파일 맵

- [src/content.js](src/content.js) — 부트스트랩. storage 로드 후 observer 시작, `storage.onChanged` 구독
- [src/core/observer.js](src/core/observer.js) — MutationObserver 2종. (1) body의 childList에서 font 태그 감지, (2) html의 class 변화로 번역 해제 감지
- [src/core/extractor.js](src/core/extractor.js) — 블록 내부를 재귀 순회해 원문 텍스트 재조립. font 노드의 `data-echo-original` 속성에서 보관된 원문을 읽음
- [src/core/renderer.js](src/core/renderer.js) — `.echo-original-text notranslate` div를 블록 내부 적절한 위치에 삽입
- [src/utils/dom.js](src/utils/dom.js) — `structuralTags` 집합, `getBlockContainer`, `isElementHidden`
- [src/popup.js](src/popup.js) / [popup.html](popup.html) — Enable Shadow 토글 UI
- [manifest.json](manifest.json) — MV3, `storage` 권한, `<all_urls>` host_permissions, all_frames

## 핵심 동작 원리

크롬 번역기는 페이지의 텍스트 노드를 `<font>` 태그로 **교체**한다. observer는 같은 부모 안에서 **removed 텍스트 노드 + added `<font>` 노드** 쌍을 매칭해 원문을 font의 `data-echo-original` 속성에 보관한다. 그 후 100ms 디바운스로 부모 블록(P/DIV/H1.../LI/TD 등)을 한 번에 `extractOriginalTextDeep` → `renderShadowText`로 처리한다. `<html>`에서 `translated-ltr`/`translated-rtl` 클래스가 사라지면 모든 shadow 요소를 즉시 정리한다.

## 코딩 컨벤션

- **Prettier** ([.prettierrc.json](.prettierrc.json)): 4-space, single quotes, `;` 사용, `printWidth: 100`, `trailingComma: "es5"`. `*.md`도 포맷 대상 ([.prettierignore](.prettierignore) 참고).
- **모듈:** ES modules — webpack이 번들. `chrome.*` API는 `typeof chrome !== 'undefined'` 가드 후 사용 ([src/content.js:14](src/content.js#L14)).
- **커밋 메시지:** 한국어 + conventional prefix (`feat:`, `refactor:`, `chore:`, `update:`, `docs:`).
- **버전:** [manifest.json](manifest.json)과 [package.json](package.json)의 version 필드를 함께 올린다.

## Known Caveats (수정 시 주의 영역)

- **removed/added 인덱스 매칭은 휴리스틱** ([src/core/observer.js:54-56](src/core/observer.js#L54-L56)) — 한 mutation에서 N:M으로 들어올 때 인덱스로 짝짓는다. 크롬 번역기 동작이 바뀌면 깨질 수 있다.
- **인라인 스타일 하드코딩** ([src/core/renderer.js:26-32](src/core/renderer.js#L26-L32)) — `#787878`, `0.9em` 등이 박혀 있어 다크 모드 사이트에서 어색할 수 있다. 사용자 설정을 추가하려면 storage 키를 늘리고 content/popup 양쪽을 함께 고친다.
- **`getComputedStyle` 비용** — `extractOriginalTextDeep` 재귀가 `isElementHidden` ([src/utils/dom.js:87](src/utils/dom.js#L87))을 호출하고, 그 안에서 모든 자식에 대해 `getComputedStyle`을 부른다. 거대한 페이지에서 레이아웃 스러싱이 의심되면 이 경로부터 본다.
- **자기 재번역 차단** — shadow div는 `class="... notranslate"` + `translate="no"`로 차단한다. 새 shadow 요소를 추가할 때 같은 속성을 반드시 붙인다.
- **`processedBlocks`는 `WeakSet`** ([src/core/observer.js:6](src/core/observer.js#L6)) — DOM 분리 시 자동 GC되지만, 같은 블록이 다시 번역되는 케이스를 디버깅할 때는 이 보호가 작동 중임을 인지한다.

## 자주 하는 작업

- **새 structural 블록 태그 지원:** [src/utils/dom.js](src/utils/dom.js)의 `structuralTags` 집합에 추가.
- **토글 외 옵션 추가:** [popup.html](popup.html) UI + [src/popup.js](src/popup.js) 핸들러 + [src/content.js](src/content.js)의 `storage.onChanged` 분기 — 3곳 동기화.
- **렌더 위치 변경:** [src/core/renderer.js](src/core/renderer.js)의 `insertBeforeNode` 탐색 로직 (1.0.1 릴리스에서 개선된 부분).

## 빌드/배포

- [dist/](dist/)는 [.gitignore](.gitignore)됨. 배포는 `npm run build` 후 `dist/`를 zip으로 압축해 크롬 웹스토어에 업로드.
- 테스트 스크립트는 placeholder ([package.json](package.json)의 `test`) — 별도 테스트 프레임워크는 없다.
