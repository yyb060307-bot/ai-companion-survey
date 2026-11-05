# AI 챗봇 사용 경험 설문

캐릭터 기반 AI 챗봇과의 대화 경험을 수집하는 7단계 익명 설문입니다.

- **정적 사이트**: `survey/` (Cloudflare Pages)
- **LLM 프록시**: `functions/api/chat.js` (Cloudflare Pages Functions)
- **모델**: `claude-haiku-5-5`
- **저장소**: Supabase (`survey_responses` 테이블, 참여자는 INSERT 전용 / 연구자는 RLS로 SELECT)
- **연구자 대시보드**: `/admin.html` (Supabase 이메일 로그인, 발화 수·지속 여부·대화 전문 열람)
- **최소 대화**: 3회 발화 후 종료 가능, 최대 20회

> Anthropic API 키는 절대 프론트엔드에 넣지 않습니다. 브라우저는 같은 도메인의 `/api/chat`만 호출하고, 키는 Cloudflare Secret에만 존재합니다.

---

## 1. 준비물

- Cloudflare 계정 (Pages 무료 플랜으로 충분)
- Supabase 프로젝트
- Anthropic API 키 (`console.anthropic.com`)
- Node.js 18+ (Wrangler 실행용)

---

## 2. Supabase 설정

1. Supabase 프로젝트를 생성합니다.
2. **SQL Editor**에서 `supabase/schema.sql` 전체를 실행합니다.
3. 이어서 `supabase/admin.sql` 전체를 실행합니다. (연구자 읽기 권한 + 요약 뷰)
4. **Project Settings → API**에서 `Project URL`과 `anon public`(또는 publishable) 키를 복사합니다.
5. `survey/js/config.js`의 `supabase` 값을 채웁니다.

```js
supabase: {
  url: 'https://xxxxxxxx.supabase.co',
  anonKey: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  table: 'survey_responses',
},
```

`anon` 키는 공개되어도 되는 키이지만, **반드시 `schema.sql`과 `admin.sql`의 RLS가 적용되어 있어야** 합니다. 참여자 브라우저는 INSERT만 가능하고, SELECT는 `survey_admins`에 등록된 연구자 계정으로만 가능합니다.

### 2-1. 연구자 대시보드 설정

1. `supabase/admin.sql` 맨 아래의 `insert into public.survey_admins ...` 주석을 풀고, 본인 이메일로 바꿔 실행합니다.

   ```sql
   insert into public.survey_admins (email, note)
   values ('researcher@example.com', '연구 책임자')
   on conflict (email) do nothing;
   ```

2. Supabase Dashboard → **Authentication → Users → Add user**에서 같은 이메일로 연구자 계정을 만듭니다. (비밀번호 방식)
3. **Authentication → Providers → Email**에서 **Enable sign ups**를 꺼 둡니다. 허용 목록에 없는 계정이 생기지 않게 하기 위함입니다.
4. 배포된 사이트의 `/admin.html`에 접속해 이메일·비밀번호로 로그인합니다.

대시보드는 브라우저에서 공개 가능한 `anon`(publishable) 키와 로그인 세션만 사용합니다. **`service_role` 키는 브라우저나 저장소에 절대 넣지 마세요.**

대시보드에서 확인할 수 있는 항목:

| 항목 | 설명 |
|---|---|
| 상태 | `완료`, `대화 종료`(대화는 끝냈지만 설문 미완료), `진행 중` |
| 발화 수 | 참여자가 실제로 보낸 메시지 수 (AI 응답 수는 상세에서 확인) |
| 대화 시간 | 대화 시작부터 종료까지의 시간 |
| 최소 턴 충족 | 최소 발화 수(기본 3회)를 넘겼는지 |
| 종료 사유 | 사용자가 종료했는지, 최대 턴에 도달했는지 |
| 대화 전문 | 참여자·AI 메시지를 시간순으로 열람 |
| 설문 응답 | 사전·사후 심리 상태, 챗봇 경험 평가 |

표 상단의 검색·상태 필터·정렬을 사용할 수 있고, **CSV 내려받기**로 현재 목록을 내려받을 수 있습니다. Supabase Dashboard의 Table Editor에서 `survey_participants` 뷰를 열어도 참여자 1명당 1행으로 같은 내용을 볼 수 있습니다.

> 대화 전문은 민감할 수 있습니다. 참여 안내문의 동의 문구에 연구자의 대화 내용 검토가 포함되어 있으니, 열람 범위를 연구진으로 제한하고 분석 종료 후 관련 지침에 따라 파기하세요.
>
> 이 변경 이전에 수집된 응답은 당시 동의 문구의 범위를 먼저 확인하세요. 새 동의 문구는 이후 참여자부터 적용됩니다.

