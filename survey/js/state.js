/**
 * 설문 상태
 * ------------------------------------------------------------
 * 현재는 메모리에만 보관합니다. 새로고침하면 초기화됩니다.
 * 실제 저장은 services/storage.js의 어댑터에서 처리하도록 분리했습니다.
 */
(function (S) {
  function createId() {
    if (window.crypto && typeof window.crypto.randomUUID === 'function') {
      return window.crypto.randomUUID();
    }

    // HTTPS가 아닌 환경에서도 Supabase uuid 컬럼에 맞는 v4 UUID를 만듭니다.
    var bytes = new Uint8Array(16);
    if (window.crypto && typeof window.crypto.getRandomValues === 'function') {
      window.crypto.getRandomValues(bytes);
    } else {
      for (var i = 0; i < bytes.length; i++) {
        bytes[i] = Math.floor(Math.random() * 256);
      }
    }
    bytes[6] = (bytes[6] & 0x0f) | 0x40;
    bytes[8] = (bytes[8] & 0x3f) | 0x80;

    var hex = Array.prototype.map.call(bytes, function (b) {
      return b.toString(16).padStart(2, '0');
    }).join('');

    return (
      hex.slice(0, 8) + '-' +
      hex.slice(8, 12) + '-' +
      hex.slice(12, 16) + '-' +
      hex.slice(16, 20) + '-' +
      hex.slice(20)
    );
  }

  S.createInitialState = function () {
    return {
      meta: {
        responseId: createId(),
        consentAt: null,
        startedAt: null,
        completedAt: null,
        currentPage: 0,
        visitedPages: [],
      },

      // 2. 사전 검사: AI 사용 경험
      preAI: {
        perception: '',
        purposes: [],
        usageTime: null,
        usagePeriod: null,
        selfDisclosure: null,
      },

      // 3. 사전 검사: AI 경험 전 심리 상태
      prePsych: {
        loneliness: null,
        isolation: null,
        disclosure: null,
        support: null,
        networkMeet: null,
        networkContact: null,
      },

      // 4. 사후 검사: 현재 심리 상태
      postPsych: {
        loneliness: null,
        isolation: null,
        disclosure: null,
        support: null,
      },

      // 5. AI 챗봇 대화
      chat: {
        started: false,
        ended: false,
        messages: [],
        behavior: {
          startedAt: null,
          firstUserMessageAt: null,
          endedAt: null,
          userTurnCount: 0,
          assistantTurnCount: 0,
          totalUserChars: 0,
          totalAssistantChars: 0,
          minUserTurns: S.config.minUserTurns,
          minTurnsMet: false,
          endedByUser: false,
          endedReason: null,
          llm: {
            model: null,
            promptVersion: null,
            calls: 0,
            inputTokens: 0,
            outputTokens: 0,
            latencyMs: 0,
            errors: 0,
          },
        },
      },

      // 6. AI 챗봇 경험 평가
      evaluation: {
        immersion: null,
        closeness: null,
        empathy: null,
        relief: null,
        continueDesire: null,
      },
    };
  };

  S.state = S.createInitialState();

  S.resetState = function () {
    S.state = S.createInitialState();
    return S.state;
  };
})(window.Survey = window.Survey || {});
