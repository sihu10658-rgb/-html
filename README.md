# 스마트 코드 최적화 도구

브라우저에서 실행하는 코드 최적화/정렬 도구입니다. 별도 설치 없이 `code.html`을 열어 실행할 수 있습니다.

## 프로젝트 구조

```text
-html
├─ code.html       # 유일한 진입 페이지
├─ styles.css      # 화면 스타일
└─ js
   ├─ language.js  # 언어 감지
   ├─ minifier.js  # 코드 압축
   ├─ formatter.js # 코드 포맷
   └─ app.js       # UI 이벤트 연결
```

## 실행 방법

1. 저장소를 다운로드하거나 클론합니다.
2. `code.html`을 브라우저에서 엽니다.

`code.html`은 CSS와 스크립트를 상대 경로로 불러오므로 GitHub Pages와 로컬 파일 실행 모두 같은 진입 파일을 사용합니다.