로그인 시 CORS 오류가 발생하면 Supabase Dashboard → **Authentication → URL Configuration**에 배포 도메인(`https://<project>.pages.dev`)을 추가하세요. 로그인은 되지만 목록이 비어 있으면 `survey_admins`의 이메일과 Auth 계정 이메일이 정확히 같은지 확인하세요.

---

## 3. Anthropic API 키 설정

```bash
# Cloudflare Pages 프로젝트에 Secret 등록
npx wrangler pages secret put ANTHROPIC_API_KEY
```

로컬 개발용은 `.dev.vars` 파일을 만듭니다.

```bash
cp .dev.vars.example .dev.vars
# .dev.vars 안의 ANTHROPIC_API_KEY를 실제 키로 교체
```

`.dev.vars`는 `.gitignore`에 포함되어 있습니다.

---

## 4. 로컬 실행

Cloudflare Functions까지 포함해 실행하려면 Wrangler를 사용합니다.

```bash
npx wrangler pages dev survey --compatibility-date 2026-11-01
# http://localhost:8788/
```

- 정적 파일만 확인하려면 `survey/index.html`을 직접 열어도 되지만, 이 경우 `/api/chat`이 없어 대화가 실패합니다.
- `mock` 응답으로 UI만 확인하려면 `survey/js/config.js`에서 `llm.provider`를 `'mock'`으로 임시 변경하세요.
- 연구자 대시보드는 `http://localhost:8788/admin.html`에서 확인합니다. (Supabase `admin.sql`과 연구자 계정 필요)

배포 전 확인:

```bash
curl http://localhost:8788/api/health
# {"ok":true,"anthropicConfigured":true,...}
```

---

## 5. Cloudflare Pages 배포

### Git 연동 (권장)

1. Cloudflare Dashboard → **Workers & Pages → Create → Pages → Connect to Git**
2. 저장소 선택
3. 빌드 설정
   - **Build command**: 비워 둠
   - **Build output directory**: `survey`
4. **Settings → Functions → KV namespace bindings**에서 (선택) `RATE_LIMIT_KV` 추가
5. **Settings → Environment variables**에서 Secret `ANTHROPIC_API_KEY` 등록
6. 배포 후 `https://<project>.pages.dev/api/health` 확인

### CLI 배포

```bash
npx wrangler pages deploy survey --project-name ai-companion-survey
```

`wrangler.toml`에 `pages_build_output_dir = "survey"`가 설정되어 있습니다.

---

## 6. 환경 변수

`wrangler.toml`의 `[vars]` 또는 Cloudflare 대시보드에서 설정합니다.

| 변수 | 기본값 | 설명 |
|---|---|---|
| `ANTHROPIC_API_KEY` | (필수 Secret) | Anthropic API 키 |
| `CLAUDE_MODEL` | `claude-haiku-5-5` | 사용할 모델 ID |
| `MAX_USER_TURNS` | `20` | 참여자 1인 최대 발화 수 |
| `MAX_MESSAGE_CHARS` | `500` | 메시지 1개 최대 길이 |
| `MAX_TOTAL_CHARS` | `6000` | 전체 대화 최대 길이 |
| `MAX_OUTPUT_TOKENS` | `300` | 응답 최대 토큰 |
| `DAILY_BUDGET_USD` | `2` | 일일 예상 비용 상한 (KV 필요) |
| `RATE_LIMIT_PER_MINUTE` | `8` | IP당 분당 요청 수 (KV 필요) |
| `ALLOWED_ORIGINS` | (빈 값) | 추가 허용 오리진, 쉼표 구분 |

same-origin 요청은 자동 허용됩니다. 커스텀 도메인을 붙인 경우 `ALLOWED_ORIGINS`에 명시하세요.

모델을 바꾸면 연구 조건이 바뀌므로 파일럿 이후에는 고정하세요. Haiku 5.5 접근 권한이 없다면 `CLAUDE_MODEL`을 `claude-haiku-4-5-20251001`로 대체할 수 있습니다(약 10배 비용, 150명 8턴 기준 약 $2.50).

`RATE_LIMIT_KV`를 바인딩하지 않아도 동작하지만, 요청 제한과 일일 예산 가드가 비활성화됩니다. 공개 설문에서는 바인딩을 권장합니다.

---

## 6-1. 챗봇 성격 바꾸기

`functions/api/persona.js` 한 파일만 수정하면 됩니다.

