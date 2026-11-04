/**
 * LLM 어댑터
 * ------------------------------------------------------------
 * 지금은 mock 응답만 사용합니다. 실제 Claude 연동 시
 * config.llm.provider를 'claude'로 바꾸고 callClaude()를
 * 서버 프록시(API 키가 노출되지 않는 곳)에서 호출하도록 구현하세요.
 */
(function (S) {
  S.services = S.services || {};

  var MOCK_REPLIES = [
    '그렇게 느끼셨군요. 조금 더 이야기해 주실 수 있을까요?',
    '말씀해 주셔서 고마워요. 그 상황에서 어떤 감정이 가장 크게 남았나요?',
    '듣고 있어요. 그때 가장 힘들었던 부분은 무엇이었나요?',
    '그런 생각이 드셨던 이유가 궁금해요. 조금 더 들려주실래요?',
    '지금 이야기를 나누면서 어떤 느낌이 드세요?',
    '충분히 그럴 수 있다고 생각해요. 그 마음을 어떻게 표현하고 싶으세요?',
  ];

  function pickReply(text) {
    if (!text) return MOCK_REPLIES[0];
    if (text.indexOf('외로') >= 0) {
      return '외로움을 이야기해 주셨네요. 그 감정이 들 때 주로 무엇을 하시게 되나요?';
    }
    if (text.indexOf('친구') >= 0 || text.indexOf('사람') >= 0) {
      return '사람과의 관계에 대한 이야기군요. 그 관계에서 어떤 점이 가장 마음에 남나요?';
    }
    if (text.indexOf('안녕') >= 0) {
      return '안녕하세요. 반가워요. 오늘은 어떤 이야기를 편하게 나눠볼까요?';
    }
    return MOCK_REPLIES[Math.abs(text.length) % MOCK_REPLIES.length];
  }

  S.services.llm = {
    get config() {
      return S.config.llm;
    },

    /**
     * @param {{ messages: Array<{role:string, content:string}>, character: object, signal?: AbortSignal }} params
     * @returns {Promise<string>}
     */
    async send(params) {
      var provider = this.config.provider;
      if (provider === 'mock') {
        return this.mockReply(params.messages, params.character, params.signal);
      }
      if (provider === 'claude') {
        return this.callClaude(params);
      }
      throw new Error('지원하지 않는 LLM provider입니다: ' + provider);
    },

    mockReply(messages, character, signal) {
      var lastUser = null;
      for (var i = messages.length - 1; i >= 0; i--) {
        if (messages[i].role === 'user') {
          lastUser = messages[i];
          break;
        }
      }
      var text = lastUser ? lastUser.content : '';
      var delay = 550 + Math.min(1100, text.length * 18);

      return new Promise(function (resolve, reject) {
        var timer = setTimeout(function () {
          resolve(pickReply(text));
        }, delay);

        if (signal) {
          if (signal.aborted) {
            clearTimeout(timer);
            reject(new DOMException('Aborted', 'AbortError'));
            return;
          }
          signal.addEventListener('abort', function () {
            clearTimeout(timer);
            reject(new DOMException('Aborted', 'AbortError'));
          }, { once: true });
        }
      });
    },

    /**
     * 실제 Claude 호출 자리입니다.
     * 브라우저에서 직접 호출하면 API 키가 노출되므로 반드시 서버를 경유하세요.
     */
    async callClaude(params) {
      // 서버 프록시에 전달할 요청 본문 구조 예시:
      // {
      //   model: this.config.model,
      //   max_tokens: this.config.maxTokens,
      //   temperature: this.config.temperature,
      //   system: this.buildSystemPrompt(params.character),
      //   messages: this.toClaudeMessages(params.messages),
      // }
      throw new Error(
        'Claude API 연동은 아직 구현되지 않았습니다. ' +
        'config.llm.provider를 mock으로 두거나 서버 프록시를 연결하세요.'
      );
    },

    /** 캐릭터 페르소나를 시스템 프롬프트로 변환하는 구조 */
    buildSystemPrompt(character) {
      return [
        '너는 ' + character.name + '라는 이름의 캐릭터다.',
        character.tagline,
        '사용자의 이야기를 판단하지 않고 듣고, 공감을 표현하되 과도한 조언은 피한다.',
        '위기 상황이나 자해·자살 관련 표현이 나오면 즉시 안전 안내와 전문기관 연계를 우선한다.',
      ].join('\n');
    },

    /** Claude Messages API 형식으로 변환하는 구조 */
    toClaudeMessages(messages) {
      return messages
        .filter(function (m) { return m.role === 'user' || m.role === 'assistant'; })
        .map(function (m) { return { role: m.role, content: m.content }; });
    },
  };
})(window.Survey = window.Survey || {});
