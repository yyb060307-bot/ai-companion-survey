# AI 챗봇 사용 경험 설문 (테스트 버전)

7단계 설문의 UI와 페이지 흐름만 구현한 테스트 버전입니다.
현재는 실제 저장, Supabase 연동, Claude API 호출을 하지 않습니다.

## 실행

`index.html`을 브라우저에서 열면 됩니다.
로컬 서버를 사용하려면 이 폴더에서 아래처럼 실행할 수 있습니다.

```bash
python -m http.server 8000
# http://localhost:8000/
```

## 페이지 흐름

1. `intro` — 연구 목적, 참여 유의사항, 시작 버튼
2. `pre-ai` — AI에 대한 인식(자유 설명), 사용 목적, 사용 시간·기간, 자기노출
3. `pre-psych` — AI 경험 전 심리사회 문항(4점 척도) 및 사회적 관계망
4. `post-psych` — 현재 심리사회 문항(4점 척도)
5. `chat` — 캐릭터 기반 채팅 UI, 최소 발화 조건, 행동 데이터 수집 구조(비노출)
6. `evaluation` — 챗봇 이용 후기 5문항(5점 척도)
7. `ending` — 완료 안내, 감사 메시지, 경품 추첨 링크

## 파일 구조

```text
.
├─ index.html                 # 앱 셸 (헤더, 진행률, 페이지 루트, 이전/다음)
├─ css/
│  └─ styles.css              # 공통 스타일
└─ js/
   ├─ config.js               # 캐릭터, 최소 대화 조건, LLM 설정, 추첨 URL
   ├─ state.js                # 메모리 기반 설문 상태
   ├─ app.js                  # 페이지 렌더링 및 이전/다음 흐름 제어
   ├─ ui.js                   # 척도·선택지 카드, 입력 바인딩, 토스트 등 공통 UI
   ├─ services/
   │  ├─ storage.js           # 저장 어댑터 스텁 (Supabase 연결 지점)
   │  └─ llm.js               # LLM 어댑터 스텁 (Claude 연결 지점)
   └─ pages/
      ├─ intro.js
      ├─ pre-ai.js
      ├─ pre-psych.js
      ├─ post-psych.js
      ├─ chat.js
      ├─ evaluation.js
      └─ ending.js
```

## 추후 연동 지점

### Supabase

`js/services/storage.js`의 메서드 내부만 교체합니다.

- `savePage(pageId, payload)`
- `saveChatBehavior(payload)`
- `saveCompletion(payload)`

현재 `js/state.js`의 상태를 그대로 payload로 넘기도록 구성되어 있습니다.

### Claude API

`js/services/llm.js`에서 처리합니다.

- `config.llm.provider`를 `'claude'`로 변경
- `callClaude()`를 서버 프록시 호출로 구현
- `buildSystemPrompt(character)`로 캐릭터 페르소나 구성
- `toClaudeMessages(messages)`로 Messages API 형식 변환

API 키가 브라우저에 노출되지 않도록 반드시 서버를 경유해야 합니다.

### 설문 문항·척도

문항과 선택지는 `js/config.js`에 모아 두었습니다.
`psychConstructs`, `evaluationItems`, `preAIOptions`, 각 척도 라벨과 선택지를
교체하면 페이지 구조를 유지한 채 문항을 바꿀 수 있습니다.

- 심리사회 문항: 4점 척도 (`psychLabels`)
- 챗봇 이용 후기: 5점 척도 (`likertLabels`)
- 사용 시간·기간, 사회적 관계망, 자기노출: 선택지형 문항

## 테스트 모드 동작

- 새로고침하면 상태가 초기화됩니다.
- 챗봇은 `mock` 응답을 사용합니다.
- `config.minUserTurns`(기본 3회)를 충족해야 대화를 종료할 수 있습니다.
- 대화 종료 후에만 다음 단계로 이동할 수 있습니다.
- 발화 수, 대화 시간 등 행동 데이터는 내부 수집용이며 참여자 화면에는 표시하지 않습니다.
- 경품 추첨 URL은 `config.raffleUrl`의 자리표시자입니다.