| 항목 | 설명 |
|---|---|
| `systemPrompt` | 성격·말투·대화 원칙. 서버에서만 사용되며 브라우저에는 노출되지 않습니다. |
| `name`, `avatar`, `tagline`, `greeting` | 화면에 표시되는 이름·아바타·소개·첫 인사 |
| `version` | 프롬프트 버전. 성격을 수정할 때마다 올려 주세요. (연구 기록용) |

```js
export const PERSONA = {
  id: 'haru',
  version: 'haru-v2', // 성격을 바꾸면 올리기
  name: '하루',
  avatar: '하',
  tagline: '차분하게 이야기를 들어주는 대화 상대',
  greeting: '안녕하세요, 저는 하루예요. 오늘은 어떤 이야기를 나눠볼까요?',
  systemPrompt: `당신은 '하루'입니다. ...`,
};
```

- 수정 후 재배포하면 `/api/chat`(대화)과 `/api/persona`(화면 표시)를 통해 자동 반영됩니다.
- 로컬에서는 `npx wrangler pages dev survey`를 다시 시작하세요.
- `survey/js/config.js`의 `character`와 `promptVersion`은 API에 연결할 수 없을 때 쓰는 대체값입니다.
- 위기 상황 안내는 `functions/api/chat.js`의 `CRISIS_SUFFIX`가 별도로 덧붙이므로, 성격을 바꿔도 유지됩니다.

---

## 7. 비용

가정: 시스템 프롬프트 약 450토큰, 사용자 메시지 60자, 응답 150자.

| 대화 턴 | Haiku 5.5 1인 | 150명 |
|---:|---:|---:|
| 4턴 | 약 $0.0007 | 약 $0.10 |
| 8턴 | 약 $0.0017 | 약 $0.25 |
| 12턴 | 약 $0.0031 | 약 $0.46 |
| 20턴 | 약 $0.0069 | 약 $1.04 |

- `claude-haiku-5-5`는 input $0.10 / output $0.50 per MTok (프롬프트 10만 토큰 이하) 기준입니다.
- Batch API는 실시간 대화라 사용할 수 없습니다.
- 프롬프트 캐싱은 시스템 프롬프트가 최소 캐시 길이보다 짧아 실익이 거의 없습니다.
- Anthropic Console에서 **자동 충전(auto-reload)을 끄거나 낮은 임계값**으로 설정하세요.
- `DAILY_BUDGET_USD`는 실제 예상 비용보다 낮게 잡아 사고를 막는 용도입니다. 150명 × 20턴이 약 $1.04이므로 기본값 $2면 충분합니다.
- 실제 사용량은 `survey_responses`의 `input_tokens`, `output_tokens`로 대조할 수 있습니다.

---

## 8. 보안·운영 체크리스트

- [ ] `supabase/schema.sql` 실행 및 RLS 적용 확인
- [ ] `supabase/admin.sql` 실행 및 `survey_admins`에 연구자 이메일 등록
- [ ] Supabase Auth의 **Enable sign ups** 비활성화
- [ ] `anon` 키로 `select`가 거부되는지 확인 (비로그인 상태에서 `/rest/v1/survey_participants` 요청)
- [ ] 연구자 계정으로 `/admin.html` 로그인 및 대화 전문 열람 확인
- [ ] 참여 안내문에 연구자의 대화 내용 검토 동의가 포함되어 있는지 확인
- [ ] `ANTHROPIC_API_KEY`와 `SUPABASE_SERVICE_ROLE_KEY`가 저장소·프론트엔드에 없는지 확인
- [ ] `RATE_LIMIT_KV` 바인딩
- [ ] `ALLOWED_ORIGINS`에 운영 도메인 등록
- [ ] `/api/health` 응답 확인
- [ ] 파일럿 10~20건으로 한국어 품질·지연 확인
- [ ] 경품 링크(`raffleUrl`)와 문의 이메일(`contactEmail`) 교체
- [ ] IRB/생명윤리 심의 및 개인정보 처리 방침 확인
- [ ] 자해·자살 언급 시 109 / 1577-0199 / 119 안내 문구 확인

---

## 9. 데이터 구조

`survey_responses` 테이블은 참여자 1명당 여러 행을 가집니다.

| 컬럼 | 설명 |
|---|---|
| `response_id` | 익명 UUID |
| `page_id` | `intro`, `pre-ai`, `pre-psych`, `post-psych`, `chat`, `evaluation`, `completion` |
| `payload` | 해당 단계의 응답 스냅샷 (JSONB) |
| `model`, `prompt_version` | 사용한 LLM과 프롬프트 버전 |
| `input_tokens`, `output_tokens`, `latency_ms` | 대화 비용·지연 추적 |
| `created_at` | 저장 시각 |

