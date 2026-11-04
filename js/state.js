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
    return 'resp-' + Date.now().toString(36) + '-' + Math.random().toString(36).slice(2, 8);
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
        purposes: [],
        purposeOther: '',
        perception: '',
        perceptionOther: '',
        usageTime: null,
        usagePeriod: null,
        selfDisclosure: null,
        disclosureNote: '',
      },

      // 3. 사전 검사: AI 경험 전 심리 상태
      prePsych: {
        loneliness: null,
        support: null,
        baseline: null,
        networkMeet: null,
        networkContact: null,
      },

      // 4. 사후 검사: 현재 심리 상태
      postPsych: {
        loneliness: null,
        support: null,
        baseline: null,
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
        },
      },

      // 6. AI 챗봇 경험 평가
      evaluation: {
        immersion: null,
        closeness: null,
        empathy: null,
        relief: null,
        continueDesire: null,
        feedback: '',
      },
    };
  };

  S.state = S.createInitialState();

  S.resetState = function () {
    S.state = S.createInitialState();
    return S.state;
  };
})(window.Survey = window.Survey || {});