- `chat` 행에는 전체 대화 transcript와 턴 수·종료 사유가 포함됩니다.
- `completion` 행에는 사전·사후·평가 응답과 전체 대화가 함께 포함됩니다.
- 새로고침 시 상태는 초기화됩니다. 필요하면 `localStorage` 임시 저장을 추가하세요.

### `survey_participants` 뷰

`supabase/admin.sql`이 만드는 뷰로, 참여자 1명당 1행입니다. Supabase Table Editor에서 바로 보거나 `/admin.html`에서 사용합니다.

| 컬럼 | 설명 |
|---|---|
| `response_id`, `short_id` | 익명 UUID와 앞 8자리 |
| `status` | `completed` / `chat_ended` / `in_progress` |
| `completed`, `chat_ended` | 설문 완료 여부, 대화 종료 여부 |
| `user_turn_count`, `assistant_turn_count` | 참여자 발화 수, AI 응답 수 |
| `duration_ms` | 대화 시작~종료 시간 |
| `ended_reason`, `ended_by_user`, `min_turns_met` | 종료 사유, 사용자 종료 여부, 최소 턴 충족 여부 |
| `consent_at`, `started_at`, `completed_at`, `chat_ended_at`, `last_seen_at` | 주요 시각 |
| `transcript` | 대화 전문 (JSONB) |
| `pre_ai`, `pre_psych`, `post_psych`, `evaluation` | 설문 응답 (완료자만) |
| `model`, `prompt_version`, `input_tokens`, `output_tokens`, `latency_ms` | 모델·비용 추적 |

> 대화 데이터는 참여자가 **대화 종료**를 눌렀을 때 저장됩니다. 대화 도중 이탈한 참여자는 `status = in_progress`로 보이고 발화 수·대화 시간이 비어 있을 수 있습니다. `last_page_id`와 `last_seen_at`으로 이탈 지점을 확인할 수 있습니다.

Supabase SQL Editor에서 바로 확인하는 예시:

```sql
-- 발화 수와 지속 여부만 빠르게 보기
select short_id, status, user_turn_count, duration_ms, min_turns_met, last_seen_at
from public.survey_participants
order by last_seen_at desc;

-- 대화 전문 보기
select short_id, transcript
from public.survey_participants
where response_id = 'xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx';
```

---

## 10. 파일 구조

```text
repo/
├─ functions/
│  └─ api/
│     ├─ chat.js              # Claude 프록시 (POST /api/chat)
│     ├─ persona.js           # 챗봇 성격 설정 + 화면 표시값 (GET /api/persona)
│     └─ health.js            # 상태 확인 (GET /api/health)
├─ supabase/
│  ├─ schema.sql              # 테이블 + 참여자 INSERT RLS
│  └─ admin.sql               # 연구자 읽기 권한 + survey_participants 뷰
├─ survey/
│  ├─ index.html
│  ├─ admin.html              # 연구자 대시보드
│  ├─ css/styles.css
│  ├─ css/admin.css
│  └─ js/
│     ├─ config.js
│     ├─ state.js
│     ├─ app.js
│     ├─ admin.js
│     ├─ ui.js
│     ├─ services/
│     │  ├─ llm.js
│     │  └─ storage.js
│     └─ pages/
│        ├─ intro.js
│        ├─ pre-ai.js
│        ├─ pre-psych.js
│        ├─ post-psych.js
│        ├─ chat.js
│        ├─ evaluation.js
│        └─ ending.js
├─ wrangler.toml
├─ .dev.vars.example
└─ .gitignore
```

---

## 11. 연구 설계 참고

- 최소 3턴은 대화량 분산을 키웁니다. 효과 추정을 안정화하려면 **8턴 고정 종료**를 권장합니다.
- 단일군 사전-사후 설계는 통제군이 없어 인과 주장에 제한이 있습니다.
- 대략적인 검정력(양측 α=.05, power=.80):
  - 대응표본 t검정 d=0.5: 약 34명
  - 독립 2집단 d=0.5: 약 128명 (64/군)
  - 상관 r=0.3: 약 85명
  - 상관 r=0.2: 약 193명
- 중도 이탈을 고려해 **140~160명 모집 → 100명 완료**를 목표로 하세요.
- 모델 ID와 프롬프트 버전(`PERSONA.version`)은 연구 중 변경하지 마세요.
